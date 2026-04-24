/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Hash, Users, Loader2, Info, Settings } from 'lucide-react';
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
}

export function ChannelView({
  channel,
  currentUid,
  currentDisplayName,
  currentPhoto,
  isModerator,
  members,
  onBack,
}: ChannelViewProps) {
  const { messages, loading } = useChannelMessages(channel?.id ?? null);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const membersByUid = useMemo(() => Object.fromEntries(members.map((m) => [m.uid, m])), [members]);

  // Auto-scroll to bottom on new messages.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length, channel?.id]);

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

      <div className="flex-1 flex min-h-0">
        <div className="flex-1 flex flex-col min-w-0">
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
            {loading ? (
              <div className="h-full flex items-center justify-center">
                <Loader2 size={24} className="animate-spin text-aaj-royal" />
              </div>
            ) : messages.length === 0 ? (
              <div className="h-full flex items-center justify-center text-aaj-gray text-sm">
                Soyez le premier à écrire dans ce canal !
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

          <MessageInput
            channelId={channel.id!}
            currentUid={currentUid}
            currentDisplayName={currentDisplayName}
            currentPhoto={currentPhoto}
            replyTo={replyTo}
            onClearReply={() => setReplyTo(null)}
          />
        </div>

        {showInfo && (
          <ChannelInfoPanel
            channel={channel}
            members={members}
            currentUid={currentUid}
            isModerator={isModerator}
            onClose={() => setShowInfo(false)}
          />
        )}
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
  return (
    <header className="flex items-center gap-3 px-4 py-3 border-b border-aaj-border bg-white flex-shrink-0">
      {onBack && (
        <button
          onClick={onBack}
          className="lg:hidden text-aaj-gray hover:text-aaj-dark"
          aria-label="Retour"
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
        <h2 className="text-sm font-black uppercase tracking-tight text-aaj-dark truncate">
          {channel.name}
        </h2>
        <p className="text-[11px] text-aaj-gray truncate">
          {channel.isAllMembers
            ? `Tous les adhérents · ${memberCount} membre${memberCount > 1 ? 's' : ''}`
            : `${memberCount} membre${memberCount > 1 ? 's' : ''}`}
          {channel.description ? ` — ${channel.description}` : ''}
        </p>
      </div>
      <button
        onClick={onToggleInfo}
        className="w-9 h-9 flex items-center justify-center text-aaj-gray hover:text-aaj-dark hover:bg-slate-50 rounded transition-colors"
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
      {messages.map((m) => {
        const day = dayKey(m.createdAt);
        const dayChanged = day !== lastDay;
        const groupedWithPrev = !dayChanged && m.senderId === lastSender;
        lastDay = day;
        lastSender = m.senderId;

        return (
          <div key={m.id}>
            {dayChanged && (
              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px bg-aaj-border" />
                <span className="text-[10px] font-black uppercase tracking-[2px] text-aaj-gray">
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
            />
          </div>
        );
      })}
    </div>
  );
}
