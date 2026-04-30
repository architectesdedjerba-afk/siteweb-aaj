/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Shared UI primitives + helpers used across the UNESCO feature.
 */

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, type UnescoPermitStatus, type UnescoPermitStatusDef } from '../../lib/api';

// Fallback definitions used until the live list from the API resolves
// (or if the call fails). Mirrors the seed in migration 014 so badges
// and dropdowns render with the historical look on first paint.
export const DEFAULT_PERMIT_STATUSES: UnescoPermitStatusDef[] = [
  { key: 'draft',            label: 'Brouillon',           colorClass: 'bg-slate-100 text-slate-700 border-slate-200',     sortOrder: 10, isSystem: true, isInitial: true,  isTerminal: false, allowsApplicantEdit: true,  isApplicantWithdrawTarget: false, nextStatuses: ['submitted', 'withdrawn'],                                                isActive: true, createdAt: null, updatedAt: null },
  { key: 'submitted',        label: 'Déposée',             colorClass: 'bg-blue-50 text-blue-700 border-blue-200',         sortOrder: 20, isSystem: true, isInitial: false, isTerminal: false, allowsApplicantEdit: false, isApplicantWithdrawTarget: false, nextStatuses: ['under_review', 'info_requested', 'rejected', 'withdrawn'],               isActive: true, createdAt: null, updatedAt: null },
  { key: 'under_review',     label: 'En instruction',      colorClass: 'bg-indigo-50 text-indigo-700 border-indigo-200',   sortOrder: 30, isSystem: true, isInitial: false, isTerminal: false, allowsApplicantEdit: false, isApplicantWithdrawTarget: false, nextStatuses: ['info_requested', 'decision_pending', 'approved', 'rejected', 'withdrawn'],isActive: true, createdAt: null, updatedAt: null },
  { key: 'info_requested',   label: 'Complément demandé',  colorClass: 'bg-amber-50 text-amber-700 border-amber-200',      sortOrder: 40, isSystem: true, isInitial: false, isTerminal: false, allowsApplicantEdit: true,  isApplicantWithdrawTarget: false, nextStatuses: ['under_review', 'decision_pending', 'rejected', 'withdrawn'],             isActive: true, createdAt: null, updatedAt: null },
  { key: 'decision_pending', label: 'Décision en attente', colorClass: 'bg-purple-50 text-purple-700 border-purple-200',   sortOrder: 50, isSystem: true, isInitial: false, isTerminal: false, allowsApplicantEdit: false, isApplicantWithdrawTarget: false, nextStatuses: ['approved', 'rejected', 'info_requested'],                                isActive: true, createdAt: null, updatedAt: null },
  { key: 'approved',         label: 'Avis favorable',      colorClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',sortOrder: 60, isSystem: true, isInitial: false, isTerminal: true,  allowsApplicantEdit: false, isApplicantWithdrawTarget: false, nextStatuses: [],                                                                       isActive: true, createdAt: null, updatedAt: null },
  { key: 'rejected',         label: 'Avis défavorable',    colorClass: 'bg-red-50 text-red-700 border-red-200',            sortOrder: 70, isSystem: true, isInitial: false, isTerminal: true,  allowsApplicantEdit: false, isApplicantWithdrawTarget: false, nextStatuses: [],                                                                       isActive: true, createdAt: null, updatedAt: null },
  { key: 'withdrawn',        label: 'Retirée',             colorClass: 'bg-slate-100 text-slate-500 border-slate-200',     sortOrder: 80, isSystem: true, isInitial: false, isTerminal: true,  allowsApplicantEdit: false, isApplicantWithdrawTarget: true,  nextStatuses: [],                                                                       isActive: true, createdAt: null, updatedAt: null },
];

const PermitStatusesContext = createContext<UnescoPermitStatusDef[]>(DEFAULT_PERMIT_STATUSES);

export function PermitStatusesProvider({
  statuses,
  children,
}: {
  statuses: UnescoPermitStatusDef[] | null;
  children: ReactNode;
}) {
  const value = useMemo(
    () => (statuses && statuses.length > 0 ? statuses : DEFAULT_PERMIT_STATUSES),
    [statuses]
  );
  return (
    <PermitStatusesContext.Provider value={value}>{children}</PermitStatusesContext.Provider>
  );
}

export function usePermitStatuses(): UnescoPermitStatusDef[] {
  return useContext(PermitStatusesContext);
}

export function usePermitStatusDef(key: string): UnescoPermitStatusDef | null {
  const list = usePermitStatuses();
  return list.find((s) => s.key === key) ?? null;
}

// One-shot loader: each top-level UNESCO view calls this hook to fetch
// the live status list and feed the context. The fetch is fire-and-forget
// — failure simply keeps the DEFAULT_PERMIT_STATUSES fallback so the UI
// never breaks if the new endpoint is unavailable.
export function useFetchPermitStatuses(): UnescoPermitStatusDef[] | null {
  const [statuses, setStatuses] = useState<UnescoPermitStatusDef[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    api.unesco
      .listStatuses()
      .then((res) => {
        if (!cancelled) setStatuses(res.items);
      })
      .catch(() => {
        if (!cancelled) setStatuses(DEFAULT_PERMIT_STATUSES);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return statuses;
}

export function permitStatusLabel(key: string, list: UnescoPermitStatusDef[]): string {
  return list.find((s) => s.key === key)?.label ?? key;
}

export function permitStatusColor(key: string, list: UnescoPermitStatusDef[]): string {
  return (
    list.find((s) => s.key === key)?.colorClass ??
    'bg-slate-100 text-slate-700 border-slate-200'
  );
}

export function permitNextStatuses(
  fromKey: string,
  list: UnescoPermitStatusDef[]
): UnescoPermitStatusDef[] {
  const def = list.find((s) => s.key === fromKey);
  if (!def) return [];
  const order = new Map<string, number>();
  list.forEach((s, i) => order.set(s.key, i));
  return def.nextStatuses
    .map((k) => list.find((s) => s.key === k && s.isActive))
    .filter((s): s is UnescoPermitStatusDef => Boolean(s))
    .sort((a, b) => (order.get(a.key) ?? 0) - (order.get(b.key) ?? 0));
}

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

// Fixed list for permit "Municipalité" dropdown (Djerba).
export const DJERBA_MUNICIPALITIES: string[] = ['Ajim', 'Midoun', 'Houmt Souk'];

// Land type is an exclusive choice: the parcel is either urban or agricultural.
// Stored in the existing `parcel_number` column as one of these values so we
// avoid a schema migration.
export const LAND_TYPES: Array<{ key: string; label: string }> = [
  { key: 'Zone urbaine', label: 'Zone urbaine' },
  { key: 'Zone agricole', label: 'Zone agricole' },
];

// Labels + metadata for the three mandatory upload slots on the permit
// form. `kind` maps to the `unesco_permit_files.kind` column.
export const PERMIT_MAIN_UPLOAD_SLOTS: Array<{
  kind: string;
  label: string;
  hint: string;
}> = [
  {
    kind: 'architecture',
    label: 'Dossier architecture',
    hint: 'Plans, façades, coupes (PDF ou image).',
  },
  {
    kind: 'topography',
    label: 'Relevé topographique',
    hint: 'Levé de géomètre (PDF ou image).',
  },
  {
    kind: 'property_deed',
    label: 'Acte de propriété',
    hint: "Justificatif légal du titre de propriété.",
  },
];

export function StatusBadge({ status }: { status: UnescoPermitStatus }) {
  const list = usePermitStatuses();
  const def = list.find((s) => s.key === status);
  const label = def?.label ?? status;
  const color = def?.colorClass ?? 'bg-slate-100 text-slate-700 border-slate-200';
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 border rounded text-[10px] font-black uppercase tracking-widest ${color}`}
    >
      {label}
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
