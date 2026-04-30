<?php
declare(strict_types=1);

/**
 * UNESCO — Djerba World Heritage endpoints.
 *
 * Routes (all under /api/unesco):
 *   GET    /geojson                 — aggregated FeatureCollection for the map
 *   GET    /kmz-sources             — list KMZ sources (admin)
 *   POST   /kmz-sources             — upload a new KMZ + extract (admin, multipart)
 *   PUT    /kmz-sources/{id}        — rename / toggle (admin)
 *   DELETE /kmz-sources/{id}        — delete (admin)
 *
 *   GET    /zones                   — list zones with regulations (active members)
 *   PUT    /zones/{id}              — edit regulation excerpt / color / doc (admin)
 *
 *   GET    /documents               — list curated UNESCO documents (members)
 *   POST   /documents               — create a document entry (admin)
 *   PUT    /documents/{id}          — edit (admin)
 *   DELETE /documents/{id}          — delete (admin)
 *
 *   GET    /permits                 — list (mine vs. all based on perms)
 *   POST   /permits                 — create draft permit (active members)
 *   GET    /permits/{id}            — detail (owner or reviewer)
 *   PUT    /permits/{id}            — patch fields (owner while draft, or reviewer)
 *   POST   /permits/{id}/submit     — transition draft → submitted (owner)
 *   POST   /permits/{id}/events     — append status change or comment (reviewer)
 *                                     owner can only post 'withdraw'
 *   POST   /permits/{id}/files      — attach a file already uploaded via /api/files
 *   DELETE /permits/{id}/files/{f}  — detach + delete file
 *
 *   GET    /status-counts           — admin badge counter (pending review)
 */

function handle_unesco(string $method, array $rest): void
{
    $root = $rest[0] ?? '';
    $sub = array_slice($rest, 1);
    switch ($root) {
        case 'geojson':         unesco_geojson(); return;
        case 'kmz-sources':     unesco_kmz_route($method, $sub); return;
        case 'zones':           unesco_zones_route($method, $sub); return;
        case 'documents':       unesco_documents_route($method, $sub); return;
        case 'permits':         unesco_permits_route($method, $sub); return;
        case 'permit-statuses': unesco_statuses_route($method, $sub); return;
        case 'status-counts':   unesco_status_counts(); return;
    }
    json_error('not_found', 'Endpoint UNESCO inconnu.', 404);
}

// ----------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------

function unesco_require_view(): array
{
    $user = require_auth();
    if (($user['status'] ?? '') !== 'active' && !is_admin($user) && !user_has_permission($user, 'unesco_manage')) {
        json_error('forbidden', 'Compte inactif.', 403);
    }
    if (!(is_admin($user)
        || user_has_permission($user, 'unesco_view')
        || user_has_permission($user, 'unesco_manage')
        || user_has_permission($user, 'unesco_permits_review')
        || user_has_permission($user, 'unesco_permits_submit'))) {
        json_error('forbidden', 'Accès à Djerba UNESCO non autorisé.', 403);
    }
    return $user;
}

function unesco_require_manage(): array
{
    $user = require_auth();
    if (!(is_admin($user) || user_has_permission($user, 'unesco_manage'))) {
        json_error('forbidden', 'Droits administrateur UNESCO requis.', 403);
    }
    return $user;
}

function unesco_require_review(): array
{
    $user = require_auth();
    if (!(is_admin($user) || user_has_permission($user, 'unesco_manage') || user_has_permission($user, 'unesco_permits_review'))) {
        json_error('forbidden', 'Droits d\'instruction requis.', 403);
    }
    return $user;
}

function unesco_uploads_dir(): string
{
    global $CONFIG;
    $base = rtrim((string)$CONFIG['uploads']['storage_dir'], '/\\');
    $dir = $base . DIRECTORY_SEPARATOR . 'unesco';
    if (!is_dir($dir) && !@mkdir($dir, 0750, true) && !is_dir($dir)) {
        json_error('storage_error', 'Impossible de créer le dossier UNESCO.', 500);
    }
    return $dir;
}

function unesco_kmz_view(array $row): array
{
    return [
        'id' => $row['id'],
        'title' => $row['title'],
        'description' => $row['description'] ?? null,
        'kmzFileId' => $row['kmz_file_id'] ?? null,
        'geojsonPath' => $row['geojson_path'] ?? null,
        'bbox' => $row['bbox'] ? json_decode((string)$row['bbox'], true) : null,
        'featureCount' => (int)($row['feature_count'] ?? 0),
        'isActive' => (bool)($row['is_active'] ?? 0),
        'sortOrder' => (int)($row['sort_order'] ?? 0),
        'createdBy' => $row['created_by'] ?? null,
        'createdAt' => iso_datetime($row['created_at'] ?? null),
    ];
}

function unesco_zone_view(array $row): array
{
    return [
        'id' => $row['id'],
        'kmzSourceId' => $row['kmz_source_id'],
        'featureKey' => $row['feature_key'],
        'name' => $row['name'],
        'zoneType' => $row['zone_type'] ?? 'buffer',
        'color' => $row['color'] ?? '#2563EB',
        'regulationShort' => $row['regulation_short'] ?? null,
        'regulationDocId' => $row['regulation_doc_id'] ?? null,
        'externalUrl' => $row['external_url'] ?? null,
        'bbox' => $row['bbox'] ? json_decode((string)$row['bbox'], true) : null,
        'sortOrder' => (int)($row['sort_order'] ?? 0),
        'isVisible' => (bool)($row['is_visible'] ?? 1),
        'createdAt' => iso_datetime($row['created_at'] ?? null),
        'updatedAt' => iso_datetime($row['updated_at'] ?? null),
    ];
}

function unesco_document_view(array $row): array
{
    global $CONFIG;
    $downloadUrl = null;
    if (!empty($row['file_id'])) {
        $downloadUrl = rtrim((string)$CONFIG['site']['uploads_base'], '/') . '/' . $row['file_id'];
    }
    return [
        'id' => $row['id'],
        'title' => $row['title'],
        'description' => $row['description'] ?? null,
        'category' => $row['category'] ?? 'autre',
        'fileId' => $row['file_id'] ?? null,
        'downloadUrl' => $downloadUrl,
        'externalUrl' => $row['external_url'] ?? null,
        'year' => $row['year'] ?? null,
        'language' => $row['language'] ?? null,
        'sortOrder' => (int)($row['sort_order'] ?? 0),
        'isVisible' => (bool)($row['is_visible'] ?? 1),
        'createdAt' => iso_datetime($row['created_at'] ?? null),
        'updatedAt' => iso_datetime($row['updated_at'] ?? null),
    ];
}

function unesco_permit_view(array $row, ?array $applicant = null, array $zones = [], array $events = [], array $files = []): array
{
    $zoneAuto = $zones[$row['auto_zone_id'] ?? ''] ?? null;
    $zoneFinal = $zones[$row['final_zone_id'] ?? ''] ?? null;
    return [
        'id' => $row['id'],
        'applicantUid' => $row['applicant_uid'],
        'applicant' => $applicant,
        'projectRef' => $row['project_ref'] ?? null,
        'title' => $row['title'],
        'description' => $row['description'] ?? null,
        'address' => $row['address'] ?? null,
        'city' => $row['city'] ?? null,
        'parcelNumber' => $row['parcel_number'] ?? null,
        'latitude' => $row['latitude'] !== null ? (float)$row['latitude'] : null,
        'longitude' => $row['longitude'] !== null ? (float)$row['longitude'] : null,
        'autoZoneId' => $row['auto_zone_id'] ?? null,
        'autoZone' => $zoneAuto,
        'finalZoneId' => $row['final_zone_id'] ?? null,
        'finalZone' => $zoneFinal,
        'projectType' => $row['project_type'] ?? null,
        'surfaceSqm' => $row['surface_sqm'] !== null ? (float)$row['surface_sqm'] : null,
        'floorsCount' => $row['floors_count'] !== null ? (int)$row['floors_count'] : null,
        'status' => $row['status'] ?? 'draft',
        'submittedAt' => iso_datetime($row['submitted_at'] ?? null),
        'decisionAt' => iso_datetime($row['decision_at'] ?? null),
        'decisionNote' => $row['decision_note'] ?? null,
        'reviewerUid' => $row['reviewer_uid'] ?? null,
        'createdAt' => iso_datetime($row['created_at'] ?? null),
        'updatedAt' => iso_datetime($row['updated_at'] ?? null),
        'events' => $events,
        'files' => $files,
    ];
}

function unesco_event_view(array $row): array
{
    return [
        'id' => $row['id'],
        'permitId' => $row['permit_id'],
        'authorUid' => $row['author_uid'] ?? null,
        'authorName' => $row['author_name'] ?? '',
        'kind' => $row['kind'] ?? 'note',
        'fromStatus' => $row['from_status'] ?? null,
        'toStatus' => $row['to_status'] ?? null,
        'message' => $row['message'] ?? null,
        'isInternal' => (bool)($row['is_internal'] ?? 0),
        'createdAt' => iso_datetime($row['created_at'] ?? null),
    ];
}

function unesco_permit_file_view(array $row): array
{
    global $CONFIG;
    $downloadUrl = rtrim((string)$CONFIG['site']['uploads_base'], '/') . '/' . $row['file_id'];
    return [
        'id' => $row['id'],
        'permitId' => $row['permit_id'],
        'fileId' => $row['file_id'],
        'downloadUrl' => $downloadUrl,
        'kind' => $row['kind'] ?? 'attachment',
        'title' => $row['title'] ?? null,
        'originalName' => $row['original_name'] ?? null,
        'sizeBytes' => $row['size_bytes'] !== null ? (int)$row['size_bytes'] : null,
        'mimeType' => $row['mime_type'] ?? null,
        'uploadedBy' => $row['uploaded_by'] ?? null,
        'createdAt' => iso_datetime($row['created_at'] ?? null),
    ];
}

// ----------------------------------------------------------------------
// GeoJSON aggregator (what the map consumes)
// ----------------------------------------------------------------------

function unesco_geojson(): void
{
    unesco_require_view();

    $pdo = db();
    $sources = $pdo->query(
        'SELECT * FROM unesco_kmz_sources WHERE is_active = 1 ORDER BY sort_order ASC, created_at ASC'
    )->fetchAll();

    // zone metadata keyed by (kmz_source_id, feature_key) so we can decorate
    // every feature inline without a lookup-per-feature SQL round trip.
    $zoneByKey = [];
    if (!empty($sources)) {
        $stmt = $pdo->query('SELECT * FROM unesco_zones WHERE is_visible = 1');
        while ($z = $stmt->fetch()) {
            $zoneByKey[$z['kmz_source_id'] . '|' . $z['feature_key']] = $z;
        }
    }

    $features = [];
    $bbox = null;
    $sourceSummaries = [];
    foreach ($sources as $src) {
        $geojsonPath = (string)($src['geojson_path'] ?? '');
        if ($geojsonPath === '') continue;
        $absolute = unesco_uploads_dir() . DIRECTORY_SEPARATOR . basename($geojsonPath);
        if (!is_file($absolute)) continue;
        $raw = @file_get_contents($absolute);
        if ($raw === false) continue;
        $fc = json_decode($raw, true);
        if (!is_array($fc) || empty($fc['features'])) continue;

        $kept = 0;
        foreach ($fc['features'] as $feat) {
            $props = $feat['properties'] ?? [];
            $fk = (string)($props['_featureKey'] ?? '');
            $zone = $zoneByKey[$src['id'] . '|' . $fk] ?? null;
            if ($zone) {
                $props['zoneId'] = $zone['id'];
                $props['color'] = $zone['color'];
                $props['name'] = $zone['name'];
                $props['zoneType'] = $zone['zone_type'];
                $props['regulationShort'] = $zone['regulation_short'];
                $props['regulationDocId'] = $zone['regulation_doc_id'];
                $props['externalUrl'] = $zone['external_url'];
            }
            $props['kmzSourceId'] = $src['id'];
            $props['kmzSourceTitle'] = $src['title'];
            $feat['properties'] = $props;
            $features[] = $feat;
            $kept++;
        }

        if (!empty($fc['bbox'])) {
            $bbox = bbox_merge($bbox, $fc['bbox']);
        }

        $sourceSummaries[] = [
            'id' => $src['id'],
            'title' => $src['title'],
            'description' => $src['description'] ?? null,
            'featureCount' => $kept,
            'sortOrder' => (int)($src['sort_order'] ?? 0),
            'bbox' => !empty($fc['bbox']) ? $fc['bbox'] : null,
        ];
    }

    json_response([
        'type' => 'FeatureCollection',
        'features' => $features,
        'bbox' => $bbox,
        'sources' => $sourceSummaries,
    ]);
}

// ----------------------------------------------------------------------
// KMZ sources
// ----------------------------------------------------------------------

function unesco_kmz_route(string $method, array $rest): void
{
    $id = $rest[0] ?? null;
    if ($method === 'GET' && $id === null) { unesco_kmz_list(); return; }
    if ($method === 'POST' && $id === null) { unesco_kmz_upload(); return; }
    if ($method === 'PUT' && $id !== null) { unesco_kmz_update($id); return; }
    if ($method === 'DELETE' && $id !== null) { unesco_kmz_delete($id); return; }
    json_error('method_not_allowed', 'Méthode non autorisée.', 405);
}

function unesco_kmz_list(): void
{
    unesco_require_manage();
    $rows = db()->query(
        'SELECT * FROM unesco_kmz_sources ORDER BY sort_order ASC, created_at DESC'
    )->fetchAll();
    json_response(['items' => array_map('unesco_kmz_view', $rows)]);
}

function unesco_kmz_upload(): void
{
    global $CONFIG;
    $user = unesco_require_manage();

    if (empty($_FILES['file']) || !is_uploaded_file($_FILES['file']['tmp_name'])) {
        json_error('no_file', 'Aucun fichier envoyé.', 400);
    }
    $up = $_FILES['file'];
    if ($up['error'] !== UPLOAD_ERR_OK) json_error('upload_failed', 'Erreur d\'upload.', 400);
    $maxBytes = (int)($CONFIG['uploads']['max_bytes'] ?? 10 * 1024 * 1024);
    if ($up['size'] > $maxBytes) json_error('too_large', 'Fichier trop volumineux.', 413);

    $ext = strtolower(pathinfo((string)$up['name'], PATHINFO_EXTENSION));
    if (!in_array($ext, ['kmz', 'kml'], true)) {
        json_error('invalid_ext', 'Seuls les fichiers .kmz et .kml sont acceptés.', 415);
    }

    $title = trim((string)($_POST['title'] ?? ''));
    if ($title === '') {
        $title = pathinfo((string)$up['name'], PATHINFO_FILENAME) ?: 'Nouveau fichier';
    }
    $description = trim((string)($_POST['description'] ?? ''));

    // Parse upfront — if the file is malformed we abort before moving anything.
    try {
        if ($ext === 'kmz') {
            $fc = kmz_extract_to_geojson($up['tmp_name']);
        } else {
            $kml = @file_get_contents($up['tmp_name']);
            if ($kml === false) throw new RuntimeException('KML illisible.');
            $fc = kml_string_to_geojson($kml);
        }
    } catch (Throwable $e) {
        json_error('parse_failed', 'Analyse du KMZ échouée : ' . $e->getMessage(), 400);
    }

    $features = $fc['features'] ?? [];
    if (empty($features)) {
        json_error('no_features', 'Le KMZ ne contient aucune zone exploitable.', 422);
    }

    // Save original + extracted GeoJSON alongside.
    $storageDir = unesco_uploads_dir();
    $id = new_id(24);
    $fileBase = $id;
    $kmzDestName = $fileBase . '.' . $ext;
    $geojsonName = $fileBase . '.geojson';

    $kmzDest = $storageDir . DIRECTORY_SEPARATOR . $kmzDestName;
    if (!move_uploaded_file($up['tmp_name'], $kmzDest)) {
        json_error('storage_error', 'Sauvegarde du KMZ échouée.', 500);
    }
    $geojsonDest = $storageDir . DIRECTORY_SEPARATOR . $geojsonName;
    file_put_contents($geojsonDest, json_encode($fc, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));

    // Register the raw KMZ in the generic files table too so admins can
    // re-download it from the UI.
    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $mime = (string)$finfo->file($kmzDest) ?: 'application/octet-stream';
    $kmzFileId = new_id(24);
    db()->prepare(
        'INSERT INTO files (id, folder, owner_uid, original_name, stored_path, mime_type, size_bytes, access)
         VALUES (?, ?, ?, ?, ?, ?, ?, "private")'
    )->execute([
        $kmzFileId,
        'unesco',
        $user['uid'],
        (string)$up['name'],
        'unesco/' . $kmzDestName,
        $mime,
        (int)$up['size'],
    ]);

    // Compute sort_order: append after existing sources.
    $nextOrder = (int)(db()->query('SELECT COALESCE(MAX(sort_order),0)+1 FROM unesco_kmz_sources')->fetchColumn() ?: 1);

    db()->prepare(
        'INSERT INTO unesco_kmz_sources
            (id, title, description, kmz_file_id, geojson_path, bbox, feature_count, is_active, sort_order, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, UTC_TIMESTAMP())'
    )->execute([
        $id,
        $title,
        $description ?: null,
        $kmzFileId,
        'unesco/' . $geojsonName,
        isset($fc['bbox']) ? json_encode($fc['bbox']) : null,
        count($features),
        $nextOrder,
        $user['uid'],
    ]);

    // Seed a zone row for every feature. Keep the KML name as the default
    // zone name, leave regulation fields empty so the admin can fill them in.
    $zoneInsert = db()->prepare(
        'INSERT IGNORE INTO unesco_zones
            (id, kmz_source_id, feature_key, name, zone_type, color, regulation_short, regulation_doc_id, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, ?)'
    );
    $i = 0;
    foreach ($features as $feat) {
        $props = $feat['properties'] ?? [];
        $fk = (string)($props['_featureKey'] ?? '');
        if ($fk === '') continue;
        $name = (string)($props['name'] ?? 'Zone') ?: 'Zone';
        $color = unesco_default_zone_color($i);
        $zoneType = unesco_guess_zone_type($name);
        $zoneInsert->execute([new_id(24), $id, $fk, $name, $zoneType, $color, $i]);
        $i++;
    }

    $row = db()->prepare('SELECT * FROM unesco_kmz_sources WHERE id = ?');
    $row->execute([$id]);
    json_response(['item' => unesco_kmz_view($row->fetch() ?: [])]);
}

function unesco_default_zone_color(int $i): string
{
    $palette = ['#DC2626', '#EA580C', '#CA8A04', '#16A34A', '#0891B2', '#2563EB', '#7C3AED', '#DB2777'];
    return $palette[$i % count($palette)];
}

function unesco_guess_zone_type(string $name): string
{
    $n = mb_strtolower($name);
    if (strpos($n, 'core') !== false || strpos($n, 'central') !== false || strpos($n, 'classé') !== false) return 'core';
    if (strpos($n, 'buffer') !== false || strpos($n, 'tampon') !== false) return 'buffer';
    if (strpos($n, 'protect') !== false) return 'protected';
    return 'buffer';
}

function unesco_kmz_update(string $id): void
{
    unesco_require_manage();
    $body = read_json_body();
    $sets = [];
    $args = [];
    if (array_key_exists('title', $body)) { $sets[] = 'title = ?'; $args[] = (string)$body['title']; }
    if (array_key_exists('description', $body)) { $sets[] = 'description = ?'; $args[] = $body['description'] === null ? null : (string)$body['description']; }
    if (array_key_exists('isActive', $body)) { $sets[] = 'is_active = ?'; $args[] = $body['isActive'] ? 1 : 0; }
    if (array_key_exists('sortOrder', $body)) { $sets[] = 'sort_order = ?'; $args[] = (int)$body['sortOrder']; }
    if (!$sets) json_error('nothing_to_update', 'Aucun champ modifiable fourni.', 400);
    $args[] = $id;
    db()->prepare('UPDATE unesco_kmz_sources SET ' . implode(', ', $sets) . ' WHERE id = ?')->execute($args);

    $stmt = db()->prepare('SELECT * FROM unesco_kmz_sources WHERE id = ? LIMIT 1');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) json_error('not_found', 'Fichier KMZ introuvable.', 404);
    json_response(['item' => unesco_kmz_view($row)]);
}

function unesco_kmz_delete(string $id): void
{
    global $CONFIG;
    unesco_require_manage();

    $stmt = db()->prepare('SELECT * FROM unesco_kmz_sources WHERE id = ? LIMIT 1');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) json_error('not_found', 'Fichier introuvable.', 404);

    $base = rtrim((string)$CONFIG['uploads']['storage_dir'], '/\\');
    if (!empty($row['geojson_path'])) {
        $p = $base . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, (string)$row['geojson_path']);
        if (is_file($p)) @unlink($p);
    }
    if (!empty($row['kmz_file_id'])) {
        $f = db()->prepare('SELECT stored_path FROM files WHERE id = ? LIMIT 1');
        $f->execute([$row['kmz_file_id']]);
        $fp = $f->fetchColumn();
        if ($fp) {
            $full = $base . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, (string)$fp);
            if (is_file($full)) @unlink($full);
        }
        db()->prepare('DELETE FROM files WHERE id = ?')->execute([$row['kmz_file_id']]);
    }
    db()->prepare('DELETE FROM unesco_kmz_sources WHERE id = ?')->execute([$id]);
    json_response(['ok' => true]);
}

// ----------------------------------------------------------------------
// Zones (one row per KMZ feature — regulation enrichment lives here)
// ----------------------------------------------------------------------

function unesco_zones_route(string $method, array $rest): void
{
    $id = $rest[0] ?? null;
    if ($method === 'GET' && $id === null) { unesco_zones_list(); return; }
    if ($method === 'PUT' && $id !== null) { unesco_zone_update($id); return; }
    json_error('method_not_allowed', 'Méthode non autorisée.', 405);
}

function unesco_zones_list(): void
{
    unesco_require_view();
    $rows = db()->query(
        'SELECT * FROM unesco_zones ORDER BY kmz_source_id, sort_order ASC, name ASC'
    )->fetchAll();
    json_response(['items' => array_map('unesco_zone_view', $rows)]);
}

function unesco_zone_update(string $id): void
{
    unesco_require_manage();
    $body = read_json_body();
    $sets = [];
    $args = [];
    if (array_key_exists('name', $body)) { $sets[] = 'name = ?'; $args[] = (string)$body['name']; }
    if (array_key_exists('zoneType', $body)) { $sets[] = 'zone_type = ?'; $args[] = (string)$body['zoneType']; }
    if (array_key_exists('color', $body)) { $sets[] = 'color = ?'; $args[] = (string)$body['color']; }
    if (array_key_exists('regulationShort', $body)) { $sets[] = 'regulation_short = ?'; $args[] = $body['regulationShort'] === null ? null : (string)$body['regulationShort']; }
    if (array_key_exists('regulationDocId', $body)) { $sets[] = 'regulation_doc_id = ?'; $args[] = $body['regulationDocId'] === null ? null : (string)$body['regulationDocId']; }
    if (array_key_exists('externalUrl', $body)) { $sets[] = 'external_url = ?'; $args[] = $body['externalUrl'] === null ? null : (string)$body['externalUrl']; }
    if (array_key_exists('isVisible', $body)) { $sets[] = 'is_visible = ?'; $args[] = $body['isVisible'] ? 1 : 0; }
    if (array_key_exists('sortOrder', $body)) { $sets[] = 'sort_order = ?'; $args[] = (int)$body['sortOrder']; }
    if (!$sets) json_error('nothing_to_update', 'Aucun champ modifiable fourni.', 400);
    $args[] = $id;
    db()->prepare('UPDATE unesco_zones SET ' . implode(', ', $sets) . ' WHERE id = ?')->execute($args);

    $stmt = db()->prepare('SELECT * FROM unesco_zones WHERE id = ? LIMIT 1');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) json_error('not_found', 'Zone introuvable.', 404);
    json_response(['item' => unesco_zone_view($row)]);
}

// ----------------------------------------------------------------------
// Documents
// ----------------------------------------------------------------------

function unesco_documents_route(string $method, array $rest): void
{
    $id = $rest[0] ?? null;
    if ($method === 'GET' && $id === null) { unesco_documents_list(); return; }
    if ($method === 'POST' && $id === null) { unesco_document_create(); return; }
    if ($method === 'PUT' && $id !== null) { unesco_document_update($id); return; }
    if ($method === 'DELETE' && $id !== null) { unesco_document_delete($id); return; }
    json_error('method_not_allowed', 'Méthode non autorisée.', 405);
}

function unesco_documents_list(): void
{
    unesco_require_view();
    $rows = db()->query(
        'SELECT * FROM unesco_documents WHERE is_visible = 1 OR 1=1 ORDER BY category ASC, sort_order ASC, created_at DESC'
    )->fetchAll();

    // Members only see visible items. Admins (unesco_manage) see everything.
    $user = current_user();
    $canManage = $user && (is_admin($user) || user_has_permission($user, 'unesco_manage'));
    $items = array_map('unesco_document_view', $rows);
    if (!$canManage) {
        $items = array_values(array_filter($items, fn($d) => !empty($d['isVisible'])));
    }
    json_response(['items' => $items]);
}

function unesco_document_create(): void
{
    $user = unesco_require_manage();
    $body = read_json_body();
    $title = trim((string)($body['title'] ?? ''));
    if ($title === '') json_error('title_required', 'Le titre est obligatoire.', 400);
    $id = new_id(24);
    db()->prepare(
        'INSERT INTO unesco_documents
            (id, title, description, category, file_id, external_url, year, language, sort_order, is_visible, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )->execute([
        $id,
        $title,
        $body['description'] ?? null,
        (string)($body['category'] ?? 'classement'),
        $body['fileId'] ?? null,
        $body['externalUrl'] ?? null,
        $body['year'] ?? null,
        $body['language'] ?? null,
        (int)($body['sortOrder'] ?? 0),
        !empty($body['isVisible']) ? 1 : (array_key_exists('isVisible', $body) ? 0 : 1),
        $user['uid'],
    ]);
    $stmt = db()->prepare('SELECT * FROM unesco_documents WHERE id = ? LIMIT 1');
    $stmt->execute([$id]);
    json_response(['item' => unesco_document_view($stmt->fetch() ?: [])]);
}

function unesco_document_update(string $id): void
{
    unesco_require_manage();
    $body = read_json_body();
    $sets = [];
    $args = [];
    $map = [
        'title' => 'title',
        'description' => 'description',
        'category' => 'category',
        'fileId' => 'file_id',
        'externalUrl' => 'external_url',
        'year' => 'year',
        'language' => 'language',
        'sortOrder' => 'sort_order',
    ];
    foreach ($map as $k => $col) {
        if (!array_key_exists($k, $body)) continue;
        $sets[] = "`$col` = ?";
        $v = $body[$k];
        if ($col === 'sort_order') $v = (int)$v;
        $args[] = $v === '' ? null : $v;
    }
    if (array_key_exists('isVisible', $body)) {
        $sets[] = 'is_visible = ?';
        $args[] = $body['isVisible'] ? 1 : 0;
    }
    if (!$sets) json_error('nothing_to_update', 'Aucun champ modifiable fourni.', 400);
    $args[] = $id;
    db()->prepare('UPDATE unesco_documents SET ' . implode(', ', $sets) . ' WHERE id = ?')->execute($args);
    $stmt = db()->prepare('SELECT * FROM unesco_documents WHERE id = ? LIMIT 1');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) json_error('not_found', 'Document introuvable.', 404);
    json_response(['item' => unesco_document_view($row)]);
}

function unesco_document_delete(string $id): void
{
    unesco_require_manage();
    db()->prepare('DELETE FROM unesco_documents WHERE id = ?')->execute([$id]);
    json_response(['ok' => true]);
}

// ----------------------------------------------------------------------
// Permits
// ----------------------------------------------------------------------

// ----------------------------------------------------------------------
// Permit statuses (admin-managed list backing every status badge,
// dropdown and transition rule used in the permit workflow).
// ----------------------------------------------------------------------

function unesco_status_view(array $row): array
{
    $next = [];
    if (!empty($row['next_statuses'])) {
        $decoded = json_decode((string)$row['next_statuses'], true);
        if (is_array($decoded)) {
            $next = array_values(array_filter($decoded, 'is_string'));
        }
    }
    return [
        'key' => (string)$row['status_key'],
        'label' => (string)$row['label'],
        'colorClass' => (string)$row['color_class'],
        'sortOrder' => (int)($row['sort_order'] ?? 0),
        'isSystem' => (bool)($row['is_system'] ?? 0),
        'isInitial' => (bool)($row['is_initial'] ?? 0),
        'isTerminal' => (bool)($row['is_terminal'] ?? 0),
        'allowsApplicantEdit' => (bool)($row['allows_applicant_edit'] ?? 0),
        'isApplicantWithdrawTarget' => (bool)($row['is_applicant_withdraw_target'] ?? 0),
        'nextStatuses' => $next,
        'isActive' => (bool)($row['is_active'] ?? 1),
        'createdAt' => iso_datetime($row['created_at'] ?? null),
        'updatedAt' => iso_datetime($row['updated_at'] ?? null),
    ];
}

function unesco_statuses_all(): array
{
    $rows = db()->query(
        'SELECT * FROM unesco_permit_statuses ORDER BY sort_order ASC, status_key ASC'
    )->fetchAll();
    return array_map('unesco_status_view', $rows);
}

function unesco_statuses_active_keys(): array
{
    $rows = db()->query(
        'SELECT status_key FROM unesco_permit_statuses WHERE is_active = 1'
    )->fetchAll();
    return array_map(fn($r) => (string)$r['status_key'], $rows);
}

function unesco_status_get(string $key): ?array
{
    $stmt = db()->prepare('SELECT * FROM unesco_permit_statuses WHERE status_key = ? LIMIT 1');
    $stmt->execute([$key]);
    $row = $stmt->fetch();
    return $row ? unesco_status_view($row) : null;
}

function unesco_statuses_route(string $method, array $rest): void
{
    $key = $rest[0] ?? null;
    if ($method === 'GET' && $key === null) { unesco_statuses_list(); return; }
    if ($method === 'POST' && $key === null) { unesco_status_create(); return; }
    if ($method === 'PUT' && $key !== null) { unesco_status_update($key); return; }
    if ($method === 'DELETE' && $key !== null) { unesco_status_delete($key); return; }
    json_error('method_not_allowed', 'Méthode non autorisée.', 405);
}

function unesco_statuses_list(): void
{
    // Any authenticated UNESCO viewer needs the list to render badges
    // and the admin filter. Admin gates are on write endpoints.
    unesco_require_view();
    $rows = db()->query(
        'SELECT * FROM unesco_permit_statuses ORDER BY sort_order ASC, status_key ASC'
    )->fetchAll();
    json_response(['items' => array_map('unesco_status_view', $rows)]);
}

function unesco_status_sanitize_key(string $raw): string
{
    $k = strtolower(trim($raw));
    $k = preg_replace('/[^a-z0-9_]+/u', '_', $k) ?? '';
    $k = trim($k, '_');
    return $k;
}

function unesco_status_validate_next(array $next, string $selfKey, ?string $previousKey = null): array
{
    $valid = [];
    $known = [];
    foreach (db()->query('SELECT status_key FROM unesco_permit_statuses')->fetchAll() as $r) {
        $known[(string)$r['status_key']] = true;
    }
    if ($previousKey !== null) $known[$previousKey] = true; // tolerate self-rename in PUT
    foreach ($next as $k) {
        if (!is_string($k)) continue;
        $k = trim($k);
        if ($k === '' || $k === $selfKey) continue;
        if (!isset($known[$k])) continue;
        $valid[$k] = true;
    }
    return array_keys($valid);
}

function unesco_status_create(): void
{
    unesco_require_manage();
    $body = read_json_body();
    $rawKey = (string)($body['key'] ?? '');
    $key = unesco_status_sanitize_key($rawKey);
    if ($key === '') json_error('key_required', 'Clé technique invalide.', 400);

    $exists = db()->prepare('SELECT 1 FROM unesco_permit_statuses WHERE status_key = ? LIMIT 1');
    $exists->execute([$key]);
    if ($exists->fetchColumn()) json_error('key_conflict', 'Cette clé existe déjà.', 409);

    $label = trim((string)($body['label'] ?? ''));
    if ($label === '') json_error('label_required', 'Libellé obligatoire.', 400);

    $color = trim((string)($body['colorClass'] ?? ''))
        ?: 'bg-slate-100 text-slate-700 border-slate-200';
    $sort = isset($body['sortOrder']) ? (int)$body['sortOrder'] : 100;
    $isActive = array_key_exists('isActive', $body) ? !empty($body['isActive']) : true;
    // Custom statuses are intermediate by design — semantic flags are
    // reserved for the system seeds so the PHP state machine invariants
    // (initial=draft, terminal=approved/rejected/withdrawn) keep holding.
    $next = is_array($body['nextStatuses'] ?? null) ? $body['nextStatuses'] : [];
    $next = unesco_status_validate_next($next, $key);

    db()->prepare(
        'INSERT INTO unesco_permit_statuses
            (status_key, label, color_class, sort_order, is_system,
             is_initial, is_terminal, allows_applicant_edit, is_applicant_withdraw_target,
             next_statuses, is_active)
         VALUES (?, ?, ?, ?, 0, 0, 0, 0, 0, ?, ?)'
    )->execute([
        $key, $label, $color, $sort,
        json_encode($next, JSON_UNESCAPED_UNICODE),
        $isActive ? 1 : 0,
    ]);

    $row = db()->prepare('SELECT * FROM unesco_permit_statuses WHERE status_key = ?');
    $row->execute([$key]);
    json_response(['item' => unesco_status_view($row->fetch())]);
}

function unesco_status_update(string $key): void
{
    unesco_require_manage();
    $cur = db()->prepare('SELECT * FROM unesco_permit_statuses WHERE status_key = ? LIMIT 1');
    $cur->execute([$key]);
    $row = $cur->fetch();
    if (!$row) json_error('not_found', 'Statut introuvable.', 404);

    $body = read_json_body();
    $sets = [];
    $args = [];

    if (array_key_exists('label', $body)) {
        $label = trim((string)$body['label']);
        if ($label === '') json_error('label_required', 'Libellé obligatoire.', 400);
        $sets[] = 'label = ?';
        $args[] = $label;
    }
    if (array_key_exists('colorClass', $body)) {
        $sets[] = 'color_class = ?';
        $args[] = trim((string)$body['colorClass']) ?: 'bg-slate-100 text-slate-700 border-slate-200';
    }
    if (array_key_exists('sortOrder', $body)) {
        $sets[] = 'sort_order = ?';
        $args[] = (int)$body['sortOrder'];
    }
    if (array_key_exists('isActive', $body)) {
        // System statuses cannot be deactivated — they are referenced by
        // the PHP state machine (decision_at trigger, withdrawal target).
        if ((int)$row['is_system'] === 1 && empty($body['isActive'])) {
            json_error('forbidden', 'Un statut système ne peut pas être désactivé.', 403);
        }
        $sets[] = 'is_active = ?';
        $args[] = !empty($body['isActive']) ? 1 : 0;
    }
    if (array_key_exists('nextStatuses', $body)) {
        $next = is_array($body['nextStatuses']) ? $body['nextStatuses'] : [];
        $next = unesco_status_validate_next($next, $key, $key);
        // Terminal statuses must keep an empty transition list — they
        // close the case in the workflow.
        if ((int)$row['is_terminal'] === 1 && $next) {
            json_error('forbidden', 'Un statut terminal ne peut pas avoir de transition sortante.', 400);
        }
        $sets[] = 'next_statuses = ?';
        $args[] = json_encode($next, JSON_UNESCAPED_UNICODE);
    }

    if (!$sets) json_error('nothing_to_update', 'Aucun champ modifiable fourni.', 400);
    $args[] = $key;
    db()->prepare('UPDATE unesco_permit_statuses SET ' . implode(', ', $sets) . ' WHERE status_key = ?')
        ->execute($args);

    $cur->execute([$key]);
    json_response(['item' => unesco_status_view($cur->fetch())]);
}

function unesco_status_delete(string $key): void
{
    unesco_require_manage();
    $cur = db()->prepare('SELECT * FROM unesco_permit_statuses WHERE status_key = ? LIMIT 1');
    $cur->execute([$key]);
    $row = $cur->fetch();
    if (!$row) json_error('not_found', 'Statut introuvable.', 404);
    if ((int)$row['is_system'] === 1) {
        json_error('forbidden', 'Un statut système ne peut pas être supprimé.', 403);
    }

    // Refuse if any permit currently uses this status — preserves audit trail.
    $used = db()->prepare('SELECT 1 FROM unesco_permits WHERE status = ? LIMIT 1');
    $used->execute([$key]);
    if ($used->fetchColumn()) {
        json_error('in_use', 'Ce statut est encore utilisé par au moins une demande.', 409);
    }

    db()->prepare('DELETE FROM unesco_permit_statuses WHERE status_key = ?')->execute([$key]);

    // Strip the deleted key from any remaining transition lists.
    foreach (db()->query('SELECT status_key, next_statuses FROM unesco_permit_statuses')->fetchAll() as $r) {
        $list = json_decode((string)($r['next_statuses'] ?? '[]'), true) ?: [];
        if (!is_array($list)) continue;
        $clean = array_values(array_filter($list, fn($k) => $k !== $key));
        if (count($clean) !== count($list)) {
            db()->prepare('UPDATE unesco_permit_statuses SET next_statuses = ? WHERE status_key = ?')
                ->execute([json_encode($clean, JSON_UNESCAPED_UNICODE), $r['status_key']]);
        }
    }

    json_response(['ok' => true]);
}

function unesco_permits_route(string $method, array $rest): void
{
    $id = $rest[0] ?? null;
    $sub = $rest[1] ?? null;
    $fid = $rest[2] ?? null;

    if ($method === 'GET' && $id === null) { unesco_permits_list(); return; }
    if ($method === 'POST' && $id === null) { unesco_permit_create(); return; }
    if ($id !== null && $sub === null) {
        if ($method === 'GET') { unesco_permit_get($id); return; }
        if ($method === 'PUT') { unesco_permit_update($id); return; }
        if ($method === 'DELETE') { unesco_permit_delete($id); return; }
    }
    if ($id !== null && $sub === 'submit' && $method === 'POST') { unesco_permit_submit($id); return; }
    if ($id !== null && $sub === 'events' && $method === 'POST') { unesco_permit_event_add($id); return; }
    if ($id !== null && $sub === 'files') {
        if ($method === 'POST') { unesco_permit_file_attach($id); return; }
        if ($method === 'DELETE' && $fid !== null) { unesco_permit_file_detach($id, $fid); return; }
    }
    json_error('method_not_allowed', 'Méthode non autorisée.', 405);
}

function unesco_permit_access(string $id, bool $requireWrite = false): array
{
    $user = require_auth();
    $stmt = db()->prepare('SELECT * FROM unesco_permits WHERE id = ? LIMIT 1');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) json_error('not_found', 'Demande introuvable.', 404);

    $isReviewer = is_admin($user) || user_has_permission($user, 'unesco_manage') || user_has_permission($user, 'unesco_permits_review');
    $isOwner = $row['applicant_uid'] === $user['uid'];
    if (!$isReviewer && !$isOwner) json_error('forbidden', 'Accès refusé.', 403);

    return ['user' => $user, 'row' => $row, 'isReviewer' => $isReviewer, 'isOwner' => $isOwner];
}

function unesco_permits_list(): void
{
    $user = require_auth();
    $isReviewer = is_admin($user) || user_has_permission($user, 'unesco_manage') || user_has_permission($user, 'unesco_permits_review');

    $status = (string)($_GET['status'] ?? '');
    $scope = (string)($_GET['scope'] ?? ($isReviewer ? 'all' : 'mine'));

    $where = [];
    $args = [];
    if ($scope === 'mine' || !$isReviewer) {
        $where[] = 'applicant_uid = ?';
        $args[] = $user['uid'];
    }
    if ($status !== '' && unesco_status_get($status) !== null) {
        $where[] = 'status = ?';
        $args[] = $status;
    }
    $sql = 'SELECT * FROM unesco_permits' . ($where ? ' WHERE ' . implode(' AND ', $where) : '') . ' ORDER BY updated_at DESC';
    $stmt = db()->prepare($sql);
    $stmt->execute($args);
    $rows = $stmt->fetchAll();

    // Hydrate applicant summary + zone names so the list UI doesn't need
    // extra round-trips.
    $applicantUids = array_values(array_unique(array_filter(array_map(fn($r) => $r['applicant_uid'], $rows))));
    $applicants = [];
    if ($applicantUids) {
        $placeholders = implode(',', array_fill(0, count($applicantUids), '?'));
        $a = db()->prepare("SELECT uid, email, display_name, first_name, last_name, mobile FROM users WHERE uid IN ($placeholders)");
        $a->execute($applicantUids);
        foreach ($a->fetchAll() as $ar) {
            $applicants[$ar['uid']] = [
                'uid' => $ar['uid'],
                'email' => $ar['email'],
                'displayName' => $ar['display_name'] ?? '',
                'firstName' => $ar['first_name'] ?? null,
                'lastName' => $ar['last_name'] ?? null,
                'mobile' => $ar['mobile'] ?? null,
            ];
        }
    }
    $zones = unesco_zones_map();
    $items = [];
    foreach ($rows as $r) {
        $items[] = unesco_permit_view($r, $applicants[$r['applicant_uid']] ?? null, $zones);
    }
    json_response(['items' => $items]);
}

function unesco_zones_map(): array
{
    $rows = db()->query('SELECT * FROM unesco_zones')->fetchAll();
    $out = [];
    foreach ($rows as $r) $out[$r['id']] = unesco_zone_view($r);
    return $out;
}

function unesco_permit_create(): void
{
    $user = require_auth();
    if (($user['status'] ?? '') !== 'active' && !is_admin($user)) {
        json_error('forbidden', 'Compte inactif.', 403);
    }
    if (!(is_admin($user) || user_has_permission($user, 'unesco_permits_submit') || user_has_permission($user, 'unesco_permits_review'))) {
        json_error('forbidden', 'Permission manquante pour déposer une demande.', 403);
    }
    $body = read_json_body();
    $title = trim((string)($body['title'] ?? ''));
    if ($title === '') json_error('title_required', 'Le titre est obligatoire.', 400);

    $lat = isset($body['latitude']) && $body['latitude'] !== '' ? (float)$body['latitude'] : null;
    $lng = isset($body['longitude']) && $body['longitude'] !== '' ? (float)$body['longitude'] : null;
    $autoZoneId = unesco_detect_zone($lat, $lng);

    $id = new_id(24);
    db()->prepare(
        'INSERT INTO unesco_permits
            (id, applicant_uid, project_ref, title, description, address, city, parcel_number,
             latitude, longitude, auto_zone_id, project_type, surface_sqm, floors_count, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, "draft")'
    )->execute([
        $id,
        $user['uid'],
        $body['projectRef'] ?? null,
        $title,
        $body['description'] ?? null,
        $body['address'] ?? null,
        $body['city'] ?? null,
        $body['parcelNumber'] ?? null,
        $lat,
        $lng,
        $autoZoneId,
        $body['projectType'] ?? null,
        isset($body['surfaceSqm']) && $body['surfaceSqm'] !== '' ? (float)$body['surfaceSqm'] : null,
        isset($body['floorsCount']) && $body['floorsCount'] !== '' ? (int)$body['floorsCount'] : null,
    ]);
    unesco_permit_event_insert($id, $user, 'create', null, 'draft', 'Demande créée (brouillon).', false);

    json_response(['item' => unesco_permit_fetch($id)]);
}

function unesco_permit_update(string $id): void
{
    $ctx = unesco_permit_access($id);
    $row = $ctx['row'];
    $user = $ctx['user'];
    $body = read_json_body();

    // Owners can edit only while the demand is still a draft.
    if (!$ctx['isReviewer']) {
        if (($row['status'] ?? 'draft') !== 'draft') {
            json_error('forbidden', 'Seul un brouillon peut être modifié par le demandeur.', 403);
        }
    }

    $sets = [];
    $args = [];
    $map = [
        'projectRef' => 'project_ref',
        'title' => 'title',
        'description' => 'description',
        'address' => 'address',
        'city' => 'city',
        'parcelNumber' => 'parcel_number',
        'projectType' => 'project_type',
        'decisionNote' => 'decision_note',
    ];
    foreach ($map as $k => $col) {
        if (!array_key_exists($k, $body)) continue;
        $sets[] = "`$col` = ?";
        $args[] = $body[$k] === '' ? null : $body[$k];
    }
    $reRunZone = false;
    if (array_key_exists('latitude', $body)) {
        $sets[] = 'latitude = ?';
        $args[] = $body['latitude'] === '' ? null : (float)$body['latitude'];
        $reRunZone = true;
    }
    if (array_key_exists('longitude', $body)) {
        $sets[] = 'longitude = ?';
        $args[] = $body['longitude'] === '' ? null : (float)$body['longitude'];
        $reRunZone = true;
    }
    if (array_key_exists('surfaceSqm', $body)) {
        $sets[] = 'surface_sqm = ?';
        $args[] = $body['surfaceSqm'] === '' ? null : (float)$body['surfaceSqm'];
    }
    if (array_key_exists('floorsCount', $body)) {
        $sets[] = 'floors_count = ?';
        $args[] = $body['floorsCount'] === '' ? null : (int)$body['floorsCount'];
    }
    // Reviewer-only fields.
    if ($ctx['isReviewer']) {
        if (array_key_exists('finalZoneId', $body)) {
            $sets[] = 'final_zone_id = ?';
            $args[] = $body['finalZoneId'] === '' ? null : (string)$body['finalZoneId'];
        }
        if (array_key_exists('reviewerUid', $body)) {
            $sets[] = 'reviewer_uid = ?';
            $args[] = $body['reviewerUid'] === '' ? null : (string)$body['reviewerUid'];
        }
    }

    if (!$sets) json_error('nothing_to_update', 'Aucun champ modifiable fourni.', 400);
    $args[] = $id;
    db()->prepare('UPDATE unesco_permits SET ' . implode(', ', $sets) . ' WHERE id = ?')->execute($args);

    if ($reRunZone) {
        // Refresh auto_zone_id from the new coordinates.
        $stmt = db()->prepare('SELECT latitude, longitude FROM unesco_permits WHERE id = ?');
        $stmt->execute([$id]);
        $c = $stmt->fetch();
        $autoZoneId = unesco_detect_zone(
            $c['latitude'] !== null ? (float)$c['latitude'] : null,
            $c['longitude'] !== null ? (float)$c['longitude'] : null
        );
        db()->prepare('UPDATE unesco_permits SET auto_zone_id = ? WHERE id = ?')->execute([$autoZoneId, $id]);
    }

    json_response(['item' => unesco_permit_fetch($id)]);
}

function unesco_permit_submit(string $id): void
{
    $ctx = unesco_permit_access($id);
    $user = $ctx['user'];
    $row = $ctx['row'];
    if (!$ctx['isOwner'] && !$ctx['isReviewer']) json_error('forbidden', 'Dépôt non autorisé.', 403);
    if (($row['status'] ?? '') !== 'draft') json_error('invalid_state', 'La demande n\'est plus au brouillon.', 409);

    db()->prepare(
        'UPDATE unesco_permits SET status = "submitted", submitted_at = UTC_TIMESTAMP() WHERE id = ?'
    )->execute([$id]);
    unesco_permit_event_insert($id, $user, 'status', 'draft', 'submitted', 'Demande soumise pour instruction.', false);
    unesco_permit_notify_reviewers($id);
    json_response(['item' => unesco_permit_fetch($id)]);
}

function unesco_permit_event_add(string $id): void
{
    $ctx = unesco_permit_access($id);
    $user = $ctx['user'];
    $row = $ctx['row'];
    $body = read_json_body();

    $toStatus = isset($body['toStatus']) ? (string)$body['toStatus'] : null;
    $message = trim((string)($body['message'] ?? ''));
    $isInternal = !empty($body['isInternal']);
    $kind = $toStatus ? 'status' : 'note';

    // The whitelist of valid target statuses comes from the
    // unesco_permit_statuses table (see migration 014). Only active rows
    // can be reached via a transition. Initial statuses (draft) cannot
    // be re-entered through an event — the permit was already created
    // in that state.
    $targetDef = $toStatus !== null ? unesco_status_get($toStatus) : null;
    if ($toStatus !== null) {
        if ($targetDef === null || empty($targetDef['isActive']) || !empty($targetDef['isInitial'])) {
            json_error('invalid_status', 'Statut cible invalide.', 400);
        }
    }

    // Owner-side rules: can only add the configured "withdraw target"
    // event while the case is still open (non-terminal).
    if (!$ctx['isReviewer']) {
        if ($targetDef === null || empty($targetDef['isApplicantWithdrawTarget'])) {
            json_error('forbidden', 'Seul le retrait est autorisé côté demandeur.', 403);
        }
        $currentDef = unesco_status_get((string)$row['status']);
        if ($currentDef !== null && !empty($currentDef['isTerminal'])) {
            json_error('invalid_state', 'Demande déjà close.', 409);
        }
    }

    // Persist status transition.
    if ($toStatus !== null && $targetDef !== null) {
        $fields = ['status = ?'];
        $args = [$toStatus];
        // A terminal-but-not-withdrawal status is by definition a final
        // ruling (avis favorable / défavorable, or any custom verdict an
        // admin adds later) — stamp decision_at + carry the comment as
        // the decision note.
        $isVerdict = !empty($targetDef['isTerminal']) && empty($targetDef['isApplicantWithdrawTarget']);
        if ($isVerdict) {
            $fields[] = 'decision_at = UTC_TIMESTAMP()';
            if ($message !== '' && empty($body['keepDecisionNote'])) {
                $fields[] = 'decision_note = ?';
                $args[] = $message;
            }
        }
        if ($ctx['isReviewer']) {
            $fields[] = 'reviewer_uid = ?';
            $args[] = $user['uid'];
        }
        $args[] = $id;
        db()->prepare('UPDATE unesco_permits SET ' . implode(', ', $fields) . ' WHERE id = ?')->execute($args);
    }

    unesco_permit_event_insert(
        $id,
        $user,
        $kind,
        (string)$row['status'],
        $toStatus,
        $message !== '' ? $message : null,
        $isInternal && $ctx['isReviewer']
    );

    // Notify owner on any public status change coming from a reviewer.
    if ($ctx['isReviewer'] && $toStatus !== null && !$isInternal) {
        unesco_permit_notify_applicant($id, $toStatus, $message);
    }

    json_response(['item' => unesco_permit_fetch($id)]);
}

function unesco_permit_event_insert(string $permitId, array $user, string $kind, ?string $from, ?string $to, ?string $message, bool $internal): void
{
    $eid = new_id(24);
    $name = trim(((string)($user['first_name'] ?? '')) . ' ' . ((string)($user['last_name'] ?? ''))) ?: (string)($user['display_name'] ?? $user['email'] ?? '');
    db()->prepare(
        'INSERT INTO unesco_permit_events
            (id, permit_id, author_uid, author_name, kind, from_status, to_status, message, is_internal)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )->execute([
        $eid, $permitId, $user['uid'] ?? null, $name,
        $kind, $from, $to, $message, $internal ? 1 : 0,
    ]);
}

function unesco_permit_file_attach(string $id): void
{
    $ctx = unesco_permit_access($id);
    $user = $ctx['user'];
    $body = read_json_body();
    $fileId = trim((string)($body['fileId'] ?? ''));
    if ($fileId === '') json_error('file_id_required', 'fileId manquant.', 400);

    // Owners attach only while drafting. Reviewers always allowed.
    if (!$ctx['isReviewer'] && ($ctx['row']['status'] ?? '') !== 'draft') {
        json_error('forbidden', 'Ajout de pièces limité au brouillon.', 403);
    }

    // Make sure the file exists AND belongs to the caller (or caller is reviewer).
    $f = db()->prepare('SELECT * FROM files WHERE id = ? LIMIT 1');
    $f->execute([$fileId]);
    $file = $f->fetch();
    if (!$file) json_error('file_not_found', 'Fichier introuvable.', 404);
    if (!$ctx['isReviewer'] && ($file['owner_uid'] ?? null) !== $user['uid']) {
        json_error('forbidden', 'Ce fichier ne vous appartient pas.', 403);
    }

    $pfid = new_id(24);
    db()->prepare(
        'INSERT INTO unesco_permit_files (id, permit_id, file_id, kind, title, uploaded_by)
         VALUES (?, ?, ?, ?, ?, ?)'
    )->execute([
        $pfid,
        $id,
        $fileId,
        (string)($body['kind'] ?? 'attachment'),
        $body['title'] ?? null,
        $user['uid'],
    ]);

    unesco_permit_event_insert($id, $user, 'file', (string)$ctx['row']['status'], null, 'Pièce jointe ajoutée.', false);

    json_response(['item' => unesco_permit_fetch($id)]);
}

function unesco_permit_file_detach(string $id, string $fid): void
{
    $ctx = unesco_permit_access($id);
    $stmt = db()->prepare('SELECT * FROM unesco_permit_files WHERE id = ? AND permit_id = ? LIMIT 1');
    $stmt->execute([$fid, $id]);
    $row = $stmt->fetch();
    if (!$row) json_error('not_found', 'Pièce jointe introuvable.', 404);

    // Owner can remove only their own attachment on a draft.
    if (!$ctx['isReviewer']) {
        if (($ctx['row']['status'] ?? '') !== 'draft') json_error('forbidden', 'Retrait de pièces limité au brouillon.', 403);
        if (($row['uploaded_by'] ?? null) !== $ctx['user']['uid']) json_error('forbidden', 'Retrait non autorisé.', 403);
    }

    // Delete the underlying file too.
    $file = db()->prepare('SELECT * FROM files WHERE id = ? LIMIT 1');
    $file->execute([$row['file_id']]);
    $fileRow = $file->fetch();
    if ($fileRow) {
        global $CONFIG;
        $full = rtrim((string)$CONFIG['uploads']['storage_dir'], '/\\')
            . DIRECTORY_SEPARATOR
            . str_replace('/', DIRECTORY_SEPARATOR, (string)$fileRow['stored_path']);
        if (is_file($full)) @unlink($full);
        db()->prepare('DELETE FROM files WHERE id = ?')->execute([$row['file_id']]);
    }

    db()->prepare('DELETE FROM unesco_permit_files WHERE id = ?')->execute([$fid]);

    unesco_permit_event_insert($id, $ctx['user'], 'file', (string)$ctx['row']['status'], null, 'Pièce jointe retirée.', false);

    json_response(['item' => unesco_permit_fetch($id)]);
}

function unesco_permit_get(string $id): void
{
    unesco_permit_access($id);
    json_response(['item' => unesco_permit_fetch($id)]);
}

function unesco_permit_delete(string $id): void
{
    $ctx = unesco_permit_access($id);
    $row = $ctx['row'];
    if (!$ctx['isReviewer']) {
        // Owner can hard-delete only its own drafts.
        if (($row['status'] ?? '') !== 'draft') json_error('forbidden', 'Seul un brouillon peut être supprimé.', 403);
    }

    // Cascade through permit_files to remove underlying binaries.
    $pf = db()->prepare('SELECT * FROM unesco_permit_files WHERE permit_id = ?');
    $pf->execute([$id]);
    global $CONFIG;
    $base = rtrim((string)$CONFIG['uploads']['storage_dir'], '/\\');
    foreach ($pf->fetchAll() as $row2) {
        $f = db()->prepare('SELECT stored_path FROM files WHERE id = ? LIMIT 1');
        $f->execute([$row2['file_id']]);
        $fp = $f->fetchColumn();
        if ($fp) {
            $full = $base . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, (string)$fp);
            if (is_file($full)) @unlink($full);
        }
        db()->prepare('DELETE FROM files WHERE id = ?')->execute([$row2['file_id']]);
    }

    db()->prepare('DELETE FROM unesco_permits WHERE id = ?')->execute([$id]);
    json_response(['ok' => true]);
}

function unesco_permit_fetch(string $id): array
{
    $stmt = db()->prepare('SELECT * FROM unesco_permits WHERE id = ? LIMIT 1');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) json_error('not_found', 'Demande introuvable.', 404);

    // applicant
    $a = db()->prepare('SELECT uid, email, display_name, first_name, last_name, mobile FROM users WHERE uid = ? LIMIT 1');
    $a->execute([$row['applicant_uid']]);
    $ar = $a->fetch();
    $applicant = $ar ? [
        'uid' => $ar['uid'],
        'email' => $ar['email'],
        'displayName' => $ar['display_name'] ?? '',
        'firstName' => $ar['first_name'] ?? null,
        'lastName' => $ar['last_name'] ?? null,
        'mobile' => $ar['mobile'] ?? null,
    ] : null;

    // events (hide internal notes from non-reviewers)
    $user = current_user();
    $isReviewer = $user && (is_admin($user) || user_has_permission($user, 'unesco_manage') || user_has_permission($user, 'unesco_permits_review'));
    $ev = db()->prepare('SELECT * FROM unesco_permit_events WHERE permit_id = ? ORDER BY created_at ASC');
    $ev->execute([$id]);
    $events = [];
    foreach ($ev->fetchAll() as $e) {
        if (!$isReviewer && !empty($e['is_internal'])) continue;
        $events[] = unesco_event_view($e);
    }

    // files
    $fp = db()->prepare(
        'SELECT pf.*, f.original_name, f.mime_type, f.size_bytes
           FROM unesco_permit_files pf
           JOIN files f ON f.id = pf.file_id
          WHERE pf.permit_id = ?
          ORDER BY pf.created_at ASC'
    );
    $fp->execute([$id]);
    $files = array_map('unesco_permit_file_view', $fp->fetchAll());

    $zones = unesco_zones_map();
    return unesco_permit_view($row, $applicant, $zones, $events, $files);
}

function unesco_detect_zone(?float $lat, ?float $lng): ?string
{
    if ($lat === null || $lng === null) return null;

    $sources = db()->query('SELECT id, geojson_path FROM unesco_kmz_sources WHERE is_active = 1')->fetchAll();
    if (!$sources) return null;

    // Map (sourceId, featureKey) → zoneId for lookup.
    $zoneByKey = [];
    foreach (db()->query('SELECT id, kmz_source_id, feature_key FROM unesco_zones')->fetchAll() as $z) {
        $zoneByKey[$z['kmz_source_id'] . '|' . $z['feature_key']] = $z['id'];
    }

    $baseDir = unesco_uploads_dir();
    foreach ($sources as $src) {
        $path = (string)($src['geojson_path'] ?? '');
        if ($path === '') continue;
        $absolute = $baseDir . DIRECTORY_SEPARATOR . basename($path);
        if (!is_file($absolute)) continue;
        $raw = @file_get_contents($absolute);
        if ($raw === false) continue;
        $fc = json_decode($raw, true);
        if (empty($fc['features'])) continue;
        foreach ($fc['features'] as $feat) {
            $geom = $feat['geometry'] ?? null;
            if (!$geom) continue;
            if (point_in_geometry($geom, $lng, $lat)) {
                $fk = (string)(($feat['properties']['_featureKey'] ?? '') ?: '');
                $zoneId = $zoneByKey[$src['id'] . '|' . $fk] ?? null;
                if ($zoneId) return $zoneId;
            }
        }
    }
    return null;
}

// ----------------------------------------------------------------------
// Notifications
// ----------------------------------------------------------------------

function unesco_permit_notify_reviewers(string $permitId): void
{
    if (!notification_event_enabled('unesco_permit_review_requested')) return;

    try {
        $stmt = db()->prepare('SELECT * FROM unesco_permits WHERE id = ?');
        $stmt->execute([$permitId]);
        $permit = $stmt->fetch();
        if (!$permit) return;

        // Collect reviewer emails — admins + explicit unesco_permits_review perm.
        $reviewers = db()->query(
            "SELECT email, role, display_name FROM users
              WHERE status = 'active'
                AND (role IN ('admin', 'super-admin') OR role = 'representative')"
        )->fetchAll();

        $title = (string)($permit['title'] ?? 'Nouvelle demande UNESCO');
        $vars = ['title' => $title, 'permitId' => $permitId];
        $subject = notification_render('unesco_permit_review_requested', 'subject', $vars);
        $html    = notification_render('unesco_permit_review_requested', 'html', $vars);

        // Build the list of admin/super-admin emails from the DB, then add
        // configured extra recipients (notification_admin_recipients dedupes).
        $reviewerEmails = [];
        foreach ($reviewers ?? [] as $r) {
            if (!$r['email']) continue;
            if (!in_array($r['role'], ['admin', 'super-admin'], true)) continue;
            $reviewerEmails[] = (string)$r['email'];
        }
        $allRecipients = notification_admin_recipients('unesco_permit_review_requested', $reviewerEmails);
        if (!$allRecipients) return;

        // Build a name map so we can pass display_name when available
        $nameByEmail = [];
        foreach ($reviewers ?? [] as $r) {
            $nameByEmail[strtolower((string)$r['email'])] = (string)($r['display_name'] ?? '');
        }
        foreach ($allRecipients as $email) {
            $name = $nameByEmail[strtolower($email)] ?? '';
            @send_mail($email, $name, $subject, $html);
        }

        // In-app notification : tous les admins/super-admins.
        push_notifications_to_users(admin_recipient_uids(), [
            'type'     => 'unesco_permit_submitted',
            'title'    => 'Nouvelle demande UNESCO',
            'body'     => $title,
            'link'     => '/espace-adherents',
            'icon'     => 'file-check',
            'priority' => 'high',
            'data'     => ['permitId' => $permitId],
        ]);
    } catch (Throwable $e) {
        error_log('[unesco] notify reviewers failed: ' . $e->getMessage());
    }
}

function unesco_permit_notify_applicant(string $permitId, string $toStatus, string $message): void
{
    if (!notification_event_enabled('unesco_permit_status_changed')) return;

    try {
        $stmt = db()->prepare(
            'SELECT p.*, u.email AS applicant_email, u.display_name AS applicant_name
               FROM unesco_permits p
               JOIN users u ON u.uid = p.applicant_uid
              WHERE p.id = ?'
        );
        $stmt->execute([$permitId]);
        $row = $stmt->fetch();
        if (!$row || empty($row['applicant_email'])) return;

        // Resolve the display label from the admin-managed status table
        // so renamed labels (e.g. "Avis favorable" → "Décision positive")
        // flow into emails and in-app notifications without code changes.
        $def = unesco_status_get($toStatus);
        $label = $def['label'] ?? $toStatus;

        $vars = [
            'name'        => (string)($row['applicant_name'] ?? ''),
            'title'       => (string)$row['title'],
            'status'      => $toStatus,
            'statusLabel' => $label,
            'message'     => $message,
        ];
        $subject = notification_render('unesco_permit_status_changed', 'subject', $vars);
        $html    = notification_render('unesco_permit_status_changed', 'html', $vars);

        @send_mail((string)$row['applicant_email'], (string)($row['applicant_name'] ?? ''), $subject, $html);

        // In-app notification au demandeur. Terminal verdicts (any
        // non-withdrawal terminal status, including custom ones added via
        // Paramètres) get high priority so they surface above routine
        // workflow updates.
        $isVerdict = $def !== null && !empty($def['isTerminal']) && empty($def['isApplicantWithdrawTarget']);
        $priority = $isVerdict ? 'high' : 'normal';
        $icon = $toStatus === 'approved'
            ? 'check-circle'
            : ($toStatus === 'rejected' ? 'x-circle' : 'file-check');
        create_notification((string)$row['applicant_uid'], [
            'type'     => 'unesco_permit_status',
            'title'    => $label,
            'body'     => (string)$row['title'] . ($message !== '' ? ' — ' . $message : ''),
            'link'     => '/espace-adherents',
            'icon'     => $icon,
            'priority' => $priority,
            'data'     => ['permitId' => $permitId, 'status' => $toStatus],
        ]);
    } catch (Throwable $e) {
        error_log('[unesco] notify applicant failed: ' . $e->getMessage());
    }
}

// ----------------------------------------------------------------------
// Badge counter
// ----------------------------------------------------------------------

function unesco_status_counts(): void
{
    $user = require_auth();
    $isReviewer = is_admin($user) || user_has_permission($user, 'unesco_manage') || user_has_permission($user, 'unesco_permits_review');
    if (!$isReviewer) {
        $stmt = db()->prepare(
            'SELECT status, COUNT(*) AS c FROM unesco_permits WHERE applicant_uid = ? GROUP BY status'
        );
        $stmt->execute([$user['uid']]);
    } else {
        $stmt = db()->query('SELECT status, COUNT(*) AS c FROM unesco_permits GROUP BY status');
    }
    $counts = [];
    foreach ($stmt->fetchAll() as $r) $counts[$r['status']] = (int)$r['c'];

    // "Pending review" = anything that's not the initial state (draft) and
    // not a terminal state (verdict / withdrawal). Computed from the
    // admin-managed status table so adding a custom intermediate status
    // automatically rolls into the badge counter.
    $pendingReview = 0;
    foreach (unesco_statuses_all() as $def) {
        if (!empty($def['isInitial']) || !empty($def['isTerminal'])) continue;
        $pendingReview += (int)($counts[$def['key']] ?? 0);
    }
    json_response([
        'counts' => $counts,
        'pendingReview' => $pendingReview,
    ]);
}
