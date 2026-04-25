-- Migration 004 — Système de notifications in-app
-- Ajoute les tables : notifications, notification_preferences.
-- Voir schema.sql pour la définition canonique ; migrations.php
-- applique le même DDL en idempotent.

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
