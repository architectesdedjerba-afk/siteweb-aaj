<?php
declare(strict_types=1);

/**
 * Auth helpers — load the current user from the JWT cookie.
 */

function current_user(): ?array
{
    static $cache = null;
    if ($cache !== null) return $cache ?: null;

    $token = jwt_cookie_read();
    if (!$token) {
        $cache = false;
        return null;
    }
    $payload = jwt_verify($token);
    if (!$payload || !isset($payload['uid'])) {
        $cache = false;
        return null;
    }

    $stmt = db()->prepare('SELECT * FROM users WHERE uid = ? LIMIT 1');
    $stmt->execute([$payload['uid']]);
    $user = $stmt->fetch();
    if (!$user) {
        $cache = false;
        return null;
    }
    $cache = $user;
    return $user;
}

function require_auth(): array
{
    $user = current_user();
    if (!$user) {
        json_error('unauthenticated', 'Connexion requise.', 401);
    }
    return $user;
}

function require_active(): array
{
    $user = require_auth();
    if (($user['status'] ?? 'pending') !== 'active') {
        json_error('inactive_account', 'Compte inactif.', 403);
    }
    return $user;
}

/**
 * Public profile for a user row — maps DB columns to the shape the
 * frontend already expects (same keys as Firestore users/{uid}).
 */
function user_profile_view(array $row): array
{
    $cotisations = null;
    if (!empty($row['cotisations'])) {
        $cotisations = json_decode((string)$row['cotisations'], true);
    }
    return [
        'id'                => $row['uid'],
        'uid'               => $row['uid'],
        'email'             => $row['email'],
        'displayName'       => $row['display_name'] ?? '',
        'firstName'         => $row['first_name'] ?? null,
        'lastName'          => $row['last_name'] ?? null,
        'role'              => $row['role'] ?? 'member',
        'status'            => $row['status'] ?? 'pending',
        'mustReset'         => (bool)($row['must_reset'] ?? 0),
        'category'          => $row['category'] ?? null,
        'memberType'        => $row['member_type'] ?? null,
        'memberTypeLetter'  => $row['member_type_letter'] ?? null,
        'birthDate'         => $row['birth_date'] ?? null,
        'licenseNumber'     => $row['license_number'] ?? null,
        'mobile'            => $row['mobile'] ?? null,
        'address'           => $row['address'] ?? null,
        'photoBase64'       => $row['photo_url'] ?? null, // kept as field name for compat; value may be a URL
        'cotisations'       => $cotisations,
        'trialStartedAt'    => iso_datetime($row['trial_started_at'] ?? null),
        'trialFirstUsedAt'  => iso_datetime($row['trial_first_used_at'] ?? null),
        'createdAt'         => iso_datetime($row['created_at'] ?? null),
        'archivedAt'        => iso_datetime($row['archived_at'] ?? null),
    ];
}
