# AAJ — Association des Architectes de Jerba

Site officiel de l'Association des Architectes de Jerba (AAJ) : présentation de l'association, actualités, partenaires, et espace dédié aux adhérents.

## Stack

- **Front-end** : React 19, TypeScript, Vite 6, Tailwind CSS v4, react-router v7, motion, lucide-react
- **Back-end** : PHP 8 + MySQL, servi sur cPanel sous `/api`
- **Auth** : JWT HS256 dans un cookie httpOnly (`aaj_session`)
- **Fichiers** : uploads streamés sur disque via `/api/files/{id}` (ACL par dossier)
- **i18n** : système interne léger (FR / AR / EN)

## Arborescence

```
.
├── api/                                # Back-end PHP (servi sous /api)
│   ├── index.php                       # Router front controller
│   ├── .htaccess                       # Rewrites + headers de sécurité
│   ├── config.example.php              # Modèle → copier en config.php côté serveur
│   ├── schema.sql                      # Tables MySQL (13)
│   ├── migrations/                     # ALTER SQL idempotents (auto-appliqués)
│   ├── endpoints/
│   │   ├── auth.php                    # login, logout, me, password-reset, accounts
│   │   ├── collections.php             # CRUD générique avec ACL par collection
│   │   └── files.php                   # Upload/download avec contrôle d'accès
│   ├── lib/
│   │   ├── auth.php                    # JWT + profils
│   │   ├── db.php                      # PDO MySQL
│   │   ├── jwt.php                     # HS256
│   │   ├── mail.php                    # Client SMTP minimal (STARTTLS/SSL)
│   │   ├── permissions.php             # Rôles + seed auto
│   │   ├── migrations.php              # Runner idempotent au cold start
│   │   ├── ids.php, json.php, bootstrap.php
│   │   └── ...
│   ├── scripts/
│   │   └── bootstrap-admin.php         # Création CLI du super-admin initial
│   └── uploads-storage/                # Binaires (bloqué via .htaccess)
├── src/                                # SPA React
│   ├── App.tsx                         # Routing + providers
│   ├── lib/
│   │   ├── api.ts                      # Client HTTP vers /api
│   │   ├── firebase.ts                 # Shim compat (garde l'ancienne surface
│   │   │                                 onSnapshot/addDoc/etc. en routant
│   │   │                                 vers /api avec polling 8 s)
│   │   ├── storage.ts                  # uploadFile/deleteFile via /api/files
│   │   ├── AuthContext.tsx, permissions.ts, memberConfig.ts
│   │   ├── toast.tsx, i18n.tsx, validation.ts, tunisianDelegations.ts
│   │   └── useFirestoreCollection.ts, useChat.ts
│   ├── components/                     # Navbar, Footer, ErrorBoundary, Chat, …
│   └── pages/                          # 10 pages
├── .htaccess                           # SPA fallback + cache + headers
└── DEPLOYMENT.md                       # Runbook cPanel complet
```

> **Note sur `src/lib/firebase.ts`** : conservé comme compat shim. Il expose la même surface que le SDK Firebase d'origine (`onSnapshot`, `addDoc`, `getDoc`, etc.) mais route tout vers `/api`. Les `onSnapshot` font du polling 8 s (configurable via `DEFAULT_POLL_MS`). Cette couche évite de réécrire chaque page ; à terme les pages migreront une par une directement vers `src/lib/api.ts`.

## Routes front

| Route                      | Page                     | Accès          |
|----------------------------|--------------------------|----------------|
| `/`                        | Accueil                  | Public         |
| `/aaj`                     | À propos                 | Public         |
| `/evennements`             | Évènements               | Public         |
| `/partenaires`             | Partenaires              | Public         |
| `/inscription-evenement`   | Inscription évènement    | Public         |
| `/demander-adhesion`       | Demande d'adhésion       | Public         |
| `/devenir-partenaire`      | Devenir partenaire       | Public         |
| `/espace-adherents`        | Espace adhérents         | Authentifié    |
| `/reset-password`          | Réinitialisation MDP     | Public (token) |
| `/mentions-legales`        | Mentions légales / RGPD  | Public         |

## Collections MySQL

`users`, `roles`, `news`, `partners`, `commission_pvs`, `contact_messages`, `documents`, `profile_updates`, `event_registrations`, `membership_applications`, `partner_applications`, `chat_channels`, `chat_messages`.

Schéma complet dans [`api/schema.sql`](api/schema.sql). Les migrations incrémentales vivent dans `api/migrations/*.sql` et sont auto-appliquées au premier appel API après déploiement (runner idempotent dans `api/lib/migrations.php`).

## Rôles & permissions

- `super-admin` — accès total (`isAllAccess`)
- `admin` — gestion membres/news/partenaires/bibliothèque/messages/demandes
- `representative` — peut déposer des PV de commission
- `member` — accès standard (dashboard, annuaire, biblio, messagerie, profil)

Les 4 rôles système sont seedés automatiquement au premier boot de l'API. Matrice complète dans [`src/lib/permissions.ts`](src/lib/permissions.ts).

## Lancement local (frontend)

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # Build production → dist/
npm run typecheck  # TypeScript
npm run lint       # ESLint
npm run format     # Prettier
```

Pour pointer le frontend vers un backend distant (prod ou staging), modifier `API_BASE` dans `src/lib/api.ts` (par défaut : même origine, `/api`).

## Déploiement

Voir [`DEPLOYMENT.md`](DEPLOYMENT.md) pour la procédure cPanel complète (base de données, `config.php`, SMTP, création du super-admin, permissions disque).

Le CI (`.github/workflows/deploy.yml`) déploie automatiquement sur `main` via FTPS :
- Build Vite → `dist/` → racine du `public_html`
- Dossier `api/` synchronisé tel quel

Pas d'accès SSH côté cPanel — toutes les opérations serveur passent par File Manager, phpMyAdmin, ou l'API REST elle-même.

## Sécurité

- JWT HS256 en cookie httpOnly Secure SameSite=Strict (7 jours)
- Password hashing : `password_hash(PASSWORD_BCRYPT)`
- Permissions vérifiées côté API sur **chaque** requête (miroir des anciennes rules)
- Uploads : taille + type MIME vérifiés, `.htaccess` interdit l'exécution dans `uploads-storage`
- Validation serveur PDO prepared statements partout
- `api/config.php` gitignoré (secrets DB/JWT/SMTP) + protégé par `.htaccess`
- SPF + DKIM + DMARC configurés sur `aaj-web.com` (pour que les mails `no-reply` ne finissent pas en spam Gmail)

## Accessibilité

- Skip-link vers contenu principal
- Navigation clavier (focus-visible)
- `aria-live` pour notifications
- `prefers-reduced-motion` respecté
- Labels `htmlFor`/`id` sur tous les formulaires

## Roadmap

- [ ] Migrer progressivement les pages de `lib/firebase.ts` (shim) vers `lib/api.ts` direct
- [ ] Remplacer les blobs base64 existants par des fichiers disque (`/api/files`)
- [ ] Refactor MemberSpace en sous-composants
- [ ] Paiement cotisations en ligne
- [ ] Export annuaire (PDF/Excel)
- [ ] Tests (Vitest + React Testing Library)

## Licence

Apache-2.0
