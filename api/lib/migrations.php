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

/**
 * Migration 003 — backfill UNESCO permissions on existing system roles.
 *
 * `seed_default_roles_if_missing()` uses INSERT IGNORE, which means
 * previously-seeded roles keep their original permissions JSON when a
 * new permission key (here: `unesco_view`, `unesco_permits_submit`) is
 * added to the code. For the UNESCO feature to be ON by default for
 * everyone, we need to push the new keys into the persisted permissions
 * of the `admin`, `representative`, and `member` rows — but ONLY if the
 * key is missing (so that a super-admin who has explicitly disabled the
 * permission afterwards keeps their override).
 *
 * Idempotent: reading the existing JSON, merging, and writing only when
 * the merge actually changes something.
 */
function migration_003_unesco_default_perms(): void
{
    $pdo = db();
    $keys = ['unesco_view', 'unesco_permits_submit'];
    $systemRoles = ['admin', 'representative', 'member'];

    $stmt = $pdo->prepare('SELECT id, permissions FROM roles WHERE id = ? LIMIT 1');
    $update = $pdo->prepare('UPDATE roles SET permissions = :perms WHERE id = :id');

    foreach ($systemRoles as $roleId) {
        $stmt->execute([$roleId]);
        $row = $stmt->fetch();
        if (!$row) continue; // role hasn't been seeded yet; seeder will handle it

        $perms = is_string($row['permissions'])
            ? (json_decode((string)$row['permissions'], true) ?: [])
            : (array)$row['permissions'];
        $changed = false;
        foreach ($keys as $k) {
            if (!array_key_exists($k, $perms)) {
                $perms[$k] = true;
                $changed = true;
            }
        }
        if ($changed) {
            $update->execute([
                ':perms' => json_encode($perms, JSON_UNESCAPED_UNICODE),
                ':id'    => $roleId,
            ]);
        }
    }
}

/**
 * Migration 004 — tables du système de notifications in-app.
 * Idempotent : CREATE TABLE IF NOT EXISTS.
 */
function migration_004_notifications_tables(): void
{
    $pdo = db();

    $ddl = [
        'notifications' => <<<'SQL'
CREATE TABLE IF NOT EXISTS notifications (
  id            VARCHAR(64)  NOT NULL,
  recipient_uid VARCHAR(64)  NOT NULL,
  type          VARCHAR(50)  NOT NULL DEFAULT 'system',
  title         VARCHAR(300) NOT NULL,
  body          TEXT NULL,
  link          VARCHAR(500) NULL,
  icon          VARCHAR(50)  NULL,
  priority      VARCHAR(16)  NOT NULL DEFAULT 'normal',
  data          JSON NULL,
  sender_uid    VARCHAR(64)  NULL,
  sender_name   VARCHAR(200) NULL,
  read_at       DATETIME NULL,
  archived_at   DATETIME NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_notifs_recipient_created (recipient_uid, created_at),
  KEY idx_notifs_recipient_unread (recipient_uid, read_at),
  KEY idx_notifs_recipient_archived (recipient_uid, archived_at),
  KEY idx_notifs_type (type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
SQL,
        'notification_preferences' => <<<'SQL'
CREATE TABLE IF NOT EXISTS notification_preferences (
  id          VARCHAR(160) NOT NULL,
  uid         VARCHAR(64)  NOT NULL,
  type        VARCHAR(50)  NOT NULL,
  in_app      TINYINT(1)   NOT NULL DEFAULT 1,
  email       TINYINT(1)   NOT NULL DEFAULT 0,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_notif_prefs_uid_type (uid, type),
  KEY idx_notif_prefs_uid (uid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
SQL,
    ];

    foreach ($ddl as $table => $sql) {
        if (!table_exists($table)) {
            $pdo->exec($sql);
        }
    }
}

/**
 * Migration 005 — backfill `notifications_send` sur le rôle admin pour
 * que la diffusion soit immédiatement disponible sans repasser par le
 * super-admin. Pareil que migration_003 pour UNESCO : on n'écrase rien
 * si le super-admin a explicitement désactivé la perm.
 */
function migration_005_notifications_default_perms(): void
{
    $pdo = db();
    $keys = ['notifications_send'];
    $systemRoles = ['admin'];

    $stmt = $pdo->prepare('SELECT id, permissions FROM roles WHERE id = ? LIMIT 1');
    $update = $pdo->prepare('UPDATE roles SET permissions = :perms WHERE id = :id');

    foreach ($systemRoles as $roleId) {
        $stmt->execute([$roleId]);
        $row = $stmt->fetch();
        if (!$row) continue;
        $perms = is_string($row['permissions'])
            ? (json_decode((string)$row['permissions'], true) ?: [])
            : (array)$row['permissions'];
        $changed = false;
        foreach ($keys as $k) {
            if (!array_key_exists($k, $perms)) {
                $perms[$k] = true;
                $changed = true;
            }
        }
        if ($changed) {
            $update->execute([
                ':perms' => json_encode($perms, JSON_UNESCAPED_UNICODE),
                ':id'    => $roleId,
            ]);
        }
    }
}

/**
 * Migration 006 — extend contact_messages so admins can reply by email
 * directly from the inbox UI. Adds a status flag, replied tracking
 * fields, the stored reply body, and an optional user_name (some legacy
 * rows only had user_email). All idempotent.
 */
function migration_006_contact_messages_reply_fields(): void
{
    $table = 'contact_messages';
    if (!table_exists($table)) return;
    $pdo = db();

    if (!column_exists($table, 'user_name')) {
        $pdo->exec("ALTER TABLE `$table` ADD COLUMN `user_name` VARCHAR(200) NULL AFTER `user_email`");
    }
    if (!column_exists($table, 'status')) {
        $pdo->exec("ALTER TABLE `$table` ADD COLUMN `status` VARCHAR(16) NOT NULL DEFAULT 'unread' AFTER `message`");
    }
    if (!column_exists($table, 'replied')) {
        $pdo->exec("ALTER TABLE `$table` ADD COLUMN `replied` TINYINT(1) NOT NULL DEFAULT 0 AFTER `status`");
    }
    if (!column_exists($table, 'replied_at')) {
        $pdo->exec("ALTER TABLE `$table` ADD COLUMN `replied_at` DATETIME NULL AFTER `replied`");
    }
    if (!column_exists($table, 'replied_by')) {
        $pdo->exec("ALTER TABLE `$table` ADD COLUMN `replied_by` VARCHAR(64) NULL AFTER `replied_at`");
    }
    if (!column_exists($table, 'reply_message')) {
        $pdo->exec("ALTER TABLE `$table` ADD COLUMN `reply_message` TEXT NULL AFTER `replied_by`");
    }
}

/**
 * Migration 007 — `jobs` table (offres & demandes d'emploi/stage).
 * Idempotent: CREATE TABLE IF NOT EXISTS. See api/migrations/007_jobs.sql for
 * the raw DDL.
 */
function migration_007_jobs_table(): void
{
    if (table_exists('jobs')) return;
    db()->exec(<<<'SQL'
CREATE TABLE IF NOT EXISTS jobs (
  id            VARCHAR(64) NOT NULL,
  kind          VARCHAR(16) NOT NULL DEFAULT 'offer',
  contract_type VARCHAR(32) NULL,
  title         VARCHAR(300) NOT NULL,
  description   TEXT NOT NULL,
  city          VARCHAR(100) NULL,
  company       VARCHAR(200) NULL,
  author_uid    VARCHAR(64) NULL,
  author_name   VARCHAR(200) NULL,
  author_role   VARCHAR(100) NULL,
  author_email  VARCHAR(255) NULL,
  author_phone  VARCHAR(50)  NULL,
  source        VARCHAR(16)  NOT NULL DEFAULT 'member',
  status        VARCHAR(16)  NOT NULL DEFAULT 'pending',
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_jobs_status (status),
  KEY idx_jobs_kind (kind),
  KEY idx_jobs_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
SQL);
}

/**
 * Migration 008 — backfill jobs permissions on existing system roles.
 *
 * Mirrors migration_003 (UNESCO): jobs_view + jobs_create are added to
 * admin/representative/member; jobs_manage is added to admin only. We only
 * insert keys that are missing so super-admin overrides survive.
 */
function migration_008_jobs_default_perms(): void
{
    $pdo = db();
    $matrix = [
        'admin'          => ['jobs_view' => true, 'jobs_create' => true, 'jobs_manage' => true],
        'representative' => ['jobs_view' => true, 'jobs_create' => true],
        'member'         => ['jobs_view' => true, 'jobs_create' => true],
    ];

    $stmt   = $pdo->prepare('SELECT id, permissions FROM roles WHERE id = ? LIMIT 1');
    $update = $pdo->prepare('UPDATE roles SET permissions = :perms WHERE id = :id');

    foreach ($matrix as $roleId => $defaults) {
        $stmt->execute([$roleId]);
        $row = $stmt->fetch();
        if (!$row) continue;
        $perms = is_string($row['permissions'])
            ? (json_decode((string)$row['permissions'], true) ?: [])
            : (array)$row['permissions'];
        $changed = false;
        foreach ($defaults as $k => $v) {
            if (!array_key_exists($k, $perms)) {
                $perms[$k] = $v;
                $changed = true;
            }
        }
        if ($changed) {
            $update->execute([
                ':perms' => json_encode($perms, JSON_UNESCAPED_UNICODE),
                ':id'    => $roleId,
            ]);
        }
    }
}

/**
 * Migration 009 — add `approval_date` to the documents (library) table so
 * Plans d'Aménagement can carry the date the PAU was officially approved.
 * Stored as VARCHAR(10) to match the YYYY-MM-DD value emitted by the
 * <input type="date"> element on the frontend (no timezone shenanigans).
 */
function migration_009_documents_approval_date(): void
{
    $table = 'documents';
    if (!table_exists($table)) return;
    if (!column_exists($table, 'approval_date')) {
        db()->exec("ALTER TABLE `$table` ADD COLUMN `approval_date` VARCHAR(10) NULL AFTER `sub_category`");
    }
}

/**
 * Migration 010 — extend the `news` table so an annonce can carry the
 * uploaded file's mime type (needed to decide inline image preview vs.
 * download tile) and the author identity (avatar + display name shown
 * in the Facebook-style card). All idempotent.
 */
function migration_010_news_attachment_and_author_fields(): void
{
    $table = 'news';
    if (!table_exists($table)) return;
    $pdo = db();

    if (!column_exists($table, 'file_mime_type')) {
        $pdo->exec("ALTER TABLE `$table` ADD COLUMN `file_mime_type` VARCHAR(100) NULL AFTER `file_name`");
    }
    if (!column_exists($table, 'author_email')) {
        $pdo->exec("ALTER TABLE `$table` ADD COLUMN `author_email` VARCHAR(200) NULL AFTER `file_mime_type`");
    }
    if (!column_exists($table, 'author_display_name')) {
        $pdo->exec("ALTER TABLE `$table` ADD COLUMN `author_display_name` VARCHAR(200) NULL AFTER `author_email`");
    }
    if (!column_exists($table, 'author_photo_base64')) {
        $pdo->exec("ALTER TABLE `$table` ADD COLUMN `author_photo_base64` LONGTEXT NULL AFTER `author_display_name`");
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
        error_log('[migrations] ' . $e->getMessage());
    }
    try {
        migration_003_unesco_default_perms();
    } catch (Throwable $e) {
        // Never break the request if a migration fails; surface in error_log so
        // ops can grep production logs instead of seeing a 500.
        error_log('[migrations] ' . $e->getMessage());
    }
    try {
        migration_004_notifications_tables();
    } catch (Throwable $e) {
        error_log('[migrations] ' . $e->getMessage());
    }
    try {
        migration_005_notifications_default_perms();
    } catch (Throwable $e) {
        error_log('[migrations] ' . $e->getMessage());
    }
    try {
        migration_006_contact_messages_reply_fields();
    } catch (Throwable $e) {
        error_log('[migrations] ' . $e->getMessage());
    }
    try {
        migration_007_jobs_table();
    } catch (Throwable $e) {
        error_log('[migrations] ' . $e->getMessage());
    }
    try {
        migration_008_jobs_default_perms();
    } catch (Throwable $e) {
        error_log('[migrations] ' . $e->getMessage());
    }
    try {
        migration_009_documents_approval_date();
    } catch (Throwable $e) {
        error_log('[migrations] ' . $e->getMessage());
    }
    try {
        migration_010_news_attachment_and_author_fields();
    } catch (Throwable $e) {
        error_log('[migrations] ' . $e->getMessage());
    }
}
