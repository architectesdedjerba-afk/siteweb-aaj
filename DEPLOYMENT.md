# Déploiement cPanel — Architectes de Jerba

Ce document décrit l'architecture (PHP + MySQL sur cPanel) et les étapes
de déploiement.

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
   - Dans cPanel → File Manager, naviguer vers `api/uploads-storage/`,
     clic droit → Permissions → `750`.

5. **Création du super-admin**
   - **Avec SSH** (si dispo) : `php api/scripts/bootstrap-admin.php email "mot_de_passe" "Display Name"`.
   - **Sans SSH** (cas cPanel Oxahost) : créer manuellement via phpMyAdmin
     une ligne dans `users` avec `role='super-admin'`, `status='active'`,
     `must_reset=1`, `password_hash = '$2y$10$...'` (générer le hash via
     un outil externe tel que `htpasswd -bnBC 10 "" mot_de_passe`), puis
     se connecter — le flux first-login impose un changement de mot de
     passe immédiatement.
   - Alternative plus simple : importer `schema.sql` sans super-admin,
     puis utiliser l'endpoint `POST /api/auth/accounts` depuis une
     session déjà authentifiée comme super-admin (circulaire : nécessite
     un premier super-admin).

6. **Test**
   - `GET https://<domaine>/api/health` → `{"ok":true,"time":"..."}`
   - Se connecter sur `/espace-adherents` avec le super-admin.

## 4. Référence API

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
`event_registrations`, `membership_applications`, `partner_applications`,
`chat_channels`, `chat_messages`.

## 5. Fonctionnement temps-réel

Le shim `src/lib/firebase.ts` implémente `onSnapshot` via un **polling
toutes les 8 secondes** de l'endpoint `GET` correspondant. Pour l'espace
adhérent (petit volume, quelques admins connectés simultanément) c'est
largement suffisant. Pour ajuster : modifier `DEFAULT_POLL_MS` dans
`src/lib/firebase.ts`.

## 6. Migrations de schéma

Les ALTER incrémentaux vivent dans `api/migrations/*.sql` et sont
appliqués automatiquement au premier appel API après déploiement
(runner idempotent dans `api/lib/migrations.php`, basé sur
`information_schema`). Pas d'action manuelle requise en prod.

## 7. Dépannage

- **500 au premier appel** : `api/config.php` manquant ou droits MySQL.
  Vérifier via cPanel → Errors, ou `api/error_log` via File Manager.
- **`storage_error` à l'upload** : le dossier `api/uploads-storage/`
  n'est pas writable. `chmod 750` + vérifier l'utilisateur PHP.
- **Upload volumineux qui échoue en 413/500** : `api/.user.ini` fixe
  `upload_max_filesize` / `post_max_size` à 512 Mo, mais les hôtes en
  PHP-FPM rechargent ce fichier toutes les ~5 min. Si les limites ne
  bougent pas, les forcer via cPanel → **Select PHP Version → Options**
  (`upload_max_filesize`, `post_max_size`, `memory_limit`,
  `max_execution_time`). Le cap applicatif est dans
  `api/config.php → uploads.max_bytes` (0 pour désactiver).
- **SMTP muet** : vérifier cPanel → **Track Delivery** pour voir si le
  message est parti (Exim). Si oui mais mail jamais reçu côté Gmail,
  check cPanel → **Email Deliverability** : il faut que SPF + DKIM +
  DMARC soient `VALID`. Sans ça Gmail drop silencieusement.
- **DB "Access denied"** : le compte MySQL référencé dans
  `api/config.php` n'a pas les droits — cPanel → MySQL Databases →
  « Add User To Database ».
