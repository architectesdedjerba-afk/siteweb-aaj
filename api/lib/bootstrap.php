<?php
declare(strict_types=1);

/**
 * Bootstrap — loads config, sets up PDO, starts the session cookie,
 * and exposes helpers used by every endpoint.
 */

date_default_timezone_set('UTC');
mb_internal_encoding('UTF-8');

$configPath = __DIR__ . '/../config.php';
if (!file_exists($configPath)) {
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'error' => 'server_misconfigured',
        'message' => 'api/config.php manquant. Copier api/config.example.php et renseigner les secrets.',
    ]);
    exit;
}

/** @var array $CONFIG */
$CONFIG = require $configPath;

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/json.php';
require_once __DIR__ . '/jwt.php';
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/permissions.php';
require_once __DIR__ . '/ids.php';
require_once __DIR__ . '/mail.php';
require_once __DIR__ . '/migrations.php';
