<?php
declare(strict_types=1);

/**
 * /api/notifications — combined router for two distinct features that share
 * the URL namespace:
 *
 *   IN-APP NOTIFICATIONS (origin/main feature):
 *     POST   /api/notifications/broadcast          (admin) fan-out à un scope
 *     POST   /api/notifications/mark-all-read              tout marquer lu
 *     POST   /api/notifications/archive-all-read           archive le lu
 *     POST   /api/notifications/bulk                       actions groupées
 *     DELETE /api/notifications/clear-archived             purge archives
 *     GET    /api/notifications/unread-count               { unread, total }
 *     (le CRUD standard reste sur /api/collections/notifications)
 *
 *   EMAIL TEMPLATES (admin-editable):
 *     GET    /api/notifications/schema             catalogue + valeurs courantes
 *     POST   /api/notifications/test               envoie un mail de test
 *     (les settings eux-mêmes vivent dans /api/collections/config/notifications)
 */

function handle_notifications(string $method, array $rest): void
{
    $action = $rest[0] ?? '';

    // In-app notifications (origin/main)
    if ($method === 'GET'    && $action === 'unread-count')      { notif_unread_count();       return; }
    if ($method === 'POST'   && $action === 'broadcast')         { notif_broadcast();          return; }
    if ($method === 'POST'   && $action === 'mark-all-read')     { notif_mark_all_read();      return; }
    if ($method === 'POST'   && $action === 'archive-all-read')  { notif_archive_all_read();   return; }
    if ($method === 'POST'   && $action === 'bulk')              { notif_bulk_action();        return; }
    if ($method === 'DELETE' && $action === 'clear-archived')    { notif_clear_archived();     return; }

    // Email template management
    if ($method === 'GET'  && $action === 'schema') { notifications_schema();    return; }
    if ($method === 'POST' && $action === 'test')   { notifications_send_test(); return; }

    json_error('not_found', 'Endpoint notifications inconnu.', 404);
}

/* ============================================================
 * EMAIL TEMPLATES
 * ============================================================ */

/**
 * Returns the full event catalogue (id, label, fields, vars) plus the
 * baked-in defaults — the frontend uses this to render the editor and
 * to power the "Restaurer les valeurs par défaut" button.
 */
function notifications_schema(): void
{
    $user = require_auth();
    if (!is_super_admin($user) && !user_has_permission($user, 'config_manage')) {
        json_error('forbidden', 'Accès refusé.', 403);
    }

    $events = [];
    foreach (NOTIFICATION_DEFAULTS as $event => $defaults) {
        $events[] = [
            'id'      => $event,
            'label'   => notifications_label($event),
            'kind'    => in_array($event, NOTIFICATION_DUAL_EVENTS, true) ? 'dual' : 'single',
            'vars'    => NOTIFICATION_VARS[$event] ?? [],
            'defaults' => $defaults,
        ];
    }

    json_response([
        'events' => $events,
        'currentSettings' => notification_settings(),
    ]);
}

/**
 * Friendly French label for the event id (used in the admin UI heading).
 */
function notifications_label(string $event): string
{
    static $labels = [
        'membership_application' => "Demande d'adhésion",
        'partner_application'    => 'Proposition de partenariat',
        'password_reset'         => 'Réinitialisation du mot de passe',
        'account_created'        => 'Compte créé (bienvenue)',
        'unesco_permit_review_requested' => 'UNESCO — nouvelle demande à instruire',
        'unesco_permit_status_changed'   => 'UNESCO — statut mis à jour',
    ];
    return $labels[$event] ?? $event;
}

/**
 * Sends one rendered template (using sample vars from notification_sample_vars)
 * to a single test address chosen by the caller.
 *
 * Body: { event: string, field: 'applicant'|'admin'|'single', to: email }
 */
function notifications_send_test(): void
{
    global $CONFIG;
    $user = require_auth();
    if (!is_super_admin($user) && !user_has_permission($user, 'config_manage')) {
        json_error('forbidden', 'Accès refusé.', 403);
    }

    $body  = read_json_body();
    $event = (string)($body['event'] ?? '');
    $kind  = (string)($body['field'] ?? 'single'); // applicant | admin | single
    $to    = strtolower(trim((string)($body['to'] ?? $user['email'] ?? '')));
    if ($event === '' || !isset(NOTIFICATION_DEFAULTS[$event])) {
        json_error('invalid_input', 'Événement inconnu.', 400);
    }
    if ($to === '' || !filter_var($to, FILTER_VALIDATE_EMAIL)) {
        json_error('invalid_email', 'Email destinataire invalide.', 400);
    }

    [$subjectField, $htmlField] = match ($kind) {
        'applicant' => ['applicantSubject', 'applicantHtml'],
        'admin'     => ['adminSubject', 'adminHtml'],
        default     => ['subject', 'html'],
    };
    if (!isset(NOTIFICATION_DEFAULTS[$event][$subjectField])) {
        json_error('invalid_input', "Champ inconnu pour cet événement.", 400);
    }

    $siteUrl = (string)($CONFIG['site']['url'] ?? '');
    $vars    = notification_sample_vars($event, $siteUrl);
    $subject = '[TEST] ' . notification_render($event, $subjectField, $vars);
    $html    = '<p style="background:#fffbe6;border:1px solid #fde68a;padding:10px;border-radius:6px;font-size:12px">'
             . 'Email de test envoyé depuis l\'espace admin AAJ avec des données fictives.'
             . '</p>'
             . notification_render($event, $htmlField, $vars);

    @set_time_limit(20);
    $ok = (bool)@send_mail($to, (string)($user['display_name'] ?? ''), $subject, $html);
    json_response(['ok' => $ok]);
}

/* ============================================================
 * IN-APP NOTIFICATIONS
 * ============================================================ */

function notif_unread_count(): void
{
    $u = require_auth();
    try {
        $stmt = db()->prepare(
            'SELECT
               SUM(CASE WHEN read_at IS NULL AND archived_at IS NULL THEN 1 ELSE 0 END) AS unread,
               SUM(CASE WHEN archived_at IS NULL THEN 1 ELSE 0 END) AS active,
               COUNT(*) AS total
             FROM notifications
             WHERE recipient_uid = ?'
        );
        $stmt->execute([$u['uid']]);
        $row = $stmt->fetch() ?: ['unread' => 0, 'active' => 0, 'total' => 0];
        json_response([
            'unread' => (int)($row['unread'] ?? 0),
            'active' => (int)($row['active'] ?? 0),
            'total'  => (int)($row['total']  ?? 0),
        ]);
    } catch (Throwable $e) {
        error_log('notif_unread_count: ' . $e->getMessage());
        json_response(['unread' => 0, 'active' => 0, 'total' => 0]);
    }
}

function notif_broadcast(): void
{
    $u = require_auth();
    if (!is_admin($u) && !user_has_permission($u, 'notifications_send')) {
        json_error('forbidden', 'Diffusion non autorisée.', 403);
    }
    $p = read_json_body();

    $scope = (string)($p['scope'] ?? 'members');
    $title = trim((string)($p['title'] ?? ''));
    if ($title === '') json_error('invalid_input', 'title requis.', 400);

    $payload = [
        'type'       => (string)($p['type'] ?? 'broadcast'),
        'title'      => $title,
        'body'       => isset($p['body'])  ? (string)$p['body']  : null,
        'link'       => isset($p['link'])  ? (string)$p['link']  : null,
        'icon'       => isset($p['icon'])  ? (string)$p['icon']  : null,
        'priority'   => (string)($p['priority'] ?? 'normal'),
        'data'       => is_array($p['data'] ?? null) ? $p['data'] : null,
        'senderUid'  => $u['uid'],
        'senderName' => $u['displayName'] ?? null,
    ];

    $uids = [];
    if (!empty($p['uids']) && is_array($p['uids'])) {
        $uids = array_values(array_filter(array_map('strval', $p['uids']), fn($x) => $x !== ''));
    } else {
        $uids = resolve_notification_scope($scope);
    }

    $sent = push_notifications_to_users($uids, $payload);
    json_response([
        'ok'       => true,
        'sent'     => count($sent),
        'targeted' => count($uids),
        'scope'    => $scope,
    ]);
}

function notif_mark_all_read(): void
{
    $u = require_auth();
    try {
        $stmt = db()->prepare(
            'UPDATE notifications
                SET read_at = ?
              WHERE recipient_uid = ?
                AND read_at IS NULL
                AND archived_at IS NULL'
        );
        $stmt->execute([gmdate('Y-m-d H:i:s'), $u['uid']]);
        json_response(['ok' => true, 'updated' => $stmt->rowCount()]);
    } catch (Throwable $e) {
        error_log('mark_all_read: ' . $e->getMessage());
        json_error('server_error', 'Échec de la mise à jour.', 500);
    }
}

function notif_archive_all_read(): void
{
    $u = require_auth();
    try {
        $stmt = db()->prepare(
            'UPDATE notifications
                SET archived_at = ?
              WHERE recipient_uid = ?
                AND read_at IS NOT NULL
                AND archived_at IS NULL'
        );
        $stmt->execute([gmdate('Y-m-d H:i:s'), $u['uid']]);
        json_response(['ok' => true, 'updated' => $stmt->rowCount()]);
    } catch (Throwable $e) {
        error_log('archive_all_read: ' . $e->getMessage());
        json_error('server_error', 'Échec de la mise à jour.', 500);
    }
}

/**
 * POST /api/notifications/bulk
 * Body: { ids: string[], action: 'read'|'unread'|'archive'|'unarchive'|'delete' }
 */
function notif_bulk_action(): void
{
    $u = require_auth();
    $p = read_json_body();
    $ids = $p['ids'] ?? [];
    $action = (string)($p['action'] ?? '');

    if (!is_array($ids) || empty($ids)) {
        json_error('invalid_input', 'ids requis.', 400);
    }
    $ids = array_values(array_filter(array_map('strval', $ids), fn($x) => $x !== ''));
    if (empty($ids)) json_error('invalid_input', 'ids vides.', 400);

    $placeholders = implode(',', array_fill(0, count($ids), '?'));
    $now = gmdate('Y-m-d H:i:s');
    $sql = null;
    $params = [];

    switch ($action) {
        case 'read':
            $sql = "UPDATE notifications SET read_at = ? WHERE recipient_uid = ? AND id IN ($placeholders) AND read_at IS NULL";
            $params = array_merge([$now, $u['uid']], $ids);
            break;
        case 'unread':
            $sql = "UPDATE notifications SET read_at = NULL WHERE recipient_uid = ? AND id IN ($placeholders)";
            $params = array_merge([$u['uid']], $ids);
            break;
        case 'archive':
            $sql = "UPDATE notifications SET archived_at = ? WHERE recipient_uid = ? AND id IN ($placeholders) AND archived_at IS NULL";
            $params = array_merge([$now, $u['uid']], $ids);
            break;
        case 'unarchive':
            $sql = "UPDATE notifications SET archived_at = NULL WHERE recipient_uid = ? AND id IN ($placeholders)";
            $params = array_merge([$u['uid']], $ids);
            break;
        case 'delete':
            $sql = "DELETE FROM notifications WHERE recipient_uid = ? AND id IN ($placeholders)";
            $params = array_merge([$u['uid']], $ids);
            break;
        default:
            json_error('invalid_input', "Action inconnue : $action", 400);
    }

    try {
        $stmt = db()->prepare($sql);
        $stmt->execute($params);
        json_response(['ok' => true, 'affected' => $stmt->rowCount(), 'action' => $action]);
    } catch (Throwable $e) {
        error_log('notif_bulk_action: ' . $e->getMessage());
        json_error('server_error', 'Échec de l\'action.', 500);
    }
}

function notif_clear_archived(): void
{
    $u = require_auth();
    try {
        $stmt = db()->prepare('DELETE FROM notifications WHERE recipient_uid = ? AND archived_at IS NOT NULL');
        $stmt->execute([$u['uid']]);
        json_response(['ok' => true, 'deleted' => $stmt->rowCount()]);
    } catch (Throwable $e) {
        error_log('notif_clear_archived: ' . $e->getMessage());
        json_error('server_error', 'Échec de la suppression.', 500);
    }
}
