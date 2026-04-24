/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useMemo, useState } from 'react';
import { X, Users, Trash2, UserPlus, Loader2 } from 'lucide-react';
import { doc, updateDoc, deleteDoc, db } from '../../lib/firebase';
import { Avatar, MemberPicker } from './MemberPicker';
import type { ChatChannel, UserProfile } from '../../types';

interface ChannelInfoPanelProps {
  channel: ChatChannel;
  members: UserProfile[];
  currentUid: string;
  isModerator: boolean;
  onClose: () => void;
}

export function ChannelInfoPanel({
  channel,
  members,
  currentUid,
  isModerator,
  onClose,
}: ChannelInfoPanelProps) {
  const [editingMembers, setEditingMembers] = useState(false);
  const [newSelected, setNewSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const channelMembers = useMemo(() => {
    if (channel.isAllMembers) return members.filter((m) => m.status === 'active');
    return members.filter((m) => channel.memberUids.includes(m.uid));
  }, [members, channel.isAllMembers, channel.memberUids]);

  const candidateMembers = useMemo(() => {
    return members.filter((m) => m.status === 'active' && !channel.memberUids.includes(m.uid));
  }, [members, channel.memberUids]);

  const canEdit = isModerator || channel.createdBy === currentUid;

  const handleAddMembers = async () => {
    if (!channel.id || newSelected.length === 0) return;
    setBusy(true);
    try {
      const merged = Array.from(new Set([...channel.memberUids, ...newSelected]));
      await updateDoc(doc(db, 'chat_channels', channel.id), {
        memberUids: merged,
        lastActivityAt: new Date().toISOString(),
      });
      setNewSelected([]);
      setEditingMembers(false);
    } catch (err) {
      console.error('Add members failed:', err);
      alert('Impossible d\u2019ajouter les membres.');
    } finally {
      setBusy(false);
    }
  };

  const handleRemoveMember = async (uid: string) => {
    if (!channel.id) return;
    if (uid === channel.createdBy) {
      alert('Le créateur du canal ne peut pas être retiré.');
      return;
    }
    if (!window.confirm('Retirer ce membre du canal ?')) return;
    try {
      const next = channel.memberUids.filter((u) => u !== uid);
      await updateDoc(doc(db, 'chat_channels', channel.id), {
        memberUids: next,
      });
    } catch (err) {
      console.error('Remove member failed:', err);
      alert('Impossible de retirer ce membre.');
    }
  };

  const handleDeleteChannel = async () => {
    if (!channel.id) return;
    if (
      !window.confirm(
        `Supprimer définitivement le canal « ${channel.name} » et tous ses messages ?`
      )
    )
      return;
    try {
      // Note: messages subcollection is left for admin cleanup or Cloud Function.
      // Firestore doesn't cascade-delete subcollections from the client.
      await deleteDoc(doc(db, 'chat_channels', channel.id));
      onClose();
    } catch (err) {
      console.error('Delete channel failed:', err);
      alert('Suppression impossible.');
    }
  };

  return (
    <aside className="w-80 border-l border-aaj-border bg-white flex flex-col flex-shrink-0">
      <div className="p-4 border-b border-aaj-border flex items-center justify-between">
        <h3 className="text-[11px] font-black uppercase tracking-[2px] text-aaj-dark">
          Détails du canal
        </h3>
        <button onClick={onClose} className="text-aaj-gray hover:text-aaj-dark" aria-label="Fermer">
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <div>
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center text-white text-lg font-black mx-auto mb-3"
            style={{ backgroundColor: channel.iconColor || '#0047AB' }}
          >
            {channel.name.slice(0, 2).toUpperCase()}
          </div>
          <h4 className="text-center font-black text-aaj-dark">{channel.name}</h4>
          {channel.description && (
            <p className="text-[11px] text-aaj-gray text-center mt-1">{channel.description}</p>
          )}
          <p className="text-[10px] text-aaj-gray text-center mt-2">
            Créé par {channel.createdByName}
          </p>
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-black uppercase tracking-[2px] text-aaj-gray flex items-center gap-2">
              <Users size={12} /> {channelMembers.length} membre
              {channelMembers.length > 1 ? 's' : ''}
            </span>
            {canEdit && !channel.isAllMembers && !editingMembers && (
              <button
                onClick={() => setEditingMembers(true)}
                className="text-[10px] font-black uppercase tracking-[2px] text-aaj-royal hover:underline flex items-center gap-1"
              >
                <UserPlus size={12} /> Ajouter
              </button>
            )}
          </div>

          {editingMembers && (
            <div className="mb-4 p-3 border border-aaj-border rounded space-y-3">
              <MemberPicker
                members={candidateMembers}
                selected={newSelected}
                onChange={setNewSelected}
                showAllToggle={false}
                maxHeight="220px"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setEditingMembers(false);
                    setNewSelected([]);
                  }}
                  className="flex-1 px-3 py-2 text-[10px] font-black uppercase tracking-[2px] text-aaj-gray hover:text-aaj-dark"
                >
                  Annuler
                </button>
                <button
                  onClick={handleAddMembers}
                  disabled={busy || newSelected.length === 0}
                  className="flex-1 px-3 py-2 bg-aaj-royal text-white text-[10px] font-black uppercase tracking-[2px] rounded hover:bg-aaj-dark disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {busy && <Loader2 size={12} className="animate-spin" />} Ajouter
                </button>
              </div>
            </div>
          )}

          <div className="space-y-1">
            {channelMembers.map((m) => (
              <div key={m.uid} className="flex items-center gap-2 p-2 rounded hover:bg-slate-50">
                <Avatar profile={m} size={28} />
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-bold text-aaj-dark truncate">
                    {m.displayName}
                    {m.uid === channel.createdBy && (
                      <span className="ml-1 text-[9px] text-aaj-royal">(créateur)</span>
                    )}
                  </div>
                  <div className="text-[10px] text-aaj-gray truncate">{m.email}</div>
                </div>
                {canEdit && !channel.isAllMembers && m.uid !== channel.createdBy && (
                  <button
                    onClick={() => handleRemoveMember(m.uid)}
                    className="text-aaj-gray hover:text-red-500"
                    title="Retirer du canal"
                    aria-label="Retirer"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {canEdit && (
          <div className="pt-4 border-t border-aaj-border">
            <button
              onClick={handleDeleteChannel}
              className="w-full flex items-center justify-center gap-2 px-3 py-3 bg-red-50 text-red-600 rounded text-[11px] font-black uppercase tracking-[2px] hover:bg-red-100 transition-colors"
            >
              <Trash2 size={14} /> Supprimer le canal
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
