/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useMemo, useState } from 'react';
import { Hash, Plus, Search, Users, Clock } from 'lucide-react';
import type { ChatChannel } from '../../types';

interface ChannelListProps {
  channels: ChatChannel[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNewChannel: () => void;
  unread: Record<string, boolean>;
  canCreate: boolean;
  currentUid: string;
}

export function ChannelList({
  channels,
  selectedId,
  onSelect,
  onNewChannel,
  unread,
  canCreate,
  currentUid,
}: ChannelListProps) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return channels;
    return channels.filter((c) => c.name.toLowerCase().includes(needle));
  }, [channels, search]);

  const approved = filtered.filter((c) => c.status === 'approved');
  const pending = filtered.filter((c) => c.status === 'pending' && c.createdBy === currentUid);

  return (
    <div className="flex flex-col h-full bg-white border-r border-aaj-border">
      <div className="p-4 border-b border-aaj-border">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[11px] font-black uppercase tracking-[2px] text-aaj-dark">
            Discussions
          </h3>
          {canCreate && (
            <button
              onClick={onNewChannel}
              className="w-8 h-8 bg-aaj-royal text-white rounded-full flex items-center justify-center hover:bg-aaj-dark transition-colors"
              title="Nouveau canal"
              aria-label="Nouveau canal"
            >
              <Plus size={16} />
            </button>
          )}
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-aaj-gray" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un canal..."
            className="w-full pl-9 pr-3 py-2 border border-aaj-border rounded text-sm focus:border-aaj-royal focus:outline-none"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {approved.length === 0 && pending.length === 0 && (
          <div className="p-6 text-center text-[11px] text-aaj-gray">
            Aucune discussion pour le moment.
          </div>
        )}

        {approved.map((c) => (
          <ChannelItem
            key={c.id}
            channel={c}
            selected={c.id === selectedId}
            unread={!!unread[c.id || '']}
            onClick={() => c.id && onSelect(c.id)}
          />
        ))}

        {pending.length > 0 && (
          <div className="px-4 pt-4 pb-2 text-[10px] font-black uppercase tracking-[2px] text-aaj-warning flex items-center gap-2">
            <Clock size={12} />
            En attente d&apos;approbation
          </div>
        )}
        {pending.map((c) => (
          <ChannelItem
            key={c.id}
            channel={c}
            selected={false}
            unread={false}
            pending
            onClick={() => {
              /* Pending channels are not clickable */
            }}
          />
        ))}
      </div>
    </div>
  );
}

function ChannelItem({
  channel,
  selected,
  unread,
  pending,
  onClick,
}: {
  channel: ChatChannel;
  selected: boolean;
  unread: boolean;
  pending?: boolean;
  onClick: () => void;
}) {
  const lastTime = channel.lastMessage?.createdAt
    ? formatRelative(channel.lastMessage.createdAt)
    : '';

  return (
    <button
      onClick={onClick}
      disabled={pending}
      className={`w-full flex items-start gap-3 p-3 text-left transition-colors border-b border-aaj-border ${
        selected ? 'bg-aaj-soft' : pending ? 'opacity-60 cursor-not-allowed' : 'hover:bg-slate-50'
      }`}
    >
      <div
        className="w-11 h-11 rounded-full flex items-center justify-center text-white text-xs font-black flex-shrink-0"
        style={{ backgroundColor: channel.iconColor || '#0047AB' }}
      >
        {channel.isAllMembers ? <Users size={18} /> : <Hash size={18} />}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span
            className={`text-sm truncate ${unread ? 'font-black text-aaj-dark' : 'font-bold text-aaj-dark'}`}
          >
            {channel.name}
          </span>
          {lastTime && (
            <span
              className={`text-[10px] flex-shrink-0 ${unread ? 'text-aaj-royal font-bold' : 'text-aaj-gray'}`}
            >
              {lastTime}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <span
            className={`text-[12px] truncate ${unread ? 'text-aaj-dark font-medium' : 'text-aaj-gray'}`}
          >
            {pending
              ? 'En attente d\u2019approbation'
              : channel.lastMessage
                ? `${channel.lastMessage.senderName?.split(' ')[0] || ''}: ${channel.lastMessage.text || (channel.lastMessage.hasAttachment ? '📎 Pièce jointe' : '')}`
                : 'Aucun message'}
          </span>
          {unread && <span className="w-2 h-2 rounded-full bg-aaj-royal flex-shrink-0" />}
        </div>
      </div>
    </button>
  );
}

function formatRelative(
  value: ChatChannel['lastMessage'] extends infer L
    ? L extends { createdAt: infer C }
      ? C
      : never
    : never
): string {
  const d = toDate(value);
  if (!d) return '';

  const now = new Date();
  const diffMin = Math.floor((now.getTime() - d.getTime()) / 60000);
  if (diffMin < 1) return "À l'instant";
  if (diffMin < 60) return `${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH} h`;
  if (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate() - 1
  ) {
    return 'Hier';
  }
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
}

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (typeof value === 'string') return new Date(value);
  const v = value as any;
  if (typeof v?.toDate === 'function') return v.toDate();
  if (typeof v?.seconds === 'number') return new Date(v.seconds * 1000);
  return null;
}
