/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Admin "Paramètres UNESCO" workspace: KMZ source upload, per-zone
 * regulation enrichment, and document library management.
 *
 * Rendered inside MemberSpace when the user has `unesco_manage`.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Upload,
  FolderOpen,
  MapPin,
  Pencil,
  Trash2,
  Plus,
  Loader2,
  Save,
  X,
  ExternalLink,
  FileText,
  Eye,
  EyeOff,
  Tag,
} from 'lucide-react';
import {
  api,
  type UnescoDocument,
  type UnescoKmzSource,
  type UnescoPermitStatusDef,
  type UnescoZone,
} from '../../lib/api';
import {
  DOCUMENT_CATEGORIES,
  PermitStatusesProvider,
  StatusBadge,
  documentCategoryLabel,
  formatDateTime,
  useFetchPermitStatuses,
  zoneTypeLabel,
} from './UnescoCommon';

type Tab = 'kmz' | 'zones' | 'documents' | 'statuses';

// Curated palette for the status badge — admins pick a swatch instead
// of typing raw Tailwind classes. Mirrors the system seeds.
const STATUS_COLOR_PRESETS: Array<{ label: string; value: string }> = [
  { label: 'Ardoise', value: 'bg-slate-100 text-slate-700 border-slate-200' },
  { label: 'Ardoise (atténué)', value: 'bg-slate-100 text-slate-500 border-slate-200' },
  { label: 'Bleu', value: 'bg-blue-50 text-blue-700 border-blue-200' },
  { label: 'Indigo', value: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  { label: 'Violet', value: 'bg-purple-50 text-purple-700 border-purple-200' },
  { label: 'Ambre', value: 'bg-amber-50 text-amber-700 border-amber-200' },
  { label: 'Émeraude', value: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { label: 'Rouge', value: 'bg-red-50 text-red-700 border-red-200' },
  { label: 'Rose', value: 'bg-pink-50 text-pink-700 border-pink-200' },
  { label: 'Cyan', value: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
];

export function UnescoAdminParams() {
  const fetched = useFetchPermitStatuses();
  return (
    <PermitStatusesProvider statuses={fetched}>
      <UnescoAdminParamsInner />
    </PermitStatusesProvider>
  );
}

function UnescoAdminParamsInner() {
  const [tab, setTab] = useState<Tab>('kmz');
  const [sources, setSources] = useState<UnescoKmzSource[]>([]);
  const [zones, setZones] = useState<UnescoZone[]>([]);
  const [documents, setDocuments] = useState<UnescoDocument[]>([]);
  const [statuses, setStatuses] = useState<UnescoPermitStatusDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [kmz, zn, docs, st] = await Promise.all([
        api.unesco.listKmzSources(),
        api.unesco.listZones(),
        api.unesco.listDocuments(),
        api.unesco.listStatuses(),
      ]);
      setSources(kmz.items);
      setZones(zn.items);
      setDocuments(docs.items);
      setStatuses(st.items);
    } catch (e: any) {
      setError(e?.message || 'Chargement impossible.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  return (
    <div>
      <div className="mb-8 pb-6 border-b border-aaj-border">
        <span className="text-[10px] uppercase tracking-[3px] text-aaj-royal font-black">
          Administration
        </span>
        <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tight mt-2">
          Paramètres UNESCO
        </h2>
        <p className="mt-3 text-sm text-aaj-gray max-w-3xl leading-relaxed">
          Gérez les fichiers KMZ (Google Earth), enrichissez chaque zone avec son règlement et
          publiez les documents du classement patrimoine mondial.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        <TabButton
          active={tab === 'kmz'}
          onClick={() => setTab('kmz')}
          icon={<Upload size={14} />}
          label={`Fichiers KMZ (${sources.length})`}
        />
        <TabButton
          active={tab === 'zones'}
          onClick={() => setTab('zones')}
          icon={<MapPin size={14} />}
          label={`Zones (${zones.length})`}
        />
        <TabButton
          active={tab === 'documents'}
          onClick={() => setTab('documents')}
          icon={<FolderOpen size={14} />}
          label={`Documents (${documents.length})`}
        />
        <TabButton
          active={tab === 'statuses'}
          onClick={() => setTab('statuses')}
          icon={<Tag size={14} />}
          label={`Statuts (${statuses.length})`}
        />
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-aaj-gray text-sm py-8">
          <Loader2 size={16} className="animate-spin" /> Chargement…
        </div>
      )}
      {error && !loading && (
        <div className="p-4 border border-red-200 bg-red-50 text-red-700 text-sm rounded">
          {error}
        </div>
      )}

      {!loading && !error && tab === 'kmz' && <KmzPanel sources={sources} onReload={loadAll} />}
      {!loading && !error && tab === 'zones' && (
        <ZonesPanel zones={zones} sources={sources} documents={documents} onReload={loadAll} />
      )}
      {!loading && !error && tab === 'documents' && (
        <DocumentsPanel documents={documents} onReload={loadAll} />
      )}
      {!loading && !error && tab === 'statuses' && (
        <StatusesPanel statuses={statuses} onReload={loadAll} />
      )}
    </div>
  );
}

function TabButton({
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
// KMZ sources
// ----------------------------------------------------------------------

function KmzPanel({
  sources,
  onReload,
}: {
  sources: UnescoKmzSource[];
  onReload: () => Promise<void>;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const handleUpload = async (file: File) => {
    setError(null);
    setUploading(true);
    try {
      await api.unesco.uploadKmz(file, title || undefined, description || undefined);
      setTitle('');
      setDescription('');
      await onReload();
    } catch (e: any) {
      setError(e?.message || 'Upload KMZ échoué.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="border border-aaj-border rounded p-5">
        <h3 className="text-[10px] uppercase tracking-[3px] text-aaj-gray font-black mb-4">
          Ajouter un fichier KMZ / KML
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="block">
            <span className="block text-[10px] font-black uppercase tracking-[2px] text-aaj-gray mb-1.5">
              Titre (optionnel)
            </span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-aaj-border text-sm rounded"
              placeholder="Ex. Périmètre UNESCO 2023"
            />
          </label>
          <label className="block">
            <span className="block text-[10px] font-black uppercase tracking-[2px] text-aaj-gray mb-1.5">
              Description (optionnel)
            </span>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-aaj-border text-sm rounded"
              placeholder="Courte description…"
            />
          </label>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-aaj-royal text-white text-[10px] font-black uppercase tracking-[2px] rounded hover:bg-aaj-dark disabled:opacity-50"
          >
            {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            Téléverser
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".kmz,.kml"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleUpload(f);
              e.target.value = '';
            }}
          />
          <p className="text-xs text-aaj-gray">Formats acceptés : .kmz, .kml (10 Mo max).</p>
        </div>
        {error && <div className="mt-3 text-sm text-red-600">{error}</div>}
      </div>

      {sources.length === 0 ? (
        <div className="border border-dashed border-aaj-border rounded p-10 text-center">
          <p className="text-sm text-aaj-gray">Aucun fichier KMZ publié.</p>
        </div>
      ) : (
        <div className="overflow-x-auto border border-aaj-border rounded">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-aaj-border">
              <tr className="text-[10px] uppercase tracking-[2px] text-aaj-gray">
                <th className="text-left px-4 py-3">Titre</th>
                <th className="text-left px-4 py-3">Zones</th>
                <th className="text-left px-4 py-3">Ajouté le</th>
                <th className="text-left px-4 py-3">Actif</th>
                <th className="px-2 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {sources.map((s) => (
                <KmzRow key={s.id} source={s} onReload={onReload} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function KmzRow({ source, onReload }: { source: UnescoKmzSource; onReload: () => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(source.title);
  const [description, setDescription] = useState(source.description ?? '');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const toggleActive = async () => {
    await api.unesco.updateKmzSource(source.id, { isActive: !source.isActive });
    await onReload();
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.unesco.updateKmzSource(source.id, { title, description });
      await onReload();
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!window.confirm('Supprimer ce fichier KMZ ? Les zones associées seront supprimées.'))
      return;
    setDeleting(true);
    try {
      await api.unesco.deleteKmzSource(source.id);
      await onReload();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <tr className="border-b border-aaj-border last:border-0">
      <td className="px-4 py-3">
        {editing ? (
          <div className="space-y-2">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-2 py-1 border border-aaj-border text-sm rounded"
            />
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-2 py-1 border border-aaj-border text-xs rounded"
              placeholder="Description"
            />
          </div>
        ) : (
          <>
            <p className="font-bold">{source.title}</p>
            {source.description && (
              <p className="text-xs text-aaj-gray mt-0.5">{source.description}</p>
            )}
          </>
        )}
      </td>
      <td className="px-4 py-3 text-aaj-gray">{source.featureCount}</td>
      <td className="px-4 py-3 text-xs text-aaj-gray">{formatDateTime(source.createdAt)}</td>
      <td className="px-4 py-3">
        <button
          type="button"
          onClick={toggleActive}
          className={`inline-flex items-center gap-1.5 px-2 py-1 text-[10px] uppercase tracking-[2px] font-black rounded border ${
            source.isActive
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-slate-100 text-slate-500 border-slate-200'
          }`}
        >
          {source.isActive ? <Eye size={12} /> : <EyeOff size={12} />}
          {source.isActive ? 'Publié' : 'Masqué'}
        </button>
      </td>
      <td className="px-2 py-3">
        <div className="flex items-center gap-1 justify-end">
          {editing ? (
            <>
              <button
                type="button"
                disabled={saving}
                onClick={save}
                className="p-2 hover:bg-slate-100 rounded text-aaj-royal"
                aria-label="Enregistrer"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setTitle(source.title);
                  setDescription(source.description ?? '');
                }}
                className="p-2 hover:bg-slate-100 rounded text-aaj-gray"
                aria-label="Annuler"
              >
                <X size={14} />
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="p-2 hover:bg-slate-100 rounded text-aaj-gray"
                aria-label="Modifier"
              >
                <Pencil size={14} />
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={remove}
                className="p-2 hover:bg-red-50 rounded text-red-600 disabled:opacity-50"
                aria-label="Supprimer"
              >
                {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              </button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

// ----------------------------------------------------------------------
// Zones editor
// ----------------------------------------------------------------------

function ZonesPanel({
  zones,
  sources,
  documents,
  onReload,
}: {
  zones: UnescoZone[];
  sources: UnescoKmzSource[];
  documents: UnescoDocument[];
  onReload: () => Promise<void>;
}) {
  const [sourceFilter, setSourceFilter] = useState<string>('all');

  const sourcesById = useMemo(() => {
    const m: Record<string, UnescoKmzSource> = {};
    for (const s of sources) m[s.id] = s;
    return m;
  }, [sources]);

  const filtered = useMemo(() => {
    if (sourceFilter === 'all') return zones;
    return zones.filter((z) => z.kmzSourceId === sourceFilter);
  }, [zones, sourceFilter]);

  if (zones.length === 0) {
    return (
      <div className="border border-dashed border-aaj-border rounded p-10 text-center">
        <p className="text-sm text-aaj-gray">
          Aucune zone disponible. Téléversez d'abord un fichier KMZ.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {sources.length > 1 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] uppercase tracking-[2px] text-aaj-gray font-black">
            Filtrer par fichier :
          </span>
          <button
            type="button"
            onClick={() => setSourceFilter('all')}
            className={`px-2 py-1 text-[10px] uppercase tracking-[2px] font-black rounded border ${
              sourceFilter === 'all'
                ? 'bg-aaj-dark text-white border-aaj-dark'
                : 'bg-white text-aaj-gray border-aaj-border hover:bg-slate-50'
            }`}
          >
            Tous
          </button>
          {sources.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSourceFilter(s.id)}
              className={`px-2 py-1 text-[10px] uppercase tracking-[2px] font-black rounded border ${
                sourceFilter === s.id
                  ? 'bg-aaj-dark text-white border-aaj-dark'
                  : 'bg-white text-aaj-gray border-aaj-border hover:bg-slate-50'
              }`}
            >
              {s.title}
            </button>
          ))}
        </div>
      )}
      <ul className="space-y-3">
        {filtered.map((z) => (
          <ZoneRow
            key={z.id}
            zone={z}
            source={sourcesById[z.kmzSourceId]}
            documents={documents}
            onReload={onReload}
          />
        ))}
      </ul>
    </div>
  );
}

function ZoneRow({
  zone,
  source,
  documents,
  onReload,
}: {
  zone: UnescoZone;
  source?: UnescoKmzSource;
  documents: UnescoDocument[];
  onReload: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: zone.name,
    zoneType: zone.zoneType,
    color: zone.color,
    regulationShort: zone.regulationShort ?? '',
    regulationDocId: zone.regulationDocId ?? '',
    externalUrl: zone.externalUrl ?? '',
    isVisible: zone.isVisible,
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await api.unesco.updateZone(zone.id, {
        name: form.name,
        zoneType: form.zoneType,
        color: form.color,
        regulationShort: form.regulationShort || null,
        regulationDocId: form.regulationDocId || null,
        externalUrl: form.externalUrl || null,
        isVisible: form.isVisible,
      });
      await onReload();
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <li className="border border-aaj-border rounded overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50"
      >
        <div className="flex items-center gap-3">
          <span
            className="inline-block w-4 h-4 rounded-sm border border-black/10 shrink-0"
            style={{ background: zone.color, opacity: 0.7 }}
          />
          <div>
            <p className="font-bold text-sm">{zone.name}</p>
            <p className="text-[10px] uppercase tracking-[2px] text-aaj-gray mt-0.5">
              {zoneTypeLabel(zone.zoneType)}
              {source ? ` · ${source.title}` : ''}
              {zone.isVisible ? '' : ' · masquée'}
            </p>
          </div>
        </div>
        <div className="text-[10px] uppercase tracking-[2px] text-aaj-gray font-black">
          {open ? 'Fermer' : 'Modifier'}
        </div>
      </button>
      {open && (
        <div className="border-t border-aaj-border p-4 space-y-4 bg-slate-50">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="block">
              <span className="block text-[10px] font-black uppercase tracking-[2px] text-aaj-gray mb-1.5">
                Nom affiché
              </span>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 border border-aaj-border text-sm rounded"
              />
            </label>
            <label className="block">
              <span className="block text-[10px] font-black uppercase tracking-[2px] text-aaj-gray mb-1.5">
                Type
              </span>
              <select
                value={form.zoneType}
                onChange={(e) => setForm({ ...form, zoneType: e.target.value })}
                className="w-full px-3 py-2 border border-aaj-border text-sm rounded bg-white"
              >
                <option value="core">Zone centrale</option>
                <option value="buffer">Zone tampon</option>
                <option value="protected">Zone de protection</option>
                <option value="restricted">Zone restreinte</option>
              </select>
            </label>
            <label className="block">
              <span className="block text-[10px] font-black uppercase tracking-[2px] text-aaj-gray mb-1.5">
                Couleur
              </span>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={form.color}
                  onChange={(e) => setForm({ ...form, color: e.target.value })}
                  className="w-12 h-9 border border-aaj-border rounded cursor-pointer"
                />
                <input
                  type="text"
                  value={form.color}
                  onChange={(e) => setForm({ ...form, color: e.target.value })}
                  className="w-full px-3 py-2 border border-aaj-border text-sm rounded"
                  pattern="#[0-9a-fA-F]{6}"
                />
              </div>
            </label>
            <label className="block">
              <span className="block text-[10px] font-black uppercase tracking-[2px] text-aaj-gray mb-1.5">
                Visibilité
              </span>
              <select
                value={form.isVisible ? 'yes' : 'no'}
                onChange={(e) => setForm({ ...form, isVisible: e.target.value === 'yes' })}
                className="w-full px-3 py-2 border border-aaj-border text-sm rounded bg-white"
              >
                <option value="yes">Publiée aux membres</option>
                <option value="no">Masquée</option>
              </select>
            </label>
          </div>

          <label className="block">
            <span className="block text-[10px] font-black uppercase tracking-[2px] text-aaj-gray mb-1.5">
              Règlement (extrait affiché dans la popup)
            </span>
            <textarea
              value={form.regulationShort}
              onChange={(e) => setForm({ ...form, regulationShort: e.target.value })}
              rows={4}
              className="w-full px-3 py-2 border border-aaj-border text-sm rounded"
              placeholder="Points clés du règlement applicable…"
            />
          </label>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="block">
              <span className="block text-[10px] font-black uppercase tracking-[2px] text-aaj-gray mb-1.5">
                Règlement complet (document)
              </span>
              <select
                value={form.regulationDocId}
                onChange={(e) => setForm({ ...form, regulationDocId: e.target.value })}
                className="w-full px-3 py-2 border border-aaj-border text-sm rounded bg-white"
              >
                <option value="">— Aucun —</option>
                {documents.map((d) => (
                  <option key={d.id} value={d.id}>
                    [{documentCategoryLabel(d.category)}] {d.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="block text-[10px] font-black uppercase tracking-[2px] text-aaj-gray mb-1.5">
                Lien externe (optionnel)
              </span>
              <input
                type="url"
                value={form.externalUrl}
                onChange={(e) => setForm({ ...form, externalUrl: e.target.value })}
                className="w-full px-3 py-2 border border-aaj-border text-sm rounded"
                placeholder="https://…"
              />
            </label>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 bg-aaj-royal text-white text-[10px] font-black uppercase tracking-[2px] rounded hover:bg-aaj-dark disabled:opacity-50"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Enregistrer
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="px-4 py-2 border border-aaj-border text-[10px] font-black uppercase tracking-[2px] rounded hover:bg-slate-50"
            >
              Fermer
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

// ----------------------------------------------------------------------
// Documents editor
// ----------------------------------------------------------------------

function DocumentsPanel({
  documents,
  onReload,
}: {
  documents: UnescoDocument[];
  onReload: () => Promise<void>;
}) {
  const [isCreating, setIsCreating] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-aaj-gray">
          {documents.length} document{documents.length > 1 ? 's' : ''} publié
          {documents.length > 1 ? 's' : ''}.
        </p>
        <button
          type="button"
          onClick={() => setIsCreating(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-aaj-royal text-white text-[10px] font-black uppercase tracking-[2px] rounded hover:bg-aaj-dark"
        >
          <Plus size={14} /> Nouveau document
        </button>
      </div>

      {isCreating && (
        <DocumentForm
          onSave={async (payload) => {
            await api.unesco.createDocument(payload);
            await onReload();
            setIsCreating(false);
          }}
          onCancel={() => setIsCreating(false)}
        />
      )}

      {documents.length === 0 ? (
        <div className="border border-dashed border-aaj-border rounded p-10 text-center">
          <p className="text-sm text-aaj-gray">Aucun document publié.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {documents.map((d) => (
            <DocumentRow key={d.id} document={d} onReload={onReload} />
          ))}
        </ul>
      )}
    </div>
  );
}

function DocumentRow({
  document: doc,
  onReload,
}: {
  document: UnescoDocument;
  onReload: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const toggleVisibility = async () => {
    await api.unesco.updateDocument(doc.id, { isVisible: !doc.isVisible });
    await onReload();
  };

  const remove = async () => {
    if (!window.confirm('Supprimer ce document de la bibliothèque UNESCO ?')) return;
    setDeleting(true);
    try {
      await api.unesco.deleteDocument(doc.id);
      await onReload();
    } finally {
      setDeleting(false);
    }
  };

  if (editing) {
    return (
      <li className="border border-aaj-border rounded p-4 bg-slate-50">
        <DocumentForm
          initial={doc}
          onSave={async (payload) => {
            await api.unesco.updateDocument(doc.id, payload);
            await onReload();
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      </li>
    );
  }

  return (
    <li className="border border-aaj-border rounded p-4 flex items-start justify-between gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[9px] uppercase tracking-[2px] text-aaj-royal font-black">
            {documentCategoryLabel(doc.category)}
          </span>
          {!doc.isVisible && (
            <span className="text-[9px] uppercase tracking-[2px] text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded font-black">
              Masqué
            </span>
          )}
        </div>
        <h4 className="font-bold mt-1">{doc.title}</h4>
        {doc.description && <p className="text-xs text-aaj-gray mt-1">{doc.description}</p>}
        <div className="mt-2 flex items-center gap-3 text-[10px] text-aaj-gray uppercase tracking-[2px]">
          {doc.year && <span>{doc.year}</span>}
          {doc.language && <span>{doc.language.toUpperCase()}</span>}
          {doc.downloadUrl && (
            <a
              href={doc.downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 hover:text-aaj-dark"
            >
              <FileText size={12} /> Fichier
            </a>
          )}
          {doc.externalUrl && (
            <a
              href={doc.externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 hover:text-aaj-dark"
            >
              <ExternalLink size={12} /> Lien
            </a>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={toggleVisibility}
          className="p-2 hover:bg-slate-100 rounded text-aaj-gray"
          aria-label={doc.isVisible ? 'Masquer' : 'Publier'}
        >
          {doc.isVisible ? <Eye size={14} /> : <EyeOff size={14} />}
        </button>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="p-2 hover:bg-slate-100 rounded text-aaj-gray"
          aria-label="Modifier"
        >
          <Pencil size={14} />
        </button>
        <button
          type="button"
          onClick={remove}
          disabled={deleting}
          className="p-2 hover:bg-red-50 rounded text-red-600 disabled:opacity-50"
          aria-label="Supprimer"
        >
          {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
        </button>
      </div>
    </li>
  );
}

function DocumentForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: UnescoDocument;
  onSave: (payload: Partial<UnescoDocument>) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    title: initial?.title ?? '',
    description: initial?.description ?? '',
    category: initial?.category ?? 'classement',
    fileId: initial?.fileId ?? '',
    externalUrl: initial?.externalUrl ?? '',
    year: initial?.year ?? '',
    language: initial?.language ?? 'fr',
    isVisible: initial?.isVisible ?? true,
  });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const handleUpload = async (file: File) => {
    setError(null);
    setUploading(true);
    try {
      const up = await api.uploadFile(file, 'unesco', 'members');
      setForm((prev) => ({ ...prev, fileId: up.id }));
    } catch (e: any) {
      setError(e?.message || 'Upload échoué.');
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    if (!form.title.trim()) {
      setError('Titre obligatoire.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave({
        title: form.title.trim(),
        description: form.description || null,
        category: form.category,
        fileId: form.fileId || null,
        externalUrl: form.externalUrl || null,
        year: form.year || null,
        language: form.language || null,
        isVisible: form.isVisible,
      });
    } catch (e: any) {
      setError(e?.message || 'Enregistrement échoué.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="block md:col-span-2">
          <span className="block text-[10px] font-black uppercase tracking-[2px] text-aaj-gray mb-1.5">
            Titre *
          </span>
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full px-3 py-2 border border-aaj-border text-sm rounded"
          />
        </label>
        <label className="block md:col-span-2">
          <span className="block text-[10px] font-black uppercase tracking-[2px] text-aaj-gray mb-1.5">
            Description
          </span>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={2}
            className="w-full px-3 py-2 border border-aaj-border text-sm rounded"
          />
        </label>
        <label className="block">
          <span className="block text-[10px] font-black uppercase tracking-[2px] text-aaj-gray mb-1.5">
            Catégorie
          </span>
          <select
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="w-full px-3 py-2 border border-aaj-border text-sm rounded bg-white"
          >
            {DOCUMENT_CATEGORIES.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="block text-[10px] font-black uppercase tracking-[2px] text-aaj-gray mb-1.5">
            Année / Langue
          </span>
          <div className="flex gap-2">
            <input
              type="text"
              value={form.year}
              onChange={(e) => setForm({ ...form, year: e.target.value })}
              className="w-1/2 px-3 py-2 border border-aaj-border text-sm rounded"
              placeholder="2023"
            />
            <select
              value={form.language}
              onChange={(e) => setForm({ ...form, language: e.target.value })}
              className="w-1/2 px-3 py-2 border border-aaj-border text-sm rounded bg-white"
            >
              <option value="fr">FR</option>
              <option value="ar">AR</option>
              <option value="en">EN</option>
              <option value="">—</option>
            </select>
          </div>
        </label>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="block">
          <span className="block text-[10px] font-black uppercase tracking-[2px] text-aaj-gray mb-1.5">
            Fichier
          </span>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-2 px-3 py-2 border border-aaj-border text-[10px] uppercase tracking-[2px] font-black rounded hover:bg-slate-50 disabled:opacity-50"
          >
            {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
            {form.fileId ? 'Remplacer le fichier' : 'Téléverser'}
          </button>
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleUpload(f);
              e.target.value = '';
            }}
          />
          {form.fileId && (
            <p className="mt-2 text-xs text-aaj-gray">
              Identifiant : <code className="text-[11px]">{form.fileId}</code>
            </p>
          )}
        </div>
        <label className="block">
          <span className="block text-[10px] font-black uppercase tracking-[2px] text-aaj-gray mb-1.5">
            Ou lien externe
          </span>
          <input
            type="url"
            value={form.externalUrl}
            onChange={(e) => setForm({ ...form, externalUrl: e.target.value })}
            className="w-full px-3 py-2 border border-aaj-border text-sm rounded"
            placeholder="https://…"
          />
        </label>
      </div>

      <label className="inline-flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.isVisible}
          onChange={(e) => setForm({ ...form, isVisible: e.target.checked })}
        />
        <span>Publier aux membres</span>
      </label>

      {error && <div className="text-sm text-red-600">{error}</div>}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2 bg-aaj-royal text-white text-[10px] font-black uppercase tracking-[2px] rounded hover:bg-aaj-dark disabled:opacity-50"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {initial ? 'Enregistrer' : 'Créer'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border border-aaj-border text-[10px] font-black uppercase tracking-[2px] rounded hover:bg-slate-50"
        >
          Annuler
        </button>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// Permit statuses editor
// ----------------------------------------------------------------------

// Plain-French description of each status's role in the workflow,
// shown in place of the technical "Initial / Terminal / Système" badges.
function statusRoleSentence(s: UnescoPermitStatusDef): string {
  if (s.isInitial) return 'Étape de départ — la demande commence ici';
  if (s.isApplicantWithdrawTarget) return 'Retrait — le demandeur a abandonné';
  if (s.isTerminal) return 'Étape finale — la demande est close';
  return 'Étape intermédiaire';
}

// Simple slug from the label so admins never have to think about a
// "technical key" — the backend sanitizes again and rejects collisions.
function slugifyLabel(label: string): string {
  return label
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function StatusesPanel({
  statuses,
  onReload,
}: {
  statuses: UnescoPermitStatusDef[];
  onReload: () => Promise<void>;
}) {
  const [isCreating, setIsCreating] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <p className="text-sm text-aaj-gray max-w-2xl">
          Renommez les statuts, changez leurs couleurs et choisissez vers quel statut chacun
          peut basculer. Les 8 statuts par défaut sont protégés et ne peuvent pas être
          supprimés.
        </p>
        <button
          type="button"
          onClick={() => setIsCreating(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-aaj-royal text-white text-[10px] font-black uppercase tracking-[2px] rounded hover:bg-aaj-dark"
        >
          <Plus size={14} /> Nouveau statut
        </button>
      </div>

      {isCreating && (
        <StatusForm
          allStatuses={statuses}
          onSave={async (payload) => {
            await api.unesco.createStatus(payload);
            await onReload();
            setIsCreating(false);
          }}
          onCancel={() => setIsCreating(false)}
        />
      )}

      <ul className="space-y-2">
        {statuses.map((s) => (
          <StatusRow
            key={s.key}
            status={s}
            allStatuses={statuses}
            onReload={onReload}
          />
        ))}
      </ul>
    </div>
  );
}

function StatusRow({
  status,
  allStatuses,
  onReload,
}: {
  status: UnescoPermitStatusDef;
  allStatuses: UnescoPermitStatusDef[];
  onReload: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const remove = async () => {
    if (!window.confirm(`Supprimer le statut "${status.label}" ?`)) return;
    setDeleting(true);
    try {
      await api.unesco.deleteStatus(status.key);
      await onReload();
    } catch (e: any) {
      window.alert(e?.message || 'Suppression impossible.');
    } finally {
      setDeleting(false);
    }
  };

  if (editing) {
    return (
      <li className="border border-aaj-border rounded p-4 bg-slate-50">
        <StatusForm
          initial={status}
          allStatuses={allStatuses}
          onSave={async (payload) => {
            await api.unesco.updateStatus(status.key, payload);
            await onReload();
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      </li>
    );
  }

  const transitionLabels = status.nextStatuses
    .map((k) => allStatuses.find((s) => s.key === k)?.label ?? k)
    .join(' · ');

  return (
    <li className="border border-aaj-border rounded p-4 flex items-start justify-between gap-3">
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <StatusBadge status={status.key} />
          {!status.isActive && (
            <span className="text-[10px] text-aaj-gray italic">(masqué)</span>
          )}
        </div>
        <p className="text-xs text-aaj-gray">{statusRoleSentence(status)}</p>
        {!status.isTerminal && (
          <p className="text-xs text-aaj-dark">
            <span className="text-aaj-gray">Mène vers :</span>{' '}
            {transitionLabels || <em className="text-aaj-gray">aucune transition configurée</em>}
          </p>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="p-2 hover:bg-slate-100 rounded text-aaj-gray"
          aria-label="Modifier"
          title="Modifier"
        >
          <Pencil size={14} />
        </button>
        {!status.isSystem && (
          <button
            type="button"
            onClick={remove}
            disabled={deleting}
            className="p-2 hover:bg-red-50 rounded text-red-600 disabled:opacity-50"
            aria-label="Supprimer"
            title="Supprimer"
          >
            {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
          </button>
        )}
      </div>
    </li>
  );
}

function StatusForm({
  initial,
  allStatuses,
  onSave,
  onCancel,
}: {
  initial?: UnescoPermitStatusDef;
  allStatuses: UnescoPermitStatusDef[];
  onSave: (payload: {
    key: string;
    label: string;
    colorClass: string;
    sortOrder: number;
    isActive: boolean;
    nextStatuses: string[];
  }) => Promise<void>;
  onCancel: () => void;
}) {
  const isEdit = !!initial;
  const [form, setForm] = useState({
    label: initial?.label ?? '',
    colorClass: initial?.colorClass ?? STATUS_COLOR_PRESETS[0].value,
    sortOrder: initial?.sortOrder ?? (allStatuses.length + 1) * 10,
    isActive: initial?.isActive ?? true,
    nextStatuses: initial?.nextStatuses ?? [],
  });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isTerminal = !!initial?.isTerminal;
  // Other statuses this one can transition to. Initial-state statuses
  // can't be re-entered (no going back to "Brouillon" once submitted),
  // so we hide them from the choice list.
  const otherStatuses = useMemo(
    () =>
      allStatuses.filter(
        (s) => s.key !== initial?.key && s.isActive && !s.isInitial
      ),
    [allStatuses, initial?.key]
  );

  const toggleNext = (key: string) => {
    setForm((prev) => ({
      ...prev,
      nextStatuses: prev.nextStatuses.includes(key)
        ? prev.nextStatuses.filter((k) => k !== key)
        : [...prev.nextStatuses, key],
    }));
  };

  const submit = async () => {
    const label = form.label.trim();
    if (!label) {
      setError('Donnez un nom à ce statut.');
      return;
    }
    // For new statuses, derive the technical identifier from the label
    // — admins shouldn't have to think about it. Backend sanitizes
    // again and rejects empty / collision.
    const key = isEdit ? (initial?.key ?? '') : slugifyLabel(label) || `statut_${Date.now()}`;
    setSaving(true);
    setError(null);
    try {
      await onSave({
        key,
        label,
        colorClass: form.colorClass,
        sortOrder: form.sortOrder,
        isActive: form.isActive,
        nextStatuses: form.nextStatuses,
      });
    } catch (e: any) {
      setError(e?.message || 'Enregistrement échoué.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <label className="block">
        <span className="block text-[10px] font-black uppercase tracking-[2px] text-aaj-gray mb-1.5">
          Nom du statut
        </span>
        <input
          type="text"
          value={form.label}
          onChange={(e) => setForm({ ...form, label: e.target.value })}
          className="w-full px-3 py-2 border border-aaj-border text-sm rounded"
          placeholder="Ex. En instruction"
          autoFocus={!isEdit}
        />
      </label>

      <div className="block">
        <span className="block text-[10px] font-black uppercase tracking-[2px] text-aaj-gray mb-1.5">
          Couleur du badge
        </span>
        <div className="flex flex-wrap gap-2">
          {STATUS_COLOR_PRESETS.map((c) => {
            const active = form.colorClass === c.value;
            return (
              <button
                type="button"
                key={c.value}
                onClick={() => setForm({ ...form, colorClass: c.value })}
                className={`px-2.5 py-1 border rounded text-[10px] uppercase tracking-widest font-black ${c.value} ${active ? 'ring-2 ring-aaj-dark ring-offset-1' : ''}`}
                title={c.label}
              >
                {form.label.trim() || c.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="block">
        <span className="block text-[10px] font-black uppercase tracking-[2px] text-aaj-gray mb-1.5">
          Vers quels statuts peut-on basculer ?
        </span>
        {isTerminal ? (
          <p className="text-xs text-aaj-gray italic">
            Ce statut clôture la demande, il ne mène vers aucun autre statut.
          </p>
        ) : otherStatuses.length === 0 ? (
          <p className="text-xs text-aaj-gray">Aucun autre statut disponible pour l'instant.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {otherStatuses.map((s) => {
              const checked = form.nextStatuses.includes(s.key);
              return (
                <label
                  key={s.key}
                  className={`inline-flex items-center gap-2 px-2.5 py-1 border rounded text-[10px] uppercase tracking-widest font-black cursor-pointer ${
                    checked
                      ? 'bg-aaj-dark text-white border-aaj-dark'
                      : 'bg-white text-aaj-gray border-aaj-border hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    className="hidden"
                    checked={checked}
                    onChange={() => toggleNext(s.key)}
                  />
                  {s.label}
                </label>
              );
            })}
          </div>
        )}
      </div>

      {/* Advanced options — hidden by default to keep the form readable. */}
      {(!initial?.isSystem || isEdit) && (
        <div className="border-t border-aaj-border pt-3">
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="text-[10px] uppercase tracking-[2px] font-black text-aaj-gray hover:text-aaj-dark inline-flex items-center gap-1"
          >
            {showAdvanced ? '▾' : '▸'} Options avancées
          </button>
          {showAdvanced && (
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="block">
                <span className="block text-[10px] font-black uppercase tracking-[2px] text-aaj-gray mb-1.5">
                  Position dans la liste
                </span>
                <input
                  type="number"
                  value={form.sortOrder}
                  onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-aaj-border text-sm rounded"
                />
                <p className="text-[10px] text-aaj-gray mt-1">
                  Plus le nombre est petit, plus le statut apparaît tôt.
                </p>
              </label>
              {!initial?.isSystem && (
                <label className="block">
                  <span className="block text-[10px] font-black uppercase tracking-[2px] text-aaj-gray mb-1.5">
                    Affichage
                  </span>
                  <select
                    value={form.isActive ? 'yes' : 'no'}
                    onChange={(e) => setForm({ ...form, isActive: e.target.value === 'yes' })}
                    className="w-full px-3 py-2 border border-aaj-border text-sm rounded bg-white"
                  >
                    <option value="yes">Visible</option>
                    <option value="no">Masqué</option>
                  </select>
                </label>
              )}
            </div>
          )}
        </div>
      )}

      {error && <div className="text-sm text-red-600">{error}</div>}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2 bg-aaj-royal text-white text-[10px] font-black uppercase tracking-[2px] rounded hover:bg-aaj-dark disabled:opacity-50"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {isEdit ? 'Enregistrer' : 'Créer'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border border-aaj-border text-[10px] font-black uppercase tracking-[2px] rounded hover:bg-slate-50"
        >
          Annuler
        </button>
      </div>
    </div>
  );
}
