/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, FormEvent } from 'react';
import { X, Loader2, Hash, Users } from 'lucide-react';
import { addDoc, collection, db } from '../../lib/firebase';
import { MemberPicker } from './MemberPicker';
import type { ChatChannel, UserProfile } from '../../types';

const CHANNEL_COLORS = [
  '#0047AB',
  '#059669',
  '#D97706',
  '#DC2626',
  '#7C3AED',
  '#DB2777',
  '#0891B2',
  '#65A30D',
];

interface NewChannelModalProps {
  open: boolean;
  onClose: () => void;
  members: UserProfile[];
  currentUid: string;
  currentDisplayName: string;
  /** When true, channel is created already approved (admin/moderator). */
  isModerator: boolean;
  /** When true, allow setting "all members" / type=general (admin only). */
  allowAllMembers?: boolean;
}

export function NewChannelModal({
  open,
  onClose,
  members,
  currentUid,
  currentDisplayName,
  isModerator,
  allowAllMembers = false,
}: NewChannelModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(CHANNEL_COLORS[0]);
  const [selected, setSelected] = useState<string[]>([]);
  const [isAllMembers, setIsAllMembers] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const reset = () => {
    setName('');
    setDescription('');
    setColor(CHANNEL_COLORS[0]);
    setSelected([]);
    setIsAllMembers(false);
    setError(null);
  };

  const handleClose = () => {
    if (submitting) return;
    reset();
    onClose();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Le nom du canal est obligatoire.');
      return;
    }
    if (!isAllMembers && selected.length === 0) {
      setError('Sélectionnez au moins un membre, ou activez « Tous les adhérents ».');
      return;
    }
    setSubmitting(true);
    try {
      // Always include the creator in memberUids so they can read their own channel
      const memberUids = isAllMembers ? [] : Array.from(new Set([currentUid, ...selected]));

      const nowIso = new Date().toISOString();
      const payload: Omit<ChatChannel, 'id' | 'createdAt'> = {
        name: trimmedName,
        description: description.trim(),
        type: isAllMembers && allowAllMembers ? 'general' : 'custom',
        status: isModerator ? 'approved' : 'pending',
        isAllMembers: isAllMembers && allowAllMembers,
        memberUids,
        createdBy: currentUid,
        createdByName: currentDisplayName,
        lastActivityAt: nowIso,
        iconColor: color,
        ...(isModerator ? { approvedBy: currentUid, approvedAt: nowIso } : {}),
      };

      await addDoc(collection(db, 'chat_channels'), payload);
      reset();
      onClose();
    } catch (err: any) {
      console.error('Create channel failed:', err);
      setError(
        err?.message?.includes('permission')
          ? "Vous n'avez pas la permission de créer un canal."
          : 'Erreur lors de la création du canal. Réessayez.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[1200] bg-aaj-dark/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={handleClose}
    >
      {/* Promote <form> to the modal wrapper so the submit button can live in
          the pinned footer (outside the scrollable body) while still triggering
          submission. max-h-[90vh] + flex column keeps header/footer visible
          and only the body scrolls when the picker grows tall. */}
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="bg-white max-w-2xl w-full rounded shadow-2xl flex flex-col max-h-[90vh] min-h-0"
      >
        {/* Header — pinned */}
        <div className="flex items-start justify-between p-6 border-b border-aaj-border flex-shrink-0">
          <div className="min-w-0 pr-4">
            <span className="text-[10px] uppercase tracking-[3px] text-aaj-royal font-black">
              Nouveau canal
            </span>
            <h3 className="text-2xl font-black uppercase tracking-tight mt-1">
              Créer une discussion
            </h3>
            {!isModerator && (
              <p className="text-[11px] text-aaj-warning mt-2 max-w-md">
                Votre demande sera soumise à un administrateur pour approbation.
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="text-aaj-gray hover:text-red-500 transition-colors flex-shrink-0"
            aria-label="Fermer"
          >
            <X size={24} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-6">
          <div>
            <label className="text-[10px] font-black uppercase tracking-[2px] text-aaj-gray block mb-2">
              Nom du canal *
            </label>
            <div className="relative">
              <Hash size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-aaj-gray" />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={70}
                placeholder="ex: Veille réglementaire"
                className="w-full pl-9 pr-3 py-3 border border-aaj-border rounded text-sm focus:border-aaj-royal focus:outline-none"
                required
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-black uppercase tracking-[2px] text-aaj-gray block mb-2">
              Description (optionnelle)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              maxLength={200}
              placeholder="À quoi ce canal sert-il ?"
              className="w-full p-3 border border-aaj-border rounded text-sm focus:border-aaj-royal focus:outline-none"
            />
          </div>

          <div>
            <label className="text-[10px] font-black uppercase tracking-[2px] text-aaj-gray block mb-2">
              Couleur
            </label>
            <div className="flex gap-2 flex-wrap">
              {CHANNEL_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${
                    color === c ? 'border-aaj-dark scale-110' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: c }}
                  aria-label={`Couleur ${c}`}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] font-black uppercase tracking-[2px] text-aaj-gray flex items-center gap-2 mb-3">
              <Users size={12} /> Membres du canal
            </label>
            <MemberPicker
              members={members}
              selected={selected}
              onChange={setSelected}
              excludeUid={currentUid}
              showAllToggle={allowAllMembers}
              isAllMembers={isAllMembers}
              onAllMembersChange={setIsAllMembers}
            />
          </div>

          {error && (
            <div className="p-3 bg-aaj-error-soft text-aaj-error rounded text-sm">{error}</div>
          )}
        </div>

        {/* Footer — pinned */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-aaj-border bg-white flex-shrink-0">
          <button
            type="button"
            onClick={handleClose}
            disabled={submitting}
            className="px-5 py-3 text-[11px] font-black uppercase tracking-[2px] text-aaj-gray hover:text-aaj-dark transition-colors"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-3 bg-aaj-royal text-white text-[11px] font-black uppercase tracking-[2px] rounded hover:bg-aaj-dark transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {submitting && <Loader2 size={14} className="animate-spin" />}
            {isModerator ? 'Créer le canal' : 'Demander la création'}
          </button>
        </div>
      </form>
    </div>
  );
}
