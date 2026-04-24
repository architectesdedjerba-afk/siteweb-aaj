-- Migration 002 — UNESCO Djerba feature
-- Ajoute les tables : kmz_sources, zones, documents, permits, permit_events,
-- permit_files. Voir schema.sql pour la définition canonique ; migrations.php
-- applique le même DDL en idempotent.

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
