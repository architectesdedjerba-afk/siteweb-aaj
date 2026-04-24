<?php
/**
 * AAJ API configuration.
 *
 * Copy this file to `config.php` on the server and fill in the values.
 * `config.php` is gitignored and protected from direct HTTP access by
 * the bundled .htaccess.
 */

return [
    // ---- Database (cPanel → MySQL Databases) ----
    'db' => [
        'host'     => 'localhost',
        'port'     => 3306,
        'name'     => 'cpaneluser_aaj',
        'user'     => 'cpaneluser_aaj',
        'password' => 'CHANGE_ME',
        'charset'  => 'utf8mb4',
    ],

    // ---- JWT (session tokens stored in an httpOnly cookie) ----
    // Generate a long random secret (e.g. `openssl rand -base64 48`)
    'jwt' => [
        'secret'        => 'CHANGE_ME_TO_A_LONG_RANDOM_SECRET',
        'issuer'        => 'aaj-api',
        'audience'      => 'aaj-web',
        'ttl_seconds'   => 60 * 60 * 24 * 7, // 7 days
        'cookie_name'   => 'aaj_session',
        'cookie_secure' => true, // set to false for local HTTP testing only
    ],

    // ---- Site ----
    'site' => [
        'url'          => 'https://votre-domaine.tn',
        'reset_path'   => '/reset-password', // frontend route; token appended as ?oobCode=
        'uploads_base' => '/api/files',      // public download prefix
    ],

    // ---- SMTP (cPanel → Email Accounts) ----
    'smtp' => [
        'host'       => 'mail.votre-domaine.tn',
        'port'       => 587,
        'encryption' => 'tls', // 'tls' | 'ssl' | ''
        'username'   => 'no-reply@votre-domaine.tn',
        'password'   => 'CHANGE_ME',
        'from_email' => 'no-reply@votre-domaine.tn',
        'from_name'  => 'Architectes de Jerba',
    ],

    // ---- Uploads ----
    'uploads' => [
        // Storage path. Default is inside /api (protected by .htaccess).
        // For extra safety, move it above the webroot and set the absolute path here.
        'storage_dir'  => __DIR__ . '/uploads-storage',
        // App-level cap for most folders. Set to 0 to disable (PHP ini
        // limits still apply — see api/.user.ini). Folders listed in
        // $unlimitedFolders inside files.php bypass this cap regardless.
        'max_bytes'    => 200 * 1024 * 1024, // 200 MB
        'allowed_mime' => [
            'image/jpeg', 'image/png', 'image/gif', 'image/webp',
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ],
    ],
];
