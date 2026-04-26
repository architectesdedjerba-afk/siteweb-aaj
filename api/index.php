<?php
declare(strict_types=1);

/**
 * AAJ API router — all requests arriving at /api/* are routed here
 * by the bundled .htaccess.
 *
 * Path conventions (same-origin; JWT in httpOnly cookie):
 *   POST   /api/auth/login
 *   POST   /api/auth/logout
 *   GET    /api/auth/me
 *   POST   /api/auth/password-reset/request
 *   POST   /api/auth/password-reset/verify
 *   POST   /api/auth/password-reset/confirm
 *   POST   /api/auth/accounts (super-admin / accounts.create)
 *
 *   GET    /api/collections/{name}                list
 *   POST   /api/collections/{name}                create
 *   GET    /api/collections/{name}/{id}           get
 *   PUT    /api/collections/{name}/{id}           update
 *   DELETE /api/collections/{name}/{id}           delete
 *
 *   POST   /api/files                             upload (multipart)
 *   GET    /api/files/{id}                        stream/download
 *   DELETE /api/files/{id}                        delete
 *
 *   GET    /api/health
 */

require_once __DIR__ . '/lib/bootstrap.php';

set_exception_handler(function (Throwable $e) {
    error_log('[api] ' . $e->getMessage() . "\n" . $e->getTraceAsString());
    json_error('server_error', 'Erreur interne du serveur.', 500);
});

// Strip the leading script path so we can route on the logical path.
$rawUri = (string)($_SERVER['REQUEST_URI'] ?? '/');
$path = parse_url($rawUri, PHP_URL_PATH) ?: '/';
// Normalise: keep only the part after /api/
if (preg_match('#/api/?(.*)$#', $path, $m)) {
    $path = '/' . $m[1];
} else {
    $path = '/' . ltrim($path, '/');
}
$path = rtrim($path, '/');
if ($path === '') $path = '/';

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
if ($method === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$segments = $path === '/' ? [''] : explode('/', ltrim($path, '/'));

try {
    // Seed default roles + apply schema migrations on every cold start;
    // both are idempotent and cheap.
    seed_default_roles_if_missing();
    run_auto_migrations();

    $root = $segments[0] ?? '';

    if ($root === 'health') {
        json_response(['ok' => true, 'time' => gmdate('c')]);
    }

    if ($root === 'auth') {
        require __DIR__ . '/endpoints/auth.php';
        handle_auth($method, array_slice($segments, 1));
    }

    if ($root === 'collections') {
        require __DIR__ . '/endpoints/collections.php';
        handle_collections($method, array_slice($segments, 1));
    }

    if ($root === 'files') {
        require __DIR__ . '/endpoints/files.php';
        handle_files($method, array_slice($segments, 1));
    }

    if ($root === 'unesco') {
        require __DIR__ . '/endpoints/unesco.php';
        handle_unesco($method, array_slice($segments, 1));
    }

    if ($root === 'notifications') {
        require __DIR__ . '/endpoints/notifications.php';
        handle_notifications($method, array_slice($segments, 1));
    }

    json_error('not_found', 'Endpoint inconnu.', 404);
} catch (PDOException $e) {
    error_log('[api-db] ' . $e->getMessage());
    json_error('db_error', 'Erreur base de données.', 500);
}
