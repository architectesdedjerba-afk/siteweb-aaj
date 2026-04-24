-- =============================================================
-- Migration 001 — expand membership_applications with the same
-- personal/professional fields used by the admin "Ajouter un
-- membre" form (so the public and admin flows collect identical
-- data, only the approval path differs).
--
-- Run once on an existing database (phpMyAdmin → SQL tab, or
-- `mysql ... < 001_membership_application_fields.sql`). Safe to
-- re-run: each ALTER uses `IF NOT EXISTS` where MySQL supports it;
-- otherwise the error can be ignored when the column is present.
-- =============================================================

-- MariaDB 10.0+ / MySQL 8.0.29+ support IF NOT EXISTS on ADD COLUMN.
-- On older engines remove the IF NOT EXISTS tokens.
ALTER TABLE membership_applications
    ADD COLUMN IF NOT EXISTS first_name         VARCHAR(100) NULL AFTER full_name,
    ADD COLUMN IF NOT EXISTS last_name          VARCHAR(100) NULL AFTER first_name,
    ADD COLUMN IF NOT EXISTS birth_date         VARCHAR(10)  NULL AFTER city,
    ADD COLUMN IF NOT EXISTS member_type_letter CHAR(1)      NULL AFTER birth_date;

-- Backfill first_name / last_name from existing full_name rows (best-effort
-- split on the first whitespace). Safe to run multiple times.
UPDATE membership_applications
   SET first_name = TRIM(SUBSTRING_INDEX(full_name, ' ', 1)),
       last_name  = TRIM(SUBSTRING(full_name, LOCATE(' ', full_name) + 1))
 WHERE first_name IS NULL
   AND full_name IS NOT NULL
   AND full_name <> '';
