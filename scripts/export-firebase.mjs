/**
 * Export Firestore + Firebase Auth → JSON bundle for migration.
 *
 * Usage:
 *   ADMIN_EMAIL=... ADMIN_PASSWORD=... node scripts/export-firebase.mjs > export.json
 *
 * Requires:
 *   - serviceAccount.json at the project root (Firebase → Project Settings
 *     → Service Accounts → Generate new private key)
 *   - firebase-applet-config.json (present in repo — used to read database ID)
 *
 * The output JSON is consumed by scripts/import-to-cpanel.mjs which pushes
 * the data into MySQL through the PHP API.
 */

import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const appConfig = JSON.parse(readFileSync(resolve('firebase-applet-config.json'), 'utf8'));
const saPath = resolve('serviceAccount.json');
if (!existsSync(saPath)) {
  console.error('❌ serviceAccount.json manquant à la racine du projet.');
  process.exit(1);
}
const serviceAccount = JSON.parse(readFileSync(saPath, 'utf8'));

initializeApp({ credential: cert(serviceAccount) });
const auth = getAuth();
const db = getFirestore(appConfig.firestoreDatabaseId);

const COLLECTIONS = [
  'users', 'roles',
  'news', 'partners', 'commission_pvs', 'contact_messages',
  'documents', 'profile_updates',
  'event_registrations', 'membership_applications', 'partner_applications',
];

function tsToIso(v) {
  if (!v) return null;
  if (typeof v === 'string') return v;
  if (typeof v._seconds === 'number') return new Date(v._seconds * 1000).toISOString();
  if (typeof v.seconds === 'number') return new Date(v.seconds * 1000).toISOString();
  if (v.toDate) return v.toDate().toISOString();
  return null;
}

function normaliseDoc(obj) {
  if (obj == null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(normaliseDoc);
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v && typeof v === 'object' && (v._seconds !== undefined || v.seconds !== undefined)) {
      out[k] = tsToIso(v);
    } else if (v && typeof v === 'object') {
      out[k] = normaliseDoc(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

async function exportCollections() {
  const dump = {};
  for (const name of COLLECTIONS) {
    process.stderr.write(`· ${name} ... `);
    const snap = await db.collection(name).get();
    dump[name] = snap.docs.map((d) => ({ id: d.id, ...normaliseDoc(d.data()) }));
    process.stderr.write(`${dump[name].length} docs\n`);
  }
  return dump;
}

async function exportAuthUsers() {
  const out = [];
  let token;
  do {
    const page = await auth.listUsers(1000, token);
    for (const u of page.users) {
      out.push({
        uid: u.uid,
        email: u.email,
        displayName: u.displayName || '',
        disabled: u.disabled,
        creationTime: u.metadata.creationTime,
      });
    }
    token = page.pageToken;
  } while (token);
  process.stderr.write(`· firebase-auth-users ... ${out.length}\n`);
  return out;
}

(async () => {
  const collections = await exportCollections();
  const authUsers = await exportAuthUsers();
  const bundle = {
    exportedAt: new Date().toISOString(),
    projectId: appConfig.projectId,
    authUsers,
    collections,
  };
  const outPath = resolve('firebase-export.json');
  writeFileSync(outPath, JSON.stringify(bundle, null, 2));
  process.stderr.write(`\n✅ Exporté dans ${outPath}\n`);
})().catch((err) => {
  console.error('❌ Export error:', err);
  process.exit(1);
});
