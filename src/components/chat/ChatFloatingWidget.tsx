/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Floating chat widget — a fixed bottom-right button that toggles a popup
 * window containing the full ChatPage. Replaces the in-page "Discussions"
 * tab so members can chat from anywhere in the member space.
 */

import { useEffect, useState } from 'react';
import { MessagesSquare, X, Maximize2, Minimize2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../../lib/AuthContext';
import { useChatBadge } from '../../lib/useChat';
import { ChatPage } from './ChatPage';

/** Distance (px) from viewport bottom when no footer is in view. Mirrors the
 *  contact-admin FAB behaviour in MemberSpace so the two FABs stack and lift
 *  together when the footer scrolls into view. */
const DEFAULT_BOTTOM = 24;

export function ChatFloatingWidget() {
  const [open, setOpen] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const [bottom, setBottom] = useState(DEFAULT_BOTTOM);
  const { user, isAdmin, can } = useAuth();
  const isModerator = isAdmin || can('chat_manage');
  const { totalUnread } = useChatBadge(user?.uid ?? null, isModerator);

  // Close on Esc — but if maximized, first un-maximize before closing
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (maximized) setMaximized(false);
      else setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, maximized]);

  // Lift the FAB when the page footer scrolls into view (same logic as the
  // contact-admin FAB) so the button never sits on top of footer content.
  useEffect(() => {
    const handleScroll = () => {
      const footer = document.querySelector('footer');
      if (!footer) return;
      const footerRect = footer.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      if (footerRect.top < viewportHeight) {
        const overlap = viewportHeight - footerRect.top;
        setBottom(overlap + 24);
      } else {
        setBottom(DEFAULT_BOTTOM);
      }
    };
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Hidden for anonymous visitors — chat is members-only
  if (!user) return null;

  const badgeLabel = totalUnread > 9 ? '9+' : String(totalUnread);

  return (
    <>
      {/* Floating action button — anchored bottom-right */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{ bottom: `${bottom}px` }}
        className="fixed right-6 z-[1100] w-14 h-14 rounded-full bg-aaj-royal text-white shadow-2xl hover:bg-aaj-dark active:scale-95 transition-all flex items-center justify-center group"
        aria-label={open ? 'Fermer la messagerie' : 'Ouvrir la messagerie'}
      >
        <AnimatePresence mode="wait" initial={false}>
          {open ? (
            <motion.span
              key="close"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <X size={22} />
            </motion.span>
          ) : (
            <motion.span
              key="open"
              initial={{ rotate: 90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: -90, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <MessagesSquare size={24} />
            </motion.span>
          )}
        </AnimatePresence>
        {!open && totalUnread > 0 && (
          <span
            className="absolute -top-1 -right-1 min-w-5 h-5 px-1.5 bg-red-500 text-white rounded-full flex items-center justify-center text-[10px] font-bold animate-pulse border-2 border-white"
            aria-label={`${totalUnread} messages non lus`}
          >
            {badgeLabel}
          </span>
        )}
      </button>

      {/* Light backdrop on desktop — click closes the popup. Mobile uses the
          full-screen sheet so no backdrop is needed there. */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="chat-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={() => setOpen(false)}
            className="hidden sm:block fixed inset-0 z-[1050] bg-aaj-dark/10"
            aria-hidden
          />
        )}
      </AnimatePresence>

      {/* Popup window */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="chat-popup"
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className={[
              // z-[1100] keeps the popup above Leaflet map panes/controls
              // (Leaflet defaults: panes 200-650, controls 1000) and the
              // project's standard z-[100]/[200] modal layer.
              'fixed z-[1100] bg-white shadow-2xl border border-aaj-border overflow-hidden flex flex-col',
              // Mobile: full-screen sheet
              'inset-0 rounded-none',
              // Desktop: maximized = near-fullscreen, default = compact card
              maximized
                ? 'sm:inset-6 sm:rounded-lg sm:w-auto sm:h-auto'
                : [
                    'sm:inset-auto sm:bottom-24 sm:right-6 sm:rounded-lg',
                    'sm:w-[420px] sm:h-[640px]',
                    'md:w-[560px] md:h-[680px]',
                    'lg:w-[760px] lg:h-[680px]',
                  ].join(' '),
            ].join(' ')}
            role="dialog"
            aria-modal="false"
            aria-label="Messagerie interne"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-aaj-border bg-aaj-soft flex-shrink-0">
              <div className="min-w-0 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-aaj-royal text-white flex items-center justify-center flex-shrink-0">
                  <MessagesSquare size={18} />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] uppercase tracking-[3px] text-aaj-royal font-black block leading-tight">
                    Discussions
                  </span>
                  <h3 className="text-sm font-black uppercase tracking-tight truncate leading-tight">
                    Messagerie interne
                  </h3>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {/* Maximize toggle — desktop only */}
                <button
                  type="button"
                  onClick={() => setMaximized((v) => !v)}
                  className="hidden sm:flex text-aaj-gray hover:text-aaj-royal transition-colors w-8 h-8 items-center justify-center rounded hover:bg-white"
                  aria-label={maximized ? 'Réduire la fenêtre' : 'Agrandir la fenêtre'}
                  title={maximized ? 'Réduire' : 'Agrandir'}
                >
                  {maximized ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="text-aaj-gray hover:text-red-500 transition-colors w-8 h-8 flex items-center justify-center rounded hover:bg-white"
                  aria-label="Fermer la messagerie"
                  title="Fermer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Body — ChatPage fills remaining space */}
            <div className="flex-1 min-h-0 overflow-hidden">
              <ChatPage embedded autoFocusInput={open} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
