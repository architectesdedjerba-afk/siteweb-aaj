-- Migration 011 — Jobs CV / portfolio attachment fields
-- Adds optional CV/portfolio reference columns to the `jobs` table so that
-- public job request submissions (and future member offers) can attach a
-- single CV/portfolio file uploaded via /api/files (folder = jobs_cv).
-- Idempotent: the application self-heals via ensure_column().

ALTER TABLE jobs
  ADD COLUMN cv_file_id   VARCHAR(64)  NULL AFTER status,
  ADD COLUMN cv_file_name VARCHAR(255) NULL AFTER cv_file_id;
