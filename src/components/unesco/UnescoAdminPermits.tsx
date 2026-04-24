/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Admin permit-review workspace. List + filter by status, detail view
 * with full timeline, status transitions, internal notes, and attached
 * decision documents.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Loader2,
  FileText,
  Search,
  ChevronRight,
  Download,
  Paperclip,
  Send,
  Lock,
  MapPin as MapPinIcon,
  AlertCircle,
  Clock,
} from 'lucide-react';
import { api, type UnescoPermit, type UnescoPermitStatus, type UnescoZone } from '../../lib/api';
import {
  PERMIT_NEXT_STATUSES,
  PERMIT_STATUS_LABELS,
  StatusBadge,
  formatDateTime,
  zoneTypeLabel,
} from './UnescoCommon';

const STATUS_FILTERS: Array<{ key: 'all' | UnescoPermitStatus; label: string }> = [
  { key: 'all', label: 'Toutes' },
  { key: 'submitted', label: 'Déposées' },
  { key: 'under_review', label: 'En instruction' },
  { key: 'info_requested', label: 'Complément demandé' },
  { key: 'decision_pending', label: 'Décision en attente' },
  { key: 'approved', label: 'Favorables' },
  { key: 'rejected', label: 'Défavorables' },
  { key: 'withdrawn', label: 'Retirées' },
];

export function UnescoAdminPermits() {
  const [permits, setPermits] = useState<UnescoPermit[]>([]);
  const [zones, setZones] = useState<UnescoZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | UnescoPermitStatus>('submitted');
  const [q, setQ] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<UnescoPermit | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, zn] = await Promise.all([
        api.unesco.listPermits({ scope: 'all' }),
        api.unesco.listZones(),
      ]);
      setPermits(list.items);
      setZones(zn.items);
    } catch (e: any) {
      setError(e?.message || 'Chargement impossible.');
    } finally {
      setLoading(false);
    }
  }, []);

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
        (p.city || '').toLowerCase().includes(qn)
      );
    });
  }, [permits, statusFilter, q]);

  const loadDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    try {
      const { item } = await api.unesco.getPermit(id);
      setSelectedDetail(item);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedId) void loadDetail(selectedId);
    else setSelectedDetail(null);
  }, [selectedId, loadDetail]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of permits) counts[p.status] = (counts[p.status] || 0) + 1;
    return counts;
  }, [permits]);

  return (
    <div>
      <div className="mb-8 pb-6 border-b border-aaj-border">
        <span className="text-[10px] uppercase tracking-[3px] text-aaj-royal font-black">
          Administration
        </span>
        <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tight mt-2">
          Instruction UNESCO
        </h2>
        <p className="mt-3 text-sm text-aaj-gray max-w-3xl leading-relaxed">
          Gérez les demandes de permis déposées par les architectes dans le périmètre classé :
          consultation, demande de complément, avis final.
        </p>
      </div>

      {error && !loading && (
        <div className="p-4 border border-red-200 bg-red-50 text-red-700 text-sm rounded mb-4 flex items-start gap-2">
          <AlertCircle size={16} className="mt-0.5 shrink-0" /> {error}
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((f) => {
            const count = f.key === 'all' ? permits.length : statusCounts[f.key] || 0;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setStatusFilter(f.key)}
                className={`px-3 py-2 text-[10px] uppercase tracking-[2px] font-black rounded border ${
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
        <div className="relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-aaj-gray pointer-events-none"
          />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher…"
            className="pl-8 pr-3 py-2 border border-aaj-border text-sm rounded w-full md:w-72"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        <div className="xl:col-span-2">
          {loading ? (
            <div className="flex items-center gap-2 text-aaj-gray text-sm py-8">
              <Loader2 size={16} className="animate-spin" /> Chargement…
            </div>
          ) : filtered.length === 0 ? (
            <div className="border border-dashed border-aaj-border rounded p-10 text-center">
              <FileText className="mx-auto text-aaj-gray mb-3" size={28} />
              <p className="text-sm text-aaj-gray">Aucune demande pour ce filtre.</p>
            </div>
          ) : (
            <ul className="border border-aaj-border rounded divide-y divide-aaj-border">
              {filtered.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(p.id)}
                    className={`w-full text-left px-4 py-3 hover:bg-slate-50 flex items-start gap-3 ${
                      selectedId === p.id ? 'bg-slate-50' : ''
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-bold text-sm truncate">{p.title}</p>
                        <StatusBadge status={p.status} />
                      </div>
                      <p className="text-xs text-aaj-gray truncate mt-0.5">
                        {p.applicant?.displayName || p.applicant?.email || p.applicantUid}
                      </p>
                      <p className="text-[11px] text-aaj-gray mt-0.5">
                        {formatDateTime(p.updatedAt)} · {p.city || 'Djerba'}
                      </p>
                    </div>
                    <ChevronRight size={16} className="text-aaj-gray shrink-0 mt-1" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="xl:col-span-3">
          {!selectedId && !detailLoading && (
            <div className="border border-dashed border-aaj-border rounded p-10 text-center">
              <p className="text-sm text-aaj-gray">Sélectionnez une demande pour l'instruire.</p>
            </div>
          )}
          {detailLoading && (
            <div className="flex items-center gap-2 text-aaj-gray text-sm py-8">
              <Loader2 size={16} className="animate-spin" /> Chargement du dossier…
            </div>
          )}
          {selectedDetail && (
            <AdminPermitDetail
              permit={selectedDetail}
              zonesById={zonesById}
              onReload={async () => {
                await loadList();
                await loadDetail(selectedDetail.id);
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function AdminPermitDetail({
  permit,
  zonesById,
  onReload,
}: {
  permit: UnescoPermit;
  zonesById: Record<string, UnescoZone>;
  onReload: () => Promise<void>;
}) {
  const [nextStatus, setNextStatus] = useState<UnescoPermitStatus | ''>('');
  const [message, setMessage] = useState('');
  const [internal, setInternal] = useState(false);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const zone = permit.finalZoneId
    ? zonesById[permit.finalZoneId]
    : permit.autoZoneId
      ? zonesById[permit.autoZoneId]
      : null;

  const nextChoices: UnescoPermitStatus[] = PERMIT_NEXT_STATUSES[permit.status] ?? [];

  const submit = async () => {
    if (!nextStatus && !message.trim()) {
      setError('Ajouter soit un changement de statut, soit un commentaire.');
      return;
    }
    setPosting(true);
    setError(null);
    try {
      await api.unesco.addPermitEvent(permit.id, {
        toStatus: nextStatus || null,
        message: message.trim() || undefined,
        isInternal: internal,
      });
      setNextStatus('');
      setMessage('');
      setInternal(false);
      await onReload();
    } catch (e: any) {
      setError(e?.message || 'Échec.');
    } finally {
      setPosting(false);
    }
  };

  const reassignZone = async (zoneId: string | '') => {
    await api.unesco.updatePermit(permit.id, { finalZoneId: (zoneId || null) as any });
    await onReload();
  };

  return (
    <div className="space-y-6">
      <div className="border border-aaj-border rounded p-5 bg-white">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-xl font-black uppercase tracking-tight">{permit.title}</h3>
            <p className="text-sm text-aaj-gray mt-1">
              {permit.applicant?.displayName || permit.applicant?.email} ·{' '}
              <span className="text-aaj-dark">{formatDateTime(permit.submittedAt)}</span>
            </p>
            {permit.projectRef && <p className="text-xs text-aaj-gray">Réf. {permit.projectRef}</p>}
          </div>
          <StatusBadge status={permit.status} />
        </div>

        <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm mt-4">
          <Row k="Type" v={permit.projectType || '—'} />
          <Row k="Surface" v={permit.surfaceSqm ? `${permit.surfaceSqm} m²` : '—'} />
          <Row k="Niveaux" v={permit.floorsCount != null ? `${permit.floorsCount}` : '—'} />
          <Row k="Adresse" v={[permit.address, permit.city].filter(Boolean).join(', ') || '—'} />
          <Row k="Parcelle" v={permit.parcelNumber || '—'} />
          <Row
            k="Coordonnées"
            v={
              permit.latitude != null && permit.longitude != null
                ? `${permit.latitude.toFixed(5)}, ${permit.longitude.toFixed(5)}`
                : '—'
            }
          />
        </dl>

        {permit.description && (
          <div className="mt-4 pt-4 border-t border-aaj-border">
            <p className="text-[10px] uppercase tracking-[2px] text-aaj-gray font-black mb-1">
              Description
            </p>
            <p className="text-sm whitespace-pre-line">{permit.description}</p>
          </div>
        )}

        {permit.applicant && (
          <div className="mt-4 pt-4 border-t border-aaj-border">
            <p className="text-[10px] uppercase tracking-[2px] text-aaj-gray font-black mb-1">
              Demandeur
            </p>
            <p className="text-sm">
              <strong>{permit.applicant.displayName || '—'}</strong>
              {permit.applicant.email && ` · ${permit.applicant.email}`}
              {permit.applicant.mobile && ` · ${permit.applicant.mobile}`}
            </p>
          </div>
        )}
      </div>

      <div className="border border-aaj-border rounded p-5">
        <h4 className="text-[10px] uppercase tracking-[3px] text-aaj-gray font-black mb-3 flex items-center gap-2">
          <MapPinIcon size={12} /> Zone UNESCO
        </h4>
        {zone ? (
          <div className="flex items-start gap-3">
            <span
              className="inline-block w-4 h-4 mt-1 rounded-sm border border-black/10 shrink-0"
              style={{ background: zone.color, opacity: 0.7 }}
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
            Aucune zone détectée automatiquement (coordonnées manquantes ou hors périmètre).
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
      </div>

      <div className="border border-aaj-border rounded p-5">
        <h4 className="text-[10px] uppercase tracking-[3px] text-aaj-gray font-black mb-3">
          Pièces jointes
        </h4>
        {permit.files.length === 0 ? (
          <p className="text-xs text-aaj-gray">Aucune pièce jointe.</p>
        ) : (
          <ul className="space-y-2">
            {permit.files.map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-3 text-sm">
                <a
                  href={f.downloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 hover:underline"
                >
                  <Paperclip size={14} />
                  {f.title || f.originalName}
                </a>
                <div className="flex items-center gap-2 text-xs text-aaj-gray">
                  <a
                    href={f.downloadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 hover:text-aaj-dark"
                  >
                    <Download size={12} />
                  </a>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="border border-aaj-border rounded p-5">
        <h4 className="text-[10px] uppercase tracking-[3px] text-aaj-gray font-black mb-3">
          Action d'instruction
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="block">
            <span className="block text-[10px] font-black uppercase tracking-[2px] text-aaj-gray mb-1.5">
              Changer le statut
            </span>
            <select
              value={nextStatus}
              onChange={(e) => setNextStatus(e.target.value as UnescoPermitStatus)}
              disabled={nextChoices.length === 0}
              className="w-full px-3 py-2 border border-aaj-border text-sm rounded bg-white disabled:opacity-50"
            >
              <option value="">— Conserver le statut actuel —</option>
              {nextChoices.map((s) => (
                <option key={s} value={s}>
                  {PERMIT_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
            {nextChoices.length === 0 && (
              <p className="text-xs text-aaj-gray mt-1">
                La demande est close, plus de transition possible.
              </p>
            )}
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
        <label className="block mt-4">
          <span className="block text-[10px] font-black uppercase tracking-[2px] text-aaj-gray mb-1.5">
            Commentaire / justification
          </span>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            className="w-full px-3 py-2 border border-aaj-border text-sm rounded"
            placeholder="Explications, motifs, référence réglementaire…"
          />
        </label>
        {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
        <div className="mt-4 flex items-center gap-2">
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
      </div>

      <div className="border border-aaj-border rounded p-5">
        <h4 className="text-[10px] uppercase tracking-[3px] text-aaj-gray font-black mb-3 flex items-center gap-2">
          <Clock size={12} /> Historique complet
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
                {e.message && <p className="text-sm mt-1.5 whitespace-pre-line">{e.message}</p>}
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <dt className="text-[10px] uppercase tracking-[2px] text-aaj-gray font-black min-w-[95px]">
        {k}
      </dt>
      <dd className="text-aaj-dark">{v}</dd>
    </div>
  );
}
