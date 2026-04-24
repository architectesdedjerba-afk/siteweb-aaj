<?php
declare(strict_types=1);

/**
 * Lightweight auto-migrations — invoked on every API cold start alongside
 * seed_default_roles_if_missing(). Each helper must be idempotent and cheap
 * enough to run on every request on a shared-hosting setup.
 *
 * We probe `information_schema.COLUMNS` instead of relying on MariaDB's
 * `ADD COLUMN IF NOT EXISTS` so the code works on any MySQL 5.7+ / MariaDB
 * 10.0+ install. Same story for indexes / tables: check first, then alter.
 */

function column_exists(string $table, string $column): bool
{
    $stmt = db()->prepare(
        'SELECT 1
           FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME   = :t
            AND COLUMN_NAME  = :c
          LIMIT 1'
    );
    $stmt->execute([':t' => $table, ':c' => $column]);
    return (bool)$stmt->fetchColumn();
}

/**
 * Migration 001 — expand membership_applications so the public
 * /demander-adhesion form collects the same data as the admin
 * "Ajouter un membre" modal (firstName, lastName, birthDate,
 * memberTypeLetter). matricule becomes nullable because the AAJ
 * matricule is attributed later, at admin approval time.
 */
function migration_001_membership_application_fields(): void
{
    $table = 'membership_applications';
    $pdo = db();

    if (!column_exists($table, 'first_name')) {
        $pdo->exec("ALTER TABLE `$table` ADD COLUMN `first_name` VARCHAR(100) NULL AFTER `full_name`");
    }
    if (!column_exists($table, 'last_name')) {
        $pdo->exec("ALTER TABLE `$table` ADD COLUMN `last_name` VARCHAR(100) NULL AFTER `first_name`");
    }
    if (!column_exists($table, 'birth_date')) {
        $pdo->exec("ALTER TABLE `$table` ADD COLUMN `birth_date` VARCHAR(10) NULL AFTER `city`");
    }
    if (!column_exists($table, 'member_type_letter')) {
        $pdo->exec("ALTER TABLE `$table` ADD COLUMN `member_type_letter` CHAR(1) NULL AFTER `birth_date`");
    }

    // Drop the NOT NULL on matricule so new public submissions can defer
    // the AAJ matricule to the approval step. Only touch it if still NOT NULL.
    $null = $pdo->prepare(
        'SELECT IS_NULLABLE
           FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME   = :t
            AND COLUMN_NAME  = :c
          LIMIT 1'
    );
    $null->execute([':t' => $table, ':c' => 'matricule']);
    $isNullable = $null->fetchColumn();
    if ($isNullable === 'NO') {
        $pdo->exec("ALTER TABLE `$table` MODIFY COLUMN `matricule` VARCHAR(100) NULL");
    }

    // Backfill first_name / last_name from legacy full_name rows (best-effort
    // split on the first whitespace). Touches only rows where first_name is
    // still NULL, so it's a no-op once applied.
    $pdo->exec(
        "UPDATE `$table`
            SET first_name = TRIM(SUBSTRING_INDEX(full_name, ' ', 1)),
                last_name  = TRIM(SUBSTRING(full_name, LOCATE(' ', full_name) + 1))
          WHERE first_name IS NULL
            AND full_name IS NOT NULL
            AND full_name <> ''"
    );
}

function run_auto_migrations(): void
{
    try {
        migration_001_membership_application_fields();
    } catch (Throwable $e) {
        // Never break the request if a migration fails; surface in error_log so
        // ops can grep production logs instead of seeing a 500.
        error_log('[migrations] ' . $e->getMessage());
    }
}
