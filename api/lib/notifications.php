<?php
declare(strict_types=1);

/**
 * Notifications — combined helpers for two distinct (but related) systems:
 *
 *  1. Admin-editable EMAIL templates + recipients + on/off toggle for every
 *     transactional email the API sends (see NOTIFICATION_DEFAULTS,
 *     notification_render, notification_admin_recipients…). Storage: a
 *     single document `config/notifications` (JSON column).
 *
 *  2. IN-APP notifications fan-out (create_notification,
 *     push_notifications_to_users, resolve_notification_scope…). Storage:
 *     `notifications` + `notification_preferences` tables — see
 *     api/schema.sql.
 *
 * Email templates use `{{variable}}` interpolation. By default values are
 * HTML-escaped; prefix with a colon to inject raw HTML — e.g.
 * `{{:adminLink}}` keeps an `<a>` tag intact. `{{nl2br:message}}` runs
 * nl2br() after escaping.
 */

/* ============================================================
 * 1) EMAIL TEMPLATES — defaults, settings, rendering, recipients
 * ============================================================ */

const NOTIFICATION_DEFAULTS = [
    'membership_application' => [
        'enabled' => true,
        'extraRecipients' => [],
        'applicantSubject' => "Votre demande d'adhésion à l'AAJ",
        'applicantHtml' =>
            "<p>Bonjour {{fullName}},</p>" .
            "<p>Nous avons bien reçu votre demande d'adhésion à l'Association des " .
            "Architectes de Jerba. Elle est maintenant en cours d'examen par le " .
            "bureau exécutif — vous recevrez une réponse prochainement.</p>" .
            "<p style='color:#555;font-size:13px'>Récapitulatif :<br>" .
            "Nom : {{fullName}}<br>" .
            "Catégorie : {{category}}<br>" .
            "Ville : {{city}}</p>" .
            "<p>— L'équipe AAJ</p>",
        'adminSubject' => "Nouvelle demande d'adhésion AAJ : {{fullName}}",
        'adminHtml' =>
            "<p>Une nouvelle demande d'adhésion vient d'être soumise :</p>" .
            "<ul>" .
            "<li><strong>Nom :</strong> {{fullName}}</li>" .
            "<li><strong>Email :</strong> {{email}}</li>" .
            "<li><strong>Téléphone :</strong> {{phone}}</li>" .
            "<li><strong>Catégorie :</strong> {{category}}</li>" .
            "<li><strong>Ville :</strong> {{city}}</li>" .
            "</ul>" .
            "<p>{{:adminLink}}</p>",
    ],

    'partner_application' => [
        'enabled' => true,
        'extraRecipients' => [],
        'applicantSubject' => 'Votre proposition de partenariat AAJ',
        'applicantHtml' =>
            "<p>Bonjour {{contactName}},</p>" .
            "<p>Nous avons bien reçu votre proposition de partenariat pour {{company}}. " .
            "Notre équipe vous contactera prochainement pour discuter des prochaines " .
            "étapes.</p>" .
            "<p>— L'équipe AAJ</p>",
        'adminSubject' => 'Nouvelle proposition de partenariat AAJ',
        'adminHtml' =>
            "<p>Nouvelle proposition de partenariat :</p>" .
            "<ul>" .
            "<li><strong>Contact :</strong> {{contactName}}</li>" .
            "<li><strong>Email :</strong> {{email}}</li>" .
            "<li><strong>Téléphone :</strong> {{phone}}</li>" .
            "<li><strong>Société :</strong> {{company}}</li>" .
            "<li><strong>Activité :</strong> {{activity}}</li>" .
            "<li><strong>Type de sponsoring :</strong> {{sponsorshipType}}</li>" .
            "</ul>" .
            "<p><strong>Message :</strong><br>{{nl2br:message}}</p>" .
            "<p>{{:adminLink}}</p>",
    ],

    'password_reset' => [
        'enabled' => true,
        'extraRecipients' => [],
        'subject' => 'Réinitialisation de votre mot de passe',
        'html' =>
            "<p>Bonjour {{name}},</p>" .
            "<p>Vous avez demandé la réinitialisation de votre mot de passe pour " .
            "l'espace adhérents des Architectes de Jerba.</p>" .
            "<p><a href=\"{{resetUrl}}\">Réinitialiser mon mot de passe</a></p>" .
            "<p>Ce lien expire dans 1 heure. Si vous n'êtes pas à l'origine de cette " .
            "demande, ignorez ce message.</p>",
    ],

    'account_created' => [
        'enabled' => true,
        'extraRecipients' => [],
        'subject' => "Votre compte sur l'espace adhérents AAJ",
        'html' =>
            "<p>Bonjour {{name}},</p>" .
            "<p>Un compte vient d'être créé pour vous sur l'espace adhérents " .
            "des Architectes de Jerba.</p>" .
            "<p><strong>Vos identifiants de connexion :</strong></p>" .
            "<ul>" .
            "<li>Email : <code>{{email}}</code></li>" .
            "<li>Mot de passe temporaire : <code>{{tempPassword}}</code></li>" .
            "</ul>" .
            "<p><a href=\"{{loginUrl}}\">Accéder à l'espace adhérents</a></p>" .
            "<p>Pour des raisons de sécurité, vous serez invité à choisir un " .
            "nouveau mot de passe lors de votre première connexion.</p>",
    ],

    'unesco_permit_review_requested' => [
        'enabled' => true,
        'extraRecipients' => [],
        'subject' => '[AAJ – UNESCO] Nouvelle demande : {{title}}',
        'html' =>
            "<p>Une nouvelle demande de permis UNESCO vient d'être déposée.</p>" .
            "<p><strong>Titre :</strong> {{title}}</p>" .
            "<p>Connectez-vous à l'espace adhérents pour l'instruire.</p>",
    ],

    'unesco_permit_status_changed' => [
        'enabled' => true,
        'extraRecipients' => [],
        'subject' => '[AAJ – UNESCO] {{statusLabel}} : {{title}}',
        'html' =>
            "<p>Bonjour {{name}},</p>" .
            "<p>Le statut de votre demande \"<strong>{{title}}</strong>\" a évolué.</p>" .
            "<p><strong>Nouveau statut :</strong> {{statusLabel}}</p>" .
            "<p><strong>Commentaire :</strong><br>{{nl2br:message}}</p>" .
            "<p>Connectez-vous à l'espace adhérents pour consulter le détail.</p>",
    ],
];

/** Documented variable list for the frontend help tooltip. */
const NOTIFICATION_VARS = [
    'membership_application' => [
        ['key' => 'fullName', 'desc' => 'Nom complet'],
        ['key' => 'firstName', 'desc' => 'Prénom'],
        ['key' => 'lastName', 'desc' => 'Nom'],
        ['key' => 'email', 'desc' => 'Email du candidat'],
        ['key' => 'phone', 'desc' => 'Téléphone'],
        ['key' => 'category', 'desc' => 'Catégorie'],
        ['key' => 'city', 'desc' => 'Ville'],
        ['key' => ':adminLink', 'desc' => "Lien HTML vers l'espace adhérents (admin uniquement)"],
    ],
    'partner_application' => [
        ['key' => 'contactName', 'desc' => 'Nom du contact'],
        ['key' => 'company', 'desc' => 'Société'],
        ['key' => 'email', 'desc' => 'Email du contact'],
        ['key' => 'phone', 'desc' => 'Téléphone'],
        ['key' => 'activity', 'desc' => 'Activité'],
        ['key' => 'sponsorshipType', 'desc' => 'Type de sponsoring'],
        ['key' => 'nl2br:message', 'desc' => 'Message libre (avec sauts de ligne)'],
        ['key' => ':adminLink', 'desc' => "Lien HTML vers l'espace adhérents (admin uniquement)"],
    ],
    'password_reset' => [
        ['key' => 'name', 'desc' => "Nom de l'utilisateur"],
        ['key' => 'email', 'desc' => 'Email'],
        ['key' => 'resetUrl', 'desc' => 'URL de réinitialisation (à conserver)'],
    ],
    'account_created' => [
        ['key' => 'name', 'desc' => "Nom de l'utilisateur"],
        ['key' => 'email', 'desc' => 'Email du compte'],
        ['key' => 'tempPassword', 'desc' => 'Mot de passe temporaire'],
        ['key' => 'loginUrl', 'desc' => 'URL de connexion'],
    ],
    'unesco_permit_review_requested' => [
        ['key' => 'title', 'desc' => 'Titre du permis'],
        ['key' => 'permitId', 'desc' => 'ID du permis'],
    ],
    'unesco_permit_status_changed' => [
        ['key' => 'name', 'desc' => 'Nom du candidat'],
        ['key' => 'title', 'desc' => 'Titre du permis'],
        ['key' => 'status', 'desc' => 'Code statut brut'],
        ['key' => 'statusLabel', 'desc' => 'Statut libellé (FR)'],
        ['key' => 'nl2br:message', 'desc' => 'Commentaire (avec sauts de ligne)'],
    ],
];

/** Events that have an applicant template AND an admin template. */
const NOTIFICATION_DUAL_EVENTS = ['membership_application', 'partner_application'];

/**
 * Read the merged settings: defaults overridden by whatever is stored in the
 * config table. Always returns a complete structure so callers can index
 * keys without null-checking.
 */
function notification_settings(): array
{
    static $cached = null;
    if ($cached !== null) return $cached;

    $stored = [];
    try {
        $stmt = db()->prepare("SELECT value FROM config WHERE id = 'notifications' LIMIT 1");
        $stmt->execute();
        $row = $stmt->fetch();
        if ($row && !empty($row['value'])) {
            $decoded = is_string($row['value']) ? json_decode($row['value'], true) : $row['value'];
            if (is_array($decoded)) $stored = $decoded;
        }
    } catch (Throwable $e) {
        error_log('notification_settings: ' . $e->getMessage());
    }

    $events = [];
    foreach (NOTIFICATION_DEFAULTS as $event => $defaults) {
        $userValue = isset($stored['events'][$event]) && is_array($stored['events'][$event])
            ? $stored['events'][$event]
            : [];
        $merged = $defaults;
        foreach (['enabled'] as $k) {
            if (array_key_exists($k, $userValue)) $merged[$k] = (bool)$userValue[$k];
        }
        if (array_key_exists('extraRecipients', $userValue) && is_array($userValue['extraRecipients'])) {
            $merged['extraRecipients'] = array_values(array_filter(array_map(
                static fn($s) => filter_var(trim((string)$s), FILTER_VALIDATE_EMAIL) ?: '',
                $userValue['extraRecipients']
            )));
        }
        foreach (['subject', 'html', 'applicantSubject', 'applicantHtml', 'adminSubject', 'adminHtml'] as $k) {
            if (isset($defaults[$k]) && isset($userValue[$k]) && is_string($userValue[$k]) && trim($userValue[$k]) !== '') {
                $merged[$k] = $userValue[$k];
            }
        }
        $events[$event] = $merged;
    }

    return $cached = ['events' => $events];
}

function notification_event_enabled(string $event): bool
{
    $s = notification_settings();
    return (bool)($s['events'][$event]['enabled'] ?? true);
}

/**
 * @return string[] Extra recipients configured by the admin for $event.
 */
function notification_extra_recipients(string $event): array
{
    $s = notification_settings();
    $list = $s['events'][$event]['extraRecipients'] ?? [];
    return is_array($list) ? array_values(array_filter(array_map('strval', $list))) : [];
}

/**
 * Render a configured template against $vars.
 * Supported markers:
 *   {{key}}         — HTML-escaped value
 *   {{:key}}        — raw HTML (use only for trusted internal HTML like links)
 *   {{nl2br:key}}   — escaped + nl2br()
 */
function notification_render(string $event, string $field, array $vars): string
{
    $settings = notification_settings();
    $template = (string)($settings['events'][$event][$field]
        ?? NOTIFICATION_DEFAULTS[$event][$field]
        ?? '');
    if ($template === '') return '';

    return preg_replace_callback(
        '/\{\{\s*([A-Za-z0-9_:]+)\s*\}\}/',
        static function ($m) use ($vars) {
            $token = $m[1];
            $mode = '';
            if (str_starts_with($token, ':')) { $mode = 'raw'; $key = substr($token, 1); }
            elseif (str_starts_with($token, 'nl2br:')) { $mode = 'nl2br'; $key = substr($token, 6); }
            else { $key = $token; }
            $val = $vars[$key] ?? '';
            $val = is_scalar($val) ? (string)$val : '';
            if ($mode === 'raw') return $val;
            $escaped = htmlspecialchars($val, ENT_QUOTES, 'UTF-8');
            if ($mode === 'nl2br') return nl2br($escaped);
            return $escaped;
        },
        $template
    ) ?? $template;
}

/**
 * Compute the admin recipient list for an event:
 *   default admins + super-admins from the users table
 *   + extra recipients configured for this event
 *   minus duplicates.
 */
function notification_admin_recipients(string $event, ?array $defaultAdmins = null): array
{
    $base = $defaultAdmins;
    if ($base === null) {
        $base = function_exists('admin_notify_emails') ? admin_notify_emails() : [];
    }
    $extras = notification_extra_recipients($event);
    $merged = array_merge((array)$base, $extras);
    $seen = [];
    $out = [];
    foreach ($merged as $email) {
        $email = strtolower(trim((string)$email));
        if ($email === '' || isset($seen[$email])) continue;
        $seen[$email] = true;
        $out[] = $email;
    }
    return $out;
}

/**
 * Sample variable values used by the "Send a test email" admin button so
 * the rendered preview looks realistic.
 */
function notification_sample_vars(string $event, string $siteUrl = ''): array
{
    $adminUrl = $siteUrl !== '' ? rtrim($siteUrl, '/') . '/espace-adherents' : '#';
    $adminLink = '<a href="' . htmlspecialchars($adminUrl, ENT_QUOTES, 'UTF-8') . '">Voir dans l\'espace adhérents</a>';
    switch ($event) {
        case 'membership_application':
            return [
                'fullName' => 'Amel Ben Salem',
                'firstName' => 'Amel',
                'lastName' => 'Ben Salem',
                'email' => 'amel.bensalem@example.com',
                'phone' => '+216 22 123 456',
                'category' => 'Architecte',
                'city' => 'Houmt Souk',
                'adminLink' => $adminLink,
            ];
        case 'partner_application':
            return [
                'contactName' => 'Karim Trabelsi',
                'company' => 'Trabelsi & Associés',
                'email' => 'karim@trabelsi.tn',
                'phone' => '+216 71 987 654',
                'activity' => 'Bureau d\'études',
                'sponsorshipType' => 'Or',
                'message' => "Bonjour,\nNous serions ravis de soutenir l'AAJ.",
                'adminLink' => $adminLink,
            ];
        case 'password_reset':
            return [
                'name' => 'Amel Ben Salem',
                'email' => 'amel.bensalem@example.com',
                'resetUrl' => $siteUrl . '/reset-password?oobCode=demo',
            ];
        case 'account_created':
            return [
                'name' => 'Amel Ben Salem',
                'email' => 'amel.bensalem@example.com',
                'tempPassword' => 'Ex9mPL3-T3sT',
                'loginUrl' => $siteUrl . '/espace-adherents',
            ];
        case 'unesco_permit_review_requested':
            return [
                'title' => 'Restauration de la médina de Houmt Souk',
                'permitId' => 'demo-permit-id',
            ];
        case 'unesco_permit_status_changed':
            return [
                'name' => 'Amel Ben Salem',
                'title' => 'Restauration de la médina de Houmt Souk',
                'status' => 'approved',
                'statusLabel' => 'Avis favorable',
                'message' => "Le dossier est complet.\nFélicitations.",
            ];
        default:
            return [];
    }
}

/* ============================================================
 * 2) IN-APP NOTIFICATIONS — fan-out, scopes, preferences
 * ============================================================ */

/**
 * Crée une notification in-app pour UN destinataire.
 * Retourne l'id généré ou null en cas d'échec.
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
 * @return string[]
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
 * Retourne les uids de tous les admins/super-admins actifs.
 * @return string[]
 */
function admin_recipient_uids(): array
{
    return resolve_notification_scope('admins');
}

/**
 * Vérifie la préférence d'un user pour un type donné.
 * Default in_app=true, email=false. Le type 'all' agit en kill-switch.
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
        $globalAllowed = true;
        $globalEmailAllowed = false;
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
