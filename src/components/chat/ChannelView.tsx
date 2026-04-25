/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Hash, Users, Loader2, Info, Settings, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useChannelMessages, markChannelRead } from '../../lib/useChat';
import { MessageBubble, dayKey, formatDayLabel } from './MessageBubble';
import { MessageInput } from './MessageInput';
import { ChannelInfoPanel } from './ChannelInfoPanel';
import type { ChatChannel, ChatMessage, UserProfile } from '../../types';

interface ChannelViewProps {
  channel: ChatChannel | null;
  currentUid: string;
  currentDisplayName: string;
  currentPhoto?: string;
  isModerator: boolean;
  members: UserProfile[];
  onBack?: () => void;
  /** Focus the message input when a channel is shown. */
  autoFocusInput?: boolean;
}

/** When the user is within this many pixels of the bottom of the message
 *  list, new incoming messages auto-scroll the view down. Beyond that, we
 *  preserve their scroll position and surface a "new messages" pill. */
const STICK_TO_BOTTOM_PX = 120;

export function ChannelView({
  channel,
  currentUid,
  currentDisplayName,
  currentPhoto,
  isModerator,
  members,
  onBack,
  autoFocusInput = false,
}: ChannelViewProps) {
  const { messages, loading } = useChannelMessages(channel?.id ?? null);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [hasNewBelow, setHasNewBelow] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stuckToBottomRef = useRef(true);
  const prevMessageCountRef = useRef(0);
  const prevChannelIdRef = useRef<string | null>(null);

  const membersByUid = useMemo(() => Object.fromEntries(members.map((m) => [m.uid, m])), [members]);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
    stuckToBottomRef.current = true;
    setHasNewBelow(false);
  }, []);

  // Track whether the user is "stuck to bottom". When they scroll up away
  // from the live edge, we stop auto-scrolling so we don't yank them out
  // of older messages.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const distFromBottom = el.scrollHeight - el.clientHeight - el.scrollTop;
      const atBottom = distFromBottom < STICK_TO_BOTTOM_PX;
      stuckToBottomRef.current = atBottom;
      if (atBottom && hasNewBelow) setHasNewBelow(false);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [hasNewBelow]);

  // Channel switch: jump to bottom instantly, reset state.
  useEffect(() => {
    if (!channel?.id) return;
    if (prevChannelIdRef.current !== channel.id) {
      prevChannelIdRef.current = channel.id;
      stuckToBottomRef.current = true;
      setHasNewBelow(false);
      // Wait a tick for the new messages list to render before scrolling.
      requestAnimationFrame(() => scrollToBottom('auto'));
    }
  }, [channel?.id, scrollToBottom]);

  // New message arrived: stick-to-bottom behaviour.
  useEffect(() => {
    const prev = prevMessageCountRef.current;
    prevMessageCountRef.current = messages.length;
    if (messages.length === 0 || prev === 0) {
      // First load — handled by channel-switch effect above.
      return;
    }
    if (messages.length <= prev) return;

    const newest = messages[messages.length - 1];
    const sentByMe = newest?.senderId === currentUid;

    if (stuckToBottomRef.current || sentByMe) {
      requestAnimationFrame(() => scrollToBottom('smooth'));
    } else {
      setHasNewBelow(true);
    }
  }, [messages, currentUid, scrollToBottom]);

  // Mark channel as read whenever it's opened or messages change.
  useEffect(() => {
    if (!channel?.id || !currentUid) return;
    markChannelRead(channel.id, currentUid).catch(() => {
      /* non-blocking */
    });
  }, [channel?.id, currentUid, messages.length]);

  // Reset reply when channel changes.
  useEffect(() => {
    setReplyTo(null);
    setShowInfo(false);
  }, [channel?.id]);

  if (!channel) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50 text-aaj-gray">
        <div className="text-center max-w-sm px-6">
          <div className="w-20 h-20 rounded-full bg-aaj-soft mx-auto mb-4 flex items-center justify-center">
            <Hash size={32} className="text-aaj-royal" />
          </div>
          <h3 className="text-lg font-black uppercase tracking-tight text-aaj-dark mb-2">
            Choisissez un canal
          </h3>
          <p className="text-sm">Sélectionnez une discussion à gauche, ou créez-en une nouvelle.</p>
        </div>
      </div>
    );
  }

  if (channel.status !== 'approved') {
    return (
      <div className="flex-1 flex flex-col bg-slate-50">
        <ChannelHeader
          channel={channel}
          memberCount={channel.isAllMembers ? members.length : channel.memberUids.length}
          onBack={onBack}
          onToggleInfo={() => setShowInfo((s) => !s)}
        />
        <div className="flex-1 flex items-center justify-center text-aaj-gray text-center px-6">
          <div className="max-w-sm">
            <Info size={32} className="mx-auto mb-3 text-aaj-warning" />
            <p className="text-sm">
              Ce canal est en attente d&apos;approbation par un administrateur. Vous pourrez y
              discuter dès qu&apos;il sera validé.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-white relative min-h-0">
      <ChannelHeader
        channel={channel}
        memberCount={
          channel.isAllMembers
            ? members.filter((m) => m.status === 'active').length
            : channel.memberUids.length
        }
        onBack={onBack}
        onToggleInfo={() => setShowInfo((s) => !s)}
      />

      <div className="flex-1 flex min-h-0 relative">
        <div className="flex-1 flex flex-col min-w-0 relative">
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-4 py-4 bg-gradient-to-b from-slate-50/40 to-white"
          >
            {loading ? (
              <div className="h-full flex items-center justify-center">
                <Loader2 size={24} className="animate-spin text-aaj-royal" />
              </div>
            ) : messages.length === 0 ? (
              <div className="h-full flex items-center justify-center text-aaj-gray text-sm text-center px-4">
                <div>
                  <p className="font-bold text-aaj-dark mb-1">Lancez la conversation</p>
                  <p>Soyez le premier à écrire dans ce canal !</p>
                </div>
              </div>
            ) : (
              <MessageList
                messages={messages}
                channelId={channel.id!}
                currentUid={currentUid}
                isModerator={isModerator}
                membersByUid={membersByUid}
                onReply={setReplyTo}
              />
            )}
          </div>

          {/* "↓ new messages" pill — appears when user has scrolled up and
              new messages arrive. Click to jump to bottom. */}
          <AnimatePresence>
            {hasNewBelow && (
              <motion.button
                key="new-msg-pill"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 12 }}
                transition={{ duration: 0.18 }}
                onClick={() => scrollToBottom('smooth')}
                className="absolute left-1/2 -translate-x-1/2 bottom-24 bg-aaj-royal text-white text-[11px] font-black uppercase tracking-[2px] px-4 py-2 rounded-full shadow-xl hover:bg-aaj-dark transition-colors flex items-center gap-2"
                aria-label="Aller au dernier message"
              >
                <ChevronDown size={14} />
                Nouveaux messages
              </motion.button>
            )}
          </AnimatePresence>

          <MessageInput
            channelId={channel.id!}
            currentUid={currentUid}
            currentDisplayName={currentDisplayName}
            currentPhoto={currentPhoto}
            replyTo={replyTo}
            onClearReply={() => setReplyTo(null)}
            autoFocus={autoFocusInput}
          />
        </div>

        {/* Info panel as a slide-in overlay rather than a flex sibling.
            On the narrow floating popup (~760px), the channel list already
            consumes 320px — adding a 320px sibling pane would squeeze the
            messages column and overflow the right edge. The overlay pattern
            keeps the conversation visible underneath and never affects
            layout width. */}
        <AnimatePresence>
          {showInfo && (
            <motion.div
              key="channel-info-panel"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="absolute inset-y-0 right-0 w-full max-w-[320px] z-20 shadow-2xl"
            >
              <ChannelInfoPanel
                channel={channel}
                members={members}
                currentUid={currentUid}
                isModerator={isModerator}
                onClose={() => setShowInfo(false)}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function ChannelHeader({
  channel,
  memberCount,
  onBack,
  onToggleInfo,
}: {
  channel: ChatChannel;
  memberCount: number;
  onBack?: () => void;
  onToggleInfo: () => void;
}) {
  const subtitle = channel.isAllMembers
    ? `Tous les adhérents · ${memberCount} membre${memberCount > 1 ? 's' : ''}`
    : `${memberCount} membre${memberCount > 1 ? 's' : ''}`;

  return (
    <header className="flex items-center gap-3 px-4 py-3 border-b border-aaj-border bg-white flex-shrink-0">
      {onBack && (
        <button
          onClick={onBack}
          className="lg:hidden text-aaj-gray hover:text-aaj-dark"
          aria-label="Retour à la liste des canaux"
        >
          <ArrowLeft size={20} />
        </button>
      )}
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center text-white flex-shrink-0"
        style={{ backgroundColor: channel.iconColor || '#0047AB' }}
      >
        {channel.isAllMembers ? <Users size={16} /> : <Hash size={16} />}
      </div>
      <div className="flex-1 min-w-0">
        <h2
          className="text-sm font-black uppercase tracking-tight text-aaj-dark truncate"
          title={channel.name}
        >
          {channel.name}
        </h2>
        <p
          className="text-[11px] text-aaj-gray truncate"
          title={channel.description ? `${subtitle} — ${channel.description}` : subtitle}
        >
          {subtitle}
          {channel.description ? ` — ${channel.description}` : ''}
        </p>
      </div>
      <button
        onClick={onToggleInfo}
        className="w-9 h-9 flex items-center justify-center text-aaj-gray hover:text-aaj-royal hover:bg-aaj-soft rounded transition-colors"
        title="Détails du canal"
        aria-label="Détails du canal"
      >
        <Settings size={16} />
      </button>
    </header>
  );
}

function MessageList({
  messages,
  channelId,
  currentUid,
  isModerator,
  membersByUid,
  onReply,
}: {
  messages: ChatMessage[];
  channelId: string;
  currentUid: string;
  isModerator: boolean;
  membersByUid: Record<string, UserProfile>;
  onReply: (msg: ChatMessage) => void;
}) {
  let lastDay = '';
  let lastSender = '';

  return (
    <div className="space-y-1">
      {messages.map((m, i) => {
        const day = dayKey(m.createdAt);
        const dayChanged = day !== lastDay;
        const groupedWithPrev = !dayChanged && m.senderId === lastSender;
        const isFirstFew = i < 3;
        lastDay = day;
        lastSender = m.senderId;

        return (
          <div key={m.id}>
            {dayChanged && (
              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px bg-aaj-border" />
                <span className="text-[10px] font-black uppercase tracking-[2px] text-aaj-gray bg-white px-2 rounded-full">
                  {formatDayLabel(m.createdAt)}
                </span>
                <div className="flex-1 h-px bg-aaj-border" />
              </div>
            )}
            <MessageBubble
              message={m}
              channelId={channelId}
              currentUid={currentUid}
              isModerator={isModerator}
              membersByUid={membersByUid}
              onReply={onReply}
              groupedWithPrev={groupedWithPrev}
              flipMenuBelow={isFirstFew}
            />
          </div>
        );
      })}
    </div>
  );
}
