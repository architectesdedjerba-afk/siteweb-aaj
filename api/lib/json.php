<?php
declare(strict_types=1);

function json_response(array $payload, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function json_error(string $code, string $message, int $status = 400, array $extra = []): void
{
    json_response(array_merge(['error' => $code, 'message' => $message], $extra), $status);
}

function read_json_body(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === '' || $raw === false) return [];
    $data = json_decode($raw, true);
    if (!is_array($data)) {
        json_error('bad_json', 'Corps JSON invalide.', 400);
    }
    return $data;
}

function iso_datetime(?string $mysqlDatetime): ?string
{
    if (!$mysqlDatetime) return null;
    // Stored as UTC (see SET time_zone = '+00:00'), return ISO-8601 Z.
    return str_replace(' ', 'T', $mysqlDatetime) . 'Z';
}
