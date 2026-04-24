/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { collection, onSnapshot, query, where, db } from '../../lib/firebase';
import { useChannels, useUnreadCounts } from '../../lib/useChat';
import { useAuth } from '../../lib/AuthContext';
import { ChannelList } from './ChannelList';
import { ChannelView } from './ChannelView';
import { NewChannelModal } from './NewChannelModal';
import type { UserProfile } from '../../types';

interface ChatPageProps {
  /** When true, fill parent height instead of using viewport-based sizing.
   *  Used when ChatPage is rendered inside the floating popup window. */
  embedded?: boolean;
}

export function ChatPage({ embedded = false }: ChatPageProps = {}) {
  const { user, profile, isAdmin, can } = useAuth();
  const [members, setMembers] = useState<UserProfile[]>([]);
  const [membersLoading, setMembersLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showNewChannel, setShowNewChannel] = useState(false);
  const [showListMobile, setShowListMobile] = useState(true);

  const isModerator = isAdmin || can('chat_manage');
  const canCreate = isAdmin || can('chat_create_channel');
  const uid = user?.uid ?? null;

  // Fetch active members (only when chat is opened)
  useEffect(() => {
    const q = query(collection(db, 'users'), where('status', '==', 'active'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setMembers(
          snap.docs.map((d) => ({ uid: d.id, ...(d.data() as UserProfile) }) as UserProfile)
        );
        setMembersLoading(false);
      },
      (err) => {
        console.error('Members subscription error:', err);
        setMembersLoading(false);
      }
    );
    return unsub;
  }, []);

  const { channels, loading: channelsLoading } = useChannels(uid, {
    isModerator,
  });
  const { unread } = useUnreadCounts(uid, channels);

  const selected = useMemo(
    () => channels.find((c) => c.id === selectedId) ?? null,
    [channels, selectedId]
  );

  // Auto-select first approved channel on mount.
  useEffect(() => {
    if (selectedId) return;
    const firstApproved = channels.find((c) => c.status === 'approved');
    if (firstApproved?.id) setSelectedId(firstApproved.id);
  }, [channels, selectedId]);

  if (!uid || !profile) {
    return (
      <div className="h-full flex items-center justify-center text-aaj-gray text-sm">
        Connexion requise pour accéder à la messagerie.
      </div>
    );
  }

  if (channelsLoading || membersLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-aaj-royal" />
      </div>
    );
  }

  return (
    <div
      className={
        embedded
          ? 'h-full bg-white overflow-hidden'
          : 'border border-aaj-border rounded overflow-hidden bg-white'
      }
    >
      <div
        className={
          embedded ? 'flex h-full min-h-0' : 'flex h-[calc(100vh-220px)] min-h-[500px]'
        }
      >
        {/* Left: channel list */}
        <div
          className={`${showListMobile ? 'flex' : 'hidden'} lg:flex w-full lg:w-80 flex-shrink-0`}
        >
          <ChannelList
            channels={channels}
            selectedId={selectedId}
            onSelect={(id) => {
              setSelectedId(id);
              setShowListMobile(false);
            }}
            onNewChannel={() => setShowNewChannel(true)}
            unread={unread}
            canCreate={canCreate}
            currentUid={uid}
          />
        </div>

        {/* Right: conversation */}
        <div className={`${showListMobile ? 'hidden' : 'flex'} lg:flex flex-1 min-w-0`}>
          <ChannelView
            channel={selected}
            currentUid={uid}
            currentDisplayName={profile.displayName || profile.email || 'Membre'}
            currentPhoto={profile.photoBase64}
            isModerator={isModerator}
            members={members}
            onBack={() => setShowListMobile(true)}
          />
        </div>
      </div>

      <NewChannelModal
        open={showNewChannel}
        onClose={() => setShowNewChannel(false)}
        members={members}
        currentUid={uid}
        currentDisplayName={profile.displayName || profile.email || 'Membre'}
        isModerator={isModerator}
        allowAllMembers={isModerator}
      />
    </div>
  );
}
