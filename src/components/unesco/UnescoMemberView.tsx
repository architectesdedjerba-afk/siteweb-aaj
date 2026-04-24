/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Members-facing Djerba UNESCO view: map with regulation pop-out,
 * documentary corpus, "my permits" list + submit form.
 *
 * Wrapped inside MemberSpace and only visible when the user carries
 * at least `unesco_view` in its permissions (the parent gates this
 * with `can('unesco_view')`).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Map as MapIcon,
  FileText,
  FolderOpen,
  Upload,
  X,
  Download,
  ExternalLink,
  Clock,
  Loader2,
  Info,
  AlertCircle,
  Send,
  Trash2,
  Pencil,
  PlusCircle,
  ChevronRight,
  ChevronDown,
  Paperclip,
  MapPin,
  Layers,
  CheckCheck,
} from 'lucide-react';
import {
  api,
  type UnescoDocument,
  type UnescoPermit,
  type UnescoPermitStatus,
  type UnescoZone,
} from '../../lib/api';
import { UnescoMap, type UnescoGeoJson } from './UnescoMap';
import {
  DJERBA_MUNICIPALITIES,
  DOCUMENT_CATEGORIES,
  LAND_TYPES,
  PERMIT_MAIN_UPLOAD_SLOTS,
  StatusBadge,
  documentCategoryLabel,
  formatDateTime,
  zoneTypeLabel,
} from './UnescoCommon';

type SubTab = 'map' | 'documents' | 'permits';

interface UnescoMemberViewProps {
  canSubmit: boolean;
}

export function UnescoMemberView({ canSubmit }: UnescoMemberViewProps) {
  const [tab, setTab] = useState<SubTab>('map');
  const [geojson, setGeojson] = useState<UnescoGeoJson | null>(null);
  const [zones, setZones] = useState<UnescoZone[]>([]);
  const [documents, setDocuments] = useState<UnescoDocument[]>([]);
  const [permits, setPermits] = useState<UnescoPermit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [fc, zns, docs, perms] = await Promise.all([
        api.unesco.geojson(),
        api.unesco.listZones(),
        api.unesco.listDocuments(),
        canSubmit
          ? api.unesco.listPermits({ scope: 'mine' })
          : Promise.resolve({ items: [] as UnescoPermit[] }),
      ]);
      setGeojson(fc as UnescoGeoJson);
      setZones(zns.items);
      setDocuments(docs.items);
      setPermits(perms.items);
    } catch (e: any) {
      setError(e?.message || 'Chargement UNESCO impossible.');
    } finally {
      setLoading(false);
    }
  }, [canSubmit]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const zonesById = useMemo(() => {
    const m: Record<string, UnescoZone> = {};
    for (const z of zones) m[z.id] = z;
    return m;
  }, [zones]);

  const docsById = useMemo(() => {
    const m: Record<string, UnescoDocument> = {};
    for (const d of documents) m[d.id] = d;
    return m;
  }, [documents]);

  return (
    <div>
      <div className="mb-10 pb-6 border-b border-aaj-border">
        <span className="text-[10px] uppercase tracking-[3px] text-aaj-royal font-black">
          Patrimoine mondial
        </span>
        <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tight mt-2">
          Djerba UNESCO
        </h2>
        <p className="mt-3 text-sm text-aaj-gray max-w-3xl leading-relaxed">
          Cartographie interactive du territoire classé, documents de référence du classement, et
          suivi des demandes de permis déposées à l'intérieur du périmètre.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        <SubTabButton
          active={tab === 'map'}
          onClick={() => setTab('map')}
          icon={<MapIcon size={16} />}
          label="Carte & règlements"
        />
        <SubTabButton
          active={tab === 'documents'}
          onClick={() => setTab('documents')}
          icon={<FolderOpen size={16} />}
          label={`Documents (${documents.length})`}
        />
        {canSubmit && (
          <SubTabButton
            active={tab === 'permits'}
            onClick={() => setTab('permits')}
            icon={<FileText size={16} />}
            label={`Mes demandes (${permits.length})`}
          />
        )}
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-aaj-gray text-sm py-8">
          <Loader2 size={16} className="animate-spin" /> Chargement…
        </div>
      )}
      {error && !loading && (
        <div className="flex items-start gap-3 p-4 border border-red-200 bg-red-50 text-red-700 text-sm rounded">
          <AlertCircle size={18} className="shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Erreur</p>
            <p>{error}</p>
          </div>
        </div>
      )}

      {!loading && !error && tab === 'map' && (
        <MapTab geojson={geojson} zones={zones} docsById={docsById} />
      )}
      {!loading && !error && tab === 'documents' && <DocumentsTab documents={documents} />}
      {!loading && !error && tab === 'permits' && canSubmit && (
        <PermitsTab
          permits={permits}
          geojson={geojson}
          zones={zones}
          zonesById={zonesById}
          docsById={docsById}
          onReload={loadAll}
        />
      )}
    </div>
  );
}

function SubTabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-4 py-2.5 text-[11px] font-black uppercase tracking-[2px] rounded border transition-colors ${
        active
          ? 'bg-aaj-dark text-white border-aaj-dark'
          : 'bg-white text-aaj-gray border-aaj-border hover:bg-slate-50'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

// ----------------------------------------------------------------------
// Map sub-tab
// ----------------------------------------------------------------------

function MapTab({
  geojson,
  zones,
  docsById,
}: {
  geojson: UnescoGeoJson | null;
  zones: UnescoZone[];
  docsById: Record<string, UnescoDocument>;
}) {
  const [selected, setSelected] = useState<Record<string, any> | null>(null);
  const sources = geojson?.sources ?? [];
  // `enabledSourceIds` defaults to "all active" and is re-initialised on
  // every sources-list change. Users toggle individual KMZ files via the
  // checkbox dropdown; unchecking a file hides its zones on the map.
  const [enabledSourceIds, setEnabledSourceIds] = useState<Set<string>>(
    () => new Set(sources.map((s) => s.id))
  );
  useEffect(() => {
    setEnabledSourceIds(new Set(sources.map((s) => s.id)));
    // We intentionally re-sync on sources ID set change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sources.map((s) => s.id).join(',')]);

  const filteredGeojson = useMemo<UnescoGeoJson | null>(() => {
    if (!geojson) return null;
    if (sources.length <= 1) return geojson;
    return {
      ...geojson,
      features: geojson.features.filter((f) => {
        const sid = f.properties?.kmzSourceId as string | undefined;
        return !sid || enabledSourceIds.has(sid);
      }),
    };
  }, [geojson, enabledSourceIds, sources.length]);

  const visibleZones = useMemo(() => {
    const kept = zones.filter((z) => z.isVisible !== false);
    if (sources.length <= 1) return kept;
    return kept.filter((z) => enabledSourceIds.has(z.kmzSourceId));
  }, [zones, sources.length, enabledSourceIds]);

  const isEmpty = !geojson || geojson.features.length === 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      <div className="lg:col-span-3">
        {sources.length > 1 && (
          <div className="mb-4">
            <KmzMultiSelect
              sources={sources}
              enabled={enabledSourceIds}
              onChange={setEnabledSourceIds}
            />
          </div>
        )}
        {isEmpty ? (
          <div className="border border-aaj-border rounded p-8 text-center bg-slate-50">
            <Info className="mx-auto text-aaj-gray mb-3" size={24} />
            <p className="text-sm text-aaj-gray">
              Aucun fichier KMZ n'est publié pour l'instant. L'administrateur peut en déposer depuis{' '}
              <strong>Paramètres UNESCO</strong>.
            </p>
          </div>
        ) : (
          <div className="relative">
            <UnescoMap
              geojson={filteredGeojson}
              onZoneClick={(props) => setSelected(props)}
              height={520}
              fitKey={Array.from(enabledSourceIds).sort().join(',')}
            />
            {selected && (
              <ZonePopup props={selected} docsById={docsById} onClose={() => setSelected(null)} />
            )}
          </div>
        )}
      </div>

      <aside className="lg:col-span-1">
        <div className="border border-aaj-border rounded p-4">
          <h3 className="text-[10px] font-black uppercase tracking-[3px] text-aaj-gray mb-4">
            Légende des zones
          </h3>
          {visibleZones.length === 0 ? (
            <p className="text-xs text-aaj-gray">Aucune zone publiée.</p>
          ) : (
            <ul className="space-y-3">
              {visibleZones.map((z) => (
                <li key={z.id} className="flex items-start gap-3">
                  <span
                    className="inline-block w-4 h-4 mt-1 rounded-sm border border-black/10 shrink-0"
                    style={{ background: z.color, opacity: 0.6 }}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-bold leading-tight">{z.name}</p>
                    <p className="text-[10px] uppercase tracking-[2px] text-aaj-gray mt-0.5">
                      {zoneTypeLabel(z.zoneType)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </div>
  );
}

/**
 * Small dropdown that lets the member choose which KMZ files are layered on
 * the map. Only surfaces when 2+ sources exist — a single source needs no
 * toggle.
 */
function KmzMultiSelect({
  sources,
  enabled,
  onChange,
}: {
  sources: NonNullable<UnescoGeoJson['sources']>;
  enabled: Set<string>;
  onChange: (next: Set<string>) => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const toggle = (id: string) => {
    const next = new Set(enabled);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  };
  const allOn = () => onChange(new Set(sources.map((s) => s.id)));
  const allOff = () => onChange(new Set());

  const total = sources.length;
  const checked = sources.filter((s) => enabled.has(s.id)).length;

  return (
    <div ref={containerRef} className="relative inline-block text-left">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 px-3 py-2 border border-aaj-border text-[10px] uppercase tracking-[2px] font-black rounded bg-white hover:bg-slate-50"
      >
        <Layers size={14} />
        Cartes affichées ({checked}/{total})
        <ChevronDown size={14} />
      </button>
      {open && (
        <div className="absolute z-[500] mt-1 w-72 border border-aaj-border bg-white shadow-lg rounded overflow-hidden">
          <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-aaj-border bg-slate-50">
            <button
              type="button"
              onClick={allOn}
              className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[2px] font-black text-aaj-royal hover:underline"
            >
              <CheckCheck size={12} /> Tout cocher
            </button>
            <button
              type="button"
              onClick={allOff}
              className="text-[10px] uppercase tracking-[2px] font-black text-aaj-gray hover:text-aaj-dark hover:underline"
            >
              Tout décocher
            </button>
          </div>
          <ul className="max-h-72 overflow-y-auto divide-y divide-aaj-border">
            {sources.map((s) => (
              <li key={s.id}>
                <label className="flex items-start gap-3 px-3 py-2.5 hover:bg-slate-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enabled.has(s.id)}
                    onChange={() => toggle(s.id)}
                    className="mt-1"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold truncate">{s.title}</p>
                    <p className="text-[10px] uppercase tracking-[2px] text-aaj-gray mt-0.5">
                      {s.featureCount} zone{s.featureCount > 1 ? 's' : ''}
                    </p>
                  </div>
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ZonePopup({
  props,
  docsById,
  onClose,
}: {
  props: Record<string, any>;
  docsById: Record<string, UnescoDocument>;
  onClose: () => void;
}) {
  const name = props.name || 'Zone';
  const type = typeof props.zoneType === 'string' ? zoneTypeLabel(props.zoneType) : null;
  const short = typeof props.regulationShort === 'string' ? props.regulationShort : null;
  const docId = typeof props.regulationDocId === 'string' ? props.regulationDocId : null;
  const external = typeof props.externalUrl === 'string' ? props.externalUrl : null;
  const doc = docId ? docsById[docId] : null;

  const panelRef = useRef<HTMLDivElement | null>(null);

  // Close the popup on any click outside its frame, or on Escape. The
  // listener is registered AFTER the mount, so the very click that opened
  // the popup can't reach here. Zone polygons call stopPropagation on the
  // original DOM event so picking a different zone swaps the content
  // instead of closing → reopening.
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!panelRef.current) return;
      if (!panelRef.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="false"
      className="absolute top-4 right-4 z-[500] max-w-sm w-[calc(100%-2rem)] border border-aaj-border bg-white shadow-2xl rounded overflow-hidden"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="px-4 py-3 bg-aaj-dark text-white flex items-start justify-between gap-3">
        <div>
          <p className="text-[9px] uppercase tracking-[3px] opacity-70">Règlement applicable</p>
          <h4 className="text-sm font-black uppercase tracking-wider leading-tight mt-0.5">
            {name}
          </h4>
          {type && <p className="text-[10px] uppercase tracking-[2px] opacity-70 mt-1">{type}</p>}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 hover:bg-white/10 rounded"
          aria-label="Fermer"
        >
          <X size={16} />
        </button>
      </div>
      <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
        {short ? (
          <p className="text-[13px] leading-relaxed text-aaj-dark whitespace-pre-line">{short}</p>
        ) : (
          <p className="text-xs text-aaj-gray italic">
            Règlement non encore renseigné pour cette zone.
          </p>
        )}
        {doc && (
          <a
            href={doc.downloadUrl ?? doc.externalUrl ?? '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-3 py-2 bg-aaj-royal text-white text-[10px] uppercase tracking-[2px] font-black rounded hover:bg-aaj-dark"
          >
            <Download size={14} /> Règlement complet
          </a>
        )}
        {!doc && external && (
          <a
            href={external}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-3 py-2 bg-aaj-royal text-white text-[10px] uppercase tracking-[2px] font-black rounded hover:bg-aaj-dark"
          >
            <ExternalLink size={14} /> Référence externe
          </a>
        )}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// Documents sub-tab
// ----------------------------------------------------------------------

function DocumentsTab({ documents }: { documents: UnescoDocument[] }) {
  const [category, setCategory] = useState<string>('all');
  const [q, setQ] = useState('');

  const categories = useMemo(() => {
    const present = new Set(documents.map((d) => d.category));
    return [
      { key: 'all', label: `Tous (${documents.length})` },
      ...DOCUMENT_CATEGORIES.filter((c) => present.has(c.key)).map((c) => ({
        key: c.key,
        label: `${c.label} (${documents.filter((d) => d.category === c.key).length})`,
      })),
    ];
  }, [documents]);

  const filtered = useMemo(() => {
    const qn = q.trim().toLowerCase();
    return documents.filter((d) => {
      if (category !== 'all' && d.category !== category) return false;
      if (!qn) return true;
      return (
        d.title.toLowerCase().includes(qn) ||
        (d.description || '').toLowerCase().includes(qn) ||
        (d.year || '').toLowerCase().includes(qn)
      );
    });
  }, [documents, category, q]);

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setCategory(c.key)}
              className={`px-3 py-2 text-[10px] uppercase tracking-[2px] font-black rounded border ${
                category === c.key
                  ? 'bg-aaj-dark text-white border-aaj-dark'
                  : 'bg-white text-aaj-gray border-aaj-border hover:bg-slate-50'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Rechercher…"
          className="px-3 py-2 border border-aaj-border text-sm rounded w-full md:w-64"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="border border-aaj-border rounded p-8 text-center bg-slate-50 text-sm text-aaj-gray">
          Aucun document disponible.
        </div>
      ) : (
        <ul className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((d) => (
            <li key={d.id} className="border border-aaj-border rounded p-4 flex flex-col">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="text-[9px] uppercase tracking-[2px] text-aaj-royal font-black">
                    {documentCategoryLabel(d.category)}
                  </span>
                  <h3 className="font-bold text-sm mt-1 leading-tight">{d.title}</h3>
                </div>
                <FileText className="text-aaj-gray shrink-0" size={18} />
              </div>
              {d.description && (
                <p className="text-xs text-aaj-gray mt-2 leading-relaxed line-clamp-3">
                  {d.description}
                </p>
              )}
              <div className="mt-3 flex items-center gap-3 text-[10px] uppercase tracking-[2px] text-aaj-gray">
                {d.year && <span>{d.year}</span>}
                {d.language && <span>{d.language.toUpperCase()}</span>}
              </div>
              <div className="mt-auto pt-4 flex gap-2">
                {d.downloadUrl && (
                  <a
                    href={d.downloadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black uppercase tracking-[2px] bg-aaj-dark text-white rounded hover:bg-aaj-royal"
                  >
                    <Download size={12} /> Télécharger
                  </a>
                )}
                {d.externalUrl && (
                  <a
                    href={d.externalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black uppercase tracking-[2px] border border-aaj-border rounded hover:bg-slate-50"
                  >
                    <ExternalLink size={12} /> Lien
                  </a>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------
// Permits sub-tab — list + form + detail
// ----------------------------------------------------------------------

function PermitsTab({
  permits,
  geojson,
  zones,
  zonesById,
  docsById,
  onReload,
}: {
  permits: UnescoPermit[];
  geojson: UnescoGeoJson | null;
  zones: UnescoZone[];
  zonesById: Record<string, UnescoZone>;
  docsById: Record<string, UnescoDocument>;
  onReload: () => Promise<void>;
}) {
  const [mode, setMode] = useState<'list' | 'form' | 'detail'>('list');
  const [selected, setSelected] = useState<UnescoPermit | null>(null);
  const [editing, setEditing] = useState<UnescoPermit | null>(null);

  const openDetail = async (id: string) => {
    const { item } = await api.unesco.getPermit(id);
    setSelected(item);
    setMode('detail');
  };

  const openForm = (permit: UnescoPermit | null) => {
    setEditing(permit);
    setMode('form');
  };

  return (
    <div>
      {mode === 'list' && (
        <PermitsListForMember permits={permits} onOpen={openDetail} onNew={() => openForm(null)} />
      )}
      {mode === 'form' && (
        <PermitForm
          initial={editing}
          geojson={geojson}
          zones={zones}
          onCancel={() => {
            setMode(editing ? 'detail' : 'list');
          }}
          onSaved={async (item) => {
            await onReload();
            setSelected(item);
            setMode('detail');
          }}
        />
      )}
      {mode === 'detail' && selected && (
        <PermitDetailMember
          permit={selected}
          zonesById={zonesById}
          docsById={docsById}
          onBack={() => {
            setSelected(null);
            setMode('list');
          }}
          onEdit={() => openForm(selected)}
          onReload={async () => {
            await onReload();
            const { item } = await api.unesco.getPermit(selected.id);
            setSelected(item);
          }}
        />
      )}
    </div>
  );
}

function PermitsListForMember({
  permits,
  onOpen,
  onNew,
}: {
  permits: UnescoPermit[];
  onOpen: (id: string) => void;
  onNew: () => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-aaj-gray">
          {permits.length === 0
            ? "Vous n'avez déposé aucune demande pour l'instant."
            : `${permits.length} demande${permits.length > 1 ? 's' : ''} au total.`}
        </p>
        <button
          type="button"
          onClick={onNew}
          className="inline-flex items-center gap-2 px-4 py-2 bg-aaj-royal text-white text-[10px] font-black uppercase tracking-[2px] rounded hover:bg-aaj-dark"
        >
          <PlusCircle size={14} /> Nouvelle demande
        </button>
      </div>

      {permits.length === 0 ? (
        <div className="border border-dashed border-aaj-border rounded p-10 text-center">
          <FileText className="mx-auto text-aaj-gray mb-3" size={28} />
          <p className="text-sm text-aaj-gray">
            Créez votre première demande pour la faire instruire.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto border border-aaj-border rounded">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-aaj-border">
              <tr className="text-[10px] uppercase tracking-[2px] text-aaj-gray">
                <th className="text-left px-4 py-3">Projet</th>
                <th className="text-left px-4 py-3">Adresse</th>
                <th className="text-left px-4 py-3">Statut</th>
                <th className="text-left px-4 py-3">Dernière MAJ</th>
                <th className="px-2 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {permits.map((p) => (
                <tr
                  key={p.id}
                  className="border-b border-aaj-border last:border-0 hover:bg-slate-50 cursor-pointer"
                  onClick={() => onOpen(p.id)}
                >
                  <td className="px-4 py-3">
                    <p className="font-bold">{p.title}</p>
                    {p.projectRef && <p className="text-xs text-aaj-gray">Réf. {p.projectRef}</p>}
                  </td>
                  <td className="px-4 py-3 text-aaj-gray">
                    {p.address ? p.address : '—'}
                    {p.city ? `, ${p.city}` : ''}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={p.status} />
                  </td>
                  <td className="px-4 py-3 text-xs text-aaj-gray">{formatDateTime(p.updatedAt)}</td>
                  <td className="px-2 py-3 text-aaj-gray">
                    <ChevronRight size={16} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function PermitForm({
  initial,
  geojson,
  zones,
  onCancel,
  onSaved,
}: {
  initial: UnescoPermit | null;
  geojson: UnescoGeoJson | null;
  zones: UnescoZone[];
  onCancel: () => void;
  onSaved: (permit: UnescoPermit) => Promise<void> | void;
}) {
  // `parcelNumber` doubles as the land-type flag ("Zone urbaine" /
  // "Zone agricole") — stored in the existing column to avoid a schema
  // migration.
  const initialLandType =
    initial?.parcelNumber && LAND_TYPES.some((l) => l.key === initial.parcelNumber)
      ? initial.parcelNumber
      : '';

  const [form, setForm] = useState({
    title: initial?.title ?? '',
    description: initial?.description ?? '',
    address: initial?.address ?? '',
    city: initial?.city ?? '',
    landType: initialLandType,
    projectType: initial?.projectType ?? '',
    surfaceSqm: initial?.surfaceSqm?.toString() ?? '',
    floorsCount: initial?.floorsCount?.toString() ?? '',
    latitude: initial?.latitude ?? null,
    longitude: initial?.longitude ?? null,
  });

  // 3 mandatory slots (architecture / topography / property deed). Each
  // slot accepts exactly one file, staged locally and uploaded on save.
  const [slotFiles, setSlotFiles] = useState<Record<string, File | null>>({
    architecture: null,
    topography: null,
    property_deed: null,
  });
  // Extra free-form attachments.
  const [otherFiles, setOtherFiles] = useState<File[]>([]);

  const slotInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const otherInputRef = useRef<HTMLInputElement | null>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const zonesById = useMemo(() => {
    const m: Record<string, UnescoZone> = {};
    for (const z of zones) m[z.id] = z;
    return m;
  }, [zones]);

  const autoZone = useMemo(() => {
    if (!geojson || form.latitude === null || form.longitude === null) return null;
    // Client-side point-in-polygon hint only — server recomputes at save.
    for (const feat of geojson.features) {
      if (pointInGeometry(feat.geometry, form.longitude, form.latitude)) {
        const zid = feat.properties.zoneId as string | undefined;
        if (zid && zonesById[zid]) return zonesById[zid];
      }
    }
    return null;
  }, [geojson, form.latitude, form.longitude, zonesById]);

  const update = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handlePick = (c: { lat: number; lng: number }) => {
    setForm((prev) => ({ ...prev, latitude: c.lat, longitude: c.lng }));
  };

  // Look up which of the existing attachments fill each main slot so the
  // UI can show "déjà joint" next to the upload control.
  const existingByKind = useMemo(() => {
    const m: Record<string, UnescoPermit['files'][number] | undefined> = {};
    if (initial) {
      for (const f of initial.files) {
        if (!m[f.kind]) m[f.kind] = f;
      }
    }
    return m;
  }, [initial]);

  const uploadAndReplaceSlot = async (
    permitId: string,
    kind: string,
    file: File
  ): Promise<UnescoPermit | null> => {
    // If a file already exists for this slot, detach it first so we only
    // ever keep one architecture / topography / deed at a time.
    const existing = existingByKind[kind];
    let latest: UnescoPermit | null = null;
    if (existing) {
      try {
        const r = await api.unesco.detachPermitFile(permitId, existing.id);
        latest = r.item;
      } catch (e) {
        console.error('Détachement de l\'ancien fichier échoué', e);
      }
    }
    const up = await api.uploadFile(file, 'unesco_permits', 'private');
    const { item } = await api.unesco.attachPermitFile(permitId, {
      fileId: up.id,
      title: file.name,
      kind,
    });
    latest = item;
    return latest;
  };

  const handleSubmit = async (submitToReview: boolean) => {
    setError(null);
    if (!form.title.trim()) {
      setError('Le titre est obligatoire.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description || undefined,
        address: form.address || undefined,
        city: form.city || undefined,
        // Re-use the `parcelNumber` column to store the land type.
        parcelNumber: form.landType || undefined,
        projectType: form.projectType || undefined,
        surfaceSqm: form.surfaceSqm ? Number(form.surfaceSqm) : undefined,
        floorsCount: form.floorsCount ? Number(form.floorsCount) : undefined,
        latitude: form.latitude ?? undefined,
        longitude: form.longitude ?? undefined,
      };

      let result: UnescoPermit;
      if (initial) {
        const { item } = await api.unesco.updatePermit(initial.id, payload);
        result = item;
      } else {
        const { item } = await api.unesco.createPermit(payload);
        result = item;
      }

      // Upload the main 3 slots, each with its specific `kind`.
      for (const slot of PERMIT_MAIN_UPLOAD_SLOTS) {
        const file = slotFiles[slot.kind];
        if (!file) continue;
        try {
          const updated = await uploadAndReplaceSlot(result.id, slot.kind, file);
          if (updated) result = updated;
        } catch (e) {
          console.error('Upload ' + slot.label + ' échoué', e);
        }
      }

      // Upload additional files as generic attachments.
      for (const f of otherFiles) {
        try {
          const up = await api.uploadFile(f, 'unesco_permits', 'private');
          const { item } = await api.unesco.attachPermitFile(result.id, {
            fileId: up.id,
            title: f.name,
            kind: 'attachment',
          });
          result = item;
        } catch (e) {
          console.error('Upload pièce jointe échouée', e);
        }
      }

      if (submitToReview && result.status === 'draft') {
        const { item } = await api.unesco.submitPermit(result.id);
        result = item;
      }

      await onSaved(result);
    } catch (e: any) {
      setError(e?.message || 'Enregistrement échoué.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-xl font-black uppercase tracking-tight">
            {initial ? 'Modifier la demande INP' : 'Nouvelle demande INP'}
          </h3>
          <p className="text-xs text-aaj-gray mt-1">
            Les champs marqués d'un astérisque sont obligatoires.
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-2 border border-aaj-border text-[10px] uppercase tracking-[2px] font-black rounded hover:bg-slate-50"
        >
          Annuler
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <Field label="Titre du projet *">
            <input
              type="text"
              value={form.title}
              onChange={(e) => update('title', e.target.value)}
              className="w-full px-3 py-2 border border-aaj-border text-sm rounded"
              placeholder="Ex. Réhabilitation maison Ben Ayed"
            />
          </Field>
          <Field label="Type de projet">
            <input
              type="text"
              value={form.projectType}
              onChange={(e) => update('projectType', e.target.value)}
              className="w-full px-3 py-2 border border-aaj-border text-sm rounded"
              placeholder="Réhabilitation, construction…"
            />
          </Field>
          <Field label="Description">
            <textarea
              value={form.description}
              onChange={(e) => update('description', e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-aaj-border text-sm rounded"
              placeholder="Nature des travaux, objectifs…"
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Surface couverte totale (m²)">
              <input
                type="number"
                step="0.01"
                value={form.surfaceSqm}
                onChange={(e) => update('surfaceSqm', e.target.value)}
                className="w-full px-3 py-2 border border-aaj-border text-sm rounded"
              />
            </Field>
            <Field label="Nombre de niveaux">
              <input
                type="number"
                value={form.floorsCount}
                onChange={(e) => update('floorsCount', e.target.value)}
                className="w-full px-3 py-2 border border-aaj-border text-sm rounded"
              />
            </Field>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Adresse">
              <input
                type="text"
                value={form.address}
                onChange={(e) => update('address', e.target.value)}
                className="w-full px-3 py-2 border border-aaj-border text-sm rounded"
              />
            </Field>
            <Field label="Municipalité">
              <select
                value={form.city}
                onChange={(e) => update('city', e.target.value)}
                className="w-full px-3 py-2 border border-aaj-border text-sm rounded bg-white"
              >
                <option value="">— Choisir —</option>
                {DJERBA_MUNICIPALITIES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Type de terrain">
            <div
              role="radiogroup"
              aria-label="Type de terrain"
              className="flex flex-wrap gap-2"
            >
              {LAND_TYPES.map((lt) => {
                const active = form.landType === lt.key;
                return (
                  <button
                    key={lt.key}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => update('landType', active ? '' : lt.key)}
                    className={`inline-flex items-center gap-2 px-3 py-2 text-[11px] uppercase tracking-[2px] font-black rounded border ${
                      active
                        ? 'bg-aaj-dark text-white border-aaj-dark'
                        : 'bg-white text-aaj-gray border-aaj-border hover:bg-slate-50'
                    }`}
                  >
                    <span
                      aria-hidden
                      className={`inline-block w-3 h-3 rounded-sm border ${
                        active ? 'bg-white border-white' : 'border-aaj-border'
                      }`}
                    />
                    {lt.label}
                  </button>
                );
              })}
            </div>
          </Field>
          <Field label="Localisation sur la carte (cliquez pour placer l'épingle)">
            <UnescoMap
              geojson={geojson}
              onPick={handlePick}
              marker={
                form.latitude !== null && form.longitude !== null
                  ? { lat: form.latitude, lng: form.longitude, label: 'Projet' }
                  : null
              }
              height={320}
            />
            <div className="mt-2 flex items-center gap-3 text-xs text-aaj-gray">
              <MapPin size={14} />
              {form.latitude !== null && form.longitude !== null ? (
                <span>
                  {form.latitude.toFixed(5)}, {form.longitude.toFixed(5)}
                </span>
              ) : (
                <span>Aucune position choisie.</span>
              )}
              {autoZone && (
                <span
                  className="inline-flex items-center gap-1.5 px-2 py-1 border rounded text-[9px] uppercase tracking-[2px] font-black"
                  style={{ borderColor: autoZone.color, color: autoZone.color }}
                >
                  {autoZone.name}
                </span>
              )}
            </div>
          </Field>
        </div>
      </div>

      <div>
        <h4 className="text-[10px] font-black uppercase tracking-[2px] text-aaj-gray mb-3">
          Pièces obligatoires
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {PERMIT_MAIN_UPLOAD_SLOTS.map((slot) => {
            const pending = slotFiles[slot.kind];
            const existing = existingByKind[slot.kind];
            const filled = Boolean(pending || existing);
            return (
              <div
                key={slot.kind}
                className={`border rounded p-4 ${
                  filled ? 'border-aaj-royal bg-slate-50' : 'border-dashed border-aaj-border'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[10px] uppercase tracking-[2px] font-black text-aaj-royal">
                    {slot.label}
                  </p>
                  {filled && <CheckCheck size={14} className="text-aaj-royal" />}
                </div>
                <p className="text-[11px] text-aaj-gray mt-1 leading-snug">{slot.hint}</p>

                {pending && (
                  <div className="mt-3 flex items-center justify-between gap-2 text-xs">
                    <span className="inline-flex items-center gap-1.5 text-aaj-dark truncate">
                      <Paperclip size={12} />
                      {pending.name}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setSlotFiles((prev) => ({ ...prev, [slot.kind]: null }))
                      }
                      className="text-red-600 hover:underline"
                    >
                      Retirer
                    </button>
                  </div>
                )}
                {!pending && existing && (
                  <p className="mt-3 text-xs text-aaj-gray">
                    <Paperclip size={12} className="inline mr-1" />
                    Déjà joint : {existing.title || existing.originalName}
                  </p>
                )}

                <button
                  type="button"
                  onClick={() => slotInputRefs.current[slot.kind]?.click()}
                  className="mt-3 inline-flex items-center gap-2 px-3 py-2 border border-aaj-border text-[10px] uppercase tracking-[2px] font-black rounded hover:bg-white bg-white"
                >
                  <Upload size={12} />
                  {existing || pending ? 'Remplacer' : 'Téléverser'}
                </button>
                <input
                  ref={(el) => {
                    slotInputRefs.current[slot.kind] = el;
                  }}
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f)
                      setSlotFiles((prev) => ({ ...prev, [slot.kind]: f }));
                    e.target.value = '';
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <h4 className="text-[10px] font-black uppercase tracking-[2px] text-aaj-gray mb-3">
          Autres pièces (optionnel)
        </h4>
        <div className="border border-dashed border-aaj-border rounded p-4">
          <button
            type="button"
            onClick={() => otherInputRef.current?.click()}
            className="inline-flex items-center gap-2 px-3 py-2 border border-aaj-border text-[10px] uppercase tracking-[2px] font-black rounded hover:bg-slate-50"
          >
            <Upload size={14} /> Ajouter un fichier
          </button>
          <input
            ref={otherInputRef}
            type="file"
            className="hidden"
            multiple
            onChange={(e) => {
              const sel = Array.from(e.target.files ?? []);
              setOtherFiles((prev) => [...prev, ...sel]);
              e.target.value = '';
            }}
          />
          {otherFiles.length > 0 && (
            <ul className="mt-3 space-y-1 text-xs">
              {otherFiles.map((f, i) => (
                <li key={i} className="flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-2">
                    <Paperclip size={12} />
                    {f.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => setOtherFiles((prev) => prev.filter((_, idx) => idx !== i))}
                    className="text-red-600 hover:underline"
                  >
                    Retirer
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3 border border-red-200 bg-red-50 text-red-700 text-sm rounded flex items-start gap-2">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-aaj-border">
        <button
          type="button"
          disabled={saving}
          onClick={() => handleSubmit(false)}
          className="inline-flex items-center gap-2 px-4 py-2 border border-aaj-border text-[10px] uppercase tracking-[2px] font-black rounded hover:bg-slate-50 disabled:opacity-50"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Pencil size={14} />}
          {initial ? 'Enregistrer le brouillon' : 'Sauver en brouillon'}
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => handleSubmit(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-aaj-royal text-white text-[10px] uppercase tracking-[2px] font-black rounded hover:bg-aaj-dark disabled:opacity-50"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          Déposer pour instruction
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[10px] font-black uppercase tracking-[2px] text-aaj-gray mb-1.5">
        {label}
      </span>
      {children}
    </label>
  );
}

// Client-side point-in-geometry. Only used as a UX hint — the server
// rematches authoritatively at save time.
function pointInGeometry(geom: any, lng: number, lat: number): boolean {
  if (!geom) return false;
  if (geom.type === 'Polygon') return pointInRings(geom.coordinates, lng, lat);
  if (geom.type === 'MultiPolygon') {
    for (const poly of geom.coordinates) if (pointInRings(poly, lng, lat)) return true;
  }
  return false;
}
function pointInRings(rings: number[][][], lng: number, lat: number): boolean {
  if (!rings.length) return false;
  if (!pointInRing(rings[0], lng, lat)) return false;
  for (let i = 1; i < rings.length; i++) if (pointInRing(rings[i], lng, lat)) return false;
  return true;
}
function pointInRing(ring: number[][], lng: number, lat: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersect =
      yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi || 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

// ----------------------------------------------------------------------
// Permit detail (member-side)
// ----------------------------------------------------------------------

function PermitDetailMember({
  permit,
  zonesById,
  docsById,
  onBack,
  onEdit,
  onReload,
}: {
  permit: UnescoPermit;
  zonesById: Record<string, UnescoZone>;
  docsById: Record<string, UnescoDocument>;
  onBack: () => void;
  onEdit: () => void;
  onReload: () => Promise<void>;
}) {
  const [withdrawing, setWithdrawing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const addFileInputRef = useRef<HTMLInputElement | null>(null);

  const zone = permit.finalZoneId
    ? zonesById[permit.finalZoneId]
    : permit.autoZoneId
      ? zonesById[permit.autoZoneId]
      : null;

  const canEdit = permit.status === 'draft';
  const canWithdraw = !['approved', 'rejected', 'withdrawn', 'draft'].includes(permit.status);
  const canDelete = permit.status === 'draft';

  const handleWithdraw = async () => {
    if (!window.confirm('Retirer cette demande ? Cette action est définitive.')) return;
    setWithdrawing(true);
    try {
      await api.unesco.addPermitEvent(permit.id, {
        toStatus: 'withdrawn',
        message: 'Demande retirée par le demandeur.',
      });
      await onReload();
    } finally {
      setWithdrawing(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Supprimer ce brouillon ?')) return;
    setDeleting(true);
    try {
      await api.unesco.deletePermit(permit.id);
      onBack();
    } finally {
      setDeleting(false);
    }
  };

  const handleAddFiles = async (list: FileList | null) => {
    if (!list || list.length === 0) return;
    setUploading(true);
    try {
      for (const f of Array.from(list)) {
        const up = await api.uploadFile(f, 'unesco_permits', 'private');
        await api.unesco.attachPermitFile(permit.id, { fileId: up.id, title: f.name });
      }
      await onReload();
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="text-[10px] uppercase tracking-[2px] font-black text-aaj-gray hover:text-aaj-dark"
          >
            ← Retour aux demandes
          </button>
          <h3 className="text-2xl font-black uppercase tracking-tight mt-2">{permit.title}</h3>
          {permit.projectRef && (
            <p className="text-xs text-aaj-gray mt-1">Référence : {permit.projectRef}</p>
          )}
        </div>
        <StatusBadge status={permit.status} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2 space-y-6">
          <InfoCard title="Informations générales">
            <Info2Col
              rows={[
                ['Type de projet', permit.projectType || '—'],
                ['Surface (m²)', permit.surfaceSqm ? permit.surfaceSqm.toString() : '—'],
                ['Niveaux', permit.floorsCount != null ? permit.floorsCount.toString() : '—'],
                ['Adresse', [permit.address, permit.city].filter(Boolean).join(', ') || '—'],
                ['Parcelle', permit.parcelNumber || '—'],
                [
                  'Coordonnées',
                  permit.latitude != null && permit.longitude != null
                    ? `${permit.latitude.toFixed(5)}, ${permit.longitude.toFixed(5)}`
                    : '—',
                ],
              ]}
            />
            {permit.description && (
              <div className="mt-4 pt-4 border-t border-aaj-border">
                <p className="text-[10px] uppercase tracking-[2px] text-aaj-gray font-black mb-1">
                  Description
                </p>
                <p className="text-sm whitespace-pre-line">{permit.description}</p>
              </div>
            )}
          </InfoCard>

          {zone && (
            <InfoCard title="Zone UNESCO concernée">
              <div className="flex items-start gap-3">
                <span
                  className="inline-block w-4 h-4 mt-1 rounded-sm border border-black/10 shrink-0"
                  style={{ background: zone.color, opacity: 0.7 }}
                />
                <div>
                  <p className="font-bold">{zone.name}</p>
                  <p className="text-[10px] uppercase tracking-[2px] text-aaj-gray mt-0.5">
                    {zoneTypeLabel(zone.zoneType)}
                  </p>
                  {zone.regulationShort && (
                    <p className="text-sm mt-3 whitespace-pre-line">{zone.regulationShort}</p>
                  )}
                  {zone.regulationDocId && docsById[zone.regulationDocId]?.downloadUrl && (
                    <a
                      href={docsById[zone.regulationDocId].downloadUrl ?? '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 border border-aaj-border text-[10px] uppercase tracking-[2px] font-black rounded hover:bg-slate-50"
                    >
                      <Download size={12} /> Règlement complet
                    </a>
                  )}
                </div>
              </div>
            </InfoCard>
          )}

          <InfoCard
            title="Pièces jointes"
            action={
              canEdit || permit.status === 'info_requested' ? (
                <>
                  <button
                    type="button"
                    onClick={() => addFileInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-aaj-border text-[10px] uppercase tracking-[2px] font-black rounded hover:bg-slate-50"
                  >
                    {uploading ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Upload size={12} />
                    )}
                    Ajouter
                  </button>
                  <input
                    ref={addFileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      void handleAddFiles(e.target.files);
                      e.target.value = '';
                    }}
                  />
                </>
              ) : null
            }
          >
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
                    {canEdit && (
                      <button
                        type="button"
                        onClick={async () => {
                          if (!window.confirm('Retirer cette pièce ?')) return;
                          await api.unesco.detachPermitFile(permit.id, f.id);
                          await onReload();
                        }}
                        className="text-red-600 text-xs hover:underline"
                      >
                        Retirer
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </InfoCard>

          {permit.decisionNote && (
            <InfoCard title="Avis / Décision">
              <p className="text-sm whitespace-pre-line">{permit.decisionNote}</p>
              {permit.decisionAt && (
                <p className="text-xs text-aaj-gray mt-2">
                  Décision du {formatDateTime(permit.decisionAt)}
                </p>
              )}
            </InfoCard>
          )}
        </section>

        <aside className="space-y-4">
          <div className="border border-aaj-border rounded p-4 space-y-3">
            {canEdit && (
              <button
                type="button"
                onClick={onEdit}
                className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 bg-aaj-dark text-white text-[10px] uppercase tracking-[2px] font-black rounded hover:bg-aaj-royal"
              >
                <Pencil size={12} /> Modifier le brouillon
              </button>
            )}
            {canWithdraw && (
              <button
                type="button"
                disabled={withdrawing}
                onClick={handleWithdraw}
                className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 border border-aaj-border text-[10px] uppercase tracking-[2px] font-black rounded hover:bg-slate-50 disabled:opacity-50"
              >
                {withdrawing ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />}{' '}
                Retirer
              </button>
            )}
            {canDelete && (
              <button
                type="button"
                disabled={deleting}
                onClick={handleDelete}
                className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 border border-red-200 text-red-600 text-[10px] uppercase tracking-[2px] font-black rounded hover:bg-red-50 disabled:opacity-50"
              >
                {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}{' '}
                Supprimer
              </button>
            )}
            {!canEdit && !canWithdraw && !canDelete && (
              <p className="text-xs text-aaj-gray text-center py-2">
                Cette demande est close ; plus aucune action n'est possible.
              </p>
            )}
          </div>

          <InfoCard title="Historique">
            <EventTimeline events={permit.events} />
          </InfoCard>
        </aside>
      </div>
    </div>
  );
}

function InfoCard({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="border border-aaj-border rounded p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-[10px] font-black uppercase tracking-[3px] text-aaj-gray">{title}</h4>
        {action}
      </div>
      {children}
    </section>
  );
}

function Info2Col({ rows }: { rows: Array<[string, string]> }) {
  return (
    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
      {rows.map(([k, v]) => (
        <div key={k} className="flex items-baseline gap-2">
          <dt className="text-[10px] uppercase tracking-[2px] text-aaj-gray font-black min-w-[110px]">
            {k}
          </dt>
          <dd className="text-aaj-dark">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function EventTimeline({ events }: { events: UnescoPermit['events'] }) {
  if (events.length === 0) {
    return <p className="text-xs text-aaj-gray">Aucun événement.</p>;
  }
  return (
    <ol className="relative border-l border-aaj-border ml-2">
      {events.map((e) => (
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
          <p className="text-[11px] text-aaj-gray mt-0.5 flex items-center gap-1.5">
            <Clock size={10} /> {formatDateTime(e.createdAt)} — {e.authorName || 'Système'}
          </p>
          {e.message && <p className="text-sm mt-1.5 whitespace-pre-line">{e.message}</p>}
        </li>
      ))}
    </ol>
  );
}
