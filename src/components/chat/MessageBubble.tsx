/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Reply, Smile, Trash2, FileText, Download, MoreVertical } from 'lucide-react';
import { motion } from 'motion/react';
import { doc, updateDoc, deleteDoc, db } from '../../lib/firebase';
import { Avatar } from './MemberPicker';
import type { ChatMessage, UserProfile } from '../../types';

const REACTIONS = ['👍', '❤️', '😂', '🎉', '🔥', '👀'];

interface MessageBubbleProps {
  message: ChatMessage;
  channelId: string;
  currentUid: string;
  isModerator: boolean;
  membersByUid: Record<string, UserProfile>;
  onReply: (msg: ChatMessage) => void;
  /** Hide avatar/name when this message is part of a streak from same author. */
  groupedWithPrev?: boolean;
  /** When true, anchor the reaction picker / overflow menu *below* the bubble
   *  instead of above. Used for the first few messages so popovers don't
   *  overflow the top of the scroll viewport. */
  flipMenuBelow?: boolean;
}

export function MessageBubble({
  message,
  channelId,
  currentUid,
  isModerator,
  membersByUid,
  onReply,
  groupedWithPrev = false,
  flipMenuBelow = false,
}: MessageBubbleProps) {
  const [showReactions, setShowReactions] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  const isMine = message.senderId === currentUid;
  const sender = membersByUid[message.senderId];
  const time = useMemo(() => formatTime(message.createdAt), [message.createdAt]);
  const fullTimestamp = useMemo(() => formatFullTimestamp(message.createdAt), [message.createdAt]);

  // Click-outside closes both popovers so they don't get stranded open.
  useEffect(() => {
    if (!showReactions && !showMenu) return;
    const onDown = (e: MouseEvent) => {
      if (!popoverRef.current) return;
      if (!popoverRef.current.contains(e.target as Node)) {
        setShowReactions(false);
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [showReactions, showMenu]);

  const toggleReaction = async (emoji: string) => {
    if (!message.id) return;
    const ref = doc(db, 'chat_messages', message.id);
    const current = message.reactions?.[emoji] || [];
    const next = current.includes(currentUid)
      ? current.filter((u) => u !== currentUid)
      : [...current, currentUid];
    const newReactions = { ...(message.reactions || {}) };
    if (next.length === 0) delete newReactions[emoji];
    else newReactions[emoji] = next;
    try {
      await updateDoc(ref, { reactions: newReactions });
    } catch (err) {
      console.error('Reaction failed:', err);
    } finally {
      setShowReactions(false);
    }
  };

  const handleDelete = async () => {
    if (!message.id) return;
    if (!window.confirm('Supprimer ce message ?')) return;
    try {
      await deleteDoc(doc(db, 'chat_messages', message.id));
    } catch (err) {
      console.error('Delete message failed:', err);
      alert('Suppression impossible.');
    }
  };

  if (message.deletedAt) {
    return (
      <div className={`flex ${isMine ? 'justify-end' : 'justify-start'} my-1`}>
        <span className="text-[11px] italic text-aaj-gray px-3 py-1">Message supprimé</span>
      </div>
    );
  }

  const canDelete = isMine || isModerator;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
      className={`group flex gap-3 ${isMine ? 'flex-row-reverse' : 'flex-row'} ${
        groupedWithPrev ? 'mt-0.5' : 'mt-3'
      }`}
    >
      <div className="w-9 flex-shrink-0">
        {!groupedWithPrev && sender && <Avatar profile={sender} size={36} />}
      </div>

      <div className={`flex flex-col max-w-[75%] ${isMine ? 'items-end' : 'items-start'}`}>
        {!groupedWithPrev && (
          <div
            className={`flex items-baseline gap-2 mb-1 px-1 ${isMine ? 'flex-row-reverse' : ''}`}
          >
            <span className="text-[11px] font-bold text-aaj-dark">
              {message.senderName || sender?.displayName || 'Membre'}
            </span>
            <span className="text-[10px] text-aaj-gray" title={fullTimestamp}>
              {time}
            </span>
          </div>
        )}

        <div className="relative" ref={popoverRef}>
          <div
            className={`rounded-2xl px-4 py-2.5 break-words whitespace-pre-wrap shadow-sm ${
              isMine
                ? 'bg-aaj-royal text-white rounded-tr-sm'
                : 'bg-white border border-aaj-border text-aaj-dark rounded-tl-sm'
            }`}
            // Tooltip for grouped (no header) messages so users can see the time
            title={groupedWithPrev ? fullTimestamp : undefined}
          >
            {message.replyTo && (
              <div
                className={`text-[11px] mb-2 pl-2 border-l-2 ${
                  isMine ? 'border-white/40' : 'border-aaj-royal'
                }`}
              >
                <div className={`font-bold ${isMine ? 'text-white/90' : 'text-aaj-royal'}`}>
                  {message.replyTo.senderName}
                </div>
                <div className={`truncate max-w-xs ${isMine ? 'text-white/70' : 'text-aaj-gray'}`}>
                  {message.replyTo.text}
                </div>
              </div>
            )}

            {message.attachmentUrl && (
              <a
                href={message.attachmentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center gap-2 p-2 mb-2 rounded ${
                  isMine ? 'bg-white/10 hover:bg-white/20' : 'bg-aaj-soft hover:bg-slate-100'
                } transition-colors`}
              >
                <FileText size={18} />
                <span className="text-[11px] flex-1 truncate">
                  {message.attachmentName || 'Pièce jointe'}
                </span>
                <Download size={14} />
              </a>
            )}

            {message.text && <div className="text-sm leading-relaxed">{message.text}</div>}

            {message.editedAt && (
              <div className={`text-[9px] mt-1 ${isMine ? 'text-white/60' : 'text-aaj-gray'}`}>
                modifié
              </div>
            )}
          </div>

          {/* Action toolbar — visible on hover (desktop) and when any popover
              is open. On touch devices the always-visible mobile button below
              gives access without hovering. */}
          <div
            className={`hidden sm:flex absolute top-0 ${
              isMine ? 'right-full mr-2' : 'left-full ml-2'
            } items-center gap-1 transition-opacity ${
              showReactions || showMenu ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
            }`}
          >
            <ToolbarButton
              onClick={() => {
                setShowMenu(false);
                setShowReactions((s) => !s);
              }}
              title="Réagir"
              ariaLabel="Réagir au message"
            >
              <Smile size={14} />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => onReply(message)}
              title="Répondre"
              ariaLabel="Répondre au message"
            >
              <Reply size={14} />
            </ToolbarButton>
            {canDelete && (
              <ToolbarButton
                onClick={() => {
                  setShowReactions(false);
                  setShowMenu((s) => !s);
                }}
                title="Plus d'actions"
                ariaLabel="Plus d'actions"
              >
                <MoreVertical size={14} />
              </ToolbarButton>
            )}
          </div>

          {/* Mobile-only: a single always-visible toggle next to the bubble
              that opens the action menu. Hover doesn't work on touch devices,
              so users need a tap-target. */}
          <button
            type="button"
            onClick={() => {
              setShowReactions(false);
              setShowMenu((s) => !s);
            }}
            className={`sm:hidden absolute top-1 ${
              isMine ? 'right-full mr-1' : 'left-full ml-1'
            } w-7 h-7 bg-white border border-aaj-border rounded-full flex items-center justify-center text-aaj-gray active:bg-aaj-soft`}
            aria-label="Actions du message"
          >
            <MoreVertical size={14} />
          </button>

          {showReactions && (
            <div
              className={`absolute z-10 ${isMine ? 'right-0' : 'left-0'} ${
                flipMenuBelow ? 'top-full mt-2' : '-top-12'
              } bg-white border border-aaj-border rounded-full shadow-lg px-2 py-1 flex gap-1`}
            >
              {REACTIONS.map((e) => (
                <button
                  key={e}
                  onClick={() => toggleReaction(e)}
                  className="w-8 h-8 rounded-full hover:bg-aaj-soft text-lg flex items-center justify-center transition-transform hover:scale-125"
                  aria-label={`Réagir avec ${e}`}
                >
                  {e}
                </button>
              ))}
            </div>
          )}

          {showMenu && (
            <div
              className={`absolute z-10 ${isMine ? 'right-0' : 'left-0'} ${
                flipMenuBelow ? 'top-full mt-1' : '-top-2 -translate-y-full'
              } bg-white border border-aaj-border rounded shadow-lg overflow-hidden min-w-[160px]`}
            >
              {/* Mobile gets reply + react + delete in the same menu since
                  there's no hover toolbar */}
              <button
                onClick={() => {
                  setShowMenu(false);
                  onReply(message);
                }}
                className="sm:hidden flex items-center gap-2 px-4 py-2 text-sm text-aaj-dark hover:bg-aaj-soft w-full text-left whitespace-nowrap"
              >
                <Reply size={14} /> Répondre
              </button>
              <button
                onClick={() => {
                  setShowMenu(false);
                  setShowReactions(true);
                }}
                className="sm:hidden flex items-center gap-2 px-4 py-2 text-sm text-aaj-dark hover:bg-aaj-soft w-full text-left whitespace-nowrap"
              >
                <Smile size={14} /> Réagir
              </button>
              {canDelete && (
                <button
                  onClick={() => {
                    setShowMenu(false);
                    handleDelete();
                  }}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-red-500 hover:bg-red-50 w-full text-left whitespace-nowrap"
                >
                  <Trash2 size={14} /> Supprimer
                </button>
              )}
            </div>
          )}
        </div>

        {message.reactions && Object.keys(message.reactions).length > 0 && (
          <div className={`flex gap-1 mt-1 flex-wrap ${isMine ? 'justify-end' : 'justify-start'}`}>
            {Object.entries(message.reactions).map(([emoji, uids]) => {
              if (uids.length === 0) return null;
              const reactedByMe = uids.includes(currentUid);
              return (
                <button
                  key={emoji}
                  onClick={() => toggleReaction(emoji)}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-colors ${
                    reactedByMe
                      ? 'bg-aaj-soft border-aaj-royal text-aaj-royal'
                      : 'bg-white border-aaj-border text-aaj-gray hover:bg-slate-50'
                  }`}
                  aria-label={`${uids.length} réaction${uids.length > 1 ? 's' : ''} ${emoji}`}
                >
                  <span>{emoji}</span>
                  <span className="font-bold">{uids.length}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
}

function ToolbarButton({
  onClick,
  title,
  ariaLabel,
  children,
}: {
  onClick: () => void;
  title: string;
  ariaLabel: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-7 h-7 bg-white border border-aaj-border rounded-full flex items-center justify-center hover:bg-aaj-soft hover:text-aaj-royal text-aaj-gray transition-colors shadow-sm"
      title={title}
      aria-label={ariaLabel}
    >
      {children}
    </button>
  );
}

function toDate(value: ChatMessage['createdAt']): Date | null {
  if (!value) return null;
  let d: Date | null = null;
  if (typeof value === 'string') d = new Date(value);
  else {
    const v = value as any;
    if (typeof v?.toDate === 'function') d = v.toDate();
    else if (typeof v?.seconds === 'number') d = new Date(v.seconds * 1000);
  }
  // Reject Invalid Date so callers don't render "Invalid Date" in the UI.
  if (!d || isNaN(d.getTime())) return null;
  return d;
}

function formatTime(value: ChatMessage['createdAt']): string {
  const d = toDate(value);
  if (!d) return '';
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function formatFullTimestamp(value: ChatMessage['createdAt']): string {
  const d = toDate(value);
  if (!d) return '';
  return d.toLocaleString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDayLabel(value: ChatMessage['createdAt']): string {
  const d = toDate(value);
  if (!d) return '';
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (sameDay(d, today)) return "Aujourd'hui";
  if (sameDay(d, yesterday)) return 'Hier';
  return d.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

export function dayKey(value: ChatMessage['createdAt']): string {
  const d = toDate(value);
  if (!d) return '';
  return d.toISOString().slice(0, 10);
}
