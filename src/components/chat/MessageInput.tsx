/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState, KeyboardEvent } from 'react';
import { Send, Paperclip, X, Loader2, Reply } from 'lucide-react';
import { addDoc, collection, doc, updateDoc, db } from '../../lib/firebase';
import { api } from '../../lib/api';
import type { ChatMessage } from '../../types';

interface MessageInputProps {
  channelId: string;
  currentUid: string;
  currentDisplayName: string;
  currentPhoto?: string;
  replyTo: ChatMessage | null;
  onClearReply: () => void;
  /** When true, focus the textarea after mount and whenever the channel
   *  changes. Used by the floating widget so the input is ready as soon as
   *  the popup opens. */
  autoFocus?: boolean;
}

export function MessageInput({
  channelId,
  currentUid,
  currentDisplayName,
  currentPhoto,
  replyTo,
  onClearReply,
  autoFocus = false,
}: MessageInputProps) {
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Focus the textarea when the input mounts in a freshly-opened channel
  // (only on devices with a fine pointer, so we don't pop the soft keyboard
  // on mobile).
  useEffect(() => {
    if (!autoFocus) return;
    if (typeof window === 'undefined') return;
    const fine = window.matchMedia?.('(pointer: fine)').matches;
    if (!fine) return;
    const t = setTimeout(() => textareaRef.current?.focus(), 200);
    return () => clearTimeout(t);
  }, [autoFocus, channelId]);

  // When the user picks "reply", focus the input so they can type immediately.
  useEffect(() => {
    if (replyTo) textareaRef.current?.focus();
  }, [replyTo]);

  const canSend = (text.trim() || file) && !sending;

  const handleSend = async () => {
    if (!canSend) return;
    setSending(true);
    setError(null);

    try {
      let attachment: Partial<ChatMessage> = {};
      if (file) {
        try {
          const uploaded = await api.uploadFile(file, 'chat', 'members');
          attachment = {
            attachmentUrl: uploaded.url,
            attachmentId: uploaded.id,
            attachmentName: uploaded.name,
            attachmentType: uploaded.type,
            attachmentSize: uploaded.size,
          };
        } catch (err: any) {
          setError(err?.message || "Échec de l'envoi de la pièce jointe.");
          setSending(false);
          return;
        }
      }

      const nowIso = new Date().toISOString();

      const payload: Record<string, any> = {
        channelId,
        text: text.trim(),
        senderId: currentUid,
        senderName: currentDisplayName,
        senderPhoto: currentPhoto,
        ...(replyTo && replyTo.id
          ? {
              replyTo: {
                messageId: replyTo.id,
                text: (replyTo.text || replyTo.attachmentName || '...').slice(0, 200),
                senderName: replyTo.senderName,
              },
            }
          : {}),
        ...attachment,
      };

      await addDoc(collection(db, 'chat_messages'), payload);

      // Bump channel lastMessage / lastActivityAt for ordering & unread tracking
      await updateDoc(doc(db, 'chat_channels', channelId), {
        lastMessage: {
          text: payload.text || (payload.attachmentName ? `📎 ${payload.attachmentName}` : ''),
          senderId: currentUid,
          senderName: currentDisplayName,
          createdAt: nowIso,
          hasAttachment: !!payload.attachmentUrl,
        },
        lastActivityAt: nowIso,
      });

      setText('');
      setFile(null);
      onClearReply();
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      console.error('Send message failed:', err);
      setError("Erreur lors de l'envoi du message.");
    } finally {
      setSending(false);
    }
  };

  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) {
      setError('Fichier trop volumineux (max 10 Mo).');
      return;
    }
    setFile(f);
    setError(null);
  };

  return (
    <div className="border-t border-aaj-border bg-white">
      {replyTo && (
        <div className="px-4 pt-3 pb-2 flex items-start gap-2 bg-aaj-soft border-b border-aaj-border">
          <Reply size={14} className="text-aaj-royal mt-1 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-black uppercase tracking-[2px] text-aaj-royal">
              Réponse à {replyTo.senderName}
            </div>
            <div className="text-[12px] text-aaj-gray truncate">
              {replyTo.text || replyTo.attachmentName || '...'}
            </div>
          </div>
          <button
            onClick={onClearReply}
            className="text-aaj-gray hover:text-red-500"
            aria-label="Annuler la réponse"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {file && (
        <div className="px-4 pt-3 flex items-center gap-2 bg-slate-50 border-b border-aaj-border py-2">
          <Paperclip size={14} className="text-aaj-royal" />
          <span className="text-[12px] text-aaj-dark flex-1 truncate">
            {file.name} <span className="text-aaj-gray">({Math.round(file.size / 1024)} Ko)</span>
          </span>
          <button
            onClick={() => {
              setFile(null);
              if (fileInputRef.current) fileInputRef.current.value = '';
            }}
            className="text-aaj-gray hover:text-red-500"
            aria-label="Retirer le fichier"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {error && (
        <div className="px-4 py-2 text-xs text-aaj-error bg-aaj-error-soft border-b border-aaj-border">
          {error}
        </div>
      )}

      <div className="flex items-end gap-2 p-3">
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={sending}
          className="w-10 h-10 flex items-center justify-center text-aaj-gray hover:text-aaj-royal hover:bg-aaj-soft rounded transition-colors disabled:opacity-50"
          title="Joindre un fichier"
          aria-label="Joindre un fichier"
        >
          <Paperclip size={18} />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          onChange={onPickFile}
          className="hidden"
          accept="image/*,application/pdf,.doc,.docx"
        />

        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKey}
          rows={1}
          placeholder="Écrire un message... (Entrée pour envoyer, Maj+Entrée pour aller à la ligne)"
          className="flex-1 resize-none px-4 py-2.5 border border-aaj-border rounded-2xl text-sm focus:border-aaj-royal focus:outline-none focus:ring-2 focus:ring-aaj-royal/10 max-h-32"
          style={{ minHeight: '40px' }}
        />

        <button
          onClick={handleSend}
          disabled={!canSend}
          className="w-10 h-10 flex items-center justify-center bg-aaj-royal text-white rounded-full hover:bg-aaj-dark transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          title="Envoyer"
          aria-label="Envoyer"
        >
          {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={16} />}
        </button>
      </div>
    </div>
  );
}
