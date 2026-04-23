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
    if ($name === '') json_error('bad_path', 'Collection manquante.', 400);

    $spec = collection_spec($name);
    if (!$spec) json_error('unknown_collection', "Collection inconnue : $name", 404);

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
    $specs['commission_pvs'] = [
        'table' => 'commission_pvs',
        'idColumn' => 'id',
        'orderBy' => ['created_at', 'DESC'],
        'toView' => fn(array $r) => [
            'id' => $r['id'],
            'town' => $r['town'], 'date' => $r['date'], 'count' => (int)$r['count'],
            'fileBase64' => $r['file_url'], 'fileName' => $r['file_name'],
            'createdAt' => iso_datetime($r['created_at']),
        ],
        'toRow' => function (array $p) {
            $row = [];
            foreach (['town','date'] as $k) if (array_key_exists($k, $p)) $row[$k] = $p[$k];
            if (array_key_exists('count', $p))      $row['count'] = (int)$p['count'];
            if (array_key_exists('fileBase64', $p)) $row['file_url'] = $p['fileBase64'];
            if (array_key_exists('fileName', $p))   $row['file_name'] = $p['fileName'];
            return $row;
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
            'subject' => $r['subject'], 'message' => $r['message'],
            'fileBase64' => $r['file_url'], 'fileName' => $r['file_name'],
            'createdAt' => iso_datetime($r['created_at']),
        ],
        'toRow' => function (array $p) {
            $row = [];
            if (array_key_exists('userId', $p))     $row['user_id'] = $p['userId'];
            if (array_key_exists('userEmail', $p))  $row['user_email'] = $p['userEmail'];
            if (array_key_exists('subject', $p))    $row['subject'] = $p['subject'];
            if (array_key_exists('message', $p))    $row['message'] = $p['message'];
            if (array_key_exists('fileBase64', $p)) $row['file_url'] = $p['fileBase64'];
            if (array_key_exists('fileName', $p))   $row['file_name'] = $p['fileName'];
            return $row;
        },
        'listFilter' => function (array $u, array $qs): array {
            // Non-admins see only their own messages.
            if (is_admin($u) || user_has_permission($u, 'messages_inbox')) return [];
            return [['user_id', '=', $u['uid']]];
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
            'fullName' => $r['full_name'], 'email' => $r['email'], 'phone' => $r['phone'],
            'category' => $r['category'], 'matricule' => $r['matricule'], 'city' => $r['city'],
            'cvFileName' => $r['cv_file_name'],
            'status' => $r['status'],
            'createdAt' => iso_datetime($r['created_at']),
        ],
        'toRow' => function (array $p) {
            $row = [];
            if (array_key_exists('fullName', $p))   $row['full_name'] = $p['fullName'];
            if (array_key_exists('email', $p))      $row['email'] = $p['email'];
            if (array_key_exists('phone', $p))      $row['phone'] = $p['phone'];
            if (array_key_exists('category', $p))   $row['category'] = $p['category'];
            if (array_key_exists('matricule', $p))  $row['matricule'] = $p['matricule'];
            if (array_key_exists('city', $p))       $row['city'] = $p['city'];
            if (array_key_exists('cvFileName', $p)) $row['cv_file_name'] = $p['cvFileName'];
            if (array_key_exists('status', $p))     $row['status'] = $p['status'];
            return $row;
        },
        'validateCreate' => function (array $p): void {
            foreach (['fullName','email','phone','category','matricule','city'] as $k) {
                if (empty($p[$k]) || !is_string($p[$k])) json_error('invalid_input', "Champ requis : $k", 400);
            }
            if (!filter_var($p['email'], FILTER_VALIDATE_EMAIL)) json_error('invalid_email', 'Email invalide.', 400);
            if (!is_string($p['category']) || $p['category'] === '' || strlen($p['category']) > 100) {
                json_error('invalid_category', 'Catégorie invalide.', 400);
            }
        },
        'beforeInsert' => function (array $p): array {
            $p['status'] = $p['status'] ?? 'pending';
            return $p;
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

    return $specs;
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
    json_response(['item' => ($spec['toView'])($get->fetch())]);
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
