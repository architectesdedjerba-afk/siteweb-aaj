/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * File upload helpers — delegates to the PHP /api/files endpoint.
 * Files are streamed to disk on the server; the frontend receives a
 * stable public download URL via /api/files/{id}.
 */

import { api } from './api';

export interface UploadResult {
  url: string;
  path: string;
}

export async function uploadFile(
  file: File,
  folder: string,
  _userId?: string
): Promise<UploadResult> {
  if (!file) throw new Error('Aucun fichier fourni.');
  if (file.size > 10 * 1024 * 1024) throw new Error('Fichier trop volumineux (max 10 Mo).');
  const res = await api.uploadFile(file, folder);
  return { url: res.url, path: res.id };
}

export async function deleteFile(pathOrId: string): Promise<void> {
  if (!pathOrId) return;
  try {
    // `path` returned by uploadFile() is the file id.
    await api.deleteFile(pathOrId);
  } catch (err) {
    console.warn(`Failed to delete ${pathOrId}:`, err);
  }
}

/** Legacy helper — kept so any lingering base64 flows still compile. */
export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
};
