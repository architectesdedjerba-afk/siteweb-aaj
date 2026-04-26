<?php
declare(strict_types=1);

/**
 * Generic collection endpoints — one entry per Firestore collection, with
 * permission checks and field mappings. Mirrors firestore.rules.
 */

function handle_collections(string $method, array $rest): void
{
    $name = $rest[0] ?? '';
    $id = $rest[1] ?? null;
    $action = $rest[2] ?? null;
    if ($name === '') json_error('bad_path', 'Collection manquante.', 400);

    $spec = collection_spec($name);
    if (!$spec) json_error('unknown_collection', "Collection inconnue : $name", 404);

    // Sub-actions on a specific document (e.g. POST /collections/contact_messages/<id>/reply)
    if ($id !== null && $action !== null) {
        if ($name === 'contact_messages' && $action === 'reply' && $method === 'POST') {
            require_once __DIR__ . '/../lib/mail.php';
            contact_messages_reply($id);
            return;
        }
        json_error('not_found', 'Action inconnue.', 404);
    }

    if ($method === 'GET' && $id === null) { list_collection($spec); return; }
    if ($method === 'GET' && $id !== null) { get_one($spec, $id); return; }
    if ($method === 'POST' && $id === null) { create_one($spec); return; }
    if ($method === 'PUT' && $id !== null) { update_one($spec, $id); return; }
    if ($method === 'DELETE' && $id !== null) { delete_one($spec, $id); return; }
    json_error('method_not_allowed', 'Méthode non autorisée.', 405);
}

/** -----------------------------------------------------------------
 * Collection registry
 * Each entry declares:
 *   table      — MySQL table
 *   toRow      — map an incoming JSON payload to DB columns
 *   toView     — map a DB row back to the JSON shape the frontend expects
 *   orderBy    — default ORDER BY column + direction
 *   canList    — closure(user?) bool
 *   canGet     — closure(user?, row) bool
 *   canCreate  — closure(user?, payload) bool / throws
 *   canUpdate  — closure(user, row, patch) bool
 *   canDelete  — closure(user, row) bool
 *   beforeInsert — (optional) closure to augment payload before insert
 * ----------------------------------------------------------------- */

function collection_spec(string $name): ?array
{
    static $cache = null;
    if ($cache === null) $cache = build_specs();
    return $cache[$name] ?? null;
}

function build_specs(): array
{
    $specs = [];

    // ---------------- users ----------------
    $specs['users'] = [
        'table' => 'users',
        'idColumn' => 'uid',
        'orderBy' => ['display_name', 'ASC'],
        'toView' => fn(array $r) => user_profile_view($r),
        'toRow'  => function (array $p) {
            $row = [];
            if (array_key_exists('email', $p))         $row['email'] = strtolower(trim((string)$p['email']));
            if (array_key_exists('displayName', $p))   $row['display_name'] = (string)$p['displayName'];
            if (array_key_exists('firstName', $p))     $row['first_name'] = $p['firstName'];
            if (array_key_exists('lastName', $p))      $row['last_name'] = $p['lastName'];
            if (array_key_exists('role', $p))          $row['role'] = (string)$p['role'];
            if (array_key_exists('status', $p))        $row['status'] = (string)$p['status'];
            if (array_key_exists('category', $p))          $row['category'] = $p['category'];
            if (array_key_exists('memberType', $p))        $row['member_type'] = $p['memberType'];
            if (array_key_exists('memberTypeLetter', $p))  $row['member_type_letter'] = $p['memberTypeLetter'] === null ? null : strtoupper(substr((string)$p['memberTypeLetter'], 0, 1));
            if (array_key_exists('birthDate', $p))         $row['birth_date'] = $p['birthDate'];
            if (array_key_exists('licenseNumber', $p))     $row['license_number'] = $p['licenseNumber'];
            if (array_key_exists('mobile', $p))            $row['mobile'] = $p['mobile'];
            if (array_key_exists('address', $p))           $row['address'] = $p['address'];
            if (array_key_exists('photoBase64', $p))       $row['photo_url'] = $p['photoBase64'];
            if (array_key_exists('cotisations', $p))       $row['cotisations'] = $p['cotisations'] === null ? null : json_encode($p['cotisations'], JSON_UNESCAPED_UNICODE);
            if (array_key_exists('archivedAt', $p)) {
                // Self-healing : crée la colonne `users.archived_at` si elle
                // manque encore (migration automatique au premier archivage).
                ensure_column('users', 'archived_at', 'DATETIME NULL');
                if ($p['archivedAt'] === null || $p['archivedAt'] === '') {
                    $row['archived_at'] = null;
                } else {
                    $ts = strtotime((string)$p['archivedAt']);
                    $row['archived_at'] = $ts ? gmdate('Y-m-d H:i:s', $ts) : null;
                }
            }
            return $row;
        },
        'canList' => fn(?array $u) => $u && (is_admin($u) || user_has_permission($u, 'members_manage') || user_has_permission($u, 'roles_manage') || user_has_permission($u, 'users_editRole') || user_has_permission($u, 'users_editStatus')),
        'canGet'  => fn(?array $u, array $r) => $u && ($u['uid'] === $r['uid'] || is_admin($u) || user_has_permission($u, 'members_manage') || user_has_permission($u, 'roles_manage')),
        'canCreate' => function (?array $u, array $p): bool {
            // Self-create (signup) is forced to role=member/status=pending
            if ($u && isset($p['uid']) && $u['uid'] === $p['uid']) {
                return (($p['role'] ?? 'member') === 'member') && (($p['status'] ?? 'pending') === 'pending');
            }
            return $u && (is_admin($u) || user_has_permission($u, 'members_manage') || user_has_permission($u, 'accounts_create'));
        },
        'canUpdate' => function (array $u, array $r, array $patch): bool {
            if (is_admin($u)) return true;
            if (user_has_permission($u, 'members_manage')) return true;
            if (user_has_permission($u, 'users_editRole') || user_has_permission($u, 'users_editStatus')) return true;
            // Owner update — may not change role/status
            if ($u['uid'] === $r['uid']) {
                if (isset($patch['role']) && $patch['role'] !== $r['role']) return false;
                if (isset($patch['status']) && $patch['status'] !== $r['status']) return false;
                return true;
            }
            return false;
        },
        'canDelete' => fn(array $u, array $r) => is_admin($u) || user_has_permission($u, 'members_manage'),
    ];

    // ---------------- roles ----------------
    $specs['roles'] = [
        'table' => 'roles',
        'idColumn' => 'id',
        'orderBy' => ['name', 'ASC'],
        'toView' => fn(array $r) => role_view($r),
        'toRow'  => function (array $p) {
            $row = [];
            if (array_key_exists('name', $p))        $row['name'] = (string)$p['name'];
            if (array_key_exists('description', $p)) $row['description'] = $p['description'];
            if (array_key_exists('permissions', $p)) $row['permissions'] = json_encode($p['permissions'] ?: new stdClass(), JSON_UNESCAPED_UNICODE);
            if (array_key_exists('isSystem', $p))    $row['is_system'] = $p['isSystem'] ? 1 : 0;
            if (array_key_exists('isAllAccess', $p)) $row['is_all_access'] = $p['isAllAccess'] ? 1 : 0;
            return $row;
        },
        'canList' => fn(?array $u) => (bool)$u,
        'canGet'  => fn(?array $u, array $r) => (bool)$u,
        'canCreate' => fn(?array $u, array $p) => $u && is_super_admin($u),
        'canUpdate' => fn(array $u, array $r, array $patch) => is_super_admin($u),
        'canDelete' => fn(array $u, array $r) => is_super_admin($u) && !(int)($r['is_system'] ?? 0),
    ];

    // ---------------- news ----------------
    $specs['news'] = [
        'table' => 'news',
        'idColumn' => 'id',
        'orderBy' => ['created_at', 'DESC'],
        'toView' => fn(array $r) => [
            'id' => $r['id'],
            'title' => $r['title'], 'content' => $r['content'],
            'date' => $r['date'], 'type' => $r['type'], 'category' => $r['category'],
            'imageUrl' => $r['image_url'], 'fileBase64' => $r['file_url'], 'fileName' => $r['file_name'],
            'createdAt' => iso_datetime($r['created_at']),
        ],
        'toRow' => function (array $p) {
            $row = [];
            foreach (['title','content','date','type','category'] as $k) {
                if (array_key_exists($k, $p)) $row[$k] = $p[$k];
            }
            if (array_key_exists('imageUrl', $p))   $row['image_url'] = $p['imageUrl'];
            if (array_key_exists('fileBase64', $p)) $row['file_url'] = $p['fileBase64'];
            if (array_key_exists('fileName', $p))   $row['file_name'] = $p['fileName'];
            return $row;
        },
        'afterInsert' => function (array $row, array $view, array $payload): void {
            push_notifications_to_users(resolve_notification_scope('active'), [
                'type'     => 'news',
                'title'    => 'Actualité publiée : ' . (string)($view['title'] ?? ''),
                'body'     => isset($view['type']) ? (string)$view['type'] : null,
                'link'     => '/evennements',
                'icon'     => 'newspaper',
                'priority' => 'normal',
                'data'     => ['newsId' => $view['id'] ?? null],
            ]);
        },
        'canList' => fn(?array $u) => true,
        'canGet'  => fn(?array $u, array $r) => true,
        'canCreate' => fn(?array $u, array $p) => $u && (is_admin($u) || user_has_permission($u, 'news_manage')),
        'canUpdate' => fn(array $u, array $r, array $patch) => is_admin($u) || user_has_permission($u, 'news_manage'),
        'canDelete' => fn(array $u, array $r) => is_admin($u) || user_has_permission($u, 'news_manage'),
    ];

    // ---------------- partners ----------------
    $specs['partners'] = [
        'table' => 'partners',
        'idColumn' => 'id',
        'orderBy' => ['name', 'ASC'],
        'toView' => fn(array $r) => [
            'id' => $r['id'],
            'name' => $r['name'],
            'logoUrl' => $r['logo_url'],
            'category' => $r['category'],
            'level' => $r['level'],
            'joined' => $r['joined'],
            'isVisible' => (bool)$r['is_visible'],
            'website' => $r['website'],
            'createdAt' => iso_datetime($r['created_at']),
        ],
        'toRow' => function (array $p) {
            $row = [];
            if (array_key_exists('name', $p))      $row['name'] = $p['name'];
            if (array_key_exists('logoUrl', $p))   $row['logo_url'] = $p['logoUrl'];
            if (array_key_exists('category', $p))  $row['category'] = $p['category'];
            if (array_key_exists('level', $p))     $row['level'] = $p['level'];
            if (array_key_exists('joined', $p))    $row['joined'] = $p['joined'];
            if (array_key_exists('isVisible', $p)) $row['is_visible'] = $p['isVisible'] ? 1 : 0;
            if (array_key_exists('website', $p))   $row['website'] = $p['website'];
            return $row;
        },
        'canList' => fn(?array $u) => true,
        'canGet'  => fn(?array $u, array $r) => true,
        'canCreate' => fn(?array $u, array $p) => $u && (is_admin($u) || user_has_permission($u, 'partners_manage')),
        'canUpdate' => fn(array $u, array $r, array $patch) => is_admin($u) || user_has_permission($u, 'partners_manage'),
        'canDelete' => fn(array $u, array $r) => is_admin($u) || user_has_permission($u, 'partners_manage'),
    ];

    // ---------------- commission_pvs ----------------
    ensure_column('commission_pvs', 'files', 'JSON NULL');
    ensure_column('commission_pvs', 'type', 'VARCHAR(100) NULL');
    $specs['commission_pvs'] = [
        'table' => 'commission_pvs',
        'idColumn' => 'id',
        'orderBy' => ['created_at', 'DESC'],
        'toView' => function (array $r) {
            $files = [];
            if (!empty($r['files'])) {
                $decoded = json_decode((string)$r['files'], true);
                if (is_array($decoded)) $files = array_values(array_filter($decoded, 'is_array'));
            }
            return [
                'id' => $r['id'],
                'town' => $r['town'],
                'date' => $r['date'],
                'count' => (int)$r['count'],
                'type' => $r['type'] ?? '',
                'files' => $files,
                // Backward-compat for rows created before the multi-file migration.
                'fileBase64' => $r['file_url'] ?? '',
                'fileName' => $r['file_name'] ?? '',
                'createdAt' => iso_datetime($r['created_at']),
            ];
        },
        'toRow' => function (array $p) {
            $row = [];
            foreach (['town','date'] as $k) if (array_key_exists($k, $p)) $row[$k] = $p[$k];
            if (array_key_exists('count', $p))      $row['count'] = (int)$p['count'];
            if (array_key_exists('type', $p))       $row['type'] = $p['type'] === null ? null : (string)$p['type'];
            if (array_key_exists('fileBase64', $p)) $row['file_url'] = (string)$p['fileBase64'];
            if (array_key_exists('fileName', $p))   $row['file_name'] = (string)$p['fileName'];
            if (array_key_exists('files', $p)) {
                $row['files'] = is_array($p['files'])
                    ? json_encode(array_values($p['files']), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
                    : null;
            }
            return $row;
        },
        'afterInsert' => function (array $row, array $view, array $payload): void {
            $town = (string)($view['town'] ?? '');
            $type = (string)($view['type'] ?? '');
            $body = trim($town . ($type !== '' ? ' — ' . $type : ''));
            push_notifications_to_users(resolve_notification_scope('active'), [
                'type'     => 'commission_pv',
                'title'    => 'Nouvel avis de commission',
                'body'     => $body !== '' ? $body : null,
                'link'     => '/espace-adherents',
                'icon'     => 'clipboard-list',
                'priority' => 'normal',
                'data'     => ['pvId' => $view['id'] ?? null],
            ]);
        },
        'canList' => fn(?array $u) => $u && (is_admin($u) || ($u['status'] === 'active')),
        'canGet'  => fn(?array $u, array $r) => $u && (is_admin($u) || ($u['status'] === 'active')),
        'canCreate' => fn(?array $u, array $p) => $u && (is_admin($u) || user_has_permission($u, 'commissions_create') || (is_representative($u) && $u['status'] === 'active')),
        'canUpdate' => fn(array $u, array $r, array $patch) => is_admin($u) || user_has_permission($u, 'commissions_create'),
        'canDelete' => fn(array $u, array $r) => is_admin($u) || user_has_permission($u, 'commissions_create'),
    ];

    // ---------------- contact_messages ----------------
    $specs['contact_messages'] = [
        'table' => 'contact_messages',
        'idColumn' => 'id',
        'orderBy' => ['created_at', 'DESC'],
        'toView' => fn(array $r) => [
            'id' => $r['id'],
            'userId' => $r['user_id'], 'userEmail' => $r['user_email'],
            'userName' => $r['user_name'] ?? null,
            'subject' => $r['subject'], 'message' => $r['message'],
            'fileBase64' => $r['file_url'], 'fileName' => $r['file_name'],
            'status' => $r['status'] ?? 'unread',
            'replied' => isset($r['replied']) ? (bool)$r['replied'] : false,
            'repliedAt' => isset($r['replied_at']) ? iso_datetime($r['replied_at']) : null,
            'repliedBy' => $r['replied_by'] ?? null,
            'replyMessage' => $r['reply_message'] ?? null,
            'createdAt' => iso_datetime($r['created_at']),
        ],
        'toRow' => function (array $p) {
            $row = [];
            if (array_key_exists('userId', $p))     $row['user_id'] = $p['userId'];
            if (array_key_exists('userEmail', $p))  $row['user_email'] = $p['userEmail'];
            if (array_key_exists('userName', $p))   $row['user_name'] = $p['userName'];
            if (array_key_exists('subject', $p))    $row['subject'] = $p['subject'];
            if (array_key_exists('message', $p))    $row['message'] = $p['message'];
            if (array_key_exists('fileBase64', $p)) $row['file_url'] = $p['fileBase64'];
            if (array_key_exists('fileName', $p))   $row['file_name'] = $p['fileName'];
            if (array_key_exists('status', $p)) {
                $s = is_string($p['status']) ? $p['status'] : 'unread';
                $row['status'] = in_array($s, ['unread', 'read', 'archived'], true) ? $s : 'unread';
            }
            if (array_key_exists('replied', $p))     $row['replied'] = $p['replied'] ? 1 : 0;
            if (array_key_exists('repliedAt', $p))   $row['replied_at'] = $p['repliedAt'];
            if (array_key_exists('repliedBy', $p))   $row['replied_by'] = $p['repliedBy'];
            if (array_key_exists('replyMessage', $p)) $row['reply_message'] = $p['replyMessage'];
            return $row;
        },
        'listFilter' => function (array $u, array $qs): array {
            // Non-admins see only their own messages.
            if (is_admin($u) || user_has_permission($u, 'messages_inbox')) return [];
            return [['user_id', '=', $u['uid']]];
        },
        'afterInsert' => function (array $row, array $view, array $payload): void {
            $subject = (string)($view['subject'] ?? '');
            $email   = (string)($view['userEmail'] ?? '');
            push_notifications_to_users(admin_recipient_uids(), [
                'type'       => 'contact_message',
                'title'      => 'Nouveau message',
                'body'       => trim(($email !== '' ? $email . ' — ' : '') . $subject),
                'link'       => '/espace-adherents',
                'icon'       => 'mail',
                'priority'   => 'normal',
                'data'       => ['messageId' => $view['id'] ?? null],
                'senderUid'  => $view['userId']   ?? null,
                'senderName' => $view['userEmail'] ?? null,
            ]);
        },
        'canList' => fn(?array $u) => (bool)$u,
        'canGet'  => fn(?array $u, array $r) => $u && ($r['user_id'] === $u['uid'] || is_admin($u) || user_has_permission($u, 'messages_inbox')),
        'canCreate' => fn(?array $u, array $p) => $u && ($u['status'] === 'active') && (($p['userId'] ?? null) === $u['uid']),
        'canUpdate' => fn(array $u, array $r, array $patch) => is_admin($u) || user_has_permission($u, 'messages_inbox'),
        'canDelete' => fn(array $u, array $r) => is_admin($u) || user_has_permission($u, 'messages_inbox'),
    ];

    // ---------------- documents (library) ----------------
    $specs['documents'] = [
        'table' => 'documents',
        'idColumn' => 'id',
        'orderBy' => ['created_at', 'DESC'],
        'toView' => fn(array $r) => [
            'id' => $r['id'],
            'name' => $r['name'],
            'url' => $r['url'],
            'fileBase64' => $r['url'], // compat alias for legacy frontend code
            'category' => $r['category'],
            'subCategory' => $r['sub_category'],
            'fileType' => $r['file_type'],
            'createdAt' => iso_datetime($r['created_at']),
        ],
        'toRow' => function (array $p) {
            $row = [];
            if (array_key_exists('name', $p))        $row['name'] = $p['name'];
            if (array_key_exists('url', $p))         $row['url'] = $p['url'];
            if (array_key_exists('fileBase64', $p))  $row['url'] = $p['fileBase64'];
            if (array_key_exists('category', $p))    $row['category'] = $p['category'];
            if (array_key_exists('subCategory', $p)) $row['sub_category'] = $p['subCategory'];
            if (array_key_exists('fileType', $p))    $row['file_type'] = $p['fileType'];
            return $row;
        },
        'canList' => fn(?array $u) => $u && $u['status'] === 'active',
        'canGet'  => fn(?array $u, array $r) => $u && $u['status'] === 'active',
        'canCreate' => fn(?array $u, array $p) => $u && (is_admin($u) || user_has_permission($u, 'library_manage')),
        'canUpdate' => fn(array $u, array $r, array $patch) => is_admin($u) || user_has_permission($u, 'library_manage'),
        'canDelete' => fn(array $u, array $r) => is_admin($u) || user_has_permission($u, 'library_manage'),
    ];

    // ---------------- profile_updates ----------------
    $specs['profile_updates'] = [
        'table' => 'profile_updates',
        'idColumn' => 'id',
        'orderBy' => ['created_at', 'DESC'],
        'toView' => fn(array $r) => [
            'id' => $r['id'],
            'uid' => $r['uid'], 'userEmail' => $r['user_email'],
            'firstName' => $r['first_name'], 'lastName' => $r['last_name'],
            'mobile' => $r['mobile'], 'category' => $r['category'],
            'licenseNumber' => $r['license_number'], 'address' => $r['address'],
            'status' => $r['status'],
            'createdAt' => iso_datetime($r['created_at']),
        ],
        'toRow' => function (array $p) {
            $row = [];
            if (array_key_exists('uid', $p))           $row['uid'] = $p['uid'];
            if (array_key_exists('userEmail', $p))     $row['user_email'] = $p['userEmail'];
            if (array_key_exists('firstName', $p))     $row['first_name'] = $p['firstName'];
            if (array_key_exists('lastName', $p))      $row['last_name'] = $p['lastName'];
            if (array_key_exists('mobile', $p))        $row['mobile'] = $p['mobile'];
            if (array_key_exists('category', $p))      $row['category'] = $p['category'];
            if (array_key_exists('licenseNumber', $p)) $row['license_number'] = $p['licenseNumber'];
            if (array_key_exists('address', $p))       $row['address'] = $p['address'];
            if (array_key_exists('status', $p))        $row['status'] = $p['status'];
            return $row;
        },
        'listFilter' => function (array $u, array $qs): array {
            if (is_admin($u) || user_has_permission($u, 'profileRequests_manage')) return [];
            return [['uid', '=', $u['uid']]];
        },
        'afterInsert' => function (array $row, array $view, array $payload): void {
            $name = trim(($view['firstName'] ?? '') . ' ' . ($view['lastName'] ?? '')) ?: (string)($view['userEmail'] ?? 'un membre');
            push_notifications_to_users(admin_recipient_uids(), [
                'type'     => 'profile_update_request',
                'title'    => 'Demande de mise à jour de profil',
                'body'     => $name,
                'link'     => '/espace-adherents',
                'icon'     => 'user-cog',
                'priority' => 'normal',
                'data'     => ['requestId' => $view['id'] ?? null],
            ]);
        },
        'canList' => fn(?array $u) => (bool)$u,
        'canGet'  => fn(?array $u, array $r) => $u && ($r['uid'] === $u['uid'] || is_admin($u) || user_has_permission($u, 'profileRequests_manage')),
        'canCreate' => fn(?array $u, array $p) => $u && $u['status'] === 'active' && (($p['uid'] ?? null) === $u['uid']) && (($p['status'] ?? 'pending') === 'pending'),
        'canUpdate' => fn(array $u, array $r, array $patch) => is_admin($u) || user_has_permission($u, 'profileRequests_manage'),
        'canDelete' => fn(array $u, array $r) => is_admin($u) || user_has_permission($u, 'profileRequests_manage'),
    ];

    // ---------------- event_registrations ----------------
    $specs['event_registrations'] = [
        'table' => 'event_registrations',
        'idColumn' => 'id',
        'orderBy' => ['created_at', 'DESC'],
        'toView' => fn(array $r) => [
            'id' => $r['id'],
            'fullName' => $r['full_name'], 'email' => $r['email'],
            'eventTitle' => $r['event_title'], 'message' => $r['message'],
            'createdAt' => iso_datetime($r['created_at']),
        ],
        'toRow' => function (array $p) {
            $row = [];
            if (array_key_exists('fullName', $p))   $row['full_name'] = $p['fullName'];
            if (array_key_exists('email', $p))      $row['email'] = $p['email'];
            if (array_key_exists('eventTitle', $p)) $row['event_title'] = $p['eventTitle'];
            if (array_key_exists('message', $p))    $row['message'] = $p['message'];
            return $row;
        },
        'validateCreate' => function (array $p): void {
            foreach (['fullName','email','eventTitle'] as $k) {
                if (empty($p[$k]) || !is_string($p[$k])) json_error('invalid_input', "Champ requis : $k", 400);
            }
            if (!filter_var($p['email'], FILTER_VALIDATE_EMAIL)) json_error('invalid_email', 'Email invalide.', 400);
        },
        'canList' => fn(?array $u) => $u && (is_admin($u) || user_has_permission($u, 'members_manage')),
        'canGet'  => fn(?array $u, array $r) => $u && (is_admin($u) || user_has_permission($u, 'members_manage')),
        'canCreate' => fn(?array $u, array $p) => true, // public form
        'canUpdate' => fn(array $u, array $r, array $patch) => is_admin($u) || user_has_permission($u, 'members_manage'),
        'canDelete' => fn(array $u, array $r) => is_admin($u) || user_has_permission($u, 'members_manage'),
    ];

    // ---------------- membership_applications ----------------
    $specs['membership_applications'] = [
        'table' => 'membership_applications',
        'idColumn' => 'id',
        'orderBy' => ['created_at', 'DESC'],
        'toView' => fn(array $r) => [
            'id' => $r['id'],
            'fullName' => $r['full_name'],
            'firstName' => $r['first_name'] ?? null,
            'lastName' => $r['last_name'] ?? null,
            'email' => $r['email'], 'phone' => $r['phone'],
            'category' => $r['category'], 'matricule' => $r['matricule'], 'city' => $r['city'],
            'birthDate' => $r['birth_date'] ?? null,
            'memberTypeLetter' => $r['member_type_letter'] ?? null,
            'cvFileName' => $r['cv_file_name'],
            'status' => $r['status'],
            'createdAt' => iso_datetime($r['created_at']),
        ],
        'toRow' => function (array $p) {
            $row = [];
            if (array_key_exists('fullName', $p))         $row['full_name'] = $p['fullName'];
            if (array_key_exists('firstName', $p))        $row['first_name'] = $p['firstName'];
            if (array_key_exists('lastName', $p))         $row['last_name'] = $p['lastName'];
            if (array_key_exists('email', $p))            $row['email'] = $p['email'];
            if (array_key_exists('phone', $p))            $row['phone'] = $p['phone'];
            if (array_key_exists('category', $p))         $row['category'] = $p['category'];
            if (array_key_exists('matricule', $p))        $row['matricule'] = $p['matricule'];
            if (array_key_exists('city', $p))             $row['city'] = $p['city'];
            if (array_key_exists('birthDate', $p))        $row['birth_date'] = $p['birthDate'];
            if (array_key_exists('memberTypeLetter', $p)) $row['member_type_letter'] = $p['memberTypeLetter'];
            if (array_key_exists('cvFileName', $p))       $row['cv_file_name'] = $p['cvFileName'];
            if (array_key_exists('status', $p))           $row['status'] = $p['status'];
            return $row;
        },
        'validateCreate' => function (array $p): void {
            foreach (['firstName','lastName','email','phone','category','city','birthDate','memberTypeLetter'] as $k) {
                if (empty($p[$k]) || !is_string($p[$k])) json_error('invalid_input', "Champ requis : $k", 400);
            }
            if (!filter_var($p['email'], FILTER_VALIDATE_EMAIL)) json_error('invalid_email', 'Email invalide.', 400);
            if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $p['birthDate'])) json_error('invalid_birthdate', 'Date de naissance invalide.', 400);
            if (strlen($p['memberTypeLetter']) !== 1) json_error('invalid_member_type', 'Type de membre invalide.', 400);
        },
        'beforeInsert' => function (array $p): array {
            $p['status'] = $p['status'] ?? 'pending';
            // Derive fullName server-side so the admin list keeps working with a single display field.
            if (empty($p['fullName']) && (!empty($p['firstName']) || !empty($p['lastName']))) {
                $p['fullName'] = trim(($p['firstName'] ?? '') . ' ' . ($p['lastName'] ?? ''));
            }
            return $p;
        },
        'afterInsert' => function (array $row, array $view, array $payload): void {
            notify_membership_application($view);
        },
        'canList' => fn(?array $u) => $u && (is_admin($u) || user_has_permission($u, 'members_manage')),
        'canGet'  => fn(?array $u, array $r) => $u && (is_admin($u) || user_has_permission($u, 'members_manage')),
        'canCreate' => fn(?array $u, array $p) => true,
        'canUpdate' => fn(array $u, array $r, array $patch) => is_admin($u) || user_has_permission($u, 'members_manage'),
        'canDelete' => fn(array $u, array $r) => is_admin($u) || user_has_permission($u, 'members_manage'),
    ];

    // ---------------- partner_applications ----------------
    $specs['partner_applications'] = [
        'table' => 'partner_applications',
        'idColumn' => 'id',
        'orderBy' => ['created_at', 'DESC'],
        'toView' => fn(array $r) => [
            'id' => $r['id'],
            'contactName' => $r['contact_name'], 'email' => $r['email'], 'phone' => $r['phone'],
            'companyName' => $r['company_name'], 'activity' => $r['activity'],
            'sponsorshipType' => $r['sponsorship_type'], 'message' => $r['message'],
            'status' => $r['status'],
            'createdAt' => iso_datetime($r['created_at']),
        ],
        'toRow' => function (array $p) {
            $row = [];
            if (array_key_exists('contactName', $p))     $row['contact_name'] = $p['contactName'];
            if (array_key_exists('email', $p))           $row['email'] = $p['email'];
            if (array_key_exists('phone', $p))           $row['phone'] = $p['phone'];
            if (array_key_exists('companyName', $p))     $row['company_name'] = $p['companyName'];
            if (array_key_exists('activity', $p))        $row['activity'] = $p['activity'];
            if (array_key_exists('sponsorshipType', $p)) $row['sponsorship_type'] = $p['sponsorshipType'];
            if (array_key_exists('message', $p))         $row['message'] = $p['message'];
            if (array_key_exists('status', $p))          $row['status'] = $p['status'];
            return $row;
        },
        'validateCreate' => function (array $p): void {
            foreach (['contactName','email','phone','companyName','activity','sponsorshipType'] as $k) {
                if (empty($p[$k]) || !is_string($p[$k])) json_error('invalid_input', "Champ requis : $k", 400);
            }
            if (!filter_var($p['email'], FILTER_VALIDATE_EMAIL)) json_error('invalid_email', 'Email invalide.', 400);
        },
        'beforeInsert' => function (array $p): array {
            $p['status'] = $p['status'] ?? 'pending';
            return $p;
        },
        'afterInsert' => function (array $row, array $view, array $payload): void {
            notify_partner_application($view);
        },
        'canList' => fn(?array $u) => $u && (is_admin($u) || user_has_permission($u, 'partners_manage')),
        'canGet'  => fn(?array $u, array $r) => $u && (is_admin($u) || user_has_permission($u, 'partners_manage')),
        'canCreate' => fn(?array $u, array $p) => true,
        'canUpdate' => fn(array $u, array $r, array $patch) => is_admin($u) || user_has_permission($u, 'partners_manage'),
        'canDelete' => fn(array $u, array $r) => is_admin($u) || user_has_permission($u, 'partners_manage'),
    ];

    // ---------------- config ----------------
    // Admin-editable lookup lists used by the member-creation form:
    //   config/villes       → { list: string[] }
    //   config/memberTypes  → { list: { letter, label }[] }
    // Each document id is a well-known key; the JSON payload is spread
    // onto the view so the frontend can read item.list directly.
    $specs['config'] = [
        'table' => 'config',
        'idColumn' => 'id',
        'orderBy' => ['id', 'ASC'],
        'toView' => function (array $r) {
            $value = is_string($r['value']) ? (json_decode($r['value'], true) ?: []) : (array)$r['value'];
            return array_merge(
                ['id' => $r['id'], 'updatedAt' => iso_datetime($r['updated_at'] ?? null)],
                $value
            );
        },
        'toRow' => function (array $p) {
            // Everything except reserved meta fields is stored as JSON in `value`.
            $value = $p;
            unset($value['id'], $value['updatedAt'], $value['createdAt']);
            return ['value' => json_encode($value, JSON_UNESCAPED_UNICODE)];
        },
        'canList' => fn(?array $u) => (bool)$u,
        'canGet'  => fn(?array $u, array $r) => (bool)$u,
        'canCreate' => fn(?array $u, array $p) => $u && (is_super_admin($u) || user_has_permission($u, 'config_manage')),
        'canUpdate' => fn(array $u, array $r, array $patch) => is_super_admin($u) || user_has_permission($u, 'config_manage'),
        'canDelete' => fn(array $u, array $r) => is_super_admin($u) || user_has_permission($u, 'config_manage'),
    ];


    // ---------------- notifications ----------------
    // Une ligne par destinataire. Lecture/écriture restreinte au
    // destinataire (sauf admin pour la création unique). Le broadcast
    // multi-destinataires passe par /api/notifications/broadcast.
    $specs['notifications'] = [
        'table' => 'notifications',
        'idColumn' => 'id',
        'orderBy' => ['created_at', 'DESC'],
        'toView' => fn(array $r) => notification_view($r),
        'toRow'  => function (array $p) {
            $row = [];
            if (array_key_exists('recipientUid', $p)) $row['recipient_uid'] = (string)$p['recipientUid'];
            if (array_key_exists('type', $p))         $row['type'] = mb_substr((string)$p['type'], 0, 50);
            if (array_key_exists('title', $p))        $row['title'] = mb_substr((string)$p['title'], 0, 300);
            if (array_key_exists('body', $p))         $row['body'] = $p['body'] === null ? null : (string)$p['body'];
            if (array_key_exists('link', $p))         $row['link'] = $p['link'] === null ? null : mb_substr((string)$p['link'], 0, 500);
            if (array_key_exists('icon', $p))         $row['icon'] = $p['icon'] === null ? null : mb_substr((string)$p['icon'], 0, 50);
            if (array_key_exists('priority', $p)) {
                $row['priority'] = in_array($p['priority'], ['low','normal','high'], true) ? (string)$p['priority'] : 'normal';
            }
            if (array_key_exists('data', $p)) {
                $row['data'] = is_array($p['data']) ? json_encode($p['data'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) : null;
            }
            if (array_key_exists('senderUid', $p))  $row['sender_uid'] = $p['senderUid'];
            if (array_key_exists('senderName', $p)) $row['sender_name'] = $p['senderName'] === null ? null : mb_substr((string)$p['senderName'], 0, 200);
            if (array_key_exists('readAt', $p)) {
                $row['read_at'] = $p['readAt'] ? gmdate('Y-m-d H:i:s', strtotime((string)$p['readAt']) ?: time()) : null;
            }
            if (array_key_exists('archivedAt', $p)) {
                $row['archived_at'] = $p['archivedAt'] ? gmdate('Y-m-d H:i:s', strtotime((string)$p['archivedAt']) ?: time()) : null;
            }
            return $row;
        },
        'validateCreate' => function (array $p): void {
            if (empty($p['recipientUid']) || !is_string($p['recipientUid'])) {
                json_error('invalid_input', 'recipientUid requis.', 400);
            }
            if (empty($p['title']) || !is_string($p['title'])) {
                json_error('invalid_input', 'title requis.', 400);
            }
        },
        'beforeInsert' => function (array $p): array {
            $p['type'] = $p['type'] ?? 'system';
            $p['priority'] = $p['priority'] ?? 'normal';
            // Stamp the sender from the current session if not provided.
            if (empty($p['senderUid']) || empty($p['senderName'])) {
                $u = current_user();
                if ($u) {
                    $p['senderUid']  = $p['senderUid']  ?? ($u['uid'] ?? null);
                    $p['senderName'] = $p['senderName'] ?? ($u['displayName'] ?? null);
                }
            }
            return $p;
        },
        'listFilter' => function (array $u, array $qs): array {
            // Chaque user ne voit que ses propres notifications, point.
            // Les admins n'ont aucun super-pouvoir ici (c'est leur boîte
            // perso) — pour broadcaster ils utilisent /broadcast.
            return [['recipient_uid', '=', $u['uid']]];
        },
        'canList' => fn(?array $u) => (bool)$u,
        'canGet'  => fn(?array $u, array $r) => $u && ($r['recipient_uid'] === $u['uid'] || is_admin($u)),
        'canCreate' => function (?array $u, array $p): bool {
            if (!$u) return false;
            // Self-create autorisé (helpers internes / tests) — la
            // création par un autre user nécessite un permission admin.
            if (($p['recipientUid'] ?? null) === $u['uid']) return true;
            return is_admin($u) || user_has_permission($u, 'notifications_send');
        },
        'canUpdate' => function (array $u, array $r, array $patch): bool {
            // Le destinataire peut uniquement modifier readAt / archivedAt.
            if ($r['recipient_uid'] !== $u['uid']) return is_admin($u);
            $allowed = ['readAt', 'archivedAt'];
            foreach (array_keys($patch) as $k) {
                if (!in_array($k, $allowed, true)) return false;
            }
            return true;
        },
        'canDelete' => fn(array $u, array $r) => $u && ($r['recipient_uid'] === $u['uid'] || is_admin($u)),
    ];

    // ---------------- notification_preferences ----------------
    // Composite id "{uid}_{type}". Chaque user gère uniquement les siennes.
    $specs['notification_preferences'] = [
        'table' => 'notification_preferences',
        'idColumn' => 'id',
        'orderBy' => ['type', 'ASC'],
        'toView' => fn(array $r) => [
            'id'        => (string)$r['id'],
            'uid'       => (string)$r['uid'],
            'type'      => (string)$r['type'],
            'inApp'     => (int)($r['in_app'] ?? 1) === 1,
            'email'     => (int)($r['email'] ?? 0) === 1,
            'updatedAt' => iso_datetime($r['updated_at'] ?? null),
            'createdAt' => iso_datetime($r['created_at'] ?? null),
        ],
        'toRow' => function (array $p) {
            $row = [];
            if (array_key_exists('uid', $p))   $row['uid']   = (string)$p['uid'];
            if (array_key_exists('type', $p))  $row['type']  = mb_substr((string)$p['type'], 0, 50);
            if (array_key_exists('inApp', $p)) $row['in_app'] = $p['inApp'] ? 1 : 0;
            if (array_key_exists('email', $p)) $row['email']  = $p['email'] ? 1 : 0;
            return $row;
        },
        'beforeInsert' => function (array $p): array {
            // Force l'id composé pour pouvoir l'updater par PUT directement.
            $uid  = (string)($p['uid']  ?? '');
            $type = (string)($p['type'] ?? '');
            if ($uid !== '' && $type !== '') {
                $p['id'] = $uid . '_' . preg_replace('/[^a-zA-Z0-9_-]/', '_', $type);
            }
            return $p;
        },
        'listFilter' => function (array $u, array $qs): array {
            return [['uid', '=', $u['uid']]];
        },
        'canList' => fn(?array $u) => (bool)$u,
        'canGet'  => fn(?array $u, array $r) => $u && $r['uid'] === $u['uid'],
        'canCreate' => fn(?array $u, array $p) => $u && (($p['uid'] ?? null) === $u['uid']),
        'canUpdate' => fn(array $u, array $r, array $patch) => $u && $r['uid'] === $u['uid'],
        'canDelete' => fn(array $u, array $r) => $u && $r['uid'] === $u['uid'],
    ];

    // ---------------- chat_channels ----------------
    $specs['chat_channels'] = [
        'table' => 'chat_channels',
        'idColumn' => 'id',
        'orderBy' => ['last_activity_at', 'DESC'],
        'toView' => fn(array $r) => chat_channel_view($r),
        'toRow'  => function (array $p) {
            $row = [];
            if (array_key_exists('name', $p))            $row['name'] = (string)$p['name'];
            if (array_key_exists('description', $p))     $row['description'] = $p['description'];
            if (array_key_exists('type', $p))            $row['type'] = (string)$p['type'];
            if (array_key_exists('status', $p))          $row['status'] = (string)$p['status'];
            if (array_key_exists('isAllMembers', $p))    $row['is_all_members'] = $p['isAllMembers'] ? 1 : 0;
            if (array_key_exists('memberUids', $p))      $row['member_uids'] = json_encode((array)$p['memberUids'], JSON_UNESCAPED_UNICODE);
            if (array_key_exists('createdBy', $p))       $row['created_by'] = (string)$p['createdBy'];
            if (array_key_exists('createdByName', $p))   $row['created_by_name'] = (string)$p['createdByName'];
            if (array_key_exists('approvedBy', $p))      $row['approved_by'] = $p['approvedBy'];
            if (array_key_exists('approvedAt', $p))      $row['approved_at'] = chat_to_datetime($p['approvedAt']);
            if (array_key_exists('rejectedReason', $p))  $row['rejected_reason'] = $p['rejectedReason'];
            if (array_key_exists('iconColor', $p))       $row['icon_color'] = $p['iconColor'];
            if (array_key_exists('lastMessage', $p))     $row['last_message'] = $p['lastMessage'] === null ? null : json_encode($p['lastMessage'], JSON_UNESCAPED_UNICODE);
            if (array_key_exists('lastActivityAt', $p))  $row['last_activity_at'] = chat_to_datetime($p['lastActivityAt']);
            return $row;
        },
        'validateCreate' => function (array $p): void {
            if (empty($p['name']) || !is_string($p['name'])) json_error('invalid_input', 'Nom de canal requis.', 400);
            if (mb_strlen($p['name']) > 80) json_error('invalid_input', 'Nom de canal trop long.', 400);
        },
        'beforeInsert' => function (array $p): array {
            $p['type']   = $p['type']   ?? 'custom';
            $p['status'] = $p['status'] ?? 'pending';
            $p['memberUids'] = $p['memberUids'] ?? [];
            $p['lastActivityAt'] = $p['lastActivityAt'] ?? gmdate('c');
            return $p;
        },
        'canList' => fn(?array $u) => $u && (is_admin($u) || user_has_permission($u, 'chat_use') || user_has_permission($u, 'chat_manage')),
        'canGet'  => fn(?array $u, array $r) => $u && chat_user_can_access_channel_row($u, $r),
        'canCreate' => function (?array $u, array $p): bool {
            if (!$u) return false;
            if (is_admin($u) || user_has_permission($u, 'chat_manage')) return true;
            if (!user_has_permission($u, 'chat_create_channel')) return false;
            // Members proposing channels: status forced to 'pending' here
            return ($p['status'] ?? 'pending') === 'pending';
        },
        'canUpdate' => function (array $u, array $r, array $patch): bool {
            if (is_admin($u) || user_has_permission($u, 'chat_manage')) return true;
            // Creator may edit their own channel (members, description, lastMessage/Activity)
            if ($r['created_by'] !== $u['uid']) {
                // Any channel member may bump lastMessage / lastActivityAt by sending
                $allowedKeys = ['lastMessage', 'lastActivityAt'];
                foreach (array_keys($patch) as $k) {
                    if (!in_array($k, $allowedKeys, true)) return false;
                }
                return chat_user_can_access_channel_row($u, $r);
            }
            // Creator may not change status (admin only)
            if (isset($patch['status']) && $patch['status'] !== $r['status']) return false;
            return true;
        },
        'canDelete' => fn(array $u, array $r) => is_admin($u) || user_has_permission($u, 'chat_manage') || $r['created_by'] === $u['uid'],
    ];

    // ---------------- chat_messages ----------------
    $specs['chat_messages'] = [
        'table' => 'chat_messages',
        'idColumn' => 'id',
        'orderBy' => ['created_at', 'ASC'],
        'toView' => fn(array $r) => chat_message_view($r),
        'toRow'  => function (array $p) {
            $row = [];
            if (array_key_exists('channelId', $p))        $row['channel_id'] = (string)$p['channelId'];
            if (array_key_exists('text', $p))             $row['text'] = (string)$p['text'];
            if (array_key_exists('senderId', $p))         $row['sender_id'] = (string)$p['senderId'];
            if (array_key_exists('senderName', $p))       $row['sender_name'] = (string)$p['senderName'];
            if (array_key_exists('senderPhoto', $p))      $row['sender_photo'] = $p['senderPhoto'];
            if (array_key_exists('replyTo', $p))          $row['reply_to'] = $p['replyTo'] === null ? null : json_encode($p['replyTo'], JSON_UNESCAPED_UNICODE);
            if (array_key_exists('attachmentUrl', $p))    $row['attachment_url'] = $p['attachmentUrl'];
            if (array_key_exists('attachmentId', $p))     $row['attachment_id'] = $p['attachmentId'];
            if (array_key_exists('attachmentName', $p))   $row['attachment_name'] = $p['attachmentName'];
            if (array_key_exists('attachmentType', $p))   $row['attachment_type'] = $p['attachmentType'];
            if (array_key_exists('attachmentSize', $p))   $row['attachment_size'] = $p['attachmentSize'] === null ? null : (int)$p['attachmentSize'];
            if (array_key_exists('reactions', $p))        $row['reactions'] = $p['reactions'] === null ? null : json_encode((object)$p['reactions'], JSON_UNESCAPED_UNICODE);
            if (array_key_exists('editedAt', $p))         $row['edited_at'] = chat_to_datetime($p['editedAt']);
            if (array_key_exists('deletedAt', $p))        $row['deleted_at'] = chat_to_datetime($p['deletedAt']);
            return $row;
        },
        'validateCreate' => function (array $p): void {
            if (empty($p['channelId']) || !is_string($p['channelId'])) json_error('invalid_input', 'channelId requis.', 400);
            $hasText = !empty($p['text']) && is_string($p['text']);
            $hasFile = !empty($p['attachmentUrl']);
            if (!$hasText && !$hasFile) json_error('invalid_input', 'Message vide.', 400);
        },
        'listFilter' => function (array $u, array $qs): array {
            $cid = null;
            $where = (array)($qs['where'] ?? []);
            foreach ($where as $w) {
                $parts = explode(':', (string)$w, 3);
                if (count($parts) === 3 && $parts[0] === 'channel_id' && $parts[1] === '=') $cid = $parts[2];
            }
            if ($cid === null) json_error('bad_request', 'channel_id requis pour lister les messages.', 400);
            if (!chat_user_can_access_channel_id($u, $cid)) json_error('forbidden', 'Canal non autorisé.', 403);
            return [];
        },
        'canList' => fn(?array $u) => $u && (is_admin($u) || user_has_permission($u, 'chat_use') || user_has_permission($u, 'chat_manage')),
        'canGet'  => function (?array $u, array $r) {
            if (!$u) return false;
            return chat_user_can_access_channel_id($u, (string)$r['channel_id']);
        },
        'canCreate' => function (?array $u, array $p): bool {
            if (!$u) return false;
            if (!user_has_permission($u, 'chat_use') && !is_admin($u)) return false;
            if (($p['senderId'] ?? null) !== $u['uid']) return false;
            return chat_user_can_access_channel_id($u, (string)($p['channelId'] ?? ''));
        },
        'canUpdate' => function (array $u, array $r, array $patch): bool {
            if (is_admin($u) || user_has_permission($u, 'chat_manage')) return true;
            if (!chat_user_can_access_channel_id($u, (string)$r['channel_id'])) return false;
            // Sender may edit text / soft-delete; any member may toggle reactions
            $patchKeys = array_keys($patch);
            $forSenderOnly = ['text', 'editedAt', 'deletedAt', 'attachmentUrl', 'attachmentId', 'attachmentName', 'attachmentType', 'attachmentSize'];
            foreach ($patchKeys as $k) {
                if ($k === 'reactions') continue;
                if (in_array($k, $forSenderOnly, true)) {
                    if ($r['sender_id'] !== $u['uid']) return false;
                    continue;
                }
                return false; // other fields are not editable
            }
            return true;
        },
        'canDelete' => fn(array $u, array $r) => is_admin($u) || user_has_permission($u, 'chat_manage') || $r['sender_id'] === $u['uid'],
    ];

    // ---------------- chat_channel_reads ----------------
    $specs['chat_channel_reads'] = [
        'table' => 'chat_channel_reads',
        'idColumn' => 'id',
        'orderBy' => ['last_read_at', 'DESC'],
        'toView' => fn(array $r) => [
            'id' => $r['id'],
            'channelId' => $r['channel_id'],
            'uid' => $r['uid'],
            'lastReadAt' => iso_datetime($r['last_read_at']),
        ],
        'toRow' => function (array $p) {
            $row = [];
            if (array_key_exists('channelId', $p))  $row['channel_id'] = (string)$p['channelId'];
            if (array_key_exists('uid', $p))        $row['uid'] = (string)$p['uid'];
            if (array_key_exists('lastReadAt', $p)) $row['last_read_at'] = chat_to_datetime($p['lastReadAt']);
            return $row;
        },
        'beforeInsert' => function (array $p): array {
            $p['lastReadAt'] = $p['lastReadAt'] ?? gmdate('c');
            return $p;
        },
        'listFilter' => function (array $u, array $qs): array {
            // Users may only list their own read markers.
            return [['uid', '=', $u['uid']]];
        },
        'canList' => fn(?array $u) => (bool)$u,
        'canGet'  => fn(?array $u, array $r) => $u && $r['uid'] === $u['uid'],
        'canCreate' => fn(?array $u, array $p) => $u && (($p['uid'] ?? null) === $u['uid']),
        'canUpdate' => fn(array $u, array $r, array $patch) => $u && $r['uid'] === $u['uid'],
        'canDelete' => fn(array $u, array $r) => $u && ($r['uid'] === $u['uid'] || is_admin($u)),
    ];

    return $specs;
}

/**
 * Helpers shared by chat collection specs.
 */
function chat_channel_view(array $r): array
{
    $members = $r['member_uids'];
    if (is_string($members)) $members = json_decode($members, true) ?: [];
    $lastMessage = $r['last_message'];
    if (is_string($lastMessage)) $lastMessage = json_decode($lastMessage, true) ?: null;
    if (is_array($lastMessage) && isset($lastMessage['createdAt'])) {
        $lastMessage['createdAt'] = iso_datetime($lastMessage['createdAt']);
    }
    return [
        'id' => $r['id'],
        'name' => $r['name'],
        'description' => $r['description'],
        'type' => $r['type'],
        'status' => $r['status'],
        'isAllMembers' => (bool)$r['is_all_members'],
        'memberUids' => is_array($members) ? array_values($members) : [],
        'createdBy' => $r['created_by'],
        'createdByName' => $r['created_by_name'],
        'approvedBy' => $r['approved_by'],
        'approvedAt' => iso_datetime($r['approved_at']),
        'rejectedReason' => $r['rejected_reason'],
        'iconColor' => $r['icon_color'],
        'lastMessage' => $lastMessage,
        'lastActivityAt' => iso_datetime($r['last_activity_at']),
        'createdAt' => iso_datetime($r['created_at']),
    ];
}

function chat_message_view(array $r): array
{
    $reactions = $r['reactions'];
    if (is_string($reactions)) $reactions = json_decode($reactions, true) ?: new stdClass();
    $replyTo = $r['reply_to'];
    if (is_string($replyTo)) $replyTo = json_decode($replyTo, true) ?: null;
    return [
        'id' => $r['id'],
        'channelId' => $r['channel_id'],
        'text' => $r['text'],
        'senderId' => $r['sender_id'],
        'senderName' => $r['sender_name'],
        'senderPhoto' => $r['sender_photo'],
        'replyTo' => $replyTo,
        'attachmentUrl' => $r['attachment_url'],
        'attachmentId' => $r['attachment_id'],
        'attachmentName' => $r['attachment_name'],
        'attachmentType' => $r['attachment_type'],
        'attachmentSize' => $r['attachment_size'] === null ? null : (int)$r['attachment_size'],
        'reactions' => $reactions,
        'editedAt' => iso_datetime($r['edited_at']),
        'deletedAt' => iso_datetime($r['deleted_at']),
        'createdAt' => iso_datetime($r['created_at']),
    ];
}

function chat_user_can_access_channel_row(array $u, array $r): bool
{
    if (is_admin($u) || user_has_permission($u, 'chat_manage')) return true;
    if (($r['status'] ?? 'pending') !== 'approved') return $r['created_by'] === $u['uid'];
    if ((int)($r['is_all_members'] ?? 0)) return true;
    $members = $r['member_uids'];
    if (is_string($members)) $members = json_decode($members, true) ?: [];
    return is_array($members) && in_array($u['uid'], $members, true);
}

function chat_user_can_access_channel_id(array $u, string $channelId): bool
{
    if ($channelId === '') return false;
    static $cache = [];
    $key = $u['uid'] . '|' . $channelId;
    if (array_key_exists($key, $cache)) return $cache[$key];
    $stmt = db()->prepare('SELECT * FROM chat_channels WHERE id = ? LIMIT 1');
    $stmt->execute([$channelId]);
    $row = $stmt->fetch();
    return $cache[$key] = ($row ? chat_user_can_access_channel_row($u, $row) : false);
}

function chat_to_datetime($value): ?string
{
    if ($value === null || $value === '') return null;
    if (!is_string($value)) return null;
    $ts = strtotime($value);
    if ($ts === false) return null;
    return gmdate('Y-m-d H:i:s', $ts);
}

// ==============================================================
// Generic handlers
// ==============================================================

function list_collection(array $spec): void
{
    $user = current_user();
    if (!($spec['canList'])($user)) {
        json_error('forbidden', 'Lecture non autorisée.', 403);
    }

    $orderCol = $spec['orderBy'][0];
    $orderDir = $spec['orderBy'][1];
    // Accept ?orderBy=field:asc|desc
    if (isset($_GET['orderBy'])) {
        [$f, $d] = array_pad(explode(':', (string)$_GET['orderBy']), 2, 'desc');
        if (preg_match('/^[a-zA-Z_][a-zA-Z0-9_]*$/', $f)) { $orderCol = $f; }
        $orderDir = strtoupper($d) === 'ASC' ? 'ASC' : 'DESC';
    }

    $where = [];
    $params = [];
    // Optional listFilter closure can force where-clauses (e.g. scope to current user)
    if (isset($spec['listFilter']) && $user) {
        foreach (($spec['listFilter'])($user, $_GET) as $f) {
            $where[] = "`{$f[0]}` {$f[1]} ?";
            $params[] = $f[2];
        }
    }
    // Client-provided ?where=col:op:value (repeatable). Only =, !=, <, <=, >, >= allowed.
    $clientWhere = $_GET['where'] ?? [];
    if (is_string($clientWhere)) $clientWhere = [$clientWhere];
    foreach ($clientWhere as $wEntry) {
        $parts = explode(':', (string)$wEntry, 3);
        if (count($parts) !== 3) continue;
        [$col, $op, $val] = $parts;
        if (!preg_match('/^[a-zA-Z_][a-zA-Z0-9_]*$/', $col)) continue;
        if (!in_array($op, ['=', '!=', '<', '<=', '>', '>='], true)) continue;
        $where[] = "`$col` $op ?";
        $params[] = $val;
    }

    $sql = "SELECT * FROM `{$spec['table']}`";
    if ($where) $sql .= ' WHERE ' . implode(' AND ', $where);
    $sql .= " ORDER BY `$orderCol` $orderDir";
    $stmt = db()->prepare($sql);
    $stmt->execute($params);

    $items = [];
    foreach ($stmt->fetchAll() as $row) {
        // Per-row read check (e.g. row-level ownership)
        if (isset($spec['canGet']) && !($spec['canGet'])($user, $row)) continue;
        $items[] = ($spec['toView'])($row);
    }
    json_response(['items' => $items]);
}

function get_one(array $spec, string $id): void
{
    $user = current_user();
    $stmt = db()->prepare("SELECT * FROM `{$spec['table']}` WHERE `{$spec['idColumn']}` = ? LIMIT 1");
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) json_error('not_found', 'Document introuvable.', 404);
    if (!($spec['canGet'])($user, $row)) {
        json_error('forbidden', 'Lecture non autorisée.', 403);
    }
    json_response(['item' => ($spec['toView'])($row)]);
}

function create_one(array $spec): void
{
    $user = current_user();
    $payload = read_json_body();

    if (isset($spec['validateCreate'])) ($spec['validateCreate'])($payload);
    if (!($spec['canCreate'])($user, $payload)) {
        json_error('forbidden', 'Création non autorisée.', 403);
    }
    if (isset($spec['beforeInsert'])) $payload = ($spec['beforeInsert'])($payload);

    $row = ($spec['toRow'])($payload);

    // IDs: prefer client-supplied one (e.g. users/{uid} with firebase UID during migration)
    $idCol = $spec['idColumn'];
    $id = (string)($payload['id'] ?? $payload[$idCol] ?? $payload['uid'] ?? '');
    if ($id === '') $id = new_id($idCol === 'uid' ? 24 : 20);
    $row[$idCol] = $id;

    if (empty($row['created_at'])) $row['created_at'] = gmdate('Y-m-d H:i:s');

    $cols = array_keys($row);
    $placeholders = array_map(fn($c) => ":$c", $cols);
    $sql = "INSERT INTO `{$spec['table']}` (`" . implode('`, `', $cols) . "`) VALUES (" . implode(', ', $placeholders) . ')';
    $stmt = db()->prepare($sql);
    foreach ($row as $k => $v) $stmt->bindValue(":$k", $v);
    $stmt->execute();

    $get = db()->prepare("SELECT * FROM `{$spec['table']}` WHERE `$idCol` = ? LIMIT 1");
    $get->execute([$id]);
    $freshRow = $get->fetch();
    $view = ($spec['toView'])($freshRow);

    // Optional after-insert hook — used for notification emails, audit logging, etc.
    // Failures are logged but never block the 200 response (the row is already saved).
    if (isset($spec['afterInsert'])) {
        try {
            ($spec['afterInsert'])($freshRow, $view, $payload);
        } catch (Throwable $e) {
            error_log('afterInsert hook failed for ' . $spec['table'] . ': ' . $e->getMessage());
        }
    }

    json_response(['item' => $view]);
}

function update_one(array $spec, string $id): void
{
    $user = require_auth();
    $get = db()->prepare("SELECT * FROM `{$spec['table']}` WHERE `{$spec['idColumn']}` = ? LIMIT 1");
    $get->execute([$id]);
    $row = $get->fetch();
    if (!$row) json_error('not_found', 'Document introuvable.', 404);

    $patch = read_json_body();
    if (!($spec['canUpdate'])($user, $row, $patch)) {
        json_error('forbidden', 'Modification non autorisée.', 403);
    }

    $patchRow = ($spec['toRow'])($patch);
    if (!$patchRow) {
        json_response(['item' => ($spec['toView'])($row)]);
    }

    $assign = [];
    foreach ($patchRow as $col => $_) $assign[] = "`$col` = :$col";
    $sql = "UPDATE `{$spec['table']}` SET " . implode(', ', $assign) . " WHERE `{$spec['idColumn']}` = :_id";
    $stmt = db()->prepare($sql);
    foreach ($patchRow as $k => $v) $stmt->bindValue(":$k", $v);
    $stmt->bindValue(':_id', $id);
    $stmt->execute();

    $get->execute([$id]);
    json_response(['item' => ($spec['toView'])($get->fetch())]);
}

function delete_one(array $spec, string $id): void
{
    $user = require_auth();
    $get = db()->prepare("SELECT * FROM `{$spec['table']}` WHERE `{$spec['idColumn']}` = ? LIMIT 1");
    $get->execute([$id]);
    $row = $get->fetch();
    if (!$row) json_error('not_found', 'Document introuvable.', 404);

    if (!($spec['canDelete'])($user, $row)) {
        json_error('forbidden', 'Suppression non autorisée.', 403);
    }
    db()->prepare("DELETE FROM `{$spec['table']}` WHERE `{$spec['idColumn']}` = ?")->execute([$id]);
    json_response(['ok' => true]);
}

/**
 * POST /collections/contact_messages/<id>/reply
 * Body: { body: string }
 *
 * Sends an HTML email via SMTP to the message author, then marks the row
 * as replied. SMTP failures are non-fatal — the DB update still happens
 * so the admin sees the reply was recorded; the response carries
 * { emailSent: false } so the UI can warn.
 */
function contact_messages_reply(string $id): void
{
    $user = require_auth();
    if (!is_admin($user) && !user_has_permission($user, 'messages_inbox')) {
        json_error('forbidden', 'Permission requise : messages_inbox', 403);
    }

    $pdo = db();
    $get = $pdo->prepare('SELECT * FROM `contact_messages` WHERE `id` = ? LIMIT 1');
    $get->execute([$id]);
    $row = $get->fetch();
    if (!$row) json_error('not_found', 'Message introuvable.', 404);

    $payload = read_json_body();
    $body = isset($payload['body']) && is_string($payload['body']) ? trim($payload['body']) : '';
    if ($body === '') json_error('invalid_input', 'Le corps de la réponse est requis.', 400);
    if (mb_strlen($body) > 10000) json_error('invalid_input', 'Réponse trop longue (10 000 caractères max).', 400);

    $toEmail = (string)($row['user_email'] ?? '');
    if ($toEmail === '' || !filter_var($toEmail, FILTER_VALIDATE_EMAIL)) {
        json_error('invalid_input', 'Le message ne contient pas d\'adresse email valide.', 400);
    }
    $toName = (string)($row['user_name'] ?? $toEmail);
    $originalSubject = (string)($row['subject'] ?? '');
    $subject = 'Re: ' . ($originalSubject !== '' ? $originalSubject : 'Votre message');

    $original = (string)($row['message'] ?? '');
    $bodyHtml = nl2br(htmlspecialchars($body, ENT_QUOTES | ENT_HTML5, 'UTF-8'));
    $originalHtml = nl2br(htmlspecialchars($original, ENT_QUOTES | ENT_HTML5, 'UTF-8'));
    $sentAt = date('d/m/Y H:i');

    $html = <<<HTML
<!DOCTYPE html>
<html lang="fr"><body style="font-family: Arial, Helvetica, sans-serif; color:#1f2937; max-width:640px; margin:0 auto; padding:24px;">
  <p>Bonjour,</p>
  <div style="margin:16px 0; line-height:1.6;">{$bodyHtml}</div>
  <p style="margin:24px 0 8px 0;">Cordialement,<br/>L'Association des Architectes de Jerba</p>
  <hr style="border:none; border-top:1px solid #e5e7eb; margin:24px 0;"/>
  <div style="font-size:12px; color:#6b7280;">
    <p style="margin:0 0 8px 0;"><strong>Message d'origine</strong> ({$sentAt})</p>
    <blockquote style="border-left:3px solid #d1d5db; padding-left:12px; margin:0; color:#4b5563;">{$originalHtml}</blockquote>
  </div>
</body></html>
HTML;

    $emailSent = false;
    try {
        $emailSent = send_mail($toEmail, $toName, $subject, $html, $body);
    } catch (Throwable $e) {
        error_log('[contact_messages_reply] mail error: ' . $e->getMessage());
        $emailSent = false;
    }

    $upd = $pdo->prepare(
        'UPDATE `contact_messages`
            SET `replied` = 1,
                `replied_at` = NOW(),
                `replied_by` = :uid,
                `reply_message` = :msg,
                `status` = CASE WHEN `status` = \'unread\' THEN \'read\' ELSE `status` END
          WHERE `id` = :id'
    );
    $upd->execute([
        ':uid' => (string)$user['uid'],
        ':msg' => $body,
        ':id'  => $id,
    ]);

    $get->execute([$id]);
    $fresh = $get->fetch();
    $spec = collection_spec('contact_messages');
    json_response([
        'item' => ($spec['toView'])($fresh),
        'emailSent' => $emailSent,
    ]);
}
