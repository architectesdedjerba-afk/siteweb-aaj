/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Lightweight validation (no external deps).
 */

export type ValidationErrors<T> = Partial<Record<keyof T, string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+]?[\d\s()-]{8,20}$/;

export function required(value: unknown, label = 'Ce champ'): string | null {
  if (value === null || value === undefined) return `${label} est requis.`;
  if (typeof value === 'string' && value.trim().length === 0) return `${label} est requis.`;
  return null;
}

export function email(value: string): string | null {
  if (!value) return null;
  return EMAIL_RE.test(value) ? null : "Adresse email invalide.";
}

export function phone(value: string): string | null {
  if (!value) return null;
  return PHONE_RE.test(value) ? null : 'Numéro de téléphone invalide.';
}

export function minLength(value: string, min: number, label = 'Ce champ'): string | null {
  if (!value) return null;
  return value.length >= min ? null : `${label} doit contenir au moins ${min} caractères.`;
}

export function maxLength(value: string, max: number, label = 'Ce champ'): string | null {
  if (!value) return null;
  return value.length <= max ? null : `${label} doit contenir au plus ${max} caractères.`;
}

export function first<T>(...checks: (string | null)[]): string | null {
  return checks.find((c) => c !== null) ?? null;
}

export function hasErrors<T>(errors: ValidationErrors<T>): boolean {
  return Object.values(errors).some((v) => v);
}
