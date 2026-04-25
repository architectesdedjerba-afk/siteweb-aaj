<?php
declare(strict_types=1);

/**
 * Minimal SMTP client — enough for transactional mail on cPanel
 * (no Composer/PHPMailer required). Supports STARTTLS and implicit TLS.
 */

function send_mail(string $toEmail, string $toName, string $subject, string $htmlBody, string $textBody = ''): bool
{
    global $CONFIG;
    $smtp = $CONFIG['smtp'];

    $host = $smtp['host'];
    $port = (int)$smtp['port'];
    $encryption = strtolower((string)($smtp['encryption'] ?? ''));
    $username = $smtp['username'];
    $password = $smtp['password'];
    $fromEmail = $smtp['from_email'];
    $fromName = $smtp['from_name'];

    $remote = $encryption === 'ssl' ? "ssl://$host:$port" : "$host:$port";

    $errno = 0; $errstr = '';
    $socket = @stream_socket_client($remote, $errno, $errstr, 15, STREAM_CLIENT_CONNECT);
    if (!$socket) {
        error_log("SMTP connect failed: $errstr ($errno)");
        return false;
    }
    stream_set_timeout($socket, 15);

    $read = function () use ($socket): string {
        $data = '';
        while (!feof($socket)) {
            $line = fgets($socket, 515);
            if ($line === false) break;
            $data .= $line;
            if (isset($line[3]) && $line[3] === ' ') break;
        }
        return $data;
    };
    $cmd = function (string $c) use ($socket, $read): string {
        fwrite($socket, $c . "\r\n");
        return $read();
    };

    $read(); // greeting
    $cmd('EHLO ' . ($_SERVER['SERVER_NAME'] ?? 'localhost'));

    if ($encryption === 'tls') {
        $cmd('STARTTLS');
        if (!stream_socket_enable_crypto($socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
            error_log('SMTP STARTTLS failed');
            fclose($socket);
            return false;
        }
        $cmd('EHLO ' . ($_SERVER['SERVER_NAME'] ?? 'localhost'));
    }

    if ($username) {
        $cmd('AUTH LOGIN');
        $cmd(base64_encode($username));
        $cmd(base64_encode($password));
    }

    $mailFrom = $cmd("MAIL FROM:<$fromEmail>");
    if (strpos($mailFrom, '250') !== 0) {
        error_log("SMTP MAIL FROM rejected: $mailFrom");
        fclose($socket);
        return false;
    }
    $rcpt = $cmd("RCPT TO:<$toEmail>");
    if (strpos($rcpt, '250') !== 0) {
        error_log("SMTP RCPT TO rejected: $rcpt");
        fclose($socket);
        return false;
    }
    $data = $cmd('DATA');
    if (strpos($data, '354') !== 0) {
        error_log("SMTP DATA rejected: $data");
        fclose($socket);
        return false;
    }

    $boundary = 'aaj_' . bin2hex(random_bytes(8));
    $headers  = [];
    $headers[] = 'From: ' . mb_encode_mimeheader($fromName) . " <$fromEmail>";
    $headers[] = 'To: ' . ($toName !== '' ? (mb_encode_mimeheader($toName) . " <$toEmail>") : "<$toEmail>");
    $headers[] = 'Subject: ' . mb_encode_mimeheader($subject);
    $headers[] = 'MIME-Version: 1.0';
    $headers[] = 'Date: ' . date('r');
    $headers[] = "Content-Type: multipart/alternative; boundary=\"$boundary\"";

    $plain = $textBody !== '' ? $textBody : strip_tags($htmlBody);
    $body  = "--$boundary\r\n";
    $body .= "Content-Type: text/plain; charset=UTF-8\r\n";
    $body .= "Content-Transfer-Encoding: 8bit\r\n\r\n";
    $body .= $plain . "\r\n";
    $body .= "--$boundary\r\n";
    $body .= "Content-Type: text/html; charset=UTF-8\r\n";
    $body .= "Content-Transfer-Encoding: 8bit\r\n\r\n";
    $body .= $htmlBody . "\r\n";
    $body .= "--$boundary--\r\n";

    // Dot-stuffing
    $bodyEscaped = preg_replace('/^\./m', '..', $body);

    fwrite($socket, implode("\r\n", $headers) . "\r\n\r\n" . $bodyEscaped . "\r\n.\r\n");
    $resp = $read();
    $cmd('QUIT');
    fclose($socket);

    $ok = strpos($resp, '250') === 0;
    if (!$ok) {
        error_log("SMTP message rejected for $toEmail: $resp");
    }
    return $ok;
}

/**
 * Admins to notify when a public form comes in. Priority:
 *   1. explicit `smtp.admin_notify` in config.php (string or array of emails)
 *   2. all active super-admins and admins from the `users` table
 *   3. the SMTP from_email as a last-resort fallback
 */
function admin_notify_emails(): array
{
    global $CONFIG;
    $configured = $CONFIG['smtp']['admin_notify'] ?? null;
    if ($configured) {
        $list = is_array($configured) ? $configured : [$configured];
        return array_values(array_filter(array_map('trim', $list)));
    }
    try {
        $stmt = db()->query(
            "SELECT email FROM users
              WHERE email IS NOT NULL AND email <> ''
                AND (role = 'super-admin' OR role = 'admin')
                AND (status IS NULL OR status <> 'archived')"
        );
        $emails = [];
        foreach ($stmt->fetchAll() as $r) {
            if (!empty($r['email'])) $emails[] = $r['email'];
        }
        if ($emails) return $emails;
    } catch (Throwable $e) {
        error_log('admin_notify_emails: ' . $e->getMessage());
    }
    $from = $CONFIG['smtp']['from_email'] ?? '';
    return $from ? [$from] : [];
}

function notify_membership_application(array $app): void
{
    global $CONFIG;
    $siteUrl = rtrim((string)($CONFIG['site']['url'] ?? ''), '/');
    $applicantEmail = (string)($app['email'] ?? '');
    $firstName = htmlspecialchars((string)($app['firstName'] ?? ''), ENT_QUOTES, 'UTF-8');
    $lastName  = htmlspecialchars((string)($app['lastName'] ?? ''), ENT_QUOTES, 'UTF-8');
    $fullName  = trim($firstName . ' ' . $lastName) ?: htmlspecialchars((string)($app['fullName'] ?? $applicantEmail), ENT_QUOTES, 'UTF-8');
    $category  = htmlspecialchars((string)($app['category'] ?? ''), ENT_QUOTES, 'UTF-8');
    $city      = htmlspecialchars((string)($app['city'] ?? ''), ENT_QUOTES, 'UTF-8');
    $phone     = htmlspecialchars((string)($app['phone'] ?? ''), ENT_QUOTES, 'UTF-8');

    // Ack to the applicant
    if ($applicantEmail !== '') {
        $html = "<p>Bonjour $fullName,</p>"
              . "<p>Nous avons bien reçu votre demande d'adhésion à l'Association des "
              . "Architectes de Jerba. Elle est maintenant en cours d'examen par le "
              . "bureau exécutif — vous recevrez une réponse prochainement.</p>"
              . "<p style='color:#555;font-size:13px'>Récapitulatif :<br>"
              . "Nom : $fullName<br>"
              . "Catégorie : $category<br>"
              . "Ville : $city</p>"
              . "<p>— L'équipe AAJ</p>";
        send_mail($applicantEmail, trim($firstName . ' ' . $lastName), "Votre demande d'adhésion à l'AAJ", $html);
    }

    // Notification to admins
    $adminUrl = $siteUrl ? ($siteUrl . '/espace-adherents') : '';
    $htmlAdmin = "<p>Une nouvelle demande d'adhésion vient d'être soumise :</p>"
               . "<ul>"
               . "<li><strong>Nom :</strong> $fullName</li>"
               . "<li><strong>Email :</strong> " . htmlspecialchars($applicantEmail, ENT_QUOTES, 'UTF-8') . "</li>"
               . "<li><strong>Téléphone :</strong> $phone</li>"
               . "<li><strong>Catégorie :</strong> $category</li>"
               . "<li><strong>Ville :</strong> $city</li>"
               . "</ul>"
               . ($adminUrl ? "<p><a href=\"$adminUrl\">Traiter la demande dans l'espace adhérents</a></p>" : '');
    foreach (admin_notify_emails() as $adminEmail) {
        send_mail($adminEmail, '', "Nouvelle demande d'adhésion AAJ : $fullName", $htmlAdmin);
    }

    // Notification in-app à tous les admins/super-admins.
    $rawName = trim((string)($app['firstName'] ?? '') . ' ' . (string)($app['lastName'] ?? ''))
             ?: (string)($app['fullName'] ?? $applicantEmail);
    push_notifications_to_users(admin_recipient_uids(), [
        'type'     => 'membership_application',
        'title'    => 'Nouvelle demande d\'adhésion',
        'body'     => $rawName . ($category !== '' ? ' — ' . html_entity_decode($category, ENT_QUOTES, 'UTF-8') : ''),
        'link'     => '/espace-adherents',
        'icon'     => 'user-plus',
        'priority' => 'high',
        'data'     => ['applicationId' => $app['id'] ?? null, 'email' => $applicantEmail],
    ]);
}

function notify_partner_application(array $app): void
{
    global $CONFIG;
    $siteUrl = rtrim((string)($CONFIG['site']['url'] ?? ''), '/');
    $contactEmail = (string)($app['email'] ?? '');
    $contactName  = htmlspecialchars((string)($app['contactName'] ?? ''), ENT_QUOTES, 'UTF-8');
    $company      = htmlspecialchars((string)($app['companyName'] ?? ''), ENT_QUOTES, 'UTF-8');
    $activity     = htmlspecialchars((string)($app['activity'] ?? ''), ENT_QUOTES, 'UTF-8');
    $sponsorship  = htmlspecialchars((string)($app['sponsorshipType'] ?? ''), ENT_QUOTES, 'UTF-8');
    $phone        = htmlspecialchars((string)($app['phone'] ?? ''), ENT_QUOTES, 'UTF-8');
    $message      = htmlspecialchars((string)($app['message'] ?? ''), ENT_QUOTES, 'UTF-8');

    // Ack to the applicant
    if ($contactEmail !== '') {
        $html = "<p>Bonjour $contactName,</p>"
              . "<p>Nous avons bien reçu votre proposition de partenariat pour $company. "
              . "Notre équipe vous contactera prochainement pour discuter des prochaines "
              . "étapes.</p>"
              . "<p>— L'équipe AAJ</p>";
        send_mail($contactEmail, $contactName, 'Votre proposition de partenariat AAJ', $html);
    }

    $adminUrl = $siteUrl ? ($siteUrl . '/espace-adherents') : '';
    $htmlAdmin = "<p>Nouvelle proposition de partenariat :</p>"
               . "<ul>"
               . "<li><strong>Contact :</strong> $contactName</li>"
               . "<li><strong>Email :</strong> " . htmlspecialchars($contactEmail, ENT_QUOTES, 'UTF-8') . "</li>"
               . "<li><strong>Téléphone :</strong> $phone</li>"
               . "<li><strong>Société :</strong> $company</li>"
               . "<li><strong>Activité :</strong> $activity</li>"
               . "<li><strong>Type de sponsoring :</strong> $sponsorship</li>"
               . "</ul>"
               . ($message !== '' ? "<p><strong>Message :</strong><br>" . nl2br($message) . "</p>" : '')
               . ($adminUrl ? "<p><a href=\"$adminUrl\">Voir dans l'espace adhérents</a></p>" : '');
    foreach (admin_notify_emails() as $adminEmail) {
        send_mail($adminEmail, '', 'Nouvelle proposition de partenariat AAJ', $htmlAdmin);
    }

    $rawCompany = (string)($app['companyName'] ?? '');
    $rawContact = (string)($app['contactName'] ?? '');
    push_notifications_to_users(admin_recipient_uids(), [
        'type'     => 'partner_application',
        'title'    => 'Nouvelle proposition de partenariat',
        'body'     => trim($rawCompany . ($rawContact ? ' — ' . $rawContact : '')),
        'link'     => '/espace-adherents',
        'icon'     => 'briefcase',
        'priority' => 'normal',
        'data'     => ['applicationId' => $app['id'] ?? null, 'email' => $contactEmail],
    ]);
}
