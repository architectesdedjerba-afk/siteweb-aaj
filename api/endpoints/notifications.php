<?php
declare(strict_types=1);

/**
 * /api/notifications — schema introspection + test sender for the
 * configurable notification templates. Settings themselves are read and
 * written through the standard config collection (`config/notifications`),
 * so we don't reimplement CRUD here.
 */

function handle_notifications(string $method, array $rest): void
{
    $sub = $rest[0] ?? '';

    if ($sub === 'schema' && $method === 'GET') {
        notifications_schema(); return;
    }
    if ($sub === 'test' && $method === 'POST') {
        notifications_send_test(); return;
    }

    json_error('not_found', 'Endpoint notifications inconnu.', 404);
}

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
 * to a single test address chosen by the caller. Useful to preview templates
 * without triggering the underlying business event.
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
