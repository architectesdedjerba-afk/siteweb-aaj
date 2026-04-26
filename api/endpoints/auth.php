<?php
declare(strict_types=1);

function handle_auth(string $method, array $rest): void
{
    $sub = $rest[0] ?? '';

    if ($sub === 'login' && $method === 'POST') {
        auth_login(); return;
    }
    if ($sub === 'logout' && $method === 'POST') {
        auth_logout(); return;
    }
    if ($sub === 'me' && $method === 'GET') {
        auth_me(); return;
    }
    if ($sub === 'password-reset') {
        $action = $rest[1] ?? '';
        if ($action === 'request' && $method === 'POST') { auth_reset_request(); return; }
        if ($action === 'verify' && $method === 'POST') { auth_reset_verify(); return; }
        if ($action === 'confirm' && $method === 'POST') { auth_reset_confirm(); return; }
    }
    if ($sub === 'accounts' && $method === 'POST') {
        auth_create_account(); return;
    }
    if ($sub === 'password' && $method === 'POST') {
        auth_password_change(); return;
    }
    if ($sub === 'test-mail' && $method === 'POST') {
        auth_test_mail(); return;
    }

    json_error('not_found', 'Endpoint auth inconnu.', 404);
}

function auth_login(): void
{
    $body = read_json_body();
    $email = strtolower(trim((string)($body['email'] ?? '')));
    $password = (string)($body['password'] ?? '');
    if ($email === '' || $password === '') {
        json_error('invalid_credentials', 'Email et mot de passe requis.', 400);
    }

    $stmt = db()->prepare('SELECT * FROM users WHERE email = ? LIMIT 1');
    $stmt->execute([$email]);
    $user = $stmt->fetch();
    if (!$user || !$user['password_hash'] || !password_verify($password, (string)$user['password_hash'])) {
        json_error('invalid_credentials', 'Identifiants invalides.', 401);
    }

    $token = jwt_sign(['uid' => $user['uid'], 'email' => $user['email']]);
    jwt_cookie_set($token);

    json_response([
        'ok'      => true,
        'user'    => user_profile_view($user),
        'role'    => load_role_for_user($user),
    ]);
}

function auth_logout(): void
{
    jwt_cookie_clear();
    json_response(['ok' => true]);
}

function auth_me(): void
{
    $user = current_user();
    if (!$user) {
        json_response(['user' => null, 'role' => null]);
    }
    json_response([
        'user' => user_profile_view($user),
        'role' => load_role_for_user($user),
    ]);
}

function auth_reset_request(): void
{
    global $CONFIG;
    $body = read_json_body();
    $email = strtolower(trim((string)($body['email'] ?? '')));
    if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        json_error('invalid_email', 'Email invalide.', 400);
    }

    $stmt = db()->prepare('SELECT * FROM users WHERE email = ? LIMIT 1');
    $stmt->execute([$email]);
    $user = $stmt->fetch();

    // Always answer ok (don't leak account existence), but only send if user exists.
    if ($user) {
        $token = new_token(32);
        $expires = gmdate('Y-m-d H:i:s', time() + 3600); // 1h TTL
        $ins = db()->prepare(
            'INSERT INTO password_resets (token, uid, email, expires_at) VALUES (?, ?, ?, ?)'
        );
        $ins->execute([$token, $user['uid'], $user['email'], $expires]);

        $url = rtrim((string)$CONFIG['site']['url'], '/')
             . ($CONFIG['site']['reset_path'] ?? '/reset-password')
             . '?oobCode=' . urlencode($token);

        if (notification_event_enabled('password_reset')) {
            $vars = [
                'name'     => (string)($user['display_name'] ?? ''),
                'email'    => (string)$user['email'],
                'resetUrl' => $url,
            ];
            $subject = notification_render('password_reset', 'subject', $vars);
            $html    = notification_render('password_reset', 'html', $vars);
            send_mail($user['email'], $user['display_name'] ?? '', $subject, $html);
        }
    }

    json_response(['ok' => true]);
}

function auth_reset_verify(): void
{
    $body = read_json_body();
    $token = (string)($body['oobCode'] ?? $body['token'] ?? '');
    if ($token === '') json_error('invalid_token', 'Jeton manquant.', 400);

    $stmt = db()->prepare('SELECT * FROM password_resets WHERE token = ? LIMIT 1');
    $stmt->execute([$token]);
    $row = $stmt->fetch();
    if (!$row || $row['used_at'] !== null || strtotime((string)$row['expires_at']) < time()) {
        json_error('invalid_token', 'Lien invalide ou expiré.', 400);
    }
    json_response(['ok' => true, 'email' => $row['email']]);
}

function auth_reset_confirm(): void
{
    $body = read_json_body();
    $token = (string)($body['oobCode'] ?? $body['token'] ?? '');
    $password = (string)($body['password'] ?? '');
    if ($token === '' || strlen($password) < 6) {
        json_error('invalid_input', 'Jeton manquant ou mot de passe trop court (6 caractères min).', 400);
    }

    $pdo = db();
    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare('SELECT * FROM password_resets WHERE token = ? FOR UPDATE');
        $stmt->execute([$token]);
        $row = $stmt->fetch();
        if (!$row || $row['used_at'] !== null || strtotime((string)$row['expires_at']) < time()) {
            $pdo->rollBack();
            json_error('invalid_token', 'Lien invalide ou expiré.', 400);
        }

        $hash = password_hash($password, PASSWORD_BCRYPT);
        $pdo->prepare('UPDATE users SET password_hash = ?, must_reset = 0 WHERE uid = ?')
            ->execute([$hash, $row['uid']]);
        $pdo->prepare('UPDATE password_resets SET used_at = NOW() WHERE token = ?')->execute([$token]);
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }

    json_response(['ok' => true]);
}

/**
 * Generate a readable temporary password (no ambiguous characters like 0/O, 1/l/I).
 * Used for admin-created accounts; the user is forced to replace it on first login.
 */
function generate_temp_password(int $length = 12): string
{
    $alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    $max = strlen($alphabet) - 1;
    $out = '';
    for ($i = 0; $i < $length; $i++) {
        $out .= $alphabet[random_int(0, $max)];
    }
    return $out;
}

function send_welcome_email(string $toEmail, string $toName, string $tempPassword): bool
{
    if (!notification_event_enabled('account_created')) return true;

    global $CONFIG;
    $loginUrl = rtrim((string)$CONFIG['site']['url'], '/') . '/espace-adherents';

    $vars = [
        'name'         => $toName !== '' ? $toName : $toEmail,
        'email'        => $toEmail,
        'tempPassword' => $tempPassword,
        'loginUrl'     => $loginUrl,
    ];
    $subject = notification_render('account_created', 'subject', $vars);
    $html    = notification_render('account_created', 'html', $vars);

    return send_mail($toEmail, $toName, $subject, $html);
}

/**
 * Create a new account — used by admins from the espace-adhérent.
 * Requires `accounts.create` permission.
 *
 * The password is always generated server-side and emailed to the new user;
 * the account is flagged `must_reset = 1` so the frontend forces a password
 * change on the first successful login.
 */
function auth_create_account(): void
{
    $actor = require_auth();
    require_permission($actor, 'accounts_create');

    $body = read_json_body();
    $email = strtolower(trim((string)($body['email'] ?? '')));
    $displayName = trim((string)($body['displayName'] ?? ''));
    if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        json_error('invalid_email', 'Email invalide.', 400);
    }
    if ($displayName === '') $displayName = $email;

    $pdo = db();
    $exists = $pdo->prepare('SELECT 1 FROM users WHERE email = ? LIMIT 1');
    $exists->execute([$email]);
    if ($exists->fetch()) {
        json_error('email_taken', 'Un compte existe déjà avec cet email.', 409);
    }

    $tempPassword = generate_temp_password(12);

    $uid = new_id(24);
    $letter = $body['memberTypeLetter'] ?? null;
    if ($letter !== null) $letter = strtoupper(substr((string)$letter, 0, 1));
    $pdo->prepare(
        'INSERT INTO users
            (uid, email, password_hash, must_reset, display_name, first_name, last_name,
             role, status, category, member_type, member_type_letter, birth_date,
             license_number, mobile, address, cotisations, created_at)
         VALUES
            (:uid, :email, :password_hash, 1, :display_name, :first_name, :last_name,
             :role, :status, :category, :member_type, :member_type_letter, :birth_date,
             :license_number, :mobile, :address, :cotisations, NOW())'
    )->execute([
        ':uid' => $uid,
        ':email' => $email,
        ':password_hash' => password_hash($tempPassword, PASSWORD_BCRYPT),
        ':display_name' => $displayName,
        ':first_name' => $body['firstName'] ?? null,
        ':last_name' => $body['lastName'] ?? null,
        ':role' => (string)($body['role'] ?? 'member'),
        ':status' => (string)($body['status'] ?? 'active'),
        ':category' => $body['category'] ?? null,
        ':member_type' => $body['memberType'] ?? null,
        ':member_type_letter' => $letter,
        ':birth_date' => $body['birthDate'] ?? null,
        ':license_number' => $body['licenseNumber'] ?? null,
        ':mobile' => $body['mobile'] ?? null,
        ':address' => $body['address'] ?? null,
        ':cotisations' => isset($body['cotisations']) ? json_encode($body['cotisations'], JSON_UNESCAPED_UNICODE) : null,
    ]);

    $emailSent = send_welcome_email($email, $displayName, $tempPassword);

    $row = $pdo->prepare('SELECT * FROM users WHERE uid = ? LIMIT 1');
    $row->execute([$uid]);
    json_response([
        'ok'           => true,
        'user'         => user_profile_view($row->fetch()),
        'emailSent'    => $emailSent,
        // The admin that just created the account is allowed to see the
        // one-shot password — they need it to pass on if the welcome email
        // fails (spam, SPF/DKIM issues, typo, etc.). The account is
        // `must_reset=1` anyway so this value is only usable for first login.
        'tempPassword' => $tempPassword,
    ]);
}

/**
 * Super-admin SMTP diagnostic. Attempts to send a minimal test email to the
 * address supplied in the request (or the caller's own email) and returns
 * whether it worked + any buffered error_log lines. Used from the admin UI
 * when welcome / reset emails are not arriving.
 */
function auth_test_mail(): void
{
    global $CONFIG;
    $actor = require_auth();
    require_super_admin($actor);

    $body = read_json_body();
    $to = strtolower(trim((string)($body['to'] ?? $actor['email'] ?? '')));
    if ($to === '' || !filter_var($to, FILTER_VALIDATE_EMAIL)) {
        json_error('invalid_email', 'Email destinataire invalide.', 400);
    }

    // Give the diagnostic a hard budget so we always return JSON. send_mail's
    // internal 15s-per-read loop can otherwise pile up past max_execution_time
    // when the SMTP server hangs, which shows as "Failed to fetch" in the UI.
    @set_time_limit(30);

    $host = (string)($CONFIG['smtp']['host'] ?? '');
    $port = (int)($CONFIG['smtp']['port'] ?? 0);
    $encryption = strtolower((string)($CONFIG['smtp']['encryption'] ?? ''));

    $buffer = [];
    $tmpLog = @tempnam(sys_get_temp_dir(), 'aaj-mail-');
    $originalErrorLog = (string)ini_get('error_log');
    if ($tmpLog !== false) @ini_set('error_log', $tmpLog);

    $tcpOk = null;
    $tcpErrno = 0;
    $tcpErrstr = '';
    $elapsedMs = 0;
    $ok = false;

    // Swallow any stray output from mail.php warnings so the JSON stays clean.
    if (ob_get_level() === 0) ob_start();

    try {
        // 1. Fast TCP pre-check (3s) — skipped if host/port look wrong.
        if ($host !== '' && $port > 0) {
            $remote = $encryption === 'ssl' ? "ssl://$host:$port" : "$host:$port";
            $ctx = stream_context_create();
            $t0 = microtime(true);
            $probe = @stream_socket_client($remote, $tcpErrno, $tcpErrstr, 3, STREAM_CLIENT_CONNECT, $ctx);
            $tcpOk = (bool)$probe;
            if ($probe) fclose($probe);
            if (!$tcpOk) {
                $buffer[] = "TCP probe failed: $tcpErrstr (errno=$tcpErrno)";
            }
        } else {
            $buffer[] = 'SMTP host/port not configured.';
        }

        // 2. Full SMTP send — only attempted if the probe succeeded.
        if ($tcpOk) {
            $t0 = microtime(true);
            $ok = @send_mail(
                $to,
                (string)($actor['display_name'] ?? ''),
                'Test SMTP — Architectes de Jerba',
                '<p>Ceci est un email de test envoyé depuis l\'espace admin AAJ.</p>'
                . '<p>Si vous recevez ce message, la configuration SMTP fonctionne.</p>'
            );
            $elapsedMs = (int)round((microtime(true) - $t0) * 1000);
        }
    } catch (Throwable $e) {
        $buffer[] = 'Exception: ' . $e->getMessage();
    }

    // Drop any captured output (SSL warnings, etc.) so the response is pure JSON.
    if (ob_get_level() > 0) { $stray = ob_get_clean(); if ($stray !== false && $stray !== '') $buffer[] = 'stdout: ' . trim($stray); }

    if ($tmpLog !== false) {
        @ini_set('error_log', $originalErrorLog);
        $raw = @file_get_contents($tmpLog);
        if ($raw !== false) {
            foreach (explode("\n", $raw) as $line) {
                $line = trim($line);
                if ($line !== '') $buffer[] = $line;
            }
        }
        @unlink($tmpLog);
    }

    json_response([
        'ok'        => $ok,
        'to'        => $to,
        'tcpOk'     => $tcpOk,
        'elapsedMs' => $elapsedMs,
        'smtp'      => [
            'host'       => $host,
            'port'       => $port,
            'encryption' => $encryption,
            'from_email' => (string)($CONFIG['smtp']['from_email'] ?? ''),
            'from_name'  => (string)($CONFIG['smtp']['from_name'] ?? ''),
            'has_password' => !empty($CONFIG['smtp']['password']),
        ],
        'log'       => $buffer,
    ]);
}

/**
 * Change the current user's password. Used both for the forced first-login
 * change (must_reset = 1, no current password required — the temp password
 * was just used to log in) and for voluntary password changes (which require
 * the current password to be supplied).
 */
function auth_password_change(): void
{
    $user = require_auth();
    $body = read_json_body();
    $newPassword = (string)($body['password'] ?? $body['newPassword'] ?? '');
    $currentPassword = (string)($body['currentPassword'] ?? '');

    if (strlen($newPassword) < 6) {
        json_error('weak_password', 'Mot de passe trop court (6 caractères min).', 400);
    }

    $mustReset = (int)($user['must_reset'] ?? 0) === 1;
    if (!$mustReset) {
        if ($currentPassword === '' ||
            !password_verify($currentPassword, (string)($user['password_hash'] ?? ''))) {
            json_error('invalid_current_password', 'Mot de passe actuel incorrect.', 401);
        }
    }

    $hash = password_hash($newPassword, PASSWORD_BCRYPT);
    db()->prepare('UPDATE users SET password_hash = ?, must_reset = 0 WHERE uid = ?')
        ->execute([$hash, $user['uid']]);

    $get = db()->prepare('SELECT * FROM users WHERE uid = ? LIMIT 1');
    $get->execute([$user['uid']]);
    json_response(['ok' => true, 'user' => user_profile_view($get->fetch())]);
}
