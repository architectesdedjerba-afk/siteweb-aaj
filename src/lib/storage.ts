/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Firebase Storage helpers — prepared for migration from Base64 to proper storage.
 * To activate:
 *   1. npm i firebase (already installed)
 *   2. Enable Storage in Firebase Console
 *   3. Add storage rules (see storage.rules)
 *   4. Replace fileBase64 fields with url fields in Firestore documents
 */

import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { initializeApp, getApps, getApp } from 'firebase/app';
import firebaseConfig from '../../firebase-applet-config.json';

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const storage = getStorage(app);

export interface UploadResult {
  url: string;
  path: string;
}

/**
 * Upload a File to Firebase Storage under the given folder.
 * Returns the download URL and storage path (to delete later).
 */
export async function uploadFile(file: File, folder: string, userId?: string): Promise<UploadResult> {
  if (!file) throw new Error('Aucun fichier fourni.');
  if (file.size > 10 * 1024 * 1024) throw new Error('Fichier trop volumineux (max 10 Mo).');

  const sanitized = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
  const timestamp = Date.now();
  const userSegment = userId ? `${userId}/` : '';
  const path = `${folder}/${userSegment}${timestamp}_${sanitized}`;

  const storageRef = ref(storage, path);
  const snapshot = await uploadBytes(storageRef, file, {
    contentType: file.type,
  });
  const url = await getDownloadURL(snapshot.ref);
  return { url, path };
}

export async function deleteFile(path: string): Promise<void> {
  if (!path) return;
  try {
    await deleteObject(ref(storage, path));
  } catch (err) {
    console.warn(`Failed to delete ${path}:`, err);
  }
}

/** Legacy helper — keep for compatibility with existing Base64 fields. */
export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
};
