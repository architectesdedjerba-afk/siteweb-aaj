/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Real-time chat hooks for internal messaging (channels + messages).
 * Backed by the Firestore-shaped shim in lib/firebase.ts which polls the
 * cPanel PHP API every few seconds.
 */

import { useEffect, useMemo, useState } from 'react';
import { collection, doc, onSnapshot, orderBy, query, setDoc, where, db } from './firebase';
import type { ChatChannel, ChatMessage } from '../types';

const CHANNELS = 'chat_channels';
const MESSAGES = 'chat_messages';
const READS = 'chat_channel_reads';

const readKey = (channelId: string, uid: string) => `${channelId}_${uid}`;

/**
 * Subscribe to all channels visible to the current user.
 *
 * The PHP API already restricts per-row reads via canGet (membership +
 * status). We further refine on the client to expose moderator-only
 * "pending" review state.
 */
export function useChannels(
  uid: string | null,
  opts: { isModerator: boolean } = { isModerator: false }
) {
  const [channels, setChannels] = useState<ChatChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!uid) {
      setChannels([]);
      setLoading(false);
      return;
    }
    const q = query(collection(db, CHANNELS), orderBy('lastActivityAt', 'desc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const all = snap.docs.map(
          (d) => ({ id: d.id, ...(d.data() as ChatChannel) }) as ChatChannel
        );
        setChannels(all);
        setLoading(false);
      },
      (err) => {
        console.error('Channels subscription error:', err);
        setError(err);
        setLoading(false);
      }
    );
    return unsub;
  }, [uid]);

  const visible = useMemo(() => {
    if (!uid) return [];
    return channels.filter((c) => {
      if (opts.isModerator) return true;
      if (c.status !== 'approved') {
        // Show creator their own pending channels
        return c.createdBy === uid;
      }
      return c.isAllMembers || (c.memberUids || []).includes(uid);
    });
  }, [channels, uid, opts.isModerator]);

  return { channels: visible, allChannels: channels, loading, error };
}

/**
 * Subscribe to messages of a single channel, oldest first (for natural chat flow).
 */
export function useChannelMessages(channelId: string | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!channelId) {
      setMessages([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const q = query(
      collection(db, MESSAGES),
      where('channelId', '==', channelId),
      orderBy('createdAt', 'asc')
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setMessages(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as ChatMessage) }) as ChatMessage)
        );
        setLoading(false);
      },
      (err) => {
        console.error(`Messages subscription error (${channelId}):`, err);
        setLoading(false);
      }
    );
    return unsub;
  }, [channelId]);

  return { messages, loading };
}

/**
 * Track per-user lastReadAt for every channel. One subscription lists every
 * read marker for the current user — no per-channel polling.
 */
export function useUnreadCounts(uid: string | null, channels: ChatChannel[]) {
  const [reads, setReads] = useState<Record<string, string | null>>({});

  useEffect(() => {
    if (!uid) {
      setReads({});
      return;
    }
    const q = query(collection(db, READS), where('uid', '==', uid));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const next: Record<string, string | null> = {};
        snap.docs.forEach((d) => {
          const data = d.data() as { channelId?: string; lastReadAt?: any };
          if (!data?.channelId) return;
          next[data.channelId] = toIso(data.lastReadAt);
        });
        setReads(next);
      },
      () => {
        /* listing failures are non-fatal */
      }
    );
    return unsub;
  }, [uid]);

  const unread = useMemo(() => {
    const result: Record<string, boolean> = {};
    channels.forEach((c) => {
      if (!c.id || !c.lastActivityAt) {
        result[c.id || ''] = false;
        return;
      }
      const lastActivityMs = toMillis(c.lastActivityAt);
      const lastReadMs = reads[c.id] ? new Date(reads[c.id] as string).getTime() : 0;
      result[c.id] = lastActivityMs > lastReadMs && c.lastMessage?.senderId !== uid;
    });
    return result;
  }, [channels, reads, uid]);

  const totalUnread = Object.values(unread).filter(Boolean).length;

  return { unread, totalUnread };
}

/** Lightweight hook for the navigation badge — total unread channels for current user. */
export function useChatBadge(uid: string | null, isModerator: boolean) {
  const { channels } = useChannels(uid, { isModerator });
  const { totalUnread } = useUnreadCounts(uid, channels);
  const pendingApproval = isModerator ? channels.filter((c) => c.status === 'pending').length : 0;
  return { totalUnread, pendingApproval };
}

export async function markChannelRead(channelId: string, uid: string) {
  const id = readKey(channelId, uid);
  await setDoc(
    doc(db, READS, id),
    {
      channelId,
      uid,
      lastReadAt: new Date().toISOString(),
    },
    { merge: true }
  );
}

function toIso(value: any): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value?.toDate === 'function') return value.toDate().toISOString();
  if (typeof value?.seconds === 'number') {
    return new Date(value.seconds * 1000).toISOString();
  }
  return null;
}

function toMillis(value: any): number {
  if (!value) return 0;
  if (typeof value === 'string') return new Date(value).getTime();
  if (typeof value?.toMillis === 'function') return value.toMillis();
  if (typeof value?.seconds === 'number') return value.seconds * 1000;
  return 0;
}
