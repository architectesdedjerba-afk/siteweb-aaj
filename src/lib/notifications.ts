/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Notification settings — types + helpers for the admin editor.
 *
 * Server source of truth: `api/lib/notifications.php`. The same shape is
 * exposed by `GET /api/notifications/schema` and persisted through the
 * standard `config/notifications` collection document.
 *
 * Naming on the wire matches the PHP keys 1:1 (camelCase) so the JSON
 * round-trips cleanly without a transformer.
 */

import { api } from './api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Single-template events have `subject` + `html`. Dual-template events
 * (applicant + admin) have `applicantSubject` / `applicantHtml` and
 * `adminSubject` / `adminHtml`. The TS shape is permissive (all optional)
 * to cover both.
 */
export interface NotificationEventConfig {
  enabled: boolean;
  extraRecipients: string[];
  subject?: string;
  html?: string;
  applicantSubject?: string;
  applicantHtml?: string;
  adminSubject?: string;
  adminHtml?: string;
}

export interface NotificationEventSchema {
  id: string;
  label: string;
  kind: 'single' | 'dual';
  vars: Array<{ key: string; desc: string }>;
  defaults: NotificationEventConfig;
}

export interface NotificationSettings {
  events: Record<string, NotificationEventConfig>;
}

// ---------------------------------------------------------------------------
// I/O helpers — wrap the existing collection endpoint so callers don't have
// to remember the magic id.
// ---------------------------------------------------------------------------

const CONFIG_DOC_ID = 'notifications';

export async function loadNotificationSettings(
  schemaDefaults: Record<string, NotificationEventConfig>
): Promise<NotificationSettings> {
  try {
    const res = await api.get('config', CONFIG_DOC_ID);
    const item = res.item as Partial<NotificationSettings> & { events?: any };
    const events: Record<string, NotificationEventConfig> = {};
    for (const [eventId, defaults] of Object.entries(schemaDefaults)) {
      const stored = (item?.events && item.events[eventId]) || {};
      events[eventId] = mergeConfig(defaults, stored);
    }
    return { events };
  } catch (err: any) {
    // 404 means the doc has never been written — fall back to defaults.
    if (err?.status === 404) {
      const events: Record<string, NotificationEventConfig> = {};
      for (const [eventId, defaults] of Object.entries(schemaDefaults)) {
        events[eventId] = { ...defaults, extraRecipients: [...defaults.extraRecipients] };
      }
      return { events };
    }
    throw err;
  }
}

export async function saveNotificationSettings(
  settings: NotificationSettings
): Promise<NotificationSettings> {
  // Try update first; if the doc doesn't exist yet, create it.
  try {
    const res = await api.update('config', CONFIG_DOC_ID, settings);
    return (res.item as NotificationSettings) ?? settings;
  } catch (err: any) {
    if (err?.status === 404) {
      const res = await api.create('config', { id: CONFIG_DOC_ID, ...settings });
      return (res.item as NotificationSettings) ?? settings;
    }
    throw err;
  }
}

function mergeConfig(
  defaults: NotificationEventConfig,
  stored: Partial<NotificationEventConfig>
): NotificationEventConfig {
  const merged: NotificationEventConfig = {
    ...defaults,
    extraRecipients: [...defaults.extraRecipients],
  };
  if (typeof stored.enabled === 'boolean') merged.enabled = stored.enabled;
  if (Array.isArray(stored.extraRecipients)) {
    merged.extraRecipients = stored.extraRecipients.filter(
      (s): s is string => typeof s === 'string' && s.trim() !== ''
    );
  }
  for (const key of [
    'subject',
    'html',
    'applicantSubject',
    'applicantHtml',
    'adminSubject',
    'adminHtml',
  ] as const) {
    if (typeof stored[key] === 'string' && stored[key]!.trim() !== '') {
      merged[key] = stored[key];
    }
  }
  return merged;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function isValidEmail(s: string): boolean {
  return EMAIL_RE.test(s.trim());
}
