/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Compatibility shim — preserves the Firebase-shaped public surface used
 * throughout the codebase while routing every call to the PHP API under
 * /api. See src/lib/api.ts for the underlying HTTP client.
 *
 * This module is deliberately named `firebase.ts` so pages can keep the
 * import paths they already had; Firebase itself is no longer a runtime
 * dependency.
 */

import { api } from './api';

// ----------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------

export type User = {
  uid: string;
  email: string | null;
  displayName: string | null;
  mustReset?: boolean;
  emailVerified?: boolean;
  isAnonymous?: boolean;
  providerData?: Array<{
    providerId: string;
    displayName: string | null;
    email: string | null;
    photoURL: string | null;
  }>;
};

export interface Timestamp {
  seconds: number;
  nanoseconds: number;
  toDate(): Date;
  toMillis(): number;
}

function isoToTimestamp(iso: string): Timestamp {
  const d = new Date(iso);
  const ms = d.getTime();
  return {
    seconds: Math.floor(ms / 1000),
    nanoseconds: (ms % 1000) * 1_000_000,
    toDate: () => new Date(ms),
    toMillis: () => ms,
  };
}

// ----------------------------------------------------------------------
// Auth "object"
// ----------------------------------------------------------------------

type AuthListener = (user: User | null) => void;

class AuthState {
  currentUser: User | null = null;
  private listeners = new Set<AuthListener>();
  private initPromise: Promise<void> | null = null;

  init(): Promise<void> {
    if (this.initPromise) return this.initPromise;
    this.initPromise = api.me().then(
      (res) => {
        this.currentUser = res.user ? toUser(res.user) : null;
        this.emit();
      },
      () => {
        this.currentUser = null;
        this.emit();
      }
    );
    return this.initPromise;
  }

  setUser(profile: any | null) {
    this.currentUser = profile ? toUser(profile) : null;
    this.emit();
  }

  subscribe(cb: AuthListener): () => void {
    this.listeners.add(cb);
    // Emit initial value only after /auth/me has resolved — avoids a
    // "flash of logged-out UI" on first paint.
    this.init().then(() => cb(this.currentUser));
    return () => this.listeners.delete(cb);
  }

  private emit() {
    for (const l of this.listeners) l(this.currentUser);
  }
}

export const auth = new AuthState();

// Kick off the initial /auth/me as soon as this module is loaded.
auth.init();

function toUser(profile: any): User {
  const composed = [profile?.firstName, profile?.lastName].filter(Boolean).join(' ');
  return {
    uid: profile.uid,
    email: profile.email ?? null,
    displayName: profile.displayName || composed || null,
    mustReset: Boolean(profile.mustReset),
    emailVerified: true,
    isAnonymous: false,
    providerData: [],
  };
}

// ----------------------------------------------------------------------
// Auth functions (Firebase-shaped signatures)
// ----------------------------------------------------------------------

export async function signInWithEmailAndPassword(
  _auth: AuthState,
  email: string,
  password: string
): Promise<{ user: User }> {
  const res = await api.login(email, password);
  auth.setUser(res.user);
  return { user: toUser(res.user) };
}

export async function signOut(_auth: AuthState): Promise<void> {
  try {
    await api.logout();
  } catch {
    /* ignore */
  }
  auth.setUser(null);
}

export async function sendPasswordResetEmail(
  _auth: AuthState,
  email: string,
  _actionCodeSettings?: any
): Promise<void> {
  await api.resetRequest(email);
}

export async function verifyPasswordResetCode(_auth: AuthState, oobCode: string): Promise<string> {
  const res = await api.resetVerify(oobCode);
  return res.email;
}

export async function confirmPasswordReset(
  _auth: AuthState,
  oobCode: string,
  password: string
): Promise<void> {
  await api.resetConfirm(oobCode, password);
}

/**
 * In Firestore land this creates an auth user. In our world, only
 * administrators with `accounts.create` can do this via /auth/accounts,
 * which does NOT log the new user in. The backend always generates the
 * password itself and emails it to the new user, so the `password` arg
 * below is ignored — kept for call-site compatibility.
 */
export async function createUserWithEmailAndPassword(
  _auth: AuthState,
  email: string,
  _password: string
): Promise<{ user: User }> {
  const res = await api.createAccount({ email });
  return { user: toUser(res.user) };
}

/**
 * Change the current user's password. When the account is flagged
 * `must_reset` (admin-issued temp password), `currentPassword` can be
 * omitted — the backend waives the check because the user already proved
 * they knew the temp password to reach this point.
 */
export async function changePassword(newPassword: string, currentPassword?: string): Promise<User> {
  const res = await api.changePassword(newPassword, currentPassword);
  auth.setUser(res.user);
  return toUser(res.user);
}

/**
 * Admin path: create a new member account. The backend generates a temp
 * password, emails it to the new user, and flags `must_reset = 1` so the
 * user is forced to choose a new password on first login.
 *
 * Returns `{ user, emailSent }` — `emailSent` is false when the SMTP call
 * fails so the caller can surface a fallback message.
 */
export async function adminCreateAccount(payload: {
  email: string;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  role?: string;
  status?: string;
  category?: string;
  memberType?: string;
  memberTypeLetter?: string;
  birthDate?: string;
  licenseNumber?: string;
  mobile?: string;
  address?: string;
  cotisations?: Record<string, any>;
}): Promise<{ user: User; emailSent: boolean; tempPassword?: string }> {
  const res = await api.createAccount(payload);
  return {
    user: toUser(res.user),
    emailSent: res.emailSent,
    tempPassword: (res as any).tempPassword,
  };
}

export function onAuthStateChanged(_auth: AuthState, cb: AuthListener): () => void {
  return auth.subscribe(cb);
}

export function getAuth(_app?: unknown): AuthState {
  return auth;
}

// initializeApp / deleteApp are no-ops — kept only so MemberSpace's legacy
// "secondary app" pattern compiles. In the new backend, /auth/accounts
// creates a user without affecting the current session.
export function initializeApp(_config: unknown, _name?: string): { name: string } {
  return { name: _name ?? '[DEFAULT]' };
}
export function deleteApp(_app: unknown): Promise<void> {
  return Promise.resolve();
}

// ----------------------------------------------------------------------
// Firestore-shaped types
// ----------------------------------------------------------------------

export interface CollectionRef {
  __kind: 'collection';
  path: string;
}
export interface DocRef {
  __kind: 'doc';
  path: string;
  id: string;
}
export interface QueryConstraint {
  kind: 'orderBy' | 'where';
  field: string;
  op?: string;
  value?: unknown;
  direction?: 'asc' | 'desc';
}
export interface Query {
  __kind: 'query';
  path: string;
  constraints: QueryConstraint[];
}
export interface DocSnapshot<T = any> {
  id: string;
  exists: () => boolean;
  data: () => T;
  get: (key: string) => unknown;
}
export interface QuerySnapshot<T = any> {
  docs: DocSnapshot<T>[];
  size: number;
  empty: boolean;
}

// `db` is an opaque handle, only used as the first arg so call sites compile.
export const db = Object.freeze({ __kind: 'db' as const });

export function collection(_db: unknown, path: string): CollectionRef {
  return { __kind: 'collection', path };
}

export function doc(_db: unknown, path: string, id?: string): DocRef {
  if (id !== undefined) return { __kind: 'doc', path, id };
  // collection-relative random id (auto-generated by the server on addDoc;
  // returning a placeholder here is enough for setDoc flows that pass an
  // explicit id).
  return { __kind: 'doc', path, id: '' };
}

export function query(ref: CollectionRef | Query, ...constraints: QueryConstraint[]): Query {
  const path = 'path' in ref ? ref.path : '';
  const prev = 'constraints' in ref ? ref.constraints : [];
  return { __kind: 'query', path, constraints: [...prev, ...constraints] };
}

export function where(field: string, op: string, value: unknown): QueryConstraint {
  return { kind: 'where', field, op, value };
}

export function orderBy(field: string, direction: 'asc' | 'desc' = 'asc'): QueryConstraint {
  return { kind: 'orderBy', field, direction };
}

// ----------------------------------------------------------------------
// serverTimestamp sentinel
// ----------------------------------------------------------------------

const SERVER_TIMESTAMP = Symbol.for('aaj.serverTimestamp');
export function serverTimestamp(): typeof SERVER_TIMESTAMP {
  return SERVER_TIMESTAMP as any;
}

function stripSentinels<T extends Record<string, unknown>>(data: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v === SERVER_TIMESTAMP) continue; // server sets created_at itself
    out[k] = v;
  }
  return out;
}

// ----------------------------------------------------------------------
// DB helpers to map collection path → our API collection name
// ----------------------------------------------------------------------

function collectionFromPath(path: string): { name: string; id?: string } {
  const parts = path.split('/').filter(Boolean);
  if (parts.length === 1) return { name: parts[0] };
  if (parts.length === 2) return { name: parts[0], id: parts[1] };
  throw new Error(`Unsupported path: ${path}`);
}

function makeSnapshot(collectionName: string, item: any | null, docId: string): DocSnapshot {
  return {
    id: item?.id ?? docId,
    exists: () => !!item,
    data: () => {
      if (!item) return undefined as any;
      // Convert ISO date fields to Timestamp-like objects where the field
      // name ends in "At" (createdAt, paidAt, etc.) — matches original code.
      const out: Record<string, any> = {};
      for (const [k, v] of Object.entries(item)) {
        if (k === 'id') continue;
        if (typeof v === 'string' && /At$/.test(k) && /\d{4}-\d{2}-\d{2}T/.test(v)) {
          out[k] = isoToTimestamp(v);
        } else if (v && typeof v === 'object' && 'paidAt' in (v as any)) {
          out[k] = v;
        } else {
          out[k] = v;
        }
      }
      return out;
    },
    get: (key: string) => (item ? (item as any)[key] : undefined),
  };
}

export async function getDoc<T = any>(ref: DocRef): Promise<DocSnapshot<T>> {
  const collectionName = ref.path.split('/').filter(Boolean)[0];
  try {
    const res = await api.get(collectionName, ref.id);
    return makeSnapshot(collectionName, res.item, ref.id);
  } catch (e: any) {
    if (e?.status === 404) return makeSnapshot(collectionName, null, ref.id);
    throw e;
  }
}

export async function addDoc(ref: CollectionRef, data: Record<string, unknown>): Promise<DocRef> {
  const payload = stripSentinels(data);
  const res = await api.create(ref.path, payload);
  return { __kind: 'doc', path: ref.path, id: res.item.id };
}

export async function setDoc(
  ref: DocRef,
  data: Record<string, unknown>,
  _options?: { merge?: boolean }
): Promise<void> {
  const payload = stripSentinels(data);
  const { path, id } = ref;
  // Upsert semantics: try update first, fall back to create on 404.
  // This matches both setDoc({merge:true}) and covers setDoc-replace use
  // cases in this codebase (e.g. users/{uid} where /auth/accounts has
  // already created the row).
  try {
    await api.update(path, id, payload);
    return;
  } catch (e: any) {
    if (e?.status !== 404) throw e;
  }
  payload.id = id;
  if (path === 'users') (payload as any).uid = id;
  await api.create(path, payload);
}

export async function updateDoc(ref: DocRef, data: Record<string, unknown>): Promise<void> {
  const payload = stripSentinels(data);
  await api.update(ref.path, ref.id, payload);
}

export async function deleteDoc(ref: DocRef): Promise<void> {
  await api.remove(ref.path, ref.id);
}

// ----------------------------------------------------------------------
// onSnapshot — polling-based real-time replacement
// ----------------------------------------------------------------------

const DEFAULT_POLL_MS = 8000;

type ErrorCallback = (err: Error) => void;

/* eslint-disable no-redeclare */
export function onSnapshot(
  ref: DocRef,
  onNext: (snap: DocSnapshot) => void,
  onError?: ErrorCallback
): () => void;
export function onSnapshot(
  ref: CollectionRef | Query,
  onNext: (snap: QuerySnapshot) => void,
  onError?: ErrorCallback
): () => void;
export function onSnapshot(
  refOrQuery: CollectionRef | Query | DocRef,
  onNext: (snap: any) => void,
  onError?: ErrorCallback
): () => void {
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const tick = async () => {
    if (cancelled) return;
    try {
      if ('__kind' in refOrQuery && refOrQuery.__kind === 'doc') {
        const snap = await getDoc(refOrQuery);
        onNext(snap);
      } else {
        const { path, constraints } = normaliseQuery(refOrQuery);
        const orderConstraint = constraints.find((c) => c.kind === 'orderBy');
        const whereConstraints = constraints.filter((c) => c.kind === 'where');
        const params: Parameters<typeof api.list>[1] = {};
        if (orderConstraint) {
          const col = toSnakeCase(orderConstraint.field);
          params.orderBy = `${col}:${orderConstraint.direction ?? 'asc'}`;
        }
        if (whereConstraints.length) {
          params.where = whereConstraints.map((c) => [
            toSnakeCase(c.field),
            translateOp(c.op as string),
            String(c.value ?? ''),
          ]);
        }
        const res = await api.list(path, params);
        const docs = res.items.map((item: any) => makeSnapshot(path, item, item.id));
        onNext({ docs, size: docs.length, empty: docs.length === 0 } as QuerySnapshot);
      }
    } catch (err: any) {
      if (onError) onError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      if (!cancelled) timer = setTimeout(tick, DEFAULT_POLL_MS);
    }
  };
  tick();

  return () => {
    cancelled = true;
    if (timer) clearTimeout(timer);
  };
}
/* eslint-enable no-redeclare */

function normaliseQuery(ref: CollectionRef | Query): {
  path: string;
  constraints: QueryConstraint[];
} {
  if ('constraints' in ref) return { path: ref.path, constraints: ref.constraints };
  return { path: ref.path, constraints: [] };
}

// Map Firestore comparison operators to the SQL operators accepted by
// the PHP API's collection router.
function translateOp(op: string | undefined): string {
  switch (op) {
    case '==':
      return '=';
    case '!=':
      return '!=';
    case '<':
      return '<';
    case '<=':
      return '<=';
    case '>':
      return '>';
    case '>=':
      return '>=';
    default:
      return '=';
  }
}

// Firestore uses camelCase but our API expects snake_case for column names.
// The small set of fields we sort/filter on are mapped here.
function toSnakeCase(field: string): string {
  const map: Record<string, string> = {
    createdAt: 'created_at',
    displayName: 'display_name',
    userId: 'user_id',
    uid: 'uid',
    name: 'name',
    date: 'date',
  };
  return map[field] ?? field.replace(/([A-Z])/g, '_$1').toLowerCase();
}

// ----------------------------------------------------------------------
// getDocFromServer (connectivity test) — stays a safe no-op/ping
// ----------------------------------------------------------------------

export async function getDocFromServer(_ref: DocRef): Promise<DocSnapshot> {
  const res = await fetch('/api/health', { credentials: 'include' });
  if (!res.ok) throw new Error('the client is offline');
  return makeSnapshot('_health', null, '_');
}
