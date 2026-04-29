<?php
declare(strict_types=1);

function db(): PDO
{
    global $CONFIG;
    static $pdo = null;
    if ($pdo !== null) return $pdo;

    $db = $CONFIG['db'];
    $dsn = sprintf(
        'mysql:host=%s;port=%d;dbname=%s;charset=%s',
        $db['host'],
        $db['port'] ?? 3306,
        $db['name'],
        $db['charset'] ?? 'utf8mb4'
    );
    $pdo = new PDO($dsn, $db['user'], $db['password'], [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ]);
    $pdo->exec("SET time_zone = '+00:00'");
    return $pdo;
}

/**
 * Ensure a column exists on a table — self-healing micro-migration.
 *
 * Used to roll out small schema additions without requiring the admin
 * to manually run the migration script on cPanel (idempotent & cached
 * per-request).
 *
 * @param string $table      Table name (unquoted, whitelisted internally).
 * @param string $column     Column name (unquoted, whitelisted internally).
 * @param string $definition Column definition (e.g. "DATETIME NULL").
 */
function ensure_column(string $table, string $column, string $definition): void
{
    // Hard whitelist — only the columns we know we may need to add.
    // Prevents this helper from being abused to run arbitrary DDL.
    static $allowed = [
        'users' => [
            'archived_at'         => 'DATETIME NULL',
            'trial_started_at'    => 'DATETIME NULL',
            'trial_first_used_at' => 'DATETIME NULL',
        ],
        'commission_pvs' => [
            'files'       => 'JSON NULL',
            'type'        => 'VARCHAR(100) NULL',
            'archived_at' => 'DATETIME NULL',
        ],
    ];
    static $done = [];

    $key = "$table.$column";
    if (isset($done[$key])) return;

    if (!isset($allowed[$table][$column]) || $allowed[$table][$column] !== $definition) {
        $done[$key] = true;
        return;
    }

    try {
        $pdo = db();
        $check = $pdo->prepare(
            "SELECT COUNT(*) AS c
             FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME   = ?
               AND COLUMN_NAME  = ?"
        );
        $check->execute([$table, $column]);
        $exists = (int) ($check->fetch()['c'] ?? 0) > 0;

        if (!$exists) {
            // Identifiers are whitelisted above; safe to interpolate.
            $pdo->exec("ALTER TABLE `$table` ADD COLUMN `$column` $definition");
        }
    } catch (Throwable $e) {
        // Don't break the request if the migration fails — the caller
        // will surface the original SQL error if the column is still
        // missing. Log for post-mortem.
        error_log("ensure_column($table, $column) failed: " . $e->getMessage());
    }

    $done[$key] = true;
}
