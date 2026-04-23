<?php
declare(strict_types=1);

/**
 * Create (or refresh) a super-admin account.
 *
 * Usage on cPanel (Terminal / SSH):
 *   cd ~/public_html/api
 *   php scripts/bootstrap-admin.php "email@domaine.tn" "MotDePasse*2026" "Super Admin"
 *
 * Or with env vars:
 *   ADMIN_EMAIL=... ADMIN_PASSWORD=... ADMIN_NAME=... php scripts/bootstrap-admin.php
 */

if (php_sapi_name() !== 'cli') {
    http_response_code(403);
    exit("CLI only.\n");
}

require_once __DIR__ . '/../lib/bootstrap.php';

$email = strtolower(trim((string)($argv[1] ?? $_ENV['ADMIN_EMAIL'] ?? getenv('ADMIN_EMAIL') ?? '')));
$password = (string)($argv[2] ?? $_ENV['ADMIN_PASSWORD'] ?? getenv('ADMIN_PASSWORD') ?? '');
$name = (string)($argv[3] ?? $_ENV['ADMIN_NAME'] ?? getenv('ADMIN_NAME') ?? 'Super Admin');

if ($email === '' || $password === '' || strlen($password) < 6) {
    fwrite(STDERR, "Usage : php bootstrap-admin.php <email> <password (6+ chars)> [name]\n");
    exit(1);
}

seed_default_roles_if_missing();

$pdo = db();
$stmt = $pdo->prepare('SELECT uid FROM users WHERE email = ? LIMIT 1');
$stmt->execute([$email]);
$row = $stmt->fetch();

$hash = password_hash($password, PASSWORD_BCRYPT);

if ($row) {
    $pdo->prepare(
        'UPDATE users SET password_hash = ?, must_reset = 0, display_name = ?, role = ?, status = ? WHERE uid = ?'
    )->execute([$hash, $name, 'super-admin', 'active', $row['uid']]);
    echo "✅ Compte existant mis à jour : {$email} → super-admin/active\n";
} else {
    $uid = new_id(24);
    $pdo->prepare(
        'INSERT INTO users (uid, email, password_hash, display_name, role, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW())'
    )->execute([$uid, $email, $hash, $name, 'super-admin', 'active']);
    echo "✅ Compte créé : {$email} → super-admin/active (uid={$uid})\n";
}

echo "\n🎉 Connectez-vous sur /espace-adherents avec :\n   Email : {$email}\n   Password : (celui fourni)\n";
