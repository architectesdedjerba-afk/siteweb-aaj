/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useMemo, useState } from 'react';
import { Search, Check, Users, X } from 'lucide-react';
import type { UserProfile } from '../../types';

interface MemberPickerProps {
  members: UserProfile[];
  selected: string[];
  onChange: (uids: string[]) => void;
  excludeUid?: string;
  /** Show the "select all" / "all members" toggle. */
  showAllToggle?: boolean;
  isAllMembers?: boolean;
  onAllMembersChange?: (value: boolean) => void;
  maxHeight?: string;
}

export function MemberPicker({
  members,
  selected,
  onChange,
  excludeUid,
  showAllToggle = true,
  isAllMembers = false,
  onAllMembersChange,
  maxHeight = '320px',
}: MemberPickerProps) {
  const [search, setSearch] = useState('');

  const candidates = useMemo(() => {
    return members.filter((m) => m.uid !== excludeUid && m.status === 'active');
  }, [members, excludeUid]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return candidates;
    return candidates.filter((m) => {
      const haystack =
        `${m.displayName ?? ''} ${m.email ?? ''} ${m.firstName ?? ''} ${m.lastName ?? ''}`.toLowerCase();
      return haystack.includes(needle);
    });
  }, [candidates, search]);

  const toggle = (uid: string) => {
    if (isAllMembers) return;
    onChange(selected.includes(uid) ? selected.filter((u) => u !== uid) : [...selected, uid]);
  };

  const selectAllVisible = () => {
    const merged = Array.from(new Set([...selected, ...filtered.map((m) => m.uid)]));
    onChange(merged);
  };

  const clearAll = () => onChange([]);

  return (
    <div className="space-y-3">
      {showAllToggle && onAllMembersChange && (
        <button
          type="button"
          onClick={() => onAllMembersChange(!isAllMembers)}
          className={`w-full flex items-center justify-between p-4 rounded border transition-all text-left ${
            isAllMembers
              ? 'bg-aaj-royal text-white border-aaj-royal'
              : 'bg-white text-aaj-dark border-aaj-border hover:border-aaj-royal'
          }`}
        >
          <div className="flex items-center gap-3">
            <Users size={18} />
            <div>
              <div className="text-[11px] font-black uppercase tracking-[2px]">
                Tous les adhérents actifs
              </div>
              <div
                className={`text-[10px] mt-1 ${isAllMembers ? 'text-white/80' : 'text-aaj-gray'}`}
              >
                {candidates.length} membre{candidates.length > 1 ? 's' : ''} — inclut les futurs
              </div>
            </div>
          </div>
          <div
            className={`w-5 h-5 rounded border flex items-center justify-center ${
              isAllMembers ? 'bg-white border-white' : 'border-aaj-border'
            }`}
          >
            {isAllMembers && <Check size={14} className="text-aaj-royal" />}
          </div>
        </button>
      )}

      <div className={isAllMembers ? 'opacity-40 pointer-events-none' : ''}>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-aaj-gray" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un membre..."
            className="w-full pl-9 pr-3 py-3 border border-aaj-border rounded text-sm focus:border-aaj-royal focus:outline-none"
          />
        </div>

        <div className="flex items-center justify-between mt-2 mb-2">
          <span className="text-[10px] font-black uppercase tracking-[2px] text-aaj-gray">
            {selected.length} sélectionné{selected.length > 1 ? 's' : ''}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={selectAllVisible}
              className="text-[10px] font-black uppercase tracking-[2px] text-aaj-royal hover:underline"
            >
              + tout sélectionner
            </button>
            {selected.length > 0 && (
              <>
                <span className="text-aaj-border">|</span>
                <button
                  type="button"
                  onClick={clearAll}
                  className="text-[10px] font-black uppercase tracking-[2px] text-red-500 hover:underline"
                >
                  vider
                </button>
              </>
            )}
          </div>
        </div>

        <div className="border border-aaj-border rounded overflow-y-auto" style={{ maxHeight }}>
          {filtered.length === 0 ? (
            <div className="p-4 text-center text-[11px] text-aaj-gray">Aucun membre trouvé.</div>
          ) : (
            filtered.map((m) => {
              const isSelected = selected.includes(m.uid);
              return (
                <button
                  key={m.uid}
                  type="button"
                  onClick={() => toggle(m.uid)}
                  className={`w-full flex items-center gap-3 p-3 text-left border-b border-aaj-border last:border-b-0 transition-colors ${
                    isSelected ? 'bg-aaj-soft' : 'hover:bg-slate-50'
                  }`}
                >
                  <Avatar profile={m} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-aaj-dark truncate">
                      {m.displayName ||
                        `${m.firstName ?? ''} ${m.lastName ?? ''}`.trim() ||
                        m.email}
                    </div>
                    <div className="text-[11px] text-aaj-gray truncate">{m.email}</div>
                  </div>
                  <div
                    className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 ${
                      isSelected ? 'bg-aaj-royal border-aaj-royal' : 'border-aaj-border'
                    }`}
                  >
                    {isSelected && <Check size={14} className="text-white" />}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {!isAllMembers && selected.length > 0 && (
        <SelectedChips
          members={members}
          selected={selected}
          onRemove={(uid) => onChange(selected.filter((u) => u !== uid))}
        />
      )}
    </div>
  );
}

function SelectedChips({
  members,
  selected,
  onRemove,
}: {
  members: UserProfile[];
  selected: string[];
  onRemove: (uid: string) => void;
}) {
  const byUid = useMemo(() => Object.fromEntries(members.map((m) => [m.uid, m])), [members]);
  return (
    <div className="flex flex-wrap gap-2 pt-1">
      {selected.map((uid) => {
        const m = byUid[uid];
        if (!m) return null;
        return (
          <span
            key={uid}
            className="inline-flex items-center gap-2 bg-aaj-soft text-aaj-dark px-3 py-1 rounded-full text-[11px]"
          >
            {m.displayName || m.email}
            <button
              type="button"
              onClick={() => onRemove(uid)}
              className="hover:text-red-500"
              aria-label={`Retirer ${m.displayName}`}
            >
              <X size={12} />
            </button>
          </span>
        );
      })}
    </div>
  );
}

export function Avatar({
  profile,
  size = 36,
}: {
  profile: Pick<UserProfile, 'displayName' | 'photoBase64' | 'email'> & {
    firstName?: string;
    lastName?: string;
  };
  size?: number;
}) {
  const initials = useMemo(() => {
    const name =
      profile.displayName ||
      `${profile.firstName ?? ''} ${profile.lastName ?? ''}`.trim() ||
      profile.email ||
      '?';
    return name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join('');
  }, [profile]);

  if (profile.photoBase64) {
    return (
      <img
        src={profile.photoBase64}
        alt=""
        className="rounded-full object-cover flex-shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="rounded-full bg-aaj-royal text-white flex items-center justify-center font-bold flex-shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {initials || '?'}
    </div>
  );
}
