/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * HTTP client for the PHP API at /api.
 * Session is carried via an httpOnly cookie set by the backend.
 */

const API_BASE = '/api';

async function http<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(init.body && !(init.body instanceof FormData)
        ? { 'Content-Type': 'application/json' }
        : {}),
      ...(init.headers || {}),
    },
    ...init,
  });

  const text = await res.text();
  let data: any = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      /* non-json */
    }
  }

  if (!res.ok) {
    const msg = data?.message || data?.error || `HTTP ${res.status}`;
    const err: any = new Error(msg);
    err.code = data?.error || `http_${res.status}`;
    err.status = res.status;
    err.response = data;
    throw err;
  }
  return data as T;
}

export const api = {
  // ---- auth ----
  login: (email: string, password: string) =>
    http<{ ok: true; user: any; role: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  logout: () => http<{ ok: true }>('/auth/logout', { method: 'POST' }),
  me: () => http<{ user: any | null; role: any | null }>('/auth/me'),
  resetRequest: (email: string) =>
    http<{ ok: true }>('/auth/password-reset/request', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),
  resetVerify: (oobCode: string) =>
    http<{ ok: true; email: string }>('/auth/password-reset/verify', {
      method: 'POST',
      body: JSON.stringify({ oobCode }),
    }),
  resetConfirm: (oobCode: string, password: string) =>
    http<{ ok: true }>('/auth/password-reset/confirm', {
      method: 'POST',
      body: JSON.stringify({ oobCode, password }),
    }),
  createAccount: (payload: {
    email: string;
    password: string;
    displayName?: string;
    firstName?: string;
    lastName?: string;
    role?: string;
    status?: string;
    category?: string;
    licenseNumber?: string;
    mobile?: string;
    address?: string;
    cotisations?: Record<string, any>;
  }) =>
    http<{ ok: true; user: any }>('/auth/accounts', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // ---- collections ----
  list: (
    name: string,
    params?: { orderBy?: string; where?: Array<[string, string, string | number]> }
  ) => {
    const qs = new URLSearchParams();
    if (params?.orderBy) qs.set('orderBy', params.orderBy);
    if (params?.where) {
      for (const [c, op, v] of params.where) qs.append('where', `${c}:${op}:${v}`);
    }
    const s = qs.toString();
    return http<{ items: any[] }>(`/collections/${encodeURIComponent(name)}${s ? `?${s}` : ''}`);
  },
  get: (name: string, id: string) =>
    http<{ item: any }>(`/collections/${encodeURIComponent(name)}/${encodeURIComponent(id)}`),
  create: (name: string, payload: Record<string, any>) =>
    http<{ item: any }>(`/collections/${encodeURIComponent(name)}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  update: (name: string, id: string, patch: Record<string, any>) =>
    http<{ item: any }>(`/collections/${encodeURIComponent(name)}/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(patch),
    }),
  remove: (name: string, id: string) =>
    http<{ ok: true }>(`/collections/${encodeURIComponent(name)}/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  // ---- files ----
  uploadFile: async (file: File, folder: string, access?: 'public' | 'members' | 'private') => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('folder', folder);
    if (access) fd.append('access', access);
    return http<{
      ok: true;
      id: string;
      url: string;
      path: string;
      name: string;
      size: number;
      type: string;
    }>('/files', { method: 'POST', body: fd });
  },
  deleteFile: (id: string) =>
    http<{ ok: true }>(`/files/${encodeURIComponent(id)}`, { method: 'DELETE' }),
};
