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
  }) =>
    http<{ ok: true; user: any; emailSent: boolean; tempPassword?: string }>('/auth/accounts', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  changePassword: (newPassword: string, currentPassword?: string) =>
    http<{ ok: true; user: any }>('/auth/password', {
      method: 'POST',
      body: JSON.stringify({ password: newPassword, currentPassword }),
    }),
  testMail: (to?: string) =>
    http<{
      ok: boolean;
      to: string;
      tcpOk: boolean | null;
      elapsedMs: number;
      smtp: {
        host: string;
        port: number;
        encryption: string;
        from_email: string;
        from_name: string;
        has_password: boolean;
      };
      log: string[];
    }>('/auth/test-mail', {
      method: 'POST',
      body: JSON.stringify({ to }),
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

  // ---- UNESCO ----
  unesco: {
    geojson: () =>
      http<{
        type: 'FeatureCollection';
        features: Array<{
          type: 'Feature';
          properties: Record<string, any>;
          geometry: { type: string; coordinates: any };
        }>;
        bbox: [number, number, number, number] | null;
        sources: Array<{
          id: string;
          title: string;
          description: string | null;
          featureCount: number;
          sortOrder: number;
          bbox: [number, number, number, number] | null;
        }>;
      }>('/unesco/geojson'),

    listKmzSources: () => http<{ items: UnescoKmzSource[] }>('/unesco/kmz-sources'),
    uploadKmz: async (file: File, title?: string, description?: string) => {
      const fd = new FormData();
      fd.append('file', file);
      if (title) fd.append('title', title);
      if (description) fd.append('description', description);
      return http<{ item: UnescoKmzSource }>('/unesco/kmz-sources', { method: 'POST', body: fd });
    },
    updateKmzSource: (
      id: string,
      patch: Partial<Pick<UnescoKmzSource, 'title' | 'description' | 'isActive' | 'sortOrder'>>
    ) =>
      http<{ item: UnescoKmzSource }>(`/unesco/kmz-sources/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify(patch),
      }),
    deleteKmzSource: (id: string) =>
      http<{ ok: true }>(`/unesco/kmz-sources/${encodeURIComponent(id)}`, { method: 'DELETE' }),

    listZones: () => http<{ items: UnescoZone[] }>('/unesco/zones'),
    updateZone: (id: string, patch: Partial<UnescoZone>) =>
      http<{ item: UnescoZone }>(`/unesco/zones/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify(patch),
      }),

    listDocuments: () => http<{ items: UnescoDocument[] }>('/unesco/documents'),
    createDocument: (payload: Partial<UnescoDocument>) =>
      http<{ item: UnescoDocument }>('/unesco/documents', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    updateDocument: (id: string, patch: Partial<UnescoDocument>) =>
      http<{ item: UnescoDocument }>(`/unesco/documents/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify(patch),
      }),
    deleteDocument: (id: string) =>
      http<{ ok: true }>(`/unesco/documents/${encodeURIComponent(id)}`, { method: 'DELETE' }),

    listPermits: (params?: { scope?: 'mine' | 'all'; status?: string }) => {
      const qs = new URLSearchParams();
      if (params?.scope) qs.set('scope', params.scope);
      if (params?.status) qs.set('status', params.status);
      const s = qs.toString();
      return http<{ items: UnescoPermit[] }>(`/unesco/permits${s ? `?${s}` : ''}`);
    },
    getPermit: (id: string) =>
      http<{ item: UnescoPermit }>(`/unesco/permits/${encodeURIComponent(id)}`),
    createPermit: (payload: Partial<UnescoPermit>) =>
      http<{ item: UnescoPermit }>('/unesco/permits', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    updatePermit: (id: string, patch: Partial<UnescoPermit>) =>
      http<{ item: UnescoPermit }>(`/unesco/permits/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify(patch),
      }),
    deletePermit: (id: string) =>
      http<{ ok: true }>(`/unesco/permits/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    submitPermit: (id: string) =>
      http<{ item: UnescoPermit }>(`/unesco/permits/${encodeURIComponent(id)}/submit`, {
        method: 'POST',
      }),
    addPermitEvent: (
      id: string,
      payload: { toStatus?: string | null; message?: string; isInternal?: boolean }
    ) =>
      http<{ item: UnescoPermit }>(`/unesco/permits/${encodeURIComponent(id)}/events`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    attachPermitFile: (id: string, payload: { fileId: string; title?: string; kind?: string }) =>
      http<{ item: UnescoPermit }>(`/unesco/permits/${encodeURIComponent(id)}/files`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    detachPermitFile: (id: string, permitFileId: string) =>
      http<{ item: UnescoPermit }>(
        `/unesco/permits/${encodeURIComponent(id)}/files/${encodeURIComponent(permitFileId)}`,
        { method: 'DELETE' }
      ),

    statusCounts: () =>
      http<{ counts: Record<string, number>; pendingReview: number }>('/unesco/status-counts'),
  },

  // ---- notifications ----
  notifications: {
    schema: () =>
      http<{
        events: Array<{
          id: string;
          label: string;
          kind: 'single' | 'dual';
          vars: Array<{ key: string; desc: string }>;
          defaults: NotificationEventConfigOnWire;
        }>;
        currentSettings: { events: Record<string, NotificationEventConfigOnWire> };
      }>('/notifications/schema'),
    test: (event: string, field: 'applicant' | 'admin' | 'single', to: string) =>
      http<{ ok: boolean }>('/notifications/test', {
        method: 'POST',
        body: JSON.stringify({ event, field, to }),
      }),
  },
};

/**
 * Wire-format event config — see `src/lib/notifications.ts` for the richer
 * domain type. Kept structurally identical here to avoid a circular import.
 */
interface NotificationEventConfigOnWire {
  enabled: boolean;
  extraRecipients: string[];
  subject?: string;
  html?: string;
  applicantSubject?: string;
  applicantHtml?: string;
  adminSubject?: string;
  adminHtml?: string;
}

// ---- UNESCO types ----
export interface UnescoGeoJsonSource {
  id: string;
  title: string;
  description: string | null;
  featureCount: number;
  sortOrder: number;
  bbox: [number, number, number, number] | null;
}

export interface UnescoKmzSource {
  id: string;
  title: string;
  description: string | null;
  kmzFileId: string | null;
  geojsonPath: string | null;
  bbox: [number, number, number, number] | null;
  featureCount: number;
  isActive: boolean;
  sortOrder: number;
  createdBy: string | null;
  createdAt: string | null;
}

export interface UnescoZone {
  id: string;
  kmzSourceId: string;
  featureKey: string;
  name: string;
  zoneType: string;
  color: string;
  regulationShort: string | null;
  regulationDocId: string | null;
  externalUrl: string | null;
  bbox: [number, number, number, number] | null;
  sortOrder: number;
  isVisible: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface UnescoDocument {
  id: string;
  title: string;
  description: string | null;
  category: string;
  fileId: string | null;
  downloadUrl: string | null;
  externalUrl: string | null;
  year: string | null;
  language: string | null;
  sortOrder: number;
  isVisible: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

export type UnescoPermitStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'info_requested'
  | 'decision_pending'
  | 'approved'
  | 'rejected'
  | 'withdrawn';

export interface UnescoPermitEvent {
  id: string;
  permitId: string;
  authorUid: string | null;
  authorName: string;
  kind: string;
  fromStatus: string | null;
  toStatus: string | null;
  message: string | null;
  isInternal: boolean;
  createdAt: string | null;
}

export interface UnescoPermitFile {
  id: string;
  permitId: string;
  fileId: string;
  downloadUrl: string;
  kind: string;
  title: string | null;
  originalName: string | null;
  sizeBytes: number | null;
  mimeType: string | null;
  uploadedBy: string | null;
  createdAt: string | null;
}

export interface UnescoApplicantSummary {
  uid: string;
  email: string | null;
  displayName: string;
  firstName: string | null;
  lastName: string | null;
  mobile: string | null;
}

export interface UnescoPermit {
  id: string;
  applicantUid: string;
  applicant: UnescoApplicantSummary | null;
  projectRef: string | null;
  title: string;
  description: string | null;
  address: string | null;
  city: string | null;
  parcelNumber: string | null;
  latitude: number | null;
  longitude: number | null;
  autoZoneId: string | null;
  autoZone: UnescoZone | null;
  finalZoneId: string | null;
  finalZone: UnescoZone | null;
  projectType: string | null;
  surfaceSqm: number | null;
  floorsCount: number | null;
  status: UnescoPermitStatus;
  submittedAt: string | null;
  decisionAt: string | null;
  decisionNote: string | null;
  reviewerUid: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  events: UnescoPermitEvent[];
  files: UnescoPermitFile[];
}
