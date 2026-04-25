<?php
declare(strict_types=1);

/**
 * Helpers — création et fan-out de notifications in-app.
 *
 * Schéma : voir api/schema.sql (notifications, notification_preferences).
 *
 * Politique :
 *   - Les notifications sont stockées par destinataire (1 ligne par user) ;
 *     les broadcasts génèrent N lignes via push_notifications_to_users().
 *   - Les préférences (notification_preferences) permettent à chaque user
 *     de couper un type côté in-app et/ou email. Par défaut tout est
 *     activé en in-app, désactivé en email.
 *   - Les fonctions ne lèvent jamais d'exception bloquante — elles loguent
 *     en error_log() pour ne pas casser le flux qui les a appelées.
 */

/**
 * Crée une notification in-app pour UN destinataire.
 * Retourne l'id généré ou null en cas d'échec.
 *
 * @param string $recipientUid   uid de l'utilisateur destinataire
 * @param array  $payload        type, title, body, link, icon, priority,
 *                               data, senderUid, senderName
 */
function create_notification(string $recipientUid, array $payload): ?string
{
    if ($recipientUid === '') return null;
    $type = (string)($payload['type'] ?? 'system');
    if (!notification_pref_allows($recipientUid, $type, 'in_app')) return null;

    try {
        $id = new_id(20);
        $row = [
            'id'            => $id,
            'recipient_uid' => $recipientUid,
            'type'          => substr($type, 0, 50),
            'title'         => mb_substr((string)($payload['title'] ?? ''), 0, 300),
            'body'          => isset($payload['body']) ? (string)$payload['body'] : null,
            'link'          => isset($payload['link']) ? mb_substr((string)$payload['link'], 0, 500) : null,
            'icon'          => isset($payload['icon']) ? mb_substr((string)$payload['icon'], 0, 50) : null,
            'priority'      => in_array(($payload['priority'] ?? 'normal'), ['low','normal','high'], true)
                                  ? (string)$payload['priority'] : 'normal',
            'data'          => isset($payload['data']) && is_array($payload['data'])
                                  ? json_encode($payload['data'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
                                  : null,
            'sender_uid'    => isset($payload['senderUid']) ? (string)$payload['senderUid'] : null,
            'sender_name'   => isset($payload['senderName']) ? mb_substr((string)$payload['senderName'], 0, 200) : null,
            'created_at'    => gmdate('Y-m-d H:i:s'),
        ];
        $cols = array_keys($row);
        $placeholders = array_map(fn($c) => ":$c", $cols);
        $sql = 'INSERT INTO notifications (`' . implode('`, `', $cols) . '`) VALUES (' . implode(', ', $placeholders) . ')';
        $stmt = db()->prepare($sql);
        foreach ($row as $k => $v) $stmt->bindValue(":$k", $v);
        $stmt->execute();
        return $id;
    } catch (Throwable $e) {
        error_log('create_notification: ' . $e->getMessage());
        return null;
    }
}

/**
 * Push à plusieurs destinataires en une passe — retourne la liste des
 * uids effectivement notifiés (filtrés par préférences).
 *
 * @param string[] $uids
 * @param array    $payload  voir create_notification()
 * @return string[]
 */
function push_notifications_to_users(array $uids, array $payload): array
{
    $sent = [];
    $seen = [];
    foreach ($uids as $uid) {
        $uid = (string)$uid;
        if ($uid === '' || isset($seen[$uid])) continue;
        $seen[$uid] = true;
        $id = create_notification($uid, $payload);
        if ($id) $sent[] = $uid;
    }
    return $sent;
}

/**
 * Cible un scope nommé : 'all', 'admins', 'representatives', 'members',
 * 'active'. Pour un ciblage explicite, passer 'uids' avec un tableau.
 *
 * @return string[]  uids des utilisateurs qui matchent le scope
 */
function resolve_notification_scope(string $scope): array
{
    $sql = null;
    switch ($scope) {
        case 'all':
            $sql = "SELECT uid FROM users WHERE archived_at IS NULL";
            break;
        case 'active':
            $sql = "SELECT uid FROM users WHERE status = 'active' AND archived_at IS NULL";
            break;
        case 'admins':
            $sql = "SELECT uid FROM users WHERE role IN ('admin','super-admin') AND (archived_at IS NULL)";
            break;
        case 'representatives':
            $sql = "SELECT uid FROM users WHERE role = 'representative' AND status = 'active' AND archived_at IS NULL";
            break;
        case 'members':
            $sql = "SELECT uid FROM users WHERE role = 'member' AND status = 'active' AND archived_at IS NULL";
            break;
        default:
            return [];
    }
    try {
        $rows = db()->query($sql)->fetchAll();
        return array_values(array_map(fn($r) => (string)$r['uid'], $rows));
    } catch (Throwable $e) {
        // archived_at column may not exist on legacy DBs — fallback without it.
        try {
            $fallback = str_replace(['AND archived_at IS NULL', 'AND (archived_at IS NULL)', 'WHERE archived_at IS NULL'], ['', '', 'WHERE 1=1'], $sql);
            $rows = db()->query($fallback)->fetchAll();
            return array_values(array_map(fn($r) => (string)$r['uid'], $rows));
        } catch (Throwable $e2) {
            error_log('resolve_notification_scope: ' . $e2->getMessage());
            return [];
        }
    }
}

/**
 * Retourne les uids de tous les admins/super-admins actifs — utilisé pour
 * notifier l'équipe quand un événement public arrive (adhésion, partenaire…)
 * @return string[]
 */
function admin_recipient_uids(): array
{
    return resolve_notification_scope('admins');
}

/**
 * Vérifie la préférence d'un user pour un type donné. Si aucune
 * préférence n'a été enregistrée, on retombe sur le défaut :
 *   - in_app : true
 *   - email  : false
 *
 * Le type spécial 'all' agit en kill-switch global : si in_app=false
 * pour 'all', AUCUNE notification in-app n'est créée pour ce user.
 */
function notification_pref_allows(string $uid, string $type, string $channel = 'in_app'): bool
{
    if (!in_array($channel, ['in_app', 'email'], true)) return false;
    try {
        $stmt = db()->prepare(
            "SELECT type, in_app, email
               FROM notification_preferences
              WHERE uid = ? AND type IN ('all', ?)"
        );
        $stmt->execute([$uid, $type]);
        $rows = $stmt->fetchAll();
        $globalAllowed = true; // default ON for in_app
        $globalEmailAllowed = false; // default OFF for email
        $typeRow = null;
        foreach ($rows as $r) {
            if (($r['type'] ?? '') === 'all') {
                $globalAllowed = (int)($r['in_app'] ?? 1) === 1;
                $globalEmailAllowed = (int)($r['email'] ?? 0) === 1;
            } elseif (($r['type'] ?? '') === $type) {
                $typeRow = $r;
            }
        }
        if ($channel === 'in_app') {
            if (!$globalAllowed) return false;
            if ($typeRow !== null) return (int)($typeRow['in_app'] ?? 1) === 1;
            return true;
        }
        // email
        if (!$globalEmailAllowed) return false;
        if ($typeRow !== null) return (int)($typeRow['email'] ?? 0) === 1;
        return false;
    } catch (Throwable $e) {
        error_log('notification_pref_allows: ' . $e->getMessage());
        return $channel === 'in_app';
    }
}

/**
 * Mappe un row DB vers la forme JSON exposée au frontend.
 */
function notification_view(array $r): array
{
    $data = $r['data'] ?? null;
    if (is_string($data)) {
        $decoded = json_decode($data, true);
        $data = is_array($decoded) ? $decoded : null;
    }
    return [
        'id'           => (string)$r['id'],
        'recipientUid' => (string)$r['recipient_uid'],
        'type'         => (string)$r['type'],
        'title'        => (string)$r['title'],
        'body'         => $r['body'],
        'link'         => $r['link'],
        'icon'         => $r['icon'],
        'priority'     => (string)($r['priority'] ?? 'normal'),
        'data'         => $data,
        'senderUid'    => $r['sender_uid'],
        'senderName'   => $r['sender_name'],
        'readAt'       => iso_datetime($r['read_at']),
        'archivedAt'   => iso_datetime($r['archived_at']),
        'createdAt'    => iso_datetime($r['created_at']),
    ];
}
