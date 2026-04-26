/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * NotificationContext — source unique pour les notifications in-app.
 * Polling toutes les 30 s quand l'utilisateur est connecté ; rafraîchit
 * également au retour de visibilité (onglet refocus). Expose le compteur
 * non-lu, la liste complète et toutes les actions de gestion (lecture,
 * archivage, suppression, actions groupées).
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  ReactNode,
} from 'react';
import { api } from './api';
import { useAuth } from './AuthContext';

export type NotificationPriority = 'low' | 'normal' | 'high';

export interface Notification {
  id: string;
  recipientUid: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  icon: string | null;
  priority: NotificationPriority;
  data: Record<string, any> | null;
  senderUid: string | null;
  senderName: string | null;
  readAt: string | null;
  archivedAt: string | null;
  createdAt: string | null;
}

export interface NotificationPreference {
  id: string;
  uid: string;
  type: string;
  inApp: boolean;
  email: boolean;
  updatedAt: string | null;
  createdAt: string | null;
}

interface NotificationContextValue {
  notifications: Notification[];
  preferences: NotificationPreference[];
  loading: boolean;
  refreshing: boolean;
  unreadCount: number;
  activeCount: number;
  totalCount: number;
  refresh: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markUnread: (id: string) => Promise<void>;
  archive: (id: string) => Promise<void>;
  unarchive: (id: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  archiveAllRead: () => Promise<void>;
  clearArchived: () => Promise<void>;
  bulk: (
    action: 'read' | 'unread' | 'archive' | 'unarchive' | 'delete',
    ids: string[]
  ) => Promise<void>;
  setPreference: (type: string, channels: { inApp?: boolean; email?: boolean }) => Promise<void>;
  getPreference: (type: string) => NotificationPreference | undefined;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

const POLL_INTERVAL_MS = 30_000;

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
  const { user, profile } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [preferences, setPreferences] = useState<NotificationPreference[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeCount, setActiveCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const inFlight = useRef(false);

  const isAuthed = Boolean(user && profile);

  const refresh = useCallback(async () => {
    if (!isAuthed) {
      setNotifications([]);
      setPreferences([]);
      setUnreadCount(0);
      setActiveCount(0);
      setTotalCount(0);
      return;
    }
    if (inFlight.current) return;
    inFlight.current = true;
    setRefreshing(true);
    try {
      const [list, count, prefs] = await Promise.all([
        api.list('notifications', { orderBy: 'created_at:desc' }),
        api.notifications.unreadCount(),
        api.list('notification_preferences'),
      ]);
      setNotifications(((list?.items ?? []) as Notification[]));
      setUnreadCount(count.unread || 0);
      setActiveCount(count.active || 0);
      setTotalCount(count.total || 0);
      setPreferences(((prefs?.items ?? []) as NotificationPreference[]));
    } catch (err) {
      // Silent fail to avoid spamming errors during transient outages —
      // the polling loop will retry on its own.
      console.error('[notifications] refresh failed:', err);
    } finally {
      inFlight.current = false;
      setRefreshing(false);
      setLoading(false);
    }
  }, [isAuthed]);

  // Initial load + polling.
  useEffect(() => {
    if (!isAuthed) return;
    setLoading(true);
    refresh();
    const id = window.setInterval(refresh, POLL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [isAuthed, refresh]);

  // Refresh when tab regains focus.
  useEffect(() => {
    if (!isAuthed) return;
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [isAuthed, refresh]);

  // ---- Single-item actions (optimistic) ----------------------------
  const patchLocal = (id: string, patch: Partial<Notification>) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, ...patch } : n)));
  };

  const removeLocal = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const recomputeCounts = useCallback(() => {
    setNotifications((prev) => {
      let unread = 0;
      let active = 0;
      for (const n of prev) {
        if (!n.archivedAt) {
          active += 1;
          if (!n.readAt) unread += 1;
        }
      }
      setUnreadCount(unread);
      setActiveCount(active);
      setTotalCount(prev.length);
      return prev;
    });
  }, []);

  const markRead = useCallback(async (id: string) => {
    patchLocal(id, { readAt: new Date().toISOString() });
    recomputeCounts();
    try {
      await api.update('notifications', id, { readAt: new Date().toISOString() });
    } catch (err) {
      console.error('[notifications] markRead failed:', err);
      refresh();
    }
  }, [refresh, recomputeCounts]);

  const markUnread = useCallback(async (id: string) => {
    patchLocal(id, { readAt: null });
    recomputeCounts();
    try {
      await api.update('notifications', id, { readAt: null });
    } catch (err) {
      console.error('[notifications] markUnread failed:', err);
      refresh();
    }
  }, [refresh, recomputeCounts]);

  const archive = useCallback(async (id: string) => {
    patchLocal(id, { archivedAt: new Date().toISOString() });
    recomputeCounts();
    try {
      await api.update('notifications', id, { archivedAt: new Date().toISOString() });
    } catch (err) {
      console.error('[notifications] archive failed:', err);
      refresh();
    }
  }, [refresh, recomputeCounts]);

  const unarchive = useCallback(async (id: string) => {
    patchLocal(id, { archivedAt: null });
    recomputeCounts();
    try {
      await api.update('notifications', id, { archivedAt: null });
    } catch (err) {
      console.error('[notifications] unarchive failed:', err);
      refresh();
    }
  }, [refresh, recomputeCounts]);

  const remove = useCallback(async (id: string) => {
    removeLocal(id);
    recomputeCounts();
    try {
      await api.remove('notifications', id);
    } catch (err) {
      console.error('[notifications] remove failed:', err);
      refresh();
    }
  }, [refresh, recomputeCounts]);

  // ---- Bulk actions ------------------------------------------------
  const markAllRead = useCallback(async () => {
    setNotifications((prev) =>
      prev.map((n) => (n.readAt || n.archivedAt ? n : { ...n, readAt: new Date().toISOString() }))
    );
    setUnreadCount(0);
    try {
      await api.notifications.markAllRead();
    } catch (err) {
      console.error('[notifications] markAllRead failed:', err);
      refresh();
    }
  }, [refresh]);

  const archiveAllRead = useCallback(async () => {
    setNotifications((prev) =>
      prev.map((n) =>
        n.readAt && !n.archivedAt ? { ...n, archivedAt: new Date().toISOString() } : n
      )
    );
    recomputeCounts();
    try {
      await api.notifications.archiveAllRead();
    } catch (err) {
      console.error('[notifications] archiveAllRead failed:', err);
      refresh();
    }
  }, [refresh, recomputeCounts]);

  const clearArchived = useCallback(async () => {
    setNotifications((prev) => prev.filter((n) => !n.archivedAt));
    recomputeCounts();
    try {
      await api.notifications.clearArchived();
    } catch (err) {
      console.error('[notifications] clearArchived failed:', err);
      refresh();
    }
  }, [refresh, recomputeCounts]);

  const bulk = useCallback(
    async (action: 'read' | 'unread' | 'archive' | 'unarchive' | 'delete', ids: string[]) => {
      if (ids.length === 0) return;
      const idSet = new Set(ids);
      const now = new Date().toISOString();
      setNotifications((prev) => {
        if (action === 'delete') return prev.filter((n) => !idSet.has(n.id));
        return prev.map((n) => {
          if (!idSet.has(n.id)) return n;
          switch (action) {
            case 'read':      return { ...n, readAt: n.readAt ?? now };
            case 'unread':    return { ...n, readAt: null };
            case 'archive':   return { ...n, archivedAt: n.archivedAt ?? now };
            case 'unarchive': return { ...n, archivedAt: null };
            default:          return n;
          }
        });
      });
      recomputeCounts();
      try {
        await api.notifications.bulk(action, ids);
      } catch (err) {
        console.error('[notifications] bulk failed:', err);
        refresh();
      }
    },
    [refresh, recomputeCounts]
  );

  // ---- Preferences -------------------------------------------------
  const getPreference = useCallback(
    (type: string) => preferences.find((p) => p.type === type),
    [preferences]
  );

  const setPreference = useCallback(
    async (type: string, channels: { inApp?: boolean; email?: boolean }) => {
      if (!user) return;
      const existing = preferences.find((p) => p.type === type);
      const inApp = channels.inApp ?? existing?.inApp ?? true;
      const email = channels.email ?? existing?.email ?? false;
      const optimistic: NotificationPreference = existing
        ? { ...existing, inApp, email, updatedAt: new Date().toISOString() }
        : {
            id: `${user.uid}_${type}`,
            uid: user.uid,
            type,
            inApp,
            email,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
      setPreferences((prev) => {
        const others = prev.filter((p) => p.type !== type);
        return [...others, optimistic];
      });
      try {
        if (existing) {
          await api.update('notification_preferences', existing.id, { inApp, email });
        } else {
          await api.create('notification_preferences', {
            uid: user.uid,
            type,
            inApp,
            email,
          });
        }
      } catch (err) {
        console.error('[notifications] setPreference failed:', err);
        refresh();
      }
    },
    [user, preferences, refresh]
  );

  const value: NotificationContextValue = useMemo(
    () => ({
      notifications,
      preferences,
      loading,
      refreshing,
      unreadCount,
      activeCount,
      totalCount,
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
      setPreference,
      getPreference,
    }),
    [
      notifications,
      preferences,
      loading,
      refreshing,
      unreadCount,
      activeCount,
      totalCount,
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
      setPreference,
      getPreference,
    ]
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
};

export const useNotifications = (): NotificationContextValue => {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return ctx;
};

// -------------------------------------------------------------------
// Catalogue partagé : tous les types de notifications connus + leurs
// libellés FR. Sert à alimenter le filtre dans le panneau et la liste
// dans les préférences. Toute nouvelle valeur côté backend doit y être
// ajoutée pour apparaître dans l'UI.
// -------------------------------------------------------------------
export interface NotificationTypeMeta {
  type: string;
  label: string;
  description: string;
  icon: string;
}

export const NOTIFICATION_TYPES: NotificationTypeMeta[] = [
  {
    type: 'membership_application',
    label: 'Demandes d\u2019adh\u00e9sion',
    description: 'Quand une nouvelle demande d\u2019adh\u00e9sion arrive (admin).',
    icon: 'user-plus',
  },
  {
    type: 'partner_application',
    label: 'Demandes de partenariat',
    description: 'Quand un partenaire potentiel se manifeste (admin).',
    icon: 'briefcase',
  },
  {
    type: 'profile_update_request',
    label: 'Demandes de mise \u00e0 jour de profil',
    description: 'Quand un membre demande \u00e0 modifier son profil (admin).',
    icon: 'user-cog',
  },
  {
    type: 'contact_message',
    label: 'Messages internes',
    description: 'Nouveau message envoy\u00e9 via le formulaire de contact (admin).',
    icon: 'mail',
  },
  {
    type: 'commission_pv',
    label: 'Avis de commission',
    description: 'Nouvel avis de commission technique d\u00e9pos\u00e9.',
    icon: 'clipboard-list',
  },
  {
    type: 'news',
    label: 'Actualit\u00e9s & Infos',
    description: 'Nouvelle publication dans \u00ab Actions & Infos \u00bb.',
    icon: 'newspaper',
  },
  {
    type: 'unesco_permit_submitted',
    label: 'Demandes de permis UNESCO',
    description: 'Nouveau dossier UNESCO d\u00e9pos\u00e9 (instructeurs).',
    icon: 'file-check',
  },
  {
    type: 'unesco_permit_status',
    label: 'Statut de mes permis UNESCO',
    description: 'Avancement des d\u00e9cisions sur vos demandes UNESCO.',
    icon: 'file-check',
  },
  {
    type: 'broadcast',
    label: 'Annonces de l\u2019\u00e9quipe',
    description: 'Diffusions ponctuelles de l\u2019\u00e9quipe AAJ.',
    icon: 'megaphone',
  },
  {
    type: 'system',
    label: 'Syst\u00e8me',
    description: 'Notifications techniques diverses.',
    icon: 'info',
  },
];

export const getNotificationTypeMeta = (type: string): NotificationTypeMeta => {
  return (
    NOTIFICATION_TYPES.find((t) => t.type === type) || {
      type,
      label: type,
      description: '',
      icon: 'bell',
    }
  );
};
