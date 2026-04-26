<?php
declare(strict_types=1);

/**
 * Notifications — admin-editable templates + recipients + on/off toggle for
 * every transactional email the API sends.
 *
 * Storage: a single document `config/notifications` (JSON column) with the
 * shape described in NOTIFICATION_DEFAULTS below. The frontend (Paramètres
 * → Mails de notifications) writes through the standard config endpoint;
 * everything in this file is the read side + the rendering helpers used by
 * mail.php, auth.php and unesco.php.
 *
 * Templates use `{{variable}}` interpolation. By default values are
 * HTML-escaped; prefix with a colon to inject raw HTML — e.g. `{{:adminLink}}`
 * keeps an `<a>` tag intact. `{{nl2br:message}}` runs nl2br() after escaping.
 */

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
        // Fields with sensible per-key fallbacks
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
 *
 * @param string $event   Event id (must exist in NOTIFICATION_DEFAULTS).
 * @param string $field   Field id within that event ('subject', 'html', 'applicantSubject'…).
 * @param array  $vars    Substitution variables.
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
 * Pass a custom $defaultAdmins to keep an event's hard-coded audience
 * (e.g. UNESCO reviewers) and just append the configured extras.
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
 * the rendered preview looks realistic. Keep keys aligned with the variable
 * lists in NOTIFICATION_VARS.
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
