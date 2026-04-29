-- Migration 012 — Membership 24h trial access
-- Adds trial-tracking columns to the `users` table so an admin can grant a
-- new member 24h of preview access while waiting for the cotisation payment.
-- `trial_started_at`    : when the admin granted the trial (button click)
-- `trial_first_used_at` : when the user first opened the dashboard after
--                         changing their temporary password — the 24h timer
--                         starts from this moment.
-- Idempotent: the application self-heals via ensure_column() (see api/lib/db.php).

ALTER TABLE users
  ADD COLUMN trial_started_at    DATETIME NULL AFTER cotisations,
  ADD COLUMN trial_first_used_at DATETIME NULL AFTER trial_started_at;
