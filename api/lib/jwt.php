<?php
declare(strict_types=1);

/**
 * Minimal HS256 JWT — no external dependency, fine for cPanel.
 */

function jwt_b64url_encode(string $data): string
{
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function jwt_b64url_decode(string $data): string
{
    $padded = strtr($data, '-_', '+/');
    $padded .= str_repeat('=', (4 - strlen($padded) % 4) % 4);
    $decoded = base64_decode($padded, true);
    return $decoded === false ? '' : $decoded;
}

function jwt_sign(array $payload): string
{
    global $CONFIG;
    $secret = (string)$CONFIG['jwt']['secret'];
    $header = ['typ' => 'JWT', 'alg' => 'HS256'];

    $payload = array_merge([
        'iss' => $CONFIG['jwt']['issuer'] ?? 'aaj-api',
        'aud' => $CONFIG['jwt']['audience'] ?? 'aaj-web',
        'iat' => time(),
        'exp' => time() + (int)($CONFIG['jwt']['ttl_seconds'] ?? 604800),
    ], $payload);

    $h = jwt_b64url_encode(json_encode($header, JSON_UNESCAPED_SLASHES));
    $p = jwt_b64url_encode(json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
    $sig = hash_hmac('sha256', $h . '.' . $p, $secret, true);
    return $h . '.' . $p . '.' . jwt_b64url_encode($sig);
}

function jwt_verify(string $token): ?array
{
    global $CONFIG;
    $secret = (string)$CONFIG['jwt']['secret'];

    $parts = explode('.', $token);
    if (count($parts) !== 3) return null;
    [$h, $p, $s] = $parts;

    $expected = jwt_b64url_encode(hash_hmac('sha256', $h . '.' . $p, $secret, true));
    if (!hash_equals($expected, $s)) return null;

    $payload = json_decode(jwt_b64url_decode($p), true);
    if (!is_array($payload)) return null;
    if (isset($payload['exp']) && time() >= (int)$payload['exp']) return null;
    if (isset($payload['iss']) && $payload['iss'] !== ($CONFIG['jwt']['issuer'] ?? 'aaj-api')) return null;
    if (isset($payload['aud']) && $payload['aud'] !== ($CONFIG['jwt']['audience'] ?? 'aaj-web')) return null;

    return $payload;
}

function jwt_cookie_set(string $token): void
{
    global $CONFIG;
    setcookie($CONFIG['jwt']['cookie_name'], $token, [
        'expires'  => time() + (int)$CONFIG['jwt']['ttl_seconds'],
        'path'     => '/',
        'secure'   => (bool)$CONFIG['jwt']['cookie_secure'],
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
}

function jwt_cookie_clear(): void
{
    global $CONFIG;
    setcookie($CONFIG['jwt']['cookie_name'], '', [
        'expires'  => time() - 3600,
        'path'     => '/',
        'secure'   => (bool)$CONFIG['jwt']['cookie_secure'],
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
}

function jwt_cookie_read(): ?string
{
    global $CONFIG;
    $name = $CONFIG['jwt']['cookie_name'];
    if (!isset($_COOKIE[$name])) return null;
    $value = (string)$_COOKIE[$name];
    return $value === '' ? null : $value;
}
