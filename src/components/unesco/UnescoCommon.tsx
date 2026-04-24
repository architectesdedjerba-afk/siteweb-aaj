/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Shared UI primitives + helpers used across the UNESCO feature.
 */

import type { UnescoPermitStatus } from '../../lib/api';

export const PERMIT_STATUS_LABELS: Record<UnescoPermitStatus, string> = {
  draft: 'Brouillon',
  submitted: 'Déposée',
  under_review: 'En instruction',
  info_requested: 'Complément demandé',
  decision_pending: 'Décision en attente',
  approved: 'Avis favorable',
  rejected: 'Avis défavorable',
  withdrawn: 'Retirée',
};

export const PERMIT_STATUS_COLORS: Record<UnescoPermitStatus, string> = {
  draft: 'bg-slate-100 text-slate-700 border-slate-200',
  submitted: 'bg-blue-50 text-blue-700 border-blue-200',
  under_review: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  info_requested: 'bg-amber-50 text-amber-700 border-amber-200',
  decision_pending: 'bg-purple-50 text-purple-700 border-purple-200',
  approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
  withdrawn: 'bg-slate-100 text-slate-500 border-slate-200',
};

export const PERMIT_NEXT_STATUSES: Record<UnescoPermitStatus, UnescoPermitStatus[]> = {
  draft: ['submitted', 'withdrawn'],
  submitted: ['under_review', 'info_requested', 'rejected', 'withdrawn'],
  under_review: ['info_requested', 'decision_pending', 'approved', 'rejected', 'withdrawn'],
  info_requested: ['under_review', 'decision_pending', 'rejected', 'withdrawn'],
  decision_pending: ['approved', 'rejected', 'info_requested'],
  approved: [],
  rejected: [],
  withdrawn: [],
};

export const DOCUMENT_CATEGORIES: Array<{ key: string; label: string }> = [
  { key: 'classement', label: 'Dossier de classement' },
  { key: 'reglement', label: 'Règlements & guides' },
  { key: 'plan', label: 'Plan de gestion' },
  { key: 'carto', label: 'Cartographie & zonage' },
  { key: 'jurisprudence', label: 'Jurisprudence & décisions' },
  { key: 'presse', label: 'Presse & communications' },
  { key: 'autre', label: 'Autre' },
];

export const ZONE_TYPE_LABELS: Record<string, string> = {
  core: 'Zone centrale',
  buffer: 'Zone tampon',
  protected: 'Zone de protection',
  restricted: 'Zone restreinte',
};

export function StatusBadge({ status }: { status: UnescoPermitStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 border rounded text-[10px] font-black uppercase tracking-widest ${PERMIT_STATUS_COLORS[status]}`}
    >
      {PERMIT_STATUS_LABELS[status]}
    </span>
  );
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function documentCategoryLabel(key: string): string {
  return DOCUMENT_CATEGORIES.find((c) => c.key === key)?.label ?? key;
}

export function zoneTypeLabel(key: string): string {
  return ZONE_TYPE_LABELS[key] ?? key;
}
