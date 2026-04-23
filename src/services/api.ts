/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Service layer — API client.
 *
 * Purpose:
 *   Abstract the backend from UI components. Components should NOT import
 *   `firebase/*` directly anymore — they call `api.*` instead.
 *
 * Backend selection:
 *   - If `VITE_API_BASE_URL` is set → POST to cPanel-hosted endpoints (JSON).
 *   - Otherwise → fall back to Firestore (legacy behavior, safe during migration).
 *
 *   Set the env var in `.env.local` or in the CI build step once the cPanel
 *   API is live. No UI code changes needed to switch backends.
 *
 * Expected cPanel API contract (public forms — unauthenticated POST):
 *
 *   POST {VITE_API_BASE_URL}/membership-applications
 *   POST {VITE_API_BASE_URL}/event-registrations
 *   POST {VITE_API_BASE_URL}/partner-applications
 *
 *   Headers: Content-Type: application/json
 *   Body:    the payload objects defined below (Membership/Event/Partner)
 *   Success: HTTP 2xx (body ignored)
 *   Failure: HTTP 4xx/5xx (thrown as Error)
 *
 *   The server is responsible for:
 *     - Validating input server-side (never trust the client).
 *     - Stamping the created-at timestamp.
 *     - Sending notification emails to the bureau exécutif if needed.
 *     - Storing data in the cPanel MySQL database.
 */

import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { MemberCategory } from '../types';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

/**
 * Base URL of the cPanel-hosted API (no trailing slash).
 * Example: `https://aaj-web.com/api`
 *
 * When empty/undefined, the service falls back to Firestore so the app keeps
 * working during the migration window.
 */
const API_BASE_URL: string = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/+$/, '');

const isCpanelBackend = (): boolean => API_BASE_URL.length > 0;

// ---------------------------------------------------------------------------
// Payload types — single source of truth, used by both backends
// ---------------------------------------------------------------------------

export interface MembershipApplicationPayload {
  fullName: string;
  phone: string;
  email: string;
  category: MemberCategory;
  matricule: string;
  city: string;
  cvFileName: string;
}

export interface EventRegistrationPayload {
  fullName: string;
  email: string;
  eventTitle: string;
  message: string;
}

export interface PartnerApplicationPayload {
  contactName: string;
  email: string;
  phone: string;
  companyName: string;
  activity: string;
  sponsorshipType: 'platine' | 'or' | 'argent' | 'autre';
  message: string;
}

// ---------------------------------------------------------------------------
// HTTP helper
// ---------------------------------------------------------------------------

async function postJson(path: string, body: unknown): Promise<void> {
  const url = `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
    credentials: 'omit',
  });
  if (!res.ok) {
    let detail = '';
    try {
      detail = await res.text();
    } catch {
      // ignore
    }
    throw new Error(
      `API ${res.status} ${res.statusText}${detail ? ` — ${detail.slice(0, 200)}` : ''}`
    );
  }
}

// ---------------------------------------------------------------------------
// Public API — submissions
// ---------------------------------------------------------------------------

export const api = {
  submitMembershipApplication: async (payload: MembershipApplicationPayload): Promise<void> => {
    if (isCpanelBackend()) {
      await postJson('/membership-applications', payload);
      return;
    }
    await addDoc(collection(db, 'membership_applications'), {
      ...payload,
      status: 'pending',
      createdAt: serverTimestamp(),
    });
  },

  submitEventRegistration: async (payload: EventRegistrationPayload): Promise<void> => {
    if (isCpanelBackend()) {
      await postJson('/event-registrations', payload);
      return;
    }
    await addDoc(collection(db, 'event_registrations'), {
      ...payload,
      createdAt: serverTimestamp(),
    });
  },

  submitPartnerApplication: async (payload: PartnerApplicationPayload): Promise<void> => {
    if (isCpanelBackend()) {
      await postJson('/partner-applications', payload);
      return;
    }
    await addDoc(collection(db, 'partner_applications'), {
      ...payload,
      status: 'pending',
      createdAt: serverTimestamp(),
    });
  },
};
