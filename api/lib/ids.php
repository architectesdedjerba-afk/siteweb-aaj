<?php
declare(strict_types=1);

/**
 * Random-string IDs — Firestore-compatible alphabet so IDs flow through
 * the frontend without any format assumption. 20 chars is 116 bits of
 * entropy — plenty for a non-high-throughput site.
 */

function new_id(int $length = 20): string
{
    $alphabet = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    $max = strlen($alphabet) - 1;
    $out = '';
    for ($i = 0; $i < $length; $i++) {
        $out .= $alphabet[random_int(0, $max)];
    }
    return $out;
}

function new_token(int $bytes = 32): string
{
    return bin2hex(random_bytes($bytes));
}
