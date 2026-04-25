/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * NotificationBell — bouton cloche pour la Navbar.
 * Affiche un badge avec le nombre de notifications non lues, et ouvre
 * un drawer (slide-in droit) contenant <NotificationsList compact />.
 */

import { useEffect, useRef, useState } from 'react';
import { Bell, Settings as SettingsIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';
import { useNotifications } from '../../lib/NotificationContext';
import { useI18n } from '../../lib/i18n';
import {
  NotificationsList,
  NotificationCountBadge,
  NotificationsClose,
} from './NotificationsList';

interface NotificationBellProps {
  /** Style du bouton ; "navbar" pour le header desktop, "mobile" pour le menu burger. */
  variant?: 'navbar' | 'mobile';
}

export const NotificationBell = ({ variant = 'navbar' }: NotificationBellProps) => {
  const { unreadCount } = useNotifications();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement | null>(null);

  // Ferme avec Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // Verrouille le scroll du body quand le drawer est ouvert.
  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  }, [open]);

  // Focus sur le drawer à l’ouverture.
  useEffect(() => {
    if (open && drawerRef.current) {
      drawerRef.current.focus();
    }
  }, [open]);

  const buttonClass =
    variant === 'mobile'
      ? 'relative flex items-center justify-between gap-3 w-full px-2 py-3 text-lg font-medium text-slate-900 hover:text-aaj-royal'
      : 'relative inline-flex items-center justify-center w-9 h-9 rounded-full text-aaj-dark hover:text-aaj-royal hover:bg-slate-100 transition-colors';

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`${t('nav.notifications')}${
          unreadCount > 0 ? ` (${unreadCount} ${t('notifications.unread')})` : ''
        }`}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={buttonClass}
      >
        {variant === 'mobile' ? (
          <>
            <span className="inline-flex items-center gap-3">
              <Bell size={20} aria-hidden="true" />
              {t('nav.notifications')}
            </span>
            <NotificationCountBadge count={unreadCount} />
          </>
        ) : (
          <>
            <Bell size={20} aria-hidden="true" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1">
                <NotificationCountBadge count={unreadCount} />
              </span>
            )}
          </>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <>
            {/* Overlay */}
            <motion.div
              key="notif-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 bg-black/30 z-[110]"
              aria-hidden="true"
            />

            {/* Drawer */}
            <motion.div
              key="notif-drawer"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 32 }}
              role="dialog"
              aria-modal="true"
              aria-label="Notifications"
              tabIndex={-1}
              ref={drawerRef}
              className="fixed top-0 right-0 bottom-0 w-full max-w-md z-[120] bg-white shadow-2xl flex flex-col outline-none"
            >
              {/* Header */}
              <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-200 bg-aaj-soft/30">
                <div className="flex items-center gap-2">
                  <Bell size={18} className="text-aaj-royal" aria-hidden="true" />
                  <h2 className="text-sm font-bold uppercase tracking-wider text-aaj-dark">
                    {t('nav.notifications')}
                  </h2>
                  {unreadCount > 0 && <NotificationCountBadge count={unreadCount} />}
                </div>
                <div className="flex items-center gap-1">
                  <Link
                    to="/espace-adherents?tab=notifications"
                    onClick={() => setOpen(false)}
                    className="p-1.5 rounded hover:bg-white text-slate-500 hover:text-aaj-royal"
                    aria-label="Tout voir dans l’espace adhérents"
                    title="Tout voir"
                  >
                    <SettingsIcon size={16} aria-hidden="true" />
                  </Link>
                  <NotificationsClose onClick={() => setOpen(false)} />
                </div>
              </div>

              {/* Liste */}
              <div className="flex-1 overflow-hidden">
                <NotificationsList compact onItemNavigate={() => setOpen(false)} />
              </div>

              {/* Pied de drawer */}
              <div className="border-t border-slate-200 bg-white px-4 py-2 text-center">
                <Link
                  to="/espace-adherents?tab=notifications"
                  onClick={() => setOpen(false)}
                  className="text-xs font-semibold text-aaj-royal hover:underline"
                >
                  {t('notifications.viewAll')}
                </Link>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};
