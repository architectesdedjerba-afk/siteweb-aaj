# Déploiement cPanel — Architectes de Jerba

Ce document décrit la nouvelle architecture (PHP + MySQL sur cPanel) qui
remplace Firebase, et les étapes de déploiement / migration.

## 1. Architecture

```
┌──────────────────────────────────────────────────────────────┐
│ cPanel — single domaine (ex. architectes-jerba.tn)           │
│                                                              │
│  /public_html/                                               │
│    index.html, assets/, …                 ← build Vite (SPA) │
│    api/                                                      │
│      index.php          ← router                             │
│      lib/               ← config, PDO, JWT, SMTP, helpers    │
│      endpoints/         ← auth.php, collections.php, files.php│
│      scripts/           ← bootstrap-admin.php                │
│      uploads-storage/   ← fichiers uploadés (accès denied)   │
│      schema.sql                                              │
│      config.php         ← secrets (NON committé)             │
│                                                              │
│  MySQL : cpaneluser_aaj  (13 tables, voir api/schema.sql)    │
└──────────────────────────────────────────────────────────────┘
```

- Auth : JWT HS256 stocké dans un cookie `aaj_session` httpOnly.
- API : sous `/api/*` sur le même domaine (pas de CORS à gérer).
- Fichiers : uploadés sur disque, servis via `/api/files/{id}` avec
  contrôle d'accès identique aux anciennes storage.rules.
- Rôles / permissions : table `roles` alimentée automatiquement avec les
  4 rôles système (super-admin, admin, representative, member).

## 2. Pré-requis cPanel

- PHP ≥ 8.0 avec extensions `pdo_mysql`, `fileinfo`, `mbstring`, `openssl`.
- MySQL / MariaDB ≥ 5.7.
- Accès SMTP (cPanel → Email Accounts → créer `no-reply@…`).
- Un compte de messagerie pour les resets (nous l'avons paramétré dans
  `api/config.php`).

## 3. Installation initiale

1. **Base de données**
   - Créer une base dans cPanel : `cpaneluser_aaj` + utilisateur dédié.
   - Importer `api/schema.sql` via phpMyAdmin.

2. **Upload des fichiers**
   - Copier le contenu du dépôt dans `/public_html/` (le dossier `api/`
     y compris).
   - Construire le frontend localement : `npm install && npm run build`.
   - Uploader le contenu de `dist/` à la racine du site.

3. **Configuration API**
   ```bash
   cp api/config.example.php api/config.php
   # Puis éditer api/config.php :
   #  - db : identifiants MySQL
   #  - jwt.secret : openssl rand -base64 48
   #  - site.url : https://architectes-jerba.tn
   #  - smtp : identifiants du compte no-reply
   ```

4. **Permissions disque**
   ```bash
   chmod 750 api/uploads-storage
   ```

5. **Création du super-admin**
   ```bash
   cd ~/public_html/api
   php scripts/bootstrap-admin.php architectes.de.djerba@gmail.com "_Aaj2026*" "Super Admin"
   ```

6. **Test**
   - `GET https://<domaine>/api/health` → `{"ok":true,"time":"..."}`
   - Se connecter sur `/espace-adherents` avec le super-admin.

## 4. Migration des données depuis Firebase (une seule fois)

Exécuté **sur votre poste** (pas sur cPanel), avec le `serviceAccount.json`
de Firebase à la racine du dépôt.

```bash
# 1. Exporter Firestore + Firebase Auth
npm i firebase-admin              # déjà en devDependency
node scripts/export-firebase.mjs
# → écrit firebase-export.json à la racine

# 2. Importer dans MySQL (connexion distante cPanel)
#    Activer l'accès distant : cPanel → Remote MySQL → ajouter votre IP
npm i mysql2
CONFIRM=yes \
  DB_HOST=<hôte cPanel> DB_PORT=3306 \
  DB_USER=cpaneluser_aaj DB_PASS=<secret> DB_NAME=cpaneluser_aaj \
  node scripts/import-to-cpanel.mjs
```

### Notes importantes sur la migration

- **Utilisateurs Firebase Auth** : les hash bcrypt/scrypt de Firebase ne
  sont pas exportables. Chaque utilisateur sera importé avec
  `password_hash = NULL` et `must_reset = 1`. **Ils devront utiliser « Mot
  de passe oublié »** lors de leur première connexion pour définir un
  nouveau mot de passe.
- **UIDs Firebase préservés** : la colonne `users.uid` reprend l'uid
  Firebase d'origine, ce qui garde toutes les références croisées
  (messages, demandes de profil…) valides.
- **Fichiers base64 existants** : les anciens champs `fileBase64` /
  `photoBase64` sont importés tels quels dans les colonnes texte
  correspondantes. Les **nouveaux** uploads passent par `/api/files` et
  stockent le binaire sur disque. Vous pouvez progressivement migrer les
  anciens blobs base64 vers du disque en ré-uploadant les fichiers
  depuis l'interface admin (rien d'urgent, ça fonctionne en l'état).

## 5. Après migration

- Prévenir les membres par email : « Votre compte a été migré. Cliquez
  sur "Mot de passe oublié" pour définir votre nouveau mot de passe. »
- Désactiver le projet Firebase (optionnel : on peut garder l'export
  quelques semaines en sauvegarde).
- Supprimer `firebase-applet-config.json`, `serviceAccount.json`,
  `firebase-export.json` et la devDep `firebase-admin` une fois l'import
  validé.

## 6. Référence API

| Méthode | Chemin | Description |
|---------|--------|-------------|
| `POST`  | `/api/auth/login` | `{ email, password }` → set cookie, renvoie user+role |
| `POST`  | `/api/auth/logout` | efface cookie |
| `GET`   | `/api/auth/me` | session courante |
| `POST`  | `/api/auth/password-reset/request` | `{ email }` → envoie mail SMTP |
| `POST`  | `/api/auth/password-reset/verify` | `{ oobCode }` → vérifie |
| `POST`  | `/api/auth/password-reset/confirm` | `{ oobCode, password }` |
| `POST`  | `/api/auth/accounts` | création admin (`accounts.create` requis) |
| `GET`   | `/api/collections/{name}` | list, params `?orderBy=...&where=...` |
| `POST`  | `/api/collections/{name}` | create |
| `GET`   | `/api/collections/{name}/{id}` | get |
| `PUT`   | `/api/collections/{name}/{id}` | update |
| `DELETE`| `/api/collections/{name}/{id}` | delete |
| `POST`  | `/api/files` | upload multipart (`file`, `folder`) |
| `GET`   | `/api/files/{id}` | download (contrôle d'accès) |
| `DELETE`| `/api/files/{id}` | delete |

Collections disponibles : `users`, `roles`, `news`, `partners`,
`commission_pvs`, `contact_messages`, `documents`, `profile_updates`,
`event_registrations`, `membership_applications`, `partner_applications`.

## 7. Fonctionnement temps-réel

Firestore fournissait des souscriptions temps-réel (`onSnapshot`). Sur
cPanel, le shim `src/lib/firebase.ts` implémente `onSnapshot` via un
**polling toutes les 8 secondes** de l'endpoint `GET` correspondant. Pour
l'espace adhérent (petit volume, quelques admins connectés
simultanément) c'est largement suffisant. Pour ajuster : modifier
`DEFAULT_POLL_MS` dans `src/lib/firebase.ts`.

## 8. Dépannage

- **500 au premier appel** : `api/config.php` manquant ou droits MySQL.
  Vérifier `tail -f ~/logs/error_log`.
- **`storage_error` à l'upload** : le dossier `api/uploads-storage/`
  n'est pas writable. `chmod 750` + vérifier l'utilisateur PHP.
- **SMTP muet** : tester avec `swaks --to you@gmail.com --from
  no-reply@domaine.tn --server mail.domaine.tn:587 --auth LOGIN ...`
  depuis SSH.
- **Mot de passe oublié sans mail reçu** : cPanel filtre parfois les
  destinations `gmail.com` depuis son propre relais. Configurer un SPF +
  DKIM sur `no-reply@domaine.tn`.
