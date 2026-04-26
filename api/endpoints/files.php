<?php
declare(strict_types=1);

/**
 * File upload/download.
 *
 * Uploads are multipart/form-data:
 *   field "file"    — the binary
 *   field "folder"  — logical bucket: news | partners | users | documents | commission_pvs | contact_messages
 *   field "access"  — "public" | "members" | "private" (default: inferred from folder)
 *
 * Downloads go through /api/files/{id}. Access is enforced based on the
 * file's `access` column, roughly mirroring storage.rules.
 */

function handle_files(string $method, array $rest): void
{
    $id = $rest[0] ?? null;
    if ($method === 'POST' && $id === null) { files_upload(); return; }
    if ($method === 'GET'  && $id !== null) { files_download($id); return; }
    if ($method === 'DELETE' && $id !== null) { files_delete($id); return; }
    json_error('method_not_allowed', 'Méthode non autorisée.', 405);
}

function files_upload(): void
{
    global $CONFIG;

    // We resolve auth lazily so the `jobs_cv` folder can accept anonymous
    // CV/portfolio attachments from the public job request form. All other
    // folders still require an authenticated session.
    $user = current_user();

    if (empty($_FILES['file']) || !is_uploaded_file($_FILES['file']['tmp_name'])) {
        json_error('no_file', 'Aucun fichier envoyé.', 400);
    }
    $folder = preg_replace('/[^a-z0-9_\-]/', '', strtolower((string)($_POST['folder'] ?? 'misc'))) ?: 'misc';
    if (!in_array($folder, ['news', 'partners', 'users', 'documents', 'commission_pvs', 'contact_messages', 'chat', 'unesco', 'unesco_permits', 'jobs_cv', 'misc'], true)) {
        json_error('invalid_folder', 'Dossier inconnu.', 400);
    }

    if ($folder !== 'jobs_cv' && !$user) {
        json_error('unauthenticated', 'Authentification requise.', 401);
    }

    // Folder-level authorization
    switch ($folder) {
        case 'news':
            if (!(is_admin($user) || user_has_permission($user, 'news_manage'))) json_error('forbidden', 'Upload réservé aux administrateurs.', 403);
            break;
        case 'partners':
            if (!(is_admin($user) || user_has_permission($user, 'partners_manage'))) json_error('forbidden', 'Upload réservé aux administrateurs.', 403);
            break;
        case 'documents':
            if (!(is_admin($user) || user_has_permission($user, 'library_manage'))) json_error('forbidden', 'Upload réservé aux administrateurs.', 403);
            break;
        case 'commission_pvs':
            if (!(is_admin($user) || user_has_permission($user, 'commissions_create') || (is_representative($user) && $user['status'] === 'active'))) {
                json_error('forbidden', 'Upload non autorisé.', 403);
            }
            break;
        case 'chat':
            if (!(is_admin($user) || user_has_permission($user, 'chat_use'))) json_error('forbidden', 'Upload réservé aux membres autorisés.', 403);
            if ($user['status'] !== 'active' && !is_admin($user)) json_error('forbidden', 'Compte inactif.', 403);
            break;
        case 'unesco':
            if (!(is_admin($user) || user_has_permission($user, 'unesco_manage'))) json_error('forbidden', 'Upload UNESCO réservé aux gestionnaires.', 403);
            break;
        case 'unesco_permits':
            if (!(is_admin($user)
                || user_has_permission($user, 'unesco_permits_submit')
                || user_has_permission($user, 'unesco_permits_review')
                || user_has_permission($user, 'unesco_manage'))) {
                json_error('forbidden', 'Upload réservé aux utilisateurs autorisés.', 403);
            }
            if ($user['status'] !== 'active' && !is_admin($user)) json_error('forbidden', 'Compte inactif.', 403);
            break;
        case 'jobs_cv':
            // Anonymous CV/portfolio upload from the public job request form.
            // No auth required; mime + size restrictions enforced below; the
            // download endpoint gates access to members so anonymous visitors
            // can't enumerate uploaded CVs.
            break;
        case 'users':
        case 'contact_messages':
        case 'misc':
        default:
            if ($user['status'] !== 'active' && !is_admin($user)) json_error('forbidden', 'Compte inactif.', 403);
    }

    $up = $_FILES['file'];
    if ($up['error'] !== UPLOAD_ERR_OK) json_error('upload_failed', 'Erreur d\'upload.', 400);

    // Some folders are explicitly exempted from the app-level size cap (the
    // OS/PHP upload limits still apply — see api/.user.ini).
    $unlimitedFolders = ['commission_pvs', 'unesco_permits'];
    if (!in_array($folder, $unlimitedFolders, true)) {
        $maxBytes = (int)$CONFIG['uploads']['max_bytes'];
        if ($maxBytes > 0 && $up['size'] > $maxBytes) {
            json_error('too_large', 'Fichier trop volumineux.', 413);
        }
    }

    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $mime = (string)$finfo->file($up['tmp_name']);
    $allowed = $CONFIG['uploads']['allowed_mime'];
    // Commission PVs accept any image/* or PDF — architects often submit a
    // stack of phone photos of the paper PV instead of a scanned PDF.
    $isImageOrPdf = (strpos($mime, 'image/') === 0) || $mime === 'application/pdf';
    if ($folder === 'commission_pvs' || $folder === 'jobs_cv') {
        if (!$isImageOrPdf) json_error('invalid_mime', 'Seules les images et les PDF sont acceptés.', 415);
    } elseif (!in_array($mime, $allowed, true)) {
        json_error('invalid_mime', 'Type de fichier non autorisé.', 415);
    }

    $storageDir = rtrim((string)$CONFIG['uploads']['storage_dir'], '/\\');
    $folderDir = $storageDir . DIRECTORY_SEPARATOR . $folder;
    if (!is_dir($folderDir)) {
        if (!mkdir($folderDir, 0750, true) && !is_dir($folderDir)) {
            json_error('storage_error', 'Impossible de créer le dossier de stockage.', 500);
        }
    }

    $id = new_id(24);
    $ext = pathinfo($up['name'], PATHINFO_EXTENSION);
    $ext = preg_replace('/[^a-zA-Z0-9]/', '', (string)$ext);
    $fileName = $id . ($ext ? ".$ext" : '');
    $storedPath = $folder . '/' . $fileName; // relative, for DB

    $dest = $folderDir . DIRECTORY_SEPARATOR . $fileName;
    if (!move_uploaded_file($up['tmp_name'], $dest)) {
        json_error('storage_error', 'Échec de sauvegarde du fichier.', 500);
    }

    $access = (string)($_POST['access'] ?? ($folder === 'news' || $folder === 'partners' ? 'public' : 'members'));
    // Anonymous CVs are always gated to logged-in members regardless of the
    // posted `access` field — the upload route is public, the download is not.
    if ($folder === 'jobs_cv') $access = 'members';

    db()->prepare(
        'INSERT INTO files (id, folder, owner_uid, original_name, stored_path, mime_type, size_bytes, access)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    )->execute([$id, $folder, $user['uid'] ?? null, $up['name'], $storedPath, $mime, (int)$up['size'], $access]);

    $publicUrl = rtrim((string)$CONFIG['site']['uploads_base'], '/') . '/' . $id;

    json_response([
        'ok'   => true,
        'id'   => $id,
        'url'  => $publicUrl,
        'path' => $storedPath,
        'name' => $up['name'],
        'size' => (int)$up['size'],
        'type' => $mime,
    ]);
}

function files_download(string $id): void
{
    global $CONFIG;

    $stmt = db()->prepare('SELECT * FROM files WHERE id = ? LIMIT 1');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) { http_response_code(404); exit; }

    $access = $row['access'] ?? 'private';
    $user = current_user();

    if ($access === 'members') {
        if (!$user || ($user['status'] !== 'active' && !is_admin($user))) {
            http_response_code(403); exit;
        }
    } elseif ($access === 'private') {
        if (!$user) { http_response_code(403); exit; }
        if (!is_admin($user) && $row['owner_uid'] !== $user['uid']) { http_response_code(403); exit; }
    }

    $full = rtrim((string)$CONFIG['uploads']['storage_dir'], '/\\') . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, (string)$row['stored_path']);
    if (!is_file($full)) { http_response_code(404); exit; }

    header('Content-Type: ' . $row['mime_type']);
    header('Content-Length: ' . (int)$row['size_bytes']);
    header('Content-Disposition: inline; filename="' . rawurlencode((string)$row['original_name']) . '"');
    header('Cache-Control: private, max-age=3600');
    readfile($full);
    exit;
}

function files_delete(string $id): void
{
    global $CONFIG;
    $user = require_auth();

    $stmt = db()->prepare('SELECT * FROM files WHERE id = ? LIMIT 1');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) json_error('not_found', 'Fichier introuvable.', 404);

    if (!is_admin($user) && $row['owner_uid'] !== $user['uid']) {
        json_error('forbidden', 'Suppression non autorisée.', 403);
    }

    $full = rtrim((string)$CONFIG['uploads']['storage_dir'], '/\\') . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, (string)$row['stored_path']);
    if (is_file($full)) @unlink($full);
    db()->prepare('DELETE FROM files WHERE id = ?')->execute([$id]);

    json_response(['ok' => true]);
}
