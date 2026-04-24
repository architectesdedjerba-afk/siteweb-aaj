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
      { key: 'dashboard_view', label: 'Tableau de bord' },
      { key: 'commissions_view', label: 'Consulter avis des commissions' },
      { key: 'library_view', label: 'Consulter la bibliothèque' },
      { key: 'annuaire_view', label: 'Consulter l\u2019annuaire' },
      { key: 'partners_view', label: 'Consulter les partenaires' },
      { key: 'messages_send', label: 'Envoyer un message' },
      { key: 'profile_edit', label: 'Modifier son profil' },
      { key: 'chat_use', label: 'Utiliser la messagerie interne' },
      { key: 'chat_create_channel', label: 'Proposer un canal de discussion' },
      { key: 'unesco_view', label: 'Consulter Djerba UNESCO' },
      { key: 'unesco_permits_submit', label: 'Déposer une demande de permis UNESCO' },
    ],
  },
  {
    label: 'Représentant',
    permissions: [{ key: 'commissions_create', label: 'Déposer un avis de commission' }],
  },
  {
    label: 'Administration',
    permissions: [
      { key: 'members_manage', label: 'Gérer les adhésions' },
      { key: 'partners_manage', label: 'Gérer les partenaires' },
      { key: 'library_manage', label: 'Gérer la bibliothèque' },
      { key: 'news_manage', label: 'Gérer Actions & Infos' },
      { key: 'profileRequests_manage', label: 'Valider les demandes de profil' },
      { key: 'messages_inbox', label: 'Lire les messages entrants' },
      { key: 'chat_manage', label: 'Modérer la messagerie interne (canaux & messages)' },
      { key: 'unesco_manage', label: 'Gérer Djerba UNESCO (KMZ, zones, documents)' },
      { key: 'unesco_permits_review', label: 'Instruire les demandes de permis UNESCO' },
    ],
  },
  {
    label: 'Super Admin',
    permissions: [
      { key: 'accounts_create', label: 'Créer des comptes utilisateurs' },
      { key: 'roles_manage', label: 'Gérer les rôles & permissions' },
      { key: 'config_manage', label: 'Gérer les paramètres (villes, types de membres)' },
      { key: 'users_editRole', label: 'Attribuer des rôles' },
      { key: 'users_editStatus', label: 'Modifier le statut des utilisateurs' },
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
      'dashboard_view',
      'commissions_view',
      'library_view',
      'annuaire_view',
      'partners_view',
      'messages_send',
      'profile_edit',
      'commissions_create',
      'members_manage',
      'partners_manage',
      'library_manage',
      'news_manage',
      'profileRequests_manage',
      'messages_inbox',
      'chat_use',
      'chat_create_channel',
      'chat_manage',
      'unesco_view',
      'unesco_permits_submit',
      'unesco_manage',
      'unesco_permits_review',
    ]),
  },
  {
    id: 'representative',
    name: 'Représentant',
    description: 'Membre avec droit de déposer les avis de commissions techniques.',
    isSystem: true,
    isAllAccess: false,
    permissions: keysFor([
      'dashboard_view',
      'commissions_view',
      'library_view',
      'annuaire_view',
      'partners_view',
      'messages_send',
      'profile_edit',
      'commissions_create',
      'chat_use',
      'chat_create_channel',
      'unesco_view',
      'unesco_permits_submit',
    ]),
  },
  {
    id: 'member',
    name: 'Membre',
    description: 'Accès standard à l\u2019espace adhérent.',
    isSystem: true,
    isAllAccess: false,
    permissions: keysFor([
      'dashboard_view',
      'commissions_view',
      'library_view',
      'annuaire_view',
      'partners_view',
      'messages_send',
      'profile_edit',
      'chat_use',
      'chat_create_channel',
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
