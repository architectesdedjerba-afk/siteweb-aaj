#!/usr/bin/env node
import { existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const OUT_DIR = join(ROOT, 'deploy');
const INCLUDE_MAPS = process.argv.includes('--with-maps');

function fail(msg) {
  console.error(`\x1b[31m✖ ${msg}\x1b[0m`);
  process.exit(1);
}
function ok(msg) {
  console.log(`\x1b[32m✔\x1b[0m ${msg}`);
}
function info(msg) {
  console.log(`  ${msg}`);
}

if (!existsSync(join(DIST, 'index.html'))) {
  fail(`dist/ introuvable ou incomplet. Lance d'abord: npm run build`);
}

mkdirSync(OUT_DIR, { recursive: true });

const now = new Date();
const ts =
  now.getFullYear().toString() +
  String(now.getMonth() + 1).padStart(2, '0') +
  String(now.getDate()).padStart(2, '0') +
  '-' +
  String(now.getHours()).padStart(2, '0') +
  String(now.getMinutes()).padStart(2, '0');
const zipName = `aaj-frontend-${ts}.zip`;
const zipPath = join(OUT_DIR, zipName);

if (existsSync(zipPath)) rmSync(zipPath);

const isWin = process.platform === 'win32';

function runZipBsdtar() {
  const bin = isWin ? 'C:\\Windows\\System32\\tar.exe' : 'tar';
  const args = ['-a', '-c', '-f', zipPath];
  if (!INCLUDE_MAPS) args.push('--exclude=*.map');
  args.push('-C', DIST, '.');
  const r = spawnSync(bin, args, { stdio: 'inherit' });
  return r.status === 0;
}

function runZipUnixZip() {
  const args = ['-r', '-q', zipPath, '.'];
  if (!INCLUDE_MAPS) args.push('-x', '*.map');
  const r = spawnSync('zip', args, { stdio: 'inherit', cwd: DIST });
  return r.status === 0;
}

let success = runZipBsdtar();
if (!success && !isWin) success = runZipUnixZip();
if (!success) fail(`Échec de la création du zip. Installe bsdtar (tar) ou zip.`);

const size = statSync(zipPath).size;
const sizeMB = (size / 1024 / 1024).toFixed(2);

ok(`Zip créé: deploy/${zipName} (${sizeMB} MB)`);
if (!INCLUDE_MAPS) info(`(sourcemaps exclus — utilise --with-maps pour les inclure)`);
console.log('');
console.log('\x1b[36mProchaine étape — upload via cPanel File Manager:\x1b[0m');
console.log('  1. Ouvre cPanel → File Manager → /public_html/');
console.log('  2. Renomme le dossier  assets/  →  assets.old/   (rollback de sécurité)');
console.log(`  3. Upload ${zipName} à la racine de /public_html/`);
console.log('  4. Clic droit sur le zip → Extract → Target: /public_html/');
console.log('  5. Teste le site (Ctrl+Shift+R)');
console.log('  6. Si OK : supprime  assets.old/  et le zip sur le serveur');
console.log('     Si KO : supprime  assets/ , renomme  assets.old/  →  assets/');
console.log('');
console.log(`  Chemin local: ${zipPath}`);
