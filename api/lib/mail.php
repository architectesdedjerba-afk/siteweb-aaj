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
    if (!notification_event_enabled('membership_application')) return;

    global $CONFIG;
    $siteUrl  = rtrim((string)($CONFIG['site']['url'] ?? ''), '/');
    $adminUrl = $siteUrl ? ($siteUrl . '/espace-adherents') : '';
    $adminLink = $adminUrl
        ? '<a href="' . htmlspecialchars($adminUrl, ENT_QUOTES, 'UTF-8') . "\">Traiter la demande dans l'espace adhérents</a>"
        : '';

    $applicantEmail = (string)($app['email'] ?? '');
    $firstName = (string)($app['firstName'] ?? '');
    $lastName  = (string)($app['lastName'] ?? '');
    $fullName  = trim($firstName . ' ' . $lastName) ?: ((string)($app['fullName'] ?? $applicantEmail));

    $vars = [
        'fullName'  => $fullName,
        'firstName' => $firstName,
        'lastName'  => $lastName,
        'email'     => $applicantEmail,
        'phone'     => (string)($app['phone'] ?? ''),
        'category'  => (string)($app['category'] ?? ''),
        'city'      => (string)($app['city'] ?? ''),
        'adminLink' => $adminLink,
    ];

    if ($applicantEmail !== '') {
        $subject = notification_render('membership_application', 'applicantSubject', $vars);
        $html    = notification_render('membership_application', 'applicantHtml', $vars);
        send_mail($applicantEmail, $fullName, $subject, $html);
    }

    $adminSubject = notification_render('membership_application', 'adminSubject', $vars);
    $adminHtml    = notification_render('membership_application', 'adminHtml', $vars);
    foreach (notification_admin_recipients('membership_application') as $adminEmail) {
        send_mail($adminEmail, '', $adminSubject, $adminHtml);
    }
}

function notify_partner_application(array $app): void
{
    if (!notification_event_enabled('partner_application')) return;

    global $CONFIG;
    $siteUrl  = rtrim((string)($CONFIG['site']['url'] ?? ''), '/');
    $adminUrl = $siteUrl ? ($siteUrl . '/espace-adherents') : '';
    $adminLink = $adminUrl
        ? '<a href="' . htmlspecialchars($adminUrl, ENT_QUOTES, 'UTF-8') . "\">Voir dans l'espace adhérents</a>"
        : '';

    $contactEmail = (string)($app['email'] ?? '');
    $contactName  = (string)($app['contactName'] ?? '');

    $vars = [
        'contactName'     => $contactName,
        'company'         => (string)($app['companyName'] ?? ''),
        'email'           => $contactEmail,
        'phone'           => (string)($app['phone'] ?? ''),
        'activity'        => (string)($app['activity'] ?? ''),
        'sponsorshipType' => (string)($app['sponsorshipType'] ?? ''),
        'message'         => (string)($app['message'] ?? ''),
        'adminLink'       => $adminLink,
    ];

    if ($contactEmail !== '') {
        $subject = notification_render('partner_application', 'applicantSubject', $vars);
        $html    = notification_render('partner_application', 'applicantHtml', $vars);
        send_mail($contactEmail, $contactName, $subject, $html);
    }

    $adminSubject = notification_render('partner_application', 'adminSubject', $vars);
    $adminHtml    = notification_render('partner_application', 'adminHtml', $vars);
    foreach (notification_admin_recipients('partner_application') as $adminEmail) {
        send_mail($adminEmail, '', $adminSubject, $adminHtml);
    }
}
