/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * UNESCO admin — vue unifiée de gestion des demandes déposées dans la
 * section Djerba UNESCO. Issue de la fusion de l'ex-onglet "Instruction
 * UNESCO" dans "Demandes UNESCO" : un seul espace pour l'agent
 * d'administration ET pour l'administrateur, avec :
 *  - tableau dense triable + cartes de synthèse + recherche + export CSV
 *  - drawer latéral de détail avec :
 *      · changement de statut + commentaire (visible demandeur)
 *      · note interne (masquée pour le demandeur)
 *      · réaffectation manuelle de la zone UNESCO
 *      · historique complet (statuts, notes, fichiers)
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Loader2,
  Search,
  Download,
  AlertCircle,
  X,
  Send,
  Inbox,
  Clock,
  CheckCircle2,
  XCircle,
  ChevronUp,
  ChevronDown,
  Paperclip,
  MapPin as MapPinIcon,
  RefreshCw,
  Lock,
} from 'lucide-react';
import { api, type UnescoPermit, type UnescoPermitStatus, type UnescoZone } from '../../lib/api';
import {
  PermitStatusesProvider,
  StatusBadge,
  formatDate,
  formatDateTime,
  permitNextStatuses,
  permitStatusLabel,
  useFetchPermitStatuses,
  usePermitStatuses,
  zoneTypeLabel,
} from './UnescoCommon';

type StatusFilter = 'all' | UnescoPermitStatus;

type SortKey = 'submittedAt' | 'updatedAt' | 'title' | 'applicant' | 'status' | 'city';
type SortDir = 'asc' | 'desc';

export function UnescoAdminRequests() {
  const fetched = useFetchPermitStatuses();
  return (
    <PermitStatusesProvider statuses={fetched}>
      <UnescoAdminRequestsInner />
    </PermitStatusesProvider>
  );
}

function UnescoAdminRequestsInner() {
  const statuses = usePermitStatuses();
  // Filter chips are derived from the live status list — admin renames
  // and custom statuses surface here without code changes. Initial
  // statuses (drafts) are hidden because this view scopes to deposited
  // requests only.
  const statusFilters = useMemo<Array<{ key: StatusFilter; label: string }>>(
    () => [
      { key: 'all', label: 'Toutes' },
      ...statuses
        .filter((s) => s.isActive && !s.isInitial)
        .map((s) => ({ key: s.key as StatusFilter, label: s.label })),
    ],
    [statuses]
  );
  const [permits, setPermits] = useState<UnescoPermit[]>([]);
  const [zones, setZones] = useState<UnescoZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [q, setQ] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('submittedAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<UnescoPermit | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadList = useCallback(
    async (silent = false) => {
      if (silent) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const [list, zn] = await Promise.all([
          api.unesco.listPermits({ scope: 'all' }),
          api.unesco.listZones(),
        ]);
        // Drafts are not yet "deposited" requests — hide them from this view.
        setPermits(list.items.filter((p) => p.status !== 'draft'));
        setZones(zn.items);
      } catch (e: any) {
        setError(e?.message || 'Chargement impossible.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );

  useEffect(() => {
    loadList();
  }, [loadList]);

  const zonesById = useMemo(() => {
    const m: Record<string, UnescoZone> = {};
    for (const z of zones) m[z.id] = z;
    return m;
  }, [zones]);

  const filtered = useMemo(() => {
    const qn = q.trim().toLowerCase();
    return permits.filter((p) => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (!qn) return true;
      return (
        p.title.toLowerCase().includes(qn) ||
        (p.projectRef || '').toLowerCase().includes(qn) ||
        (p.applicant?.displayName || '').toLowerCase().includes(qn) ||
        (p.applicant?.email || '').toLowerCase().includes(qn) ||
        (p.address || '').toLowerCase().includes(qn) ||
        (p.city || '').toLowerCase().includes(qn) ||
        (p.projectType || '').toLowerCase().includes(qn)
      );
    });
  }, [permits, statusFilter, q]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const dir = sortDir === 'asc' ? 1 : -1;
    const cmp = (a: string | null | undefined, b: string | null | undefined) => {
      const av = (a || '').toLowerCase();
      const bv = (b || '').toLowerCase();
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    };
    arr.sort((a, b) => {
      switch (sortKey) {
        case 'title':
          return cmp(a.title, b.title);
        case 'applicant':
          return cmp(a.applicant?.displayName || a.applicant?.email, b.applicant?.displayName || b.applicant?.email);
        case 'status':
          return cmp(a.status, b.status);
        case 'city':
          return cmp(a.city, b.city);
        case 'updatedAt':
          return cmp(a.updatedAt, b.updatedAt);
        case 'submittedAt':
        default:
          return cmp(a.submittedAt || a.createdAt, b.submittedAt || b.createdAt);
      }
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else {
      setSortKey(k);
      setSortDir('desc');
    }
  };

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const p of permits) c[p.status] = (c[p.status] || 0) + 1;
    return c;
  }, [permits]);

  const summary = useMemo(() => {
    const pendingReview =
      (counts.submitted || 0) +
      (counts.under_review || 0) +
      (counts.info_requested || 0) +
      (counts.decision_pending || 0);
    return {
      total: permits.length,
      pendingReview,
      approved: counts.approved || 0,
      rejected: counts.rejected || 0,
    };
  }, [counts, permits.length]);

  const loadDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    try {
      const { item } = await api.unesco.getPermit(id);
      setSelectedDetail(item);
    } catch (e: any) {
      setError(e?.message || 'Détail indisponible.');
      setSelectedId(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedId) void loadDetail(selectedId);
    else setSelectedDetail(null);
  }, [selectedId, loadDetail]);

  const exportCsv = () => {
    const header = [
      'Référence',
      'Titre',
      'Demandeur',
      'Email',
      'Téléphone',
      'Type de projet',
      'Adresse',
      'Ville',
      'Parcelle',
      'Surface (m²)',
      'Niveaux',
      'Zone',
      'Statut',
      'Déposée le',
      'Mise à jour',
    ];
    const escape = (v: string | number | null | undefined): string => {
      const s = v == null ? '' : String(v);
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };
    const rows = sorted.map((p) => {
      const zone = p.finalZoneId ? zonesById[p.finalZoneId] : p.autoZoneId ? zonesById[p.autoZoneId] : null;
      return [
        p.projectRef,
        p.title,
        p.applicant?.displayName || '',
        p.applicant?.email || '',
        p.applicant?.mobile || '',
        p.projectType,
        p.address,
        p.city,
        p.parcelNumber,
        p.surfaceSqm,
        p.floorsCount,
        zone?.name || '',
        permitStatusLabel(p.status, statuses),
        formatDate(p.submittedAt),
        formatDate(p.updatedAt),
      ].map(escape).join(',');
    });
    const csv = [header.join(','), ...rows].join('\r\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `demandes-unesco-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="mb-8 pb-6 border-b border-aaj-border">
        <span className="text-[10px] uppercase tracking-[3px] text-aaj-royal font-black">
          Administration
        </span>
        <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tight mt-2">
          Demandes UNESCO
        </h2>
        <p className="mt-3 text-sm text-aaj-gray max-w-3xl leading-relaxed">
          Vue d'ensemble de toutes les demandes déposées par les architectes dans la section
          Djerba UNESCO. Suivez l'avancement, recherchez et exportez les dossiers.
        </p>
      </div>

      {error && !loading && (
        <div className="p-4 border border-red-200 bg-red-50 text-red-700 text-sm rounded mb-4 flex items-start gap-2">
          <AlertCircle size={16} className="mt-0.5 shrink-0" /> {error}
        </div>
      )}

      {/* Cartes de synthèse */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <SummaryCard
          icon={<Inbox size={16} />}
          label="Total reçues"
          value={summary.total}
          tone="slate"
        />
        <SummaryCard
          icon={<Clock size={16} />}
          label="En cours"
          value={summary.pendingReview}
          tone="indigo"
        />
        <SummaryCard
          icon={<CheckCircle2 size={16} />}
          label="Favorables"
          value={summary.approved}
          tone="emerald"
        />
        <SummaryCard
          icon={<XCircle size={16} />}
          label="Défavorables"
          value={summary.rejected}
          tone="red"
        />
      </div>

      {/* Barre filtres + recherche + actions */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-6">
        <div className="flex flex-wrap gap-2">
          {statusFilters.map((f) => {
            const count = f.key === 'all' ? permits.length : counts[f.key] || 0;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setStatusFilter(f.key)}
                className={`px-3 py-2 text-[10px] uppercase tracking-[2px] font-black rounded border transition-colors ${
                  statusFilter === f.key
                    ? 'bg-aaj-dark text-white border-aaj-dark'
                    : 'bg-white text-aaj-gray border-aaj-border hover:bg-slate-50'
                }`}
              >
                {f.label} ({count})
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-aaj-gray pointer-events-none"
            />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Rechercher (titre, demandeur, ville…)"
              className="pl-8 pr-3 py-2 border border-aaj-border text-sm rounded w-full lg:w-80"
            />
          </div>
          <button
            type="button"
            onClick={() => loadList(true)}
            disabled={refreshing}
            title="Actualiser"
            className="inline-flex items-center justify-center w-9 h-9 border border-aaj-border rounded text-aaj-gray hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          </button>
          <button
            type="button"
            onClick={exportCsv}
            disabled={sorted.length === 0}
            className="inline-flex items-center gap-2 px-3 py-2 border border-aaj-border rounded text-[10px] font-black uppercase tracking-[2px] hover:bg-slate-50 disabled:opacity-50"
          >
            <Download size={14} /> Export CSV
          </button>
        </div>
      </div>

      {/* Tableau */}
      <div className="border border-aaj-border rounded overflow-hidden bg-white">
        {loading ? (
          <div className="flex items-center gap-2 text-aaj-gray text-sm py-12 justify-center">
            <Loader2 size={16} className="animate-spin" /> Chargement des demandes…
          </div>
        ) : sorted.length === 0 ? (
          <div className="text-center py-16">
            <Inbox className="mx-auto text-aaj-gray mb-3" size={32} />
            <p className="text-sm text-aaj-gray">
              Aucune demande pour les filtres en cours.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead className="bg-slate-50 border-b border-aaj-border">
                <tr>
                  <SortHeader
                    label="Déposée"
                    active={sortKey === 'submittedAt'}
                    dir={sortDir}
                    onClick={() => toggleSort('submittedAt')}
                  />
                  <th className="px-3 py-3 text-left text-[10px] uppercase tracking-[2px] font-black text-aaj-gray">
                    Réf.
                  </th>
                  <SortHeader
                    label="Titre du projet"
                    active={sortKey === 'title'}
                    dir={sortDir}
                    onClick={() => toggleSort('title')}
                  />
                  <SortHeader
                    label="Demandeur"
                    active={sortKey === 'applicant'}
                    dir={sortDir}
                    onClick={() => toggleSort('applicant')}
                  />
                  <SortHeader
                    label="Ville"
                    active={sortKey === 'city'}
                    dir={sortDir}
                    onClick={() => toggleSort('city')}
                  />
                  <th className="px-3 py-3 text-left text-[10px] uppercase tracking-[2px] font-black text-aaj-gray">
                    Zone
                  </th>
                  <SortHeader
                    label="Statut"
                    active={sortKey === 'status'}
                    dir={sortDir}
                    onClick={() => toggleSort('status')}
                  />
                  <th className="px-3 py-3 text-right text-[10px] uppercase tracking-[2px] font-black text-aaj-gray">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-aaj-border">
                {sorted.map((p) => {
                  const zone = p.finalZoneId
                    ? zonesById[p.finalZoneId]
                    : p.autoZoneId
                      ? zonesById[p.autoZoneId]
                      : null;
                  return (
                    <tr
                      key={p.id}
                      className={`hover:bg-slate-50 transition-colors cursor-pointer ${
                        selectedId === p.id ? 'bg-slate-50' : ''
                      }`}
                      onClick={() => setSelectedId(p.id)}
                    >
                      <td className="px-3 py-3 text-aaj-gray whitespace-nowrap">
                        {formatDate(p.submittedAt)}
                      </td>
                      <td className="px-3 py-3 text-aaj-gray text-xs">
                        {p.projectRef || '—'}
                      </td>
                      <td className="px-3 py-3">
                        <p className="font-bold text-aaj-dark truncate max-w-[280px]">
                          {p.title}
                        </p>
                        {p.projectType && (
                          <p className="text-[11px] text-aaj-gray mt-0.5">{p.projectType}</p>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <p className="font-bold truncate max-w-[200px]">
                          {p.applicant?.displayName || p.applicant?.email || '—'}
                        </p>
                        {p.applicant?.email && p.applicant.displayName && (
                          <p className="text-[11px] text-aaj-gray truncate max-w-[200px]">
                            {p.applicant.email}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-3 text-aaj-gray">{p.city || '—'}</td>
                      <td className="px-3 py-3">
                        {zone ? (
                          <span className="inline-flex items-center gap-1.5 text-xs">
                            <span
                              className="inline-block w-2.5 h-2.5 rounded-sm border border-black/10"
                              style={{ background: zone.color, opacity: 0.8 }}
                            />
                            <span className="truncate max-w-[140px]">{zone.name}</span>
                          </span>
                        ) : (
                          <span className="text-xs text-aaj-gray">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <StatusBadge status={p.status} />
                      </td>
                      <td className="px-3 py-3 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedId(p.id);
                          }}
                          className="text-[10px] uppercase tracking-[2px] font-black text-aaj-royal hover:underline"
                        >
                          Ouvrir
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Compteur + détail latéral */}
      {!loading && sorted.length > 0 && (
        <p className="text-xs text-aaj-gray mt-3">
          {sorted.length} demande{sorted.length > 1 ? 's' : ''} affichée
          {sorted.length > 1 ? 's' : ''} sur {permits.length} au total.
        </p>
      )}

      <RequestDetailDrawer
        permit={selectedDetail}
        loading={detailLoading}
        zonesById={zonesById}
        onClose={() => setSelectedId(null)}
        onChanged={async () => {
          if (selectedId) await loadDetail(selectedId);
          await loadList(true);
        }}
      />
    </div>
  );
}

function SortHeader({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
}) {
  return (
    <th className="px-3 py-3 text-left text-[10px] uppercase tracking-[2px] font-black text-aaj-gray">
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-1 hover:text-aaj-dark"
      >
        {label}
        {active &&
          (dir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
      </button>
    </th>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: 'slate' | 'indigo' | 'emerald' | 'red';
}) {
  const styles: Record<string, string> = {
    slate: 'bg-slate-50 border-slate-200 text-slate-700',
    indigo: 'bg-indigo-50 border-indigo-200 text-indigo-700',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    red: 'bg-red-50 border-red-200 text-red-700',
  };
  return (
    <div className={`border rounded p-4 ${styles[tone]}`}>
      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[2px]">
        {icon}
        {label}
      </div>
      <div className="text-3xl font-black mt-2 tabular-nums">{value}</div>
    </div>
  );
}

function RequestDetailDrawer({
  permit,
  loading,
  zonesById,
  onClose,
  onChanged,
}: {
  permit: UnescoPermit | null;
  loading: boolean;
  zonesById: Record<string, UnescoZone>;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const [nextStatus, setNextStatus] = useState<UnescoPermitStatus | ''>('');
  const [message, setMessage] = useState('');
  const [internal, setInternal] = useState(false);
  const [posting, setPosting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setNextStatus('');
    setMessage('');
    setInternal(false);
    setErr(null);
  }, [permit?.id]);

  if (!permit && !loading) return null;

  const statuses = usePermitStatuses();
  const nextChoices = permit ? permitNextStatuses(permit.status, statuses) : [];

  const zone =
    permit && permit.finalZoneId
      ? zonesById[permit.finalZoneId]
      : permit && permit.autoZoneId
        ? zonesById[permit.autoZoneId]
        : null;

  const submit = async () => {
    if (!permit) return;
    if (!nextStatus && !message.trim()) {
      setErr('Sélectionnez un nouveau statut ou ajoutez un commentaire.');
      return;
    }
    setPosting(true);
    setErr(null);
    try {
      await api.unesco.addPermitEvent(permit.id, {
        toStatus: nextStatus || null,
        message: message.trim() || undefined,
        isInternal: internal,
      });
      setNextStatus('');
      setMessage('');
      setInternal(false);
      await onChanged();
    } catch (e: any) {
      setErr(e?.message || 'Échec de la mise à jour.');
    } finally {
      setPosting(false);
    }
  };

  const reassignZone = async (zoneId: string) => {
    if (!permit) return;
    try {
      await api.unesco.updatePermit(permit.id, {
        finalZoneId: (zoneId || null) as any,
      });
      await onChanged();
    } catch (e: any) {
      setErr(e?.message || 'Réaffectation impossible.');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex"
      role="dialog"
      aria-modal="true"
      aria-label="Détail de la demande UNESCO"
    >
      <div
        className="absolute inset-0 bg-aaj-dark/40 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div className="ml-auto relative w-full max-w-2xl bg-white border-l border-aaj-border shadow-2xl overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-aaj-border px-6 py-4 flex items-center justify-between z-10">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[3px] text-aaj-royal font-black">
              Demande UNESCO
            </p>
            <h3 className="font-black text-lg truncate">
              {loading || !permit ? 'Chargement…' : permit.title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-aaj-gray hover:text-aaj-dark"
            aria-label="Fermer"
          >
            <X size={18} />
          </button>
        </div>

        {loading || !permit ? (
          <div className="flex items-center gap-2 text-aaj-gray text-sm py-16 justify-center">
            <Loader2 size={16} className="animate-spin" /> Chargement du dossier…
          </div>
        ) : (
          <div className="p-6 space-y-6">
            <div className="flex items-center justify-between gap-3">
              <StatusBadge status={permit.status} />
              <span className="text-xs text-aaj-gray">
                Déposée le {formatDateTime(permit.submittedAt)}
              </span>
            </div>

            <section>
              <h4 className="text-[10px] uppercase tracking-[3px] text-aaj-gray font-black mb-2">
                Demandeur
              </h4>
              <p className="text-sm">
                <strong>{permit.applicant?.displayName || '—'}</strong>
              </p>
              {permit.applicant?.email && (
                <p className="text-xs text-aaj-gray">{permit.applicant.email}</p>
              )}
              {permit.applicant?.mobile && (
                <p className="text-xs text-aaj-gray">{permit.applicant.mobile}</p>
              )}
            </section>

            <section className="border-t border-aaj-border pt-4">
              <h4 className="text-[10px] uppercase tracking-[3px] text-aaj-gray font-black mb-2">
                Projet
              </h4>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <Row k="Référence" v={permit.projectRef || '—'} />
                <Row k="Type" v={permit.projectType || '—'} />
                <Row k="Surface" v={permit.surfaceSqm ? `${permit.surfaceSqm} m²` : '—'} />
                <Row k="Niveaux" v={permit.floorsCount != null ? `${permit.floorsCount}` : '—'} />
                <Row
                  k="Adresse"
                  v={[permit.address, permit.city].filter(Boolean).join(', ') || '—'}
                />
                <Row k="Parcelle" v={permit.parcelNumber || '—'} />
              </dl>
              {permit.description && (
                <div className="mt-3">
                  <p className="text-[10px] uppercase tracking-[2px] text-aaj-gray font-black mb-1">
                    Description
                  </p>
                  <p className="text-sm whitespace-pre-line">{permit.description}</p>
                </div>
              )}
            </section>

            <section className="border-t border-aaj-border pt-4">
              <h4 className="text-[10px] uppercase tracking-[3px] text-aaj-gray font-black mb-2 flex items-center gap-2">
                <MapPinIcon size={12} /> Zone UNESCO
              </h4>
              {zone ? (
                <div className="flex items-start gap-3">
                  <span
                    className="inline-block w-4 h-4 mt-1 rounded-sm border border-black/10 shrink-0"
                    style={{ background: zone.color, opacity: 0.8 }}
                  />
                  <div className="min-w-0">
                    <p className="font-bold text-sm">{zone.name}</p>
                    <p className="text-[10px] uppercase tracking-[2px] text-aaj-gray mt-0.5">
                      {zoneTypeLabel(zone.zoneType)}{' '}
                      {permit.finalZoneId ? '· zone retenue' : '· détection automatique'}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-aaj-gray">
                  Aucune zone détectée (coordonnées manquantes ou hors périmètre).
                </p>
              )}
              <label className="block mt-3">
                <span className="block text-[10px] font-black uppercase tracking-[2px] text-aaj-gray mb-1.5">
                  Réaffecter la zone
                </span>
                <select
                  value={permit.finalZoneId || ''}
                  onChange={(e) => void reassignZone(e.target.value)}
                  className="w-full px-3 py-2 border border-aaj-border text-sm rounded bg-white"
                >
                  <option value="">— Laisser la détection automatique —</option>
                  {Object.values(zonesById).map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.name} ({zoneTypeLabel(z.zoneType)})
                    </option>
                  ))}
                </select>
              </label>
            </section>

            <section className="border-t border-aaj-border pt-4">
              <h4 className="text-[10px] uppercase tracking-[3px] text-aaj-gray font-black mb-2">
                Pièces jointes ({permit.files.length})
              </h4>
              {permit.files.length === 0 ? (
                <p className="text-xs text-aaj-gray">Aucune pièce.</p>
              ) : (
                <ul className="space-y-2">
                  {permit.files.map((f) => (
                    <li key={f.id}>
                      <a
                        href={f.downloadUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-sm hover:underline"
                      >
                        <Paperclip size={14} />
                        {f.title || f.originalName || 'Fichier'}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {nextChoices.length > 0 && (
              <section className="border-t border-aaj-border pt-4">
                <h4 className="text-[10px] uppercase tracking-[3px] text-aaj-gray font-black mb-2">
                  Mise à jour rapide
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className="block">
                    <span className="block text-[10px] font-black uppercase tracking-[2px] text-aaj-gray mb-1.5">
                      Nouveau statut
                    </span>
                    <select
                      value={nextStatus}
                      onChange={(e) => setNextStatus(e.target.value as UnescoPermitStatus)}
                      className="w-full px-3 py-2 border border-aaj-border text-sm rounded bg-white"
                    >
                      <option value="">— Conserver le statut actuel —</option>
                      {nextChoices.map((s) => (
                        <option key={s.key} value={s.key}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="inline-flex items-center gap-2 md:mt-7 text-sm">
                    <input
                      type="checkbox"
                      checked={internal}
                      onChange={(e) => setInternal(e.target.checked)}
                    />
                    <span className="inline-flex items-center gap-1">
                      <Lock size={12} /> Note interne (masquée pour le demandeur)
                    </span>
                  </label>
                </div>
                <label className="block mt-3">
                  <span className="block text-[10px] font-black uppercase tracking-[2px] text-aaj-gray mb-1.5">
                    {internal
                      ? 'Note interne (visible uniquement par les administrateurs)'
                      : 'Commentaire (visible par le demandeur)'}
                  </span>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-aaj-border text-sm rounded"
                    placeholder={
                      internal
                        ? 'Information interne, référence, contexte…'
                        : 'Motif, justification, demande de complément…'
                    }
                  />
                </label>
                {err && <p className="text-sm text-red-600 mt-2">{err}</p>}
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={submit}
                    disabled={posting}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-aaj-royal text-white text-[10px] font-black uppercase tracking-[2px] rounded hover:bg-aaj-dark disabled:opacity-50"
                  >
                    {posting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                    Enregistrer
                  </button>
                </div>
              </section>
            )}

            <section className="border-t border-aaj-border pt-4">
              <h4 className="text-[10px] uppercase tracking-[3px] text-aaj-gray font-black mb-3 flex items-center gap-2">
                <Clock size={12} /> Historique
              </h4>
              {permit.events.length === 0 ? (
                <p className="text-xs text-aaj-gray">Aucun événement.</p>
              ) : (
                <ol className="relative border-l border-aaj-border ml-2">
                  {permit.events.map((e) => (
                    <li key={e.id} className="pl-4 pb-4 last:pb-0">
                      <span className="absolute -left-1.5 w-3 h-3 bg-aaj-royal rounded-full border-2 border-white" />
                      <div className="flex items-center gap-2 flex-wrap">
                        {e.toStatus ? (
                          <StatusBadge status={e.toStatus as UnescoPermitStatus} />
                        ) : (
                          <span className="text-[10px] uppercase tracking-[2px] font-black text-aaj-gray">
                            Note
                          </span>
                        )}
                        {e.isInternal && (
                          <span className="text-[9px] uppercase tracking-[2px] font-black text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                            Interne
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-aaj-gray mt-0.5">
                        {formatDateTime(e.createdAt)} — {e.authorName || 'Système'}
                      </p>
                      {e.message && (
                        <p className="text-sm mt-1.5 whitespace-pre-line">{e.message}</p>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline gap-2 min-w-0">
      <dt className="text-[10px] uppercase tracking-[2px] text-aaj-gray font-black min-w-[80px]">
        {k}
      </dt>
      <dd className="text-aaj-dark truncate">{v}</dd>
    </div>
  );
}
