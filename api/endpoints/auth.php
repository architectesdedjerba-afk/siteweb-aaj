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

        $html = "<p>Bonjour,</p>"
              . "<p>Vous avez demandé la réinitialisation de votre mot de passe pour l'espace adhérents des Architectes de Jerba.</p>"
              . "<p><a href=\"$url\">Réinitialiser mon mot de passe</a></p>"
              . "<p>Ce lien expire dans 1 heure. Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.</p>";
        send_mail($user['email'], $user['display_name'] ?? '', 'Réinitialisation de votre mot de passe', $html);
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
 * Create a new account — used by admins from the espace-adhérent.
 * Requires `accounts.create` permission.
 */
function auth_create_account(): void
{
    $actor = require_auth();
    require_permission($actor, 'accounts_create');

    $body = read_json_body();
    $email = strtolower(trim((string)($body['email'] ?? '')));
    $password = (string)($body['password'] ?? '');
    $displayName = trim((string)($body['displayName'] ?? ''));
    if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        json_error('invalid_email', 'Email invalide.', 400);
    }
    if (strlen($password) < 6) {
        json_error('weak_password', 'Mot de passe trop court (6 caractères min).', 400);
    }
    if ($displayName === '') $displayName = $email;

    $pdo = db();
    $exists = $pdo->prepare('SELECT 1 FROM users WHERE email = ? LIMIT 1');
    $exists->execute([$email]);
    if ($exists->fetch()) {
        json_error('email_taken', 'Un compte existe déjà avec cet email.', 409);
    }

    $uid = new_id(24);
    $pdo->prepare(
        'INSERT INTO users
            (uid, email, password_hash, display_name, first_name, last_name,
             role, status, category, license_number, mobile, address, cotisations, created_at)
         VALUES
            (:uid, :email, :password_hash, :display_name, :first_name, :last_name,
             :role, :status, :category, :license_number, :mobile, :address, :cotisations, NOW())'
    )->execute([
        ':uid' => $uid,
        ':email' => $email,
        ':password_hash' => password_hash($password, PASSWORD_BCRYPT),
        ':display_name' => $displayName,
        ':first_name' => $body['firstName'] ?? null,
        ':last_name' => $body['lastName'] ?? null,
        ':role' => (string)($body['role'] ?? 'member'),
        ':status' => (string)($body['status'] ?? 'active'),
        ':category' => $body['category'] ?? null,
        ':license_number' => $body['licenseNumber'] ?? null,
        ':mobile' => $body['mobile'] ?? null,
        ':address' => $body['address'] ?? null,
        ':cotisations' => isset($body['cotisations']) ? json_encode($body['cotisations'], JSON_UNESCAPED_UNICODE) : null,
    ]);

    $row = $pdo->prepare('SELECT * FROM users WHERE uid = ? LIMIT 1');
    $row->execute([$uid]);
    json_response(['ok' => true, 'user' => user_profile_view($row->fetch())]);
}
