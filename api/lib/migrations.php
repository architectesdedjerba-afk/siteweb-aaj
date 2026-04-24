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

function table_exists(string $table): bool
{
    $stmt = db()->prepare(
        'SELECT 1
           FROM information_schema.TABLES
          WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME   = :t
          LIMIT 1'
    );
    $stmt->execute([':t' => $table]);
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

/**
 * Migration 002 — UNESCO Djerba tables. Idempotent: CREATE TABLE IF NOT EXISTS.
 * See api/migrations/002_unesco.sql for the raw DDL applied manually.
 */
function migration_002_unesco_tables(): void
{
    $pdo = db();

    $ddl = [
        'unesco_kmz_sources' => <<<'SQL'
CREATE TABLE IF NOT EXISTS unesco_kmz_sources (
  id            VARCHAR(64)  NOT NULL,
  title         VARCHAR(200) NOT NULL,
  description   TEXT NULL,
  kmz_file_id   VARCHAR(64)  NULL,
  geojson_path  VARCHAR(500) NULL,
  bbox          JSON NULL,
  feature_count INT NOT NULL DEFAULT 0,
  is_active     TINYINT(1) NOT NULL DEFAULT 1,
  sort_order    INT NOT NULL DEFAULT 0,
  created_by    VARCHAR(64) NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_unesco_kmz_active (is_active, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
SQL,
        'unesco_zones' => <<<'SQL'
CREATE TABLE IF NOT EXISTS unesco_zones (
  id                VARCHAR(64)  NOT NULL,
  kmz_source_id     VARCHAR(64)  NOT NULL,
  feature_key       VARCHAR(191) NOT NULL,
  name              VARCHAR(200) NOT NULL,
  zone_type         VARCHAR(32)  NOT NULL DEFAULT 'buffer',
  color             VARCHAR(16)  NOT NULL DEFAULT '#2563EB',
  regulation_short  TEXT NULL,
  regulation_doc_id VARCHAR(64)  NULL,
  external_url      TEXT NULL,
  bbox              JSON NULL,
  sort_order        INT NOT NULL DEFAULT 0,
  is_visible        TINYINT(1) NOT NULL DEFAULT 1,
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_unesco_zones_feature (kmz_source_id, feature_key),
  KEY idx_unesco_zones_type (zone_type),
  CONSTRAINT fk_unesco_zones_kmz
    FOREIGN KEY (kmz_source_id) REFERENCES unesco_kmz_sources(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
SQL,
        'unesco_documents' => <<<'SQL'
CREATE TABLE IF NOT EXISTS unesco_documents (
  id          VARCHAR(64)  NOT NULL,
  title       VARCHAR(300) NOT NULL,
  description TEXT NULL,
  category    VARCHAR(100) NOT NULL DEFAULT 'classement',
  file_id     VARCHAR(64)  NULL,
  external_url TEXT NULL,
  year        VARCHAR(16)  NULL,
  language    VARCHAR(8)   NULL,
  sort_order  INT NOT NULL DEFAULT 0,
  is_visible  TINYINT(1) NOT NULL DEFAULT 1,
  created_by  VARCHAR(64)  NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_unesco_docs_category (category, sort_order),
  KEY idx_unesco_docs_visible (is_visible)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
SQL,
        'unesco_permits' => <<<'SQL'
CREATE TABLE IF NOT EXISTS unesco_permits (
  id              VARCHAR(64)  NOT NULL,
  applicant_uid   VARCHAR(64)  NOT NULL,
  project_ref     VARCHAR(100) NULL,
  title           VARCHAR(300) NOT NULL,
  description     TEXT NULL,
  address         VARCHAR(300) NULL,
  city            VARCHAR(100) NULL,
  parcel_number   VARCHAR(100) NULL,
  latitude        DECIMAL(10,7) NULL,
  longitude       DECIMAL(10,7) NULL,
  auto_zone_id    VARCHAR(64)  NULL,
  final_zone_id   VARCHAR(64)  NULL,
  project_type    VARCHAR(100) NULL,
  surface_sqm     DECIMAL(10,2) NULL,
  floors_count    INT NULL,
  status          VARCHAR(32)  NOT NULL DEFAULT 'draft',
  submitted_at    DATETIME NULL,
  decision_at     DATETIME NULL,
  decision_note   TEXT NULL,
  reviewer_uid    VARCHAR(64)  NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_unesco_permits_applicant (applicant_uid),
  KEY idx_unesco_permits_status (status, updated_at),
  KEY idx_unesco_permits_zone (auto_zone_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
SQL,
        'unesco_permit_events' => <<<'SQL'
CREATE TABLE IF NOT EXISTS unesco_permit_events (
  id           VARCHAR(64)  NOT NULL,
  permit_id    VARCHAR(64)  NOT NULL,
  author_uid   VARCHAR(64)  NULL,
  author_name  VARCHAR(200) NOT NULL DEFAULT '',
  kind         VARCHAR(32)  NOT NULL DEFAULT 'note',
  from_status  VARCHAR(32)  NULL,
  to_status    VARCHAR(32)  NULL,
  message      TEXT NULL,
  is_internal  TINYINT(1) NOT NULL DEFAULT 0,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_unesco_pevents_permit (permit_id, created_at),
  CONSTRAINT fk_unesco_pevents_permit
    FOREIGN KEY (permit_id) REFERENCES unesco_permits(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
SQL,
        'unesco_permit_files' => <<<'SQL'
CREATE TABLE IF NOT EXISTS unesco_permit_files (
  id          VARCHAR(64)  NOT NULL,
  permit_id   VARCHAR(64)  NOT NULL,
  file_id     VARCHAR(64)  NOT NULL,
  kind        VARCHAR(32)  NOT NULL DEFAULT 'attachment',
  title       VARCHAR(200) NULL,
  uploaded_by VARCHAR(64)  NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_unesco_pfiles_permit (permit_id),
  CONSTRAINT fk_unesco_pfiles_permit
    FOREIGN KEY (permit_id) REFERENCES unesco_permits(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
SQL,
    ];

    foreach ($ddl as $table => $sql) {
        if (!table_exists($table)) {
            $pdo->exec($sql);
        }
    }
}

function run_auto_migrations(): void
{
    try {
        migration_001_membership_application_fields();
    } catch (Throwable $e) {
        error_log('[migrations] ' . $e->getMessage());
    }
    try {
        migration_002_unesco_tables();
    } catch (Throwable $e) {
        // Never break the request if a migration fails; surface in error_log so
        // ops can grep production logs instead of seeing a 500.
        error_log('[migrations] ' . $e->getMessage());
    }
}
