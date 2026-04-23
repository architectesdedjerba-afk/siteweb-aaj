/**
 * Import firebase-export.json → MySQL (cPanel).
 *
 * Usage (locally, with ssh tunnel to cPanel MySQL, or from a machine with
 * direct access to the DB host):
 *
 *   DB_HOST=... DB_PORT=3306 DB_USER=... DB_PASS=... DB_NAME=... \
 *     node scripts/import-to-cpanel.mjs
 *
 * Steps performed:
 *   1. Truncate target tables (after a confirmation prompt via env flag).
 *   2. INSERT rows for each collection, mapping Firestore field names
 *      to the MySQL columns defined in api/schema.sql.
 *   3. INSERT firebase-auth users into `users` with:
 *        - password_hash = NULL (Firebase bcrypt params aren't portable)
 *        - must_reset = 1
 *      Users must use "Mot de passe oublié" to set a new password.
 *
 * Prereqs: `npm i mysql2` in a workspace of your choice. The script
 * resolves the package via createRequire so it does not need to be a
 * project dependency.
 */

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const require = createRequire(import.meta.url);
let mysql;
try {
  mysql = require('mysql2/promise');
} catch {
  console.error('❌ `mysql2` introuvable. Installez-le dans un workspace quelconque : `npm i mysql2`');
  process.exit(1);
}

const bundle = JSON.parse(readFileSync(resolve('firebase-export.json'), 'utf8'));

const CONFIRM = process.env.CONFIRM === 'yes';
if (!CONFIRM) {
  console.error('⚠  Ce script TRUNCATE les tables cibles avant import.');
  console.error('   Relancez avec CONFIRM=yes pour confirmer.');
  process.exit(1);
}

const conn = await mysql.createConnection({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  timezone: '+00:00',
  multipleStatements: false,
});

const trunc = [
  'password_resets', 'files',
  'profile_updates', 'contact_messages', 'commission_pvs', 'documents',
  'news', 'partners',
  'event_registrations', 'membership_applications', 'partner_applications',
  'users', 'roles',
];
for (const t of trunc) await conn.query(`TRUNCATE TABLE \`${t}\``);

/* ------------------ helpers ------------------ */

const tsToMysql = (v) => {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 19).replace('T', ' ');
};

const jsonOrNull = (v) => (v == null ? null : JSON.stringify(v));

async function insertMany(table, rows, columns) {
  if (!rows.length) return;
  const placeholders = '(' + columns.map(() => '?').join(', ') + ')';
  const sql = `INSERT INTO \`${table}\` (\`${columns.join('`, `')}\`) VALUES ${rows.map(() => placeholders).join(', ')}`;
  const values = rows.flatMap((r) => columns.map((c) => r[c] ?? null));
  await conn.query(sql, values);
}

/* ------------------ roles ------------------ */

const rolesIn = bundle.collections.roles || [];
const roleRows = rolesIn.map((r) => ({
  id: r.id,
  name: r.name || r.id,
  description: r.description ?? null,
  permissions: jsonOrNull(r.permissions ?? {}),
  is_system: r.isSystem ? 1 : 0,
  is_all_access: r.isAllAccess ? 1 : 0,
  created_at: tsToMysql(r.createdAt) || new Date().toISOString().slice(0, 19).replace('T', ' '),
}));
await insertMany('roles', roleRows, ['id', 'name', 'description', 'permissions', 'is_system', 'is_all_access', 'created_at']);
console.error(`· roles : ${roleRows.length}`);

/* ------------------ users ------------------ */

// Merge Firebase-Auth user list with Firestore users/{uid} documents.
const firestoreUsers = new Map();
for (const u of (bundle.collections.users || [])) firestoreUsers.set(u.id, u);

const authUsers = bundle.authUsers || [];
const userRows = authUsers.map((u) => {
  const prof = firestoreUsers.get(u.uid) || {};
  return {
    uid: u.uid,
    email: (u.email || prof.email || '').toLowerCase(),
    password_hash: null,
    must_reset: 1,
    display_name: prof.displayName || u.displayName || '',
    first_name: prof.firstName ?? null,
    last_name: prof.lastName ?? null,
    role: prof.role || 'member',
    status: prof.status || 'pending',
    category: prof.category ?? null,
    license_number: prof.licenseNumber ?? null,
    mobile: prof.mobile ?? null,
    address: prof.address ?? null,
    photo_url: prof.photoBase64 ?? null,
    cotisations: jsonOrNull(prof.cotisations),
    created_at: tsToMysql(prof.createdAt || u.creationTime) || new Date().toISOString().slice(0, 19).replace('T', ' '),
  };
});
// Also include Firestore user docs that have no matching Auth entry
// (shouldn't happen normally, but guards against missed rows).
for (const [uid, prof] of firestoreUsers) {
  if (!userRows.find((r) => r.uid === uid)) {
    userRows.push({
      uid,
      email: (prof.email || '').toLowerCase(),
      password_hash: null,
      must_reset: 1,
      display_name: prof.displayName || '',
      first_name: prof.firstName ?? null,
      last_name: prof.lastName ?? null,
      role: prof.role || 'member',
      status: prof.status || 'pending',
      category: prof.category ?? null,
      license_number: prof.licenseNumber ?? null,
      mobile: prof.mobile ?? null,
      address: prof.address ?? null,
      photo_url: prof.photoBase64 ?? null,
      cotisations: jsonOrNull(prof.cotisations),
      created_at: tsToMysql(prof.createdAt) || new Date().toISOString().slice(0, 19).replace('T', ' '),
    });
  }
}
await insertMany('users', userRows, [
  'uid','email','password_hash','must_reset','display_name','first_name','last_name',
  'role','status','category','license_number','mobile','address','photo_url','cotisations','created_at',
]);
console.error(`· users : ${userRows.length}`);

/* ------------------ news ------------------ */

const newsRows = (bundle.collections.news || []).map((n) => ({
  id: n.id,
  title: n.title ?? '',
  content: n.content ?? '',
  date: n.date ?? null,
  type: n.type ?? null,
  category: n.category ?? null,
  image_url: n.imageUrl ?? null,
  file_url: n.fileBase64 ?? null,
  file_name: n.fileName ?? null,
  created_at: tsToMysql(n.createdAt) || new Date().toISOString().slice(0, 19).replace('T', ' '),
}));
await insertMany('news', newsRows, ['id','title','content','date','type','category','image_url','file_url','file_name','created_at']);
console.error(`· news : ${newsRows.length}`);

/* ------------------ partners ------------------ */

const partnerRows = (bundle.collections.partners || []).map((p) => ({
  id: p.id,
  name: p.name ?? '',
  logo_url: p.logoUrl ?? null,
  category: p.category ?? null,
  level: p.level ?? null,
  joined: p.joined ?? null,
  is_visible: p.isVisible === false ? 0 : 1,
  website: p.website ?? null,
  created_at: tsToMysql(p.createdAt) || new Date().toISOString().slice(0, 19).replace('T', ' '),
}));
await insertMany('partners', partnerRows, ['id','name','logo_url','category','level','joined','is_visible','website','created_at']);
console.error(`· partners : ${partnerRows.length}`);

/* ------------------ commission_pvs ------------------ */

const pvRows = (bundle.collections.commission_pvs || []).map((p) => ({
  id: p.id,
  town: p.town ?? '',
  date: p.date ?? null,
  count: Number(p.count) || 0,
  file_url: p.fileBase64 ?? null,
  file_name: p.fileName ?? null,
  created_at: tsToMysql(p.createdAt) || new Date().toISOString().slice(0, 19).replace('T', ' '),
}));
await insertMany('commission_pvs', pvRows, ['id','town','date','count','file_url','file_name','created_at']);
console.error(`· commission_pvs : ${pvRows.length}`);

/* ------------------ contact_messages ------------------ */

const msgRows = (bundle.collections.contact_messages || []).map((m) => ({
  id: m.id,
  user_id: m.userId ?? '',
  user_email: m.userEmail ?? null,
  subject: m.subject ?? '',
  message: m.message ?? '',
  file_url: m.fileBase64 ?? null,
  file_name: m.fileName ?? null,
  created_at: tsToMysql(m.createdAt) || new Date().toISOString().slice(0, 19).replace('T', ' '),
}));
await insertMany('contact_messages', msgRows, ['id','user_id','user_email','subject','message','file_url','file_name','created_at']);
console.error(`· contact_messages : ${msgRows.length}`);

/* ------------------ documents ------------------ */

const docRows = (bundle.collections.documents || []).map((d) => ({
  id: d.id,
  name: d.name ?? '',
  url: d.url ?? d.fileBase64 ?? null,
  category: d.category ?? '',
  sub_category: d.subCategory ?? null,
  file_type: d.fileType ?? null,
  created_at: tsToMysql(d.createdAt) || new Date().toISOString().slice(0, 19).replace('T', ' '),
}));
await insertMany('documents', docRows, ['id','name','url','category','sub_category','file_type','created_at']);
console.error(`· documents : ${docRows.length}`);

/* ------------------ profile_updates ------------------ */

const puRows = (bundle.collections.profile_updates || []).map((p) => ({
  id: p.id,
  uid: p.uid ?? '',
  user_email: p.userEmail ?? '',
  first_name: p.firstName ?? null,
  last_name: p.lastName ?? null,
  mobile: p.mobile ?? null,
  category: p.category ?? null,
  license_number: p.licenseNumber ?? null,
  address: p.address ?? null,
  status: p.status ?? 'pending',
  created_at: tsToMysql(p.createdAt) || new Date().toISOString().slice(0, 19).replace('T', ' '),
}));
await insertMany('profile_updates', puRows, ['id','uid','user_email','first_name','last_name','mobile','category','license_number','address','status','created_at']);
console.error(`· profile_updates : ${puRows.length}`);

/* ------------------ event_registrations ------------------ */

const erRows = (bundle.collections.event_registrations || []).map((e) => ({
  id: e.id,
  full_name: e.fullName ?? '',
  email: e.email ?? '',
  event_title: e.eventTitle ?? '',
  message: e.message ?? null,
  created_at: tsToMysql(e.createdAt) || new Date().toISOString().slice(0, 19).replace('T', ' '),
}));
await insertMany('event_registrations', erRows, ['id','full_name','email','event_title','message','created_at']);
console.error(`· event_registrations : ${erRows.length}`);

/* ------------------ membership_applications ------------------ */

const maRows = (bundle.collections.membership_applications || []).map((m) => ({
  id: m.id,
  full_name: m.fullName ?? '',
  email: m.email ?? '',
  phone: m.phone ?? '',
  category: m.category ?? '',
  matricule: m.matricule ?? '',
  city: m.city ?? '',
  cv_file_name: m.cvFileName ?? null,
  status: m.status ?? 'pending',
  created_at: tsToMysql(m.createdAt) || new Date().toISOString().slice(0, 19).replace('T', ' '),
}));
await insertMany('membership_applications', maRows, ['id','full_name','email','phone','category','matricule','city','cv_file_name','status','created_at']);
console.error(`· membership_applications : ${maRows.length}`);

/* ------------------ partner_applications ------------------ */

const paRows = (bundle.collections.partner_applications || []).map((p) => ({
  id: p.id,
  contact_name: p.contactName ?? '',
  email: p.email ?? '',
  phone: p.phone ?? '',
  company_name: p.companyName ?? '',
  activity: p.activity ?? '',
  sponsorship_type: p.sponsorshipType ?? '',
  message: p.message ?? null,
  status: p.status ?? 'pending',
  created_at: tsToMysql(p.createdAt) || new Date().toISOString().slice(0, 19).replace('T', ' '),
}));
await insertMany('partner_applications', paRows, ['id','contact_name','email','phone','company_name','activity','sponsorship_type','message','status','created_at']);
console.error(`· partner_applications : ${paRows.length}`);

await conn.end();
console.error('\n✅ Import terminé. Les membres devront utiliser « Mot de passe oublié » pour définir leur mot de passe.');
