# AAJ — Association des Architectes de Jerba

Site officiel de l'Association des Architectes de Jerba (AAJ) : présentation de l'association, actualités, partenaires, et espace dédié aux adhérents.

## Stack

- **Front-end** : React 19, TypeScript, Vite 6
- **Styling** : Tailwind CSS v4 (plugin Vite)
- **Routing** : react-router-dom v7
- **Animations** : motion (Framer Motion)
- **Icônes** : lucide-react
- **Back-end** : Firebase (Auth + Firestore + Storage)
- **i18n** : système interne léger (FR / AR / EN)

## Structure

```
src/
├── App.tsx                      # Router + providers (Auth, Toast, i18n)
├── main.tsx                     # Bootstrap React
├── index.css                    # Thème Tailwind + a11y
├── types.ts                     # Types TypeScript partagés
├── components/
│   ├── Navbar.tsx               # Navigation + sélecteur langue
│   ├── Footer.tsx
│   ├── ErrorBoundary.tsx
│   ├── ScrollToTop.tsx
│   ├── CookieBanner.tsx         # Consentement RGPD
│   └── LanguageSwitcher.tsx
├── lib/
│   ├── firebase.ts              # Init SDK
│   ├── AuthContext.tsx          # Context Auth global
│   ├── toast.tsx                # Système de notifications
│   ├── i18n.tsx                 # Traductions
│   ├── validation.ts            # Validation formulaires
│   ├── storage.ts               # Helpers Firebase Storage
│   ├── error-handler.ts
│   └── useFirestoreCollection.ts
├── pages/                       # 10 pages
└── img/                         # Assets statiques
```

## Routes

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

## Firestore collections

- `users/{uid}` — profils membres (role/status contrôlés serveur)
- `news/{id}` — actualités (lecture publique)
- `partners/{id}` — partenaires (lecture publique)
- `documents/{id}` — bibliothèque technique/légale (adhérents)
- `commission_pvs/{id}` — PV commissions (adhérents)
- `contact_messages/{id}` — messagerie interne
- `profile_updates/{id}` — demandes de modification
- `event_registrations/{id}` — inscriptions événements (public create)
- `membership_applications/{id}` — demandes d'adhésion (public create)
- `partner_applications/{id}` — demandes partenariat (public create)

Règles complètes dans `firestore.rules` et `storage.rules`.

## Rôles

- `admin` — accès total, gestion membres/news/partenaires/documents
- `representative` — peut publier des PV de commission
- `member` — accès bibliothèque + messagerie + profil
- Statut `status`: `pending` → `active` (validé admin) / `suspended`

## Lancement local

### Prérequis
- Node.js 20+
- Un projet Firebase (Auth email/password + Firestore + Storage activés)

### Installation

```bash
npm install
```

### Configuration Firebase

Mettre à jour `firebase-applet-config.json` avec votre config Firebase (clés publiques — la sécurité repose sur les rules Firestore/Storage).

### Démarrage

```bash
npm run dev       # http://localhost:3000
npm run build     # production build
npm run preview   # preview du build
npm run lint      # ESLint
npm run format    # Prettier
npm run typecheck # TypeScript
```

## Déploiement

Le site est déployable sur **Firebase Hosting**, **Vercel** ou **Netlify**. Pour Firebase Hosting :

```bash
npm run build
firebase deploy --only hosting,firestore:rules,storage:rules
```

## Sécurité

- Aucune clé secrète côté client (les clés Firebase sont publiques et protégées par les rules)
- Authentification : email/password Firebase
- Rules Firestore/Storage strictes avec catch-all deny
- Validation serveur des tailles/types de fichiers (Storage rules)
- Validation client + serveur des formulaires publics

## Accessibilité

- Skip-link vers contenu principal
- Navigation clavier (focus-visible)
- `aria-live` pour notifications
- `prefers-reduced-motion` respecté
- Labels `htmlFor`/`id` sur tous les formulaires

## Roadmap

- [ ] Migration Base64 → Firebase Storage (helpers déjà prêts)
- [ ] Refactor MemberSpace en sous-composants
- [ ] Paiement cotisations en ligne
- [ ] Export annuaire (PDF/Excel)
- [ ] Tests (Vitest + React Testing Library)
- [ ] CI/CD GitHub Actions
- [ ] Notifications email (Firebase Extensions + SendGrid)

## Licence

Apache-2.0
