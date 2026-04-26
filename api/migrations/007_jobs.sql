-- Migration 007 — Jobs / Internships module
-- Ajoute la table `jobs` (offres + demandes d'emploi/stage).
-- Voir schema.sql pour la définition canonique. Idempotent : safe à relancer.

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
