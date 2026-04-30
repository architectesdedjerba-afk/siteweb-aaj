/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * NotificationsList — vue principale de gestion des notifications.
 * Utilis\u00e9e \u00e0 la fois dans le drawer (cloche) et dans l\u2019onglet
 * Notifications de l\u2019espace adh\u00e9rents.
 *
 * Fonctionnalit\u00e9s :
 *   - Filtres : statut (toutes / non lues / archiv\u00e9es) + type + recherche
 *   - Tri : plus r\u00e9centes / plus anciennes / priorit\u00e9
 *   - Actions par item : marquer lu/non lu, archiver/d\u00e9sarchiver, supprimer
 *   - Actions group\u00e9es : tout marquer lu, archiver le lu, vider l\u2019archive
 *   - S\u00e9lection multiple : checkbox + actions de masse
 */

import { useMemo, useState } from 'react';
import {
  Bell,
  CheckCheck,
  Trash2,
  Archive,
  ArchiveRestore,
  Inbox,
  Search,
  ExternalLink,
  X,
  CircleDot,
  Filter as FilterIcon,
  ArrowDownNarrowWide,
  ArrowUpWideNarrow,
  AlertCircle,
  UserPlus,
  Briefcase,
  UserCog,
  Mail,
  ClipboardList,
  Newspaper,
  FileCheck,
  Megaphone,
  Info,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import {
  useNotifications,
  Notification,
  getNotificationTypeMeta,
} from '../../lib/NotificationContext';
import { useNavigate } from 'react-router-dom';

type StatusFilter = 'all' | 'unread' | 'read' | 'archived';
type SortBy = 'recent' | 'oldest' | 'priority';

interface NotificationsListProps {
  /** Quand true, force le mode compact (drawer). */
  compact?: boolean;
  /** Callback appel\u00e9 quand l\u2019utilisateur clique sur le lien d\u2019une notification. */
  onItemNavigate?: () => void;
  /** Hauteur max pour la liste scrollable. */
  maxHeight?: string;
}

const ICON_MAP: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  bell: Bell,
  'user-plus': UserPlus,
  briefcase: Briefcase,
  'user-cog': UserCog,
  mail: Mail,
  'clipboard-list': ClipboardList,
  newspaper: Newspaper,
  'file-check': FileCheck,
  megaphone: Megaphone,
  info: Info,
  'check-circle': CheckCircle2,
  'x-circle': XCircle,
};

const PRIORITY_RANK: Record<string, number> = { high: 0, normal: 1, low: 2 };

const PRIORITY_STYLES: Record<string, string> = {
  high: 'bg-red-50 text-red-700 border-red-200',
  normal: 'bg-aaj-soft text-aaj-royal border-aaj-royal/20',
  low: 'bg-slate-50 text-slate-600 border-slate-200',
};

function formatRelative(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (isNaN(date.getTime())) return '';
  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'À l\u2019instant';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `Il y a ${diffMin} min`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `Il y a ${diffHr} h`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `Il y a ${diffDay} j`;
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

export const NotificationsList = ({
  compact = false,
  onItemNavigate,
  maxHeight,
}: NotificationsListProps) => {
  const {
    notifications,
    loading,
    refreshing,
    refresh,
    markRead,
    markUnread,
    archive,
    unarchive,
    remove,
    markAllRead,
    archiveAllRead,
    clearArchived,
    bulk,
  } = useNotifications();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortBy>('recent');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const navigate = useNavigate();

  // Liste des types pr\u00e9sents dans les notifications, pour ne proposer
  // que des filtres utiles (et pas les 10 types th\u00e9oriques).
  const availableTypes = useMemo(() => {
    const set = new Set<string>();
    notifications.forEach((n) => set.add(n.type));
    return Array.from(set).sort();
  }, [notifications]);

  const filtered = useMemo(() => {
    let list = notifications.slice();

    switch (statusFilter) {
      case 'unread':
        list = list.filter((n) => !n.archivedAt && !n.readAt);
        break;
      case 'read':
        list = list.filter((n) => !n.archivedAt && !!n.readAt);
        break;
      case 'archived':
        list = list.filter((n) => !!n.archivedAt);
        break;
      default:
        list = list.filter((n) => !n.archivedAt);
    }

    if (typeFilter !== 'all') {
      list = list.filter((n) => n.type === typeFilter);
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          (n.body || '').toLowerCase().includes(q) ||
          (n.senderName || '').toLowerCase().includes(q)
      );
    }

    list.sort((a, b) => {
      if (sortBy === 'priority') {
        const ap = PRIORITY_RANK[a.priority] ?? 1;
        const bp = PRIORITY_RANK[b.priority] ?? 1;
        if (ap !== bp) return ap - bp;
      }
      const da = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const db = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return sortBy === 'oldest' ? da - db : db - da;
    });

    return list;
  }, [notifications, statusFilter, typeFilter, search, sortBy]);

  const allSelected = filtered.length > 0 && filtered.every((n) => selected.has(n.id));
  const someSelected = selected.size > 0;

  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(filtered.map((n) => n.id)));
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleItemClick = async (n: Notification) => {
    if (!n.readAt) await markRead(n.id);
    if (n.link) {
      onItemNavigate?.();
      navigate(n.link);
    }
  };

  const renderIcon = (iconKey: string | null, type: string) => {
    const key = iconKey || getNotificationTypeMeta(type).icon || 'bell';
    const Icon = ICON_MAP[key] || Bell;
    return <Icon size={compact ? 16 : 18} className="shrink-0" />;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar : recherche + filtres + tri */}
      <div className={`border-b border-slate-200 bg-white ${compact ? 'p-3' : 'p-4'} space-y-3`}>
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher dans les notifications…"
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-aaj-royal/30 focus:border-aaj-royal"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-md border border-slate-200 overflow-hidden text-xs">
            {(
              [
                ['all', 'Toutes'],
                ['unread', 'Non lues'],
                ['read', 'Lues'],
                ['archived', 'Archivées'],
              ] as Array<[StatusFilter, string]>
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setStatusFilter(key)}
                className={`px-3 py-1.5 font-semibold transition-colors ${
                  statusFilter === key
                    ? 'bg-aaj-royal text-white'
                    : 'bg-white text-slate-600 hover:bg-slate-50'
                }`}
                aria-pressed={statusFilter === key}
              >
                {label}
              </button>
            ))}
          </div>

          <label className="inline-flex items-center gap-1.5 text-xs text-slate-600">
            <FilterIcon size={14} aria-hidden="true" />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="border border-slate-200 rounded-md py-1 pl-2 pr-7 text-xs focus:outline-none focus:ring-2 focus:ring-aaj-royal/30"
              aria-label="Filtrer par type"
            >
              <option value="all">Tous les types</option>
              {availableTypes.map((t) => (
                <option key={t} value={t}>
                  {getNotificationTypeMeta(t).label}
                </option>
              ))}
            </select>
          </label>

          <label className="inline-flex items-center gap-1.5 text-xs text-slate-600">
            {sortBy === 'oldest' ? (
              <ArrowUpWideNarrow size={14} aria-hidden="true" />
            ) : (
              <ArrowDownNarrowWide size={14} aria-hidden="true" />
            )}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortBy)}
              className="border border-slate-200 rounded-md py-1 pl-2 pr-7 text-xs focus:outline-none focus:ring-2 focus:ring-aaj-royal/30"
              aria-label="Trier"
            >
              <option value="recent">Plus récentes</option>
              <option value="oldest">Plus anciennes</option>
              <option value="priority">Par priorité</option>
            </select>
          </label>

          <button
            type="button"
            onClick={refresh}
            disabled={refreshing}
            className="ml-auto text-xs text-slate-500 hover:text-aaj-royal disabled:opacity-50"
            aria-label="Rafraîchir"
          >
            {refreshing ? 'Actualisation…' : 'Actualiser'}
          </button>
        </div>

        {/* Actions globales / actions de s\u00e9lection */}
        {someSelected ? (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-semibold text-aaj-royal">{selected.size} sélectionnée(s)</span>
            <button
              type="button"
              onClick={() => bulk('read', Array.from(selected))}
              className="px-2 py-1 border border-slate-200 rounded hover:bg-slate-50 inline-flex items-center gap-1"
            >
              <CheckCheck size={12} aria-hidden="true" /> Marquer lu
            </button>
            <button
              type="button"
              onClick={() => bulk('unread', Array.from(selected))}
              className="px-2 py-1 border border-slate-200 rounded hover:bg-slate-50 inline-flex items-center gap-1"
            >
              <CircleDot size={12} aria-hidden="true" /> Non lu
            </button>
            <button
              type="button"
              onClick={() => {
                bulk(statusFilter === 'archived' ? 'unarchive' : 'archive', Array.from(selected));
                setSelected(new Set());
              }}
              className="px-2 py-1 border border-slate-200 rounded hover:bg-slate-50 inline-flex items-center gap-1"
            >
              {statusFilter === 'archived' ? (
                <>
                  <ArchiveRestore size={12} aria-hidden="true" /> Désarchiver
                </>
              ) : (
                <>
                  <Archive size={12} aria-hidden="true" /> Archiver
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                if (confirm(`Supprimer ${selected.size} notification(s) ?`)) {
                  bulk('delete', Array.from(selected));
                  setSelected(new Set());
                }
              }}
              className="px-2 py-1 border border-red-200 text-red-700 rounded hover:bg-red-50 inline-flex items-center gap-1"
            >
              <Trash2 size={12} aria-hidden="true" /> Supprimer
            </button>
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="text-slate-500 hover:text-slate-800 ml-auto"
            >
              Annuler
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
            <button
              type="button"
              onClick={markAllRead}
              className="inline-flex items-center gap-1 hover:text-aaj-royal"
            >
              <CheckCheck size={12} aria-hidden="true" /> Tout marquer lu
            </button>
            <button
              type="button"
              onClick={archiveAllRead}
              className="inline-flex items-center gap-1 hover:text-aaj-royal"
            >
              <Archive size={12} aria-hidden="true" /> Archiver les lues
            </button>
            {statusFilter === 'archived' && (
              <button
                type="button"
                onClick={() => {
                  if (confirm('Vider toutes les notifications archivées ?')) clearArchived();
                }}
                className="inline-flex items-center gap-1 text-red-600 hover:text-red-700"
              >
                <Trash2 size={12} aria-hidden="true" /> Vider l\u2019archive
              </button>
            )}
          </div>
        )}
      </div>

      {/* Liste */}
      <div
        className="overflow-y-auto flex-1 bg-white"
        style={maxHeight ? { maxHeight } : undefined}
        role="list"
        aria-label="Liste des notifications"
      >
        {loading ? (
          <div className="p-10 text-center text-sm text-slate-500">Chargement…</div>
        ) : filtered.length === 0 ? (
          <EmptyState statusFilter={statusFilter} />
        ) : (
          <>
            {/* En-t\u00eate de s\u00e9lection */}
            <label className="flex items-center gap-2 px-4 py-2 border-b border-slate-100 text-xs text-slate-500 sticky top-0 bg-white">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
                className="rounded border-slate-300 text-aaj-royal focus:ring-aaj-royal"
                aria-label="Tout sélectionner"
              />
              <span>{filtered.length} résultat(s)</span>
            </label>
            <ul className="divide-y divide-slate-100">
              {filtered.map((n) => (
                <li
                  key={n.id}
                  className={`group flex items-start gap-3 px-4 py-3 transition-colors ${
                    n.readAt ? 'bg-white' : 'bg-aaj-soft/30'
                  } hover:bg-slate-50`}
                  role="listitem"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(n.id)}
                    onChange={() => toggleOne(n.id)}
                    className="mt-1 rounded border-slate-300 text-aaj-royal focus:ring-aaj-royal"
                    aria-label={`Sélectionner ${n.title}`}
                  />

                  <span
                    className={`mt-0.5 inline-flex items-center justify-center w-9 h-9 rounded-full border ${
                      PRIORITY_STYLES[n.priority] || PRIORITY_STYLES.normal
                    }`}
                    aria-hidden="true"
                  >
                    {renderIcon(n.icon, n.type)}
                  </span>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2">
                      <button
                        type="button"
                        onClick={() => handleItemClick(n)}
                        className="text-left flex-1"
                      >
                        <p
                          className={`text-sm ${
                            n.readAt ? 'font-medium text-slate-800' : 'font-bold text-slate-900'
                          }`}
                        >
                          {n.title}
                        </p>
                        {n.body && (
                          <p className="text-xs text-slate-600 mt-0.5 whitespace-pre-line line-clamp-3">
                            {n.body}
                          </p>
                        )}
                      </button>
                      {!n.readAt && (
                        <span
                          className="mt-1 w-2 h-2 rounded-full bg-aaj-royal shrink-0"
                          aria-label="Non lue"
                        />
                      )}
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                      <span>{formatRelative(n.createdAt)}</span>
                      <span className="inline-flex items-center gap-1">
                        <span
                          className={`inline-block w-1.5 h-1.5 rounded-full ${
                            n.priority === 'high'
                              ? 'bg-red-500'
                              : n.priority === 'low'
                                ? 'bg-slate-400'
                                : 'bg-aaj-royal'
                          }`}
                          aria-hidden="true"
                        />
                        {getNotificationTypeMeta(n.type).label}
                      </span>
                      {n.senderName && <span>par {n.senderName}</span>}
                      {n.link && (
                        <button
                          type="button"
                          onClick={() => handleItemClick(n)}
                          className="inline-flex items-center gap-1 text-aaj-royal hover:underline"
                        >
                          Ouvrir <ExternalLink size={10} aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Actions au survol */}
                  <div className="flex flex-col items-end gap-1 opacity-60 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={() => (n.readAt ? markUnread(n.id) : markRead(n.id))}
                      className="p-1 rounded hover:bg-slate-100 text-slate-500 hover:text-aaj-royal"
                      aria-label={n.readAt ? 'Marquer non lue' : 'Marquer lue'}
                      title={n.readAt ? 'Marquer non lue' : 'Marquer lue'}
                    >
                      {n.readAt ? <CircleDot size={14} /> : <CheckCheck size={14} />}
                    </button>
                    <button
                      type="button"
                      onClick={() => (n.archivedAt ? unarchive(n.id) : archive(n.id))}
                      className="p-1 rounded hover:bg-slate-100 text-slate-500 hover:text-aaj-royal"
                      aria-label={n.archivedAt ? 'Désarchiver' : 'Archiver'}
                      title={n.archivedAt ? 'Désarchiver' : 'Archiver'}
                    >
                      {n.archivedAt ? <ArchiveRestore size={14} /> : <Archive size={14} />}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm('Supprimer cette notification ?')) remove(n.id);
                      }}
                      className="p-1 rounded hover:bg-red-50 text-slate-500 hover:text-red-600"
                      aria-label="Supprimer"
                      title="Supprimer"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
};

const EmptyState = ({ statusFilter }: { statusFilter: StatusFilter }) => {
  const messages: Record<StatusFilter, { icon: React.ReactNode; title: string; body: string }> = {
    all: {
      icon: <Inbox size={36} className="text-slate-300" aria-hidden="true" />,
      title: 'Aucune notification',
      body: 'Vous n\u2019avez aucune notification active. Profitez du calme \uD83D\uDC4B',
    },
    unread: {
      icon: <CheckCheck size={36} className="text-emerald-300" aria-hidden="true" />,
      title: 'Tout est lu',
      body: 'Toutes vos notifications ont \u00e9t\u00e9 consult\u00e9es.',
    },
    read: {
      icon: <Bell size={36} className="text-slate-300" aria-hidden="true" />,
      title: 'Aucune notification lue',
      body: 'Les notifications que vous lirez appara\u00eetront ici.',
    },
    archived: {
      icon: <Archive size={36} className="text-slate-300" aria-hidden="true" />,
      title: 'Archive vide',
      body: 'Les notifications archiv\u00e9es appara\u00eetront dans cette vue.',
    },
  };
  const m = messages[statusFilter];
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6">
      {m.icon}
      <p className="mt-3 text-sm font-semibold text-slate-700">{m.title}</p>
      <p className="mt-1 text-xs text-slate-500 max-w-xs">{m.body}</p>
    </div>
  );
};

/**
 * Petit composant utilitaire export\u00e9 pour le drawer/dropdown.
 * Affiche une badge "+N" si la valeur est sup\u00e9rieure \u00e0 la limite.
 */
export const NotificationCountBadge = ({
  count,
  max = 99,
  className = '',
}: {
  count: number;
  max?: number;
  className?: string;
}) => {
  if (count <= 0) return null;
  return (
    <span
      className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold rounded-full bg-red-500 text-white ${className}`}
      aria-label={`${count} non lues`}
    >
      {count > max ? `${max}+` : count}
    </span>
  );
};

/** Petite version inline pour les cas d\u2019erreur. */
export const NotificationsError = ({ message }: { message: string }) => (
  <div className="p-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md flex items-start gap-2">
    <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
    <span>{message}</span>
  </div>
);

export const NotificationsClose = ({ onClick }: { onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    className="p-1 rounded hover:bg-slate-100 text-slate-500"
    aria-label="Fermer"
  >
    <X size={18} aria-hidden="true" />
  </button>
);
