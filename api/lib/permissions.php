<?php
declare(strict_types=1);

/**
 * Permission helpers — server-side mirror of src/lib/permissions.ts.
 * The source of truth is the `roles` table; fallbacks mirror DEFAULT_ROLES.
 */

const ALL_PERMISSION_KEYS = [
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
    'accounts_create',
    'roles_manage',
    'config_manage',
    'users_editRole',
    'users_editStatus',
];

function permissions_all_true(): array
{
    $out = [];
    foreach (ALL_PERMISSION_KEYS as $k) $out[$k] = true;
    return $out;
}

function permissions_keys_for(array $keys): array
{
    $out = [];
    foreach (ALL_PERMISSION_KEYS as $k) $out[$k] = in_array($k, $keys, true);
    return $out;
}

function default_roles(): array
{
    return [
        [
            'id' => 'super-admin',
            'name' => 'Super Administrateur',
            'description' => 'Accès total à toutes les fonctionnalités. Ne peut pas être modifié.',
            'isSystem' => true,
            'isAllAccess' => true,
            'permissions' => permissions_all_true(),
        ],
        [
            'id' => 'admin',
            'name' => 'Administrateur',
            'description' => 'Gestion complète du site et des adhésions.',
            'isSystem' => true,
            'isAllAccess' => false,
            'permissions' => permissions_keys_for([
                'dashboard_view', 'commissions_view', 'library_view', 'annuaire_view',
                'partners_view', 'messages_send', 'profile_edit', 'commissions_create',
                'members_manage', 'partners_manage', 'library_manage', 'news_manage',
                'profileRequests_manage', 'messages_inbox',
            ]),
        ],
        [
            'id' => 'representative',
            'name' => 'Représentant',
            'description' => 'Membre avec droit de déposer les avis de commissions techniques.',
            'isSystem' => true,
            'isAllAccess' => false,
            'permissions' => permissions_keys_for([
                'dashboard_view', 'commissions_view', 'library_view', 'annuaire_view',
                'partners_view', 'messages_send', 'profile_edit', 'commissions_create',
            ]),
        ],
        [
            'id' => 'member',
            'name' => 'Membre',
            'description' => "Accès standard à l'espace adhérent.",
            'isSystem' => true,
            'isAllAccess' => false,
            'permissions' => permissions_keys_for([
                'dashboard_view', 'commissions_view', 'library_view', 'annuaire_view',
                'partners_view', 'messages_send', 'profile_edit',
            ]),
        ],
    ];
}

function role_view(array $row): array
{
    return [
        'id'          => $row['id'],
        'name'        => $row['name'],
        'description' => $row['description'] ?? null,
        'permissions' => is_string($row['permissions'])
            ? (json_decode($row['permissions'], true) ?: new stdClass())
            : $row['permissions'],
        'isSystem'    => (bool)($row['is_system'] ?? 0),
        'isAllAccess' => (bool)($row['is_all_access'] ?? 0),
        'createdAt'   => iso_datetime($row['created_at'] ?? null),
    ];
}

function load_role_for_user(array $user): ?array
{
    $roleId = $user['role'] ?? 'member';
    $stmt = db()->prepare('SELECT * FROM roles WHERE id = ? LIMIT 1');
    $stmt->execute([$roleId]);
    $row = $stmt->fetch();
    if ($row) return role_view($row);

    // Fallback: built-in default
    foreach (default_roles() as $def) {
        if ($def['id'] === $roleId) return $def;
    }
    return null;
}

function user_has_permission(array $user, string $key): bool
{
    $role = load_role_for_user($user);
    if (!$role) return false;
    if (!empty($role['isAllAccess'])) return true;
    return isset($role['permissions'][$key]) && $role['permissions'][$key] === true;
}

function is_super_admin(array $user): bool
{
    if (($user['role'] ?? '') === 'super-admin') return true;
    $role = load_role_for_user($user);
    return $role !== null && !empty($role['isAllAccess']);
}

function is_admin(array $user): bool
{
    if (is_super_admin($user)) return true;
    return ($user['role'] ?? '') === 'admin';
}

function is_representative(array $user): bool
{
    if (is_admin($user)) return true;
    return ($user['role'] ?? '') === 'representative';
}

function require_permission(array $user, string $key): void
{
    if (is_super_admin($user)) return;
    if (is_admin($user)) return;
    if (!user_has_permission($user, $key)) {
        json_error('forbidden', 'Permission requise : ' . $key, 403);
    }
}

function require_admin(array $user): void
{
    if (!is_admin($user)) {
        json_error('forbidden', 'Droits administrateur requis.', 403);
    }
}

function require_super_admin(array $user): void
{
    if (!is_super_admin($user)) {
        json_error('forbidden', 'Droits super-administrateur requis.', 403);
    }
}

/**
 * Seed built-in roles on first boot. INSERT IGNORE so that any later
 * permission customization by a super-admin (via the Rôles & Permissions
 * matrix) is NOT clobbered on subsequent API calls.
 *
 * The super-admin role is the only exception: we force it to keep
 * isAllAccess=1 and a full permissions map, because that role is a
 * privileged escape hatch that should never be locked down.
 */
function seed_default_roles_if_missing(): void
{
    $pdo = db();
    $insert = $pdo->prepare(
        'INSERT IGNORE INTO roles (id, name, description, permissions, is_system, is_all_access, created_at)
         VALUES (:id, :name, :description, :permissions, 1, :is_all_access, NOW())'
    );
    foreach (default_roles() as $r) {
        $insert->execute([
            ':id' => $r['id'],
            ':name' => $r['name'],
            ':description' => $r['description'],
            ':permissions' => json_encode($r['permissions'], JSON_UNESCAPED_UNICODE),
            ':is_all_access' => $r['isAllAccess'] ? 1 : 0,
        ]);
    }

    // Safety net: the super-admin role must always be all-access.
    $pdo->prepare(
        'UPDATE roles
            SET is_all_access = 1,
                is_system = 1,
                permissions = :permissions
          WHERE id = "super-admin"'
    )->execute([
        ':permissions' => json_encode(permissions_all_true(), JSON_UNESCAPED_UNICODE),
    ]);
}
