/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface PermissionDef {
  key: string;
  label: string;
}

export interface PermissionGroup {
  label: string;
  permissions: PermissionDef[];
}

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    label: 'Espace Membre',
    permissions: [
      { key: 'dashboard.view', label: 'Tableau de bord' },
      { key: 'commissions.view', label: 'Consulter avis des commissions' },
      { key: 'library.view', label: 'Consulter la bibliothèque' },
      { key: 'annuaire.view', label: 'Consulter l\u2019annuaire' },
      { key: 'partners.view', label: 'Consulter les partenaires' },
      { key: 'messages.send', label: 'Envoyer un message' },
      { key: 'profile.edit', label: 'Modifier son profil' },
    ],
  },
  {
    label: 'Représentant',
    permissions: [{ key: 'commissions.create', label: 'Déposer un avis de commission' }],
  },
  {
    label: 'Administration',
    permissions: [
      { key: 'members.manage', label: 'Gérer les adhésions' },
      { key: 'partners.manage', label: 'Gérer les partenaires' },
      { key: 'library.manage', label: 'Gérer la bibliothèque' },
      { key: 'news.manage', label: 'Gérer Actions & Infos' },
      { key: 'profileRequests.manage', label: 'Valider les demandes de profil' },
      { key: 'messages.inbox', label: 'Lire les messages entrants' },
    ],
  },
  {
    label: 'Super Admin',
    permissions: [
      { key: 'accounts.create', label: 'Créer des comptes utilisateurs' },
      { key: 'roles.manage', label: 'Gérer les rôles & permissions' },
      { key: 'config.manage', label: 'Gérer les paramètres (villes, types de membres)' },
      { key: 'users.editRole', label: 'Attribuer des rôles' },
      { key: 'users.editStatus', label: 'Modifier le statut des utilisateurs' },
    ],
  },
];

export const ALL_PERMISSION_KEYS: string[] = PERMISSION_GROUPS.flatMap((g) =>
  g.permissions.map((p) => p.key)
);

const allTrue = (): Record<string, boolean> =>
  Object.fromEntries(ALL_PERMISSION_KEYS.map((k) => [k, true]));

const keysFor = (keys: string[]): Record<string, boolean> =>
  Object.fromEntries(ALL_PERMISSION_KEYS.map((k) => [k, keys.includes(k)]));

export interface DefaultRole {
  id: string;
  name: string;
  description: string;
  isSystem: true;
  isAllAccess: boolean;
  permissions: Record<string, boolean>;
}

export const DEFAULT_ROLES: DefaultRole[] = [
  {
    id: 'super-admin',
    name: 'Super Administrateur',
    description: 'Accès total à toutes les fonctionnalités. Ne peut pas être modifié.',
    isSystem: true,
    isAllAccess: true,
    permissions: allTrue(),
  },
  {
    id: 'admin',
    name: 'Administrateur',
    description: 'Gestion complète du site et des adhésions.',
    isSystem: true,
    isAllAccess: false,
    permissions: keysFor([
      'dashboard.view',
      'commissions.view',
      'library.view',
      'annuaire.view',
      'partners.view',
      'messages.send',
      'profile.edit',
      'commissions.create',
      'members.manage',
      'partners.manage',
      'library.manage',
      'news.manage',
      'profileRequests.manage',
      'messages.inbox',
    ]),
  },
  {
    id: 'representative',
    name: 'Représentant',
    description: 'Membre avec droit de déposer les avis de commissions techniques.',
    isSystem: true,
    isAllAccess: false,
    permissions: keysFor([
      'dashboard.view',
      'commissions.view',
      'library.view',
      'annuaire.view',
      'partners.view',
      'messages.send',
      'profile.edit',
      'commissions.create',
    ]),
  },
  {
    id: 'member',
    name: 'Membre',
    description: 'Accès standard à l\u2019espace adhérent.',
    isSystem: true,
    isAllAccess: false,
    permissions: keysFor([
      'dashboard.view',
      'commissions.view',
      'library.view',
      'annuaire.view',
      'partners.view',
      'messages.send',
      'profile.edit',
    ]),
  },
];

export const sanitizeRoleId = (name: string): string =>
  name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 40);
