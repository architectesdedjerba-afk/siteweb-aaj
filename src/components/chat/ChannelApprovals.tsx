/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useMemo, useState } from 'react';
import { CheckCircle2, XCircle, Hash, Users, Loader2, Clock } from 'lucide-react';
import { doc, updateDoc, collection, onSnapshot, orderBy, query, db } from '../../lib/firebase';
import { useEffect } from 'react';
import type { ChatChannel } from '../../types';

interface ChannelApprovalsProps {
  currentUid: string;
}

export function ChannelApprovals({ currentUid }: ChannelApprovalsProps) {
  const [channels, setChannels] = useState<ChatChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'chat_channels'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setChannels(snap.docs.map((d) => ({ id: d.id, ...(d.data() as ChatChannel) })));
        setLoading(false);
      },
      (err) => {
        console.error('Approvals subscription error:', err);
        setLoading(false);
      }
    );
    return unsub;
  }, []);

  const pending = useMemo(() => channels.filter((c) => c.status === 'pending'), [channels]);
  const approved = useMemo(() => channels.filter((c) => c.status === 'approved'), [channels]);

  const approve = async (channel: ChatChannel) => {
    if (!channel.id) return;
    setBusyId(channel.id);
    try {
      const nowIso = new Date().toISOString();
      await updateDoc(doc(db, 'chat_channels', channel.id), {
        status: 'approved',
        approvedBy: currentUid,
        approvedAt: nowIso,
        lastActivityAt: nowIso,
      });
    } catch (err) {
      console.error('Approve failed:', err);
      alert('Approbation impossible.');
    } finally {
      setBusyId(null);
    }
  };

  const reject = async (channel: ChatChannel) => {
    if (!channel.id) return;
    const reason = window.prompt('Motif du rejet (optionnel) :') ?? '';
    setBusyId(channel.id);
    try {
      await updateDoc(doc(db, 'chat_channels', channel.id), {
        status: 'rejected',
        rejectedReason: reason,
      });
    } catch (err) {
      console.error('Reject failed:', err);
      alert('Rejet impossible.');
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={28} className="animate-spin text-aaj-royal" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section>
        <div className="flex items-center gap-3 mb-4">
          <Clock size={16} className="text-aaj-warning" />
          <h3 className="text-[11px] font-black uppercase tracking-[2px] text-aaj-dark">
            En attente d&apos;approbation ({pending.length})
          </h3>
        </div>
        {pending.length === 0 ? (
          <div className="p-6 text-center text-[12px] text-aaj-gray border border-dashed border-aaj-border rounded">
            Aucune demande en attente.
          </div>
        ) : (
          <div className="space-y-3">
            {pending.map((c) => (
              <ChannelCard
                key={c.id}
                channel={c}
                busy={busyId === c.id}
                onApprove={() => approve(c)}
                onReject={() => reject(c)}
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="flex items-center gap-3 mb-4">
          <CheckCircle2 size={16} className="text-aaj-success" />
          <h3 className="text-[11px] font-black uppercase tracking-[2px] text-aaj-dark">
            Canaux actifs ({approved.length})
          </h3>
        </div>
        {approved.length === 0 ? (
          <div className="p-6 text-center text-[12px] text-aaj-gray border border-dashed border-aaj-border rounded">
            Aucun canal approuvé pour le moment.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {approved.map((c) => (
              <div
                key={c.id}
                className="border border-aaj-border rounded p-4 flex items-center gap-3"
              >
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white flex-shrink-0"
                  style={{ backgroundColor: c.iconColor || '#0047AB' }}
                >
                  {c.isAllMembers ? <Users size={16} /> : <Hash size={16} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-aaj-dark truncate">{c.name}</div>
                  <div className="text-[11px] text-aaj-gray truncate">
                    {c.isAllMembers
                      ? 'Tous les adhérents'
                      : `${c.memberUids.length} membre${c.memberUids.length > 1 ? 's' : ''}`}
                    {' · '}créé par {c.createdByName}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ChannelCard({
  channel,
  busy,
  onApprove,
  onReject,
}: {
  channel: ChatChannel;
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <div className="border border-aaj-warning bg-aaj-warning-soft/30 rounded p-4">
      <div className="flex items-start gap-3">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-white flex-shrink-0"
          style={{ backgroundColor: channel.iconColor || '#0047AB' }}
        >
          <Hash size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-black text-aaj-dark">{channel.name}</h4>
          {channel.description && (
            <p className="text-[12px] text-aaj-gray mt-1">{channel.description}</p>
          )}
          <p className="text-[11px] text-aaj-gray mt-2">
            Demandé par <strong>{channel.createdByName}</strong> · {channel.memberUids.length}{' '}
            membre{channel.memberUids.length > 1 ? 's' : ''} sélectionné
            {channel.memberUids.length > 1 ? 's' : ''}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 mt-4">
        <button
          onClick={onReject}
          disabled={busy}
          className="px-4 py-2 text-[11px] font-black uppercase tracking-[2px] text-red-600 border border-red-200 rounded hover:bg-red-50 disabled:opacity-50 flex items-center gap-2"
        >
          <XCircle size={14} /> Rejeter
        </button>
        <button
          onClick={onApprove}
          disabled={busy}
          className="px-4 py-2 text-[11px] font-black uppercase tracking-[2px] text-white bg-aaj-success rounded hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}{' '}
          Approuver
        </button>
      </div>
    </div>
  );
}
