/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { doc, getDoc, setDoc, serverTimestamp, db } from './firebase';
import { TUNISIAN_DELEGATIONS } from './tunisianDelegations';

export interface MemberType {
  letter: string;
  label: string;
}

export const DEFAULT_MEMBER_TYPES: MemberType[] = [
  { letter: 'A', label: 'Architecte' },
  { letter: 'E', label: 'Étudiant / Diplômé en architecture' },
  { letter: 'S', label: 'Architecte Stagiaire' },
];

export const DEFAULT_VILLES: string[] = Array.from(new Set(TUNISIAN_DELEGATIONS)).sort((a, b) =>
  a.localeCompare(b, 'fr')
);

export const VILLES_DOC_PATH = { col: 'config', id: 'villes' } as const;
export const MEMBER_TYPES_DOC_PATH = { col: 'config', id: 'memberTypes' } as const;
export const COMMISSION_COLORS_DOC_PATH = { col: 'config', id: 'commissionColors' } as const;

/**
 * Default colour assignments for the three Djerba town councils whose
 * commissions feed into the calendar. Falls back to a deterministic palette
 * for any other town the admin adds later.
 */
export const DEFAULT_COMMISSION_COLORS: Record<string, string> = {
  'Houmt Souk': '#1E40AF',
  Midoun: '#16A34A',
  Ajim: '#D97706',
};

const FALLBACK_PALETTE = [
  '#1E40AF',
  '#16A34A',
  '#D97706',
  '#7C3AED',
  '#DB2777',
  '#0EA5E9',
  '#DC2626',
  '#0F766E',
  '#9333EA',
  '#CA8A04',
];

/**
 * Resolve a colour for a town. Priority:
 *   1. explicit value in the saved config map (admin-customised),
 *   2. hardcoded default for known Djerba towns,
 *   3. deterministic pick from FALLBACK_PALETTE based on the town name.
 */
export function colorForTown(town: string, configured: Record<string, string>): string {
  const direct = configured?.[town];
  if (direct && /^#[0-9a-fA-F]{6}$/.test(direct)) return direct;
  if (DEFAULT_COMMISSION_COLORS[town]) return DEFAULT_COMMISSION_COLORS[town];
  let hash = 0;
  for (let i = 0; i < town.length; i++) hash = (hash * 31 + town.charCodeAt(i)) >>> 0;
  return FALLBACK_PALETTE[hash % FALLBACK_PALETTE.length];
}

export async function loadVilles(): Promise<string[]> {
  try {
    const snap = await getDoc(doc(db, VILLES_DOC_PATH.col, VILLES_DOC_PATH.id));
    if (snap.exists()) {
      const data = snap.data() as { list?: string[] };
      if (Array.isArray(data.list) && data.list.length > 0) {
        return data.list;
      }
    }
  } catch (err) {
    console.warn('loadVilles fallback to defaults:', err);
  }
  return DEFAULT_VILLES;
}

export async function saveVilles(list: string[]): Promise<void> {
  await setDoc(
    doc(db, VILLES_DOC_PATH.col, VILLES_DOC_PATH.id),
    { list, updatedAt: serverTimestamp() },
    { merge: true }
  );
}

export async function loadMemberTypes(): Promise<MemberType[]> {
  try {
    const snap = await getDoc(doc(db, MEMBER_TYPES_DOC_PATH.col, MEMBER_TYPES_DOC_PATH.id));
    if (snap.exists()) {
      const data = snap.data() as { list?: MemberType[] };
      if (Array.isArray(data.list) && data.list.length > 0) {
        return data.list.filter(
          (t) => t && typeof t.letter === 'string' && typeof t.label === 'string'
        );
      }
    }
  } catch (err) {
    console.warn('loadMemberTypes fallback to defaults:', err);
  }
  return DEFAULT_MEMBER_TYPES;
}

export async function saveMemberTypes(list: MemberType[]): Promise<void> {
  await setDoc(
    doc(db, MEMBER_TYPES_DOC_PATH.col, MEMBER_TYPES_DOC_PATH.id),
    { list, updatedAt: serverTimestamp() },
    { merge: true }
  );
}

export async function loadCommissionColors(): Promise<Record<string, string>> {
  try {
    const snap = await getDoc(
      doc(db, COMMISSION_COLORS_DOC_PATH.col, COMMISSION_COLORS_DOC_PATH.id)
    );
    if (snap.exists()) {
      const data = snap.data() as { colors?: Record<string, string> };
      if (data.colors && typeof data.colors === 'object') {
        const cleaned: Record<string, string> = {};
        for (const [town, hex] of Object.entries(data.colors)) {
          if (typeof hex === 'string' && /^#[0-9a-fA-F]{6}$/.test(hex)) {
            cleaned[town] = hex;
          }
        }
        return { ...DEFAULT_COMMISSION_COLORS, ...cleaned };
      }
    }
  } catch (err) {
    console.warn('loadCommissionColors fallback to defaults:', err);
  }
  return { ...DEFAULT_COMMISSION_COLORS };
}

export async function saveCommissionColors(colors: Record<string, string>): Promise<void> {
  const cleaned: Record<string, string> = {};
  for (const [town, hex] of Object.entries(colors)) {
    if (typeof hex === 'string' && /^#[0-9a-fA-F]{6}$/.test(hex)) cleaned[town] = hex;
  }
  await setDoc(
    doc(db, COMMISSION_COLORS_DOC_PATH.col, COMMISSION_COLORS_DOC_PATH.id),
    { colors: cleaned, updatedAt: serverTimestamp() },
    { merge: true }
  );
}

/**
 * Matricule AAJ format: AAJ + MM (birth month) + YY (birth year, 2 digits) + NN (index) + L (type letter)
 * Example: AAJ039300A → architect born March 1993, first of that month-year, letter A.
 * Index starts at "00" (single AAJ code per collision). If another member shares month+year+letter,
 * increments: "01", "02", ...
 */
export function buildMatricule(
  birthDate: string, // "YYYY-MM-DD"
  typeLetter: string,
  index: number
): string {
  if (!birthDate || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return '';
  const [year, month] = birthDate.split('-');
  const mm = month.padStart(2, '0');
  const yy = year.slice(-2);
  const nn = String(index).padStart(2, '0');
  const letter = (typeLetter || '').toUpperCase().slice(0, 1);
  return `AAJ${mm}${yy}${nn}${letter}`;
}

/**
 * Compute next available index for a given (birthDate, typeLetter) pair
 * given the existing matricules in the user collection.
 */
export function computeNextIndex(
  existingMatricules: string[],
  birthDate: string,
  typeLetter: string
): number {
  if (!birthDate || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return 0;
  const [year, month] = birthDate.split('-');
  const mm = month.padStart(2, '0');
  const yy = year.slice(-2);
  const letter = (typeLetter || '').toUpperCase().slice(0, 1);
  const prefix = `AAJ${mm}${yy}`;
  const suffix = letter;
  const usedIndices = new Set<number>();
  for (const m of existingMatricules) {
    if (!m) continue;
    if (
      m.startsWith(prefix) &&
      m.endsWith(suffix) &&
      m.length === prefix.length + 2 + suffix.length
    ) {
      const idxStr = m.slice(prefix.length, prefix.length + 2);
      const n = parseInt(idxStr, 10);
      if (!Number.isNaN(n)) usedIndices.add(n);
    }
  }
  let next = 0;
  while (usedIndices.has(next)) next++;
  return next;
}
