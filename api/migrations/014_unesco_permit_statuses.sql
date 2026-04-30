-- Migration 014 — UNESCO permit statuses are now stored in DB so admins
-- can rename labels, recolor badges, add custom intermediate statuses
-- and customize transitions from the "Paramètres" page.
--
-- The 8 historical hardcoded keys (draft, submitted, under_review,
-- info_requested, decision_pending, approved, rejected, withdrawn)
-- are seeded with `is_system = 1` so they cannot be deleted and their
-- key cannot be changed (label, color, sort, transitions stay editable).
-- Custom statuses added later are intermediate by design — they cannot
-- be marked initial / terminal / withdrawal-target so the state machine
-- semantic invariants used by the PHP backend keep holding.

CREATE TABLE IF NOT EXISTS unesco_permit_statuses (
  status_key                       VARCHAR(64)  NOT NULL,
  label                            VARCHAR(120) NOT NULL,
  color_class                      VARCHAR(255) NOT NULL DEFAULT 'bg-slate-100 text-slate-700 border-slate-200',
  sort_order                       INT          NOT NULL DEFAULT 0,
  is_system                        TINYINT(1)   NOT NULL DEFAULT 0,
  is_initial                       TINYINT(1)   NOT NULL DEFAULT 0,
  is_terminal                      TINYINT(1)   NOT NULL DEFAULT 0,
  allows_applicant_edit            TINYINT(1)   NOT NULL DEFAULT 0,
  is_applicant_withdraw_target     TINYINT(1)   NOT NULL DEFAULT 0,
  next_statuses                    JSON         NULL,
  is_active                        TINYINT(1)   NOT NULL DEFAULT 1,
  created_at                       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (status_key),
  KEY idx_unesco_permit_statuses_active (is_active, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO unesco_permit_statuses
  (status_key, label, color_class, sort_order, is_system, is_initial, is_terminal, allows_applicant_edit, is_applicant_withdraw_target, next_statuses)
VALUES
  ('draft',            'Brouillon',           'bg-slate-100 text-slate-700 border-slate-200',     10, 1, 1, 0, 1, 0, '["submitted","withdrawn"]'),
  ('submitted',        'Déposée',             'bg-blue-50 text-blue-700 border-blue-200',         20, 1, 0, 0, 0, 0, '["under_review","info_requested","rejected","withdrawn"]'),
  ('under_review',     'En instruction',      'bg-indigo-50 text-indigo-700 border-indigo-200',   30, 1, 0, 0, 0, 0, '["info_requested","decision_pending","approved","rejected","withdrawn"]'),
  ('info_requested',   'Complément demandé',  'bg-amber-50 text-amber-700 border-amber-200',      40, 1, 0, 0, 1, 0, '["under_review","decision_pending","rejected","withdrawn"]'),
  ('decision_pending', 'Décision en attente', 'bg-purple-50 text-purple-700 border-purple-200',   50, 1, 0, 0, 0, 0, '["approved","rejected","info_requested"]'),
  ('approved',         'Avis favorable',      'bg-emerald-50 text-emerald-700 border-emerald-200',60, 1, 0, 1, 0, 0, '[]'),
  ('rejected',         'Avis défavorable',    'bg-red-50 text-red-700 border-red-200',            70, 1, 0, 1, 0, 0, '[]'),
  ('withdrawn',        'Retirée',             'bg-slate-100 text-slate-500 border-slate-200',     80, 1, 0, 1, 0, 1, '[]');
