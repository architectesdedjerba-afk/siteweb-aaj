<?php
declare(strict_types=1);

/**
 * Minimal point-in-polygon utilities for server-side zone matching.
 *
 * We accept plain GeoJSON geometry objects (Polygon or MultiPolygon) and
 * a [lng, lat] pair. The algorithm is the standard ray casting test,
 * with bbox pre-filtering to avoid looping over every ring of every
 * feature when the point is clearly elsewhere.
 */

function point_in_geometry(array $geometry, float $lng, float $lat): bool
{
    $type = $geometry['type'] ?? '';
    $coords = $geometry['coordinates'] ?? null;
    if (!$coords) return false;

    if ($type === 'Polygon') {
        return point_in_polygon_rings($coords, $lng, $lat);
    }
    if ($type === 'MultiPolygon') {
        foreach ($coords as $polygon) {
            if (point_in_polygon_rings($polygon, $lng, $lat)) return true;
        }
    }
    return false;
}

function point_in_polygon_rings(array $rings, float $lng, float $lat): bool
{
    if (empty($rings)) return false;

    // Outer ring must contain the point.
    if (!ring_contains($rings[0], $lng, $lat)) return false;

    // And the point must NOT fall into any hole.
    for ($i = 1; $i < count($rings); $i++) {
        if (ring_contains($rings[$i], $lng, $lat)) return false;
    }
    return true;
}

function ring_contains(array $ring, float $lng, float $lat): bool
{
    $n = count($ring);
    if ($n < 3) return false;

    // Bounding box pre-filter.
    $minX = $maxX = $ring[0][0];
    $minY = $maxY = $ring[0][1];
    for ($i = 1; $i < $n; $i++) {
        $x = $ring[$i][0];
        $y = $ring[$i][1];
        if ($x < $minX) $minX = $x;
        if ($x > $maxX) $maxX = $x;
        if ($y < $minY) $minY = $y;
        if ($y > $maxY) $maxY = $y;
    }
    if ($lng < $minX || $lng > $maxX || $lat < $minY || $lat > $maxY) {
        return false;
    }

    // Ray casting.
    $inside = false;
    for ($i = 0, $j = $n - 1; $i < $n; $j = $i++) {
        $xi = $ring[$i][0]; $yi = $ring[$i][1];
        $xj = $ring[$j][0]; $yj = $ring[$j][1];

        $intersect = (($yi > $lat) !== ($yj > $lat))
            && ($lng < ($xj - $xi) * ($lat - $yi) / (($yj - $yi) ?: 1e-12) + $xi);
        if ($intersect) $inside = !$inside;
    }
    return $inside;
}
