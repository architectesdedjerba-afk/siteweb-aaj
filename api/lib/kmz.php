<?php
declare(strict_types=1);

/**
 * KMZ / KML → GeoJSON extractor.
 *
 * A KMZ file is a ZIP archive containing a single KML document (plus
 * optional icon/image assets). This helper opens the ZIP, picks the
 * first `.kml` entry it finds, parses it with SimpleXML, and converts
 * every Placemark geometry into a GeoJSON Feature.
 *
 * Supported geometries: Point, LineString, Polygon (with holes), and
 * MultiGeometry compositions of the above. Altitude is dropped — we
 * only keep [lng, lat] pairs because Leaflet ignores the third value
 * and it inflates the payload.
 *
 * Returns a FeatureCollection that can be served as-is to the frontend.
 */

function kmz_extract_to_geojson(string $kmzPath): array
{
    if (!class_exists('ZipArchive')) {
        throw new RuntimeException('ZipArchive indisponible sur ce serveur.');
    }
    $zip = new ZipArchive();
    if ($zip->open($kmzPath) !== true) {
        throw new RuntimeException('Impossible d\'ouvrir le KMZ (archive illisible).');
    }

    // Find the first .kml entry (prefer doc.kml when present).
    $kmlEntry = null;
    $preferred = null;
    for ($i = 0; $i < $zip->numFiles; $i++) {
        $name = $zip->getNameIndex($i);
        if (!is_string($name)) continue;
        if (preg_match('/\.kml$/i', $name)) {
            $kmlEntry = $kmlEntry ?? $name;
            if (strtolower(basename($name)) === 'doc.kml') {
                $preferred = $name;
            }
        }
    }
    $entry = $preferred ?? $kmlEntry;
    if (!$entry) {
        $zip->close();
        throw new RuntimeException('Aucun fichier .kml trouvé dans le KMZ.');
    }

    $kml = $zip->getFromName($entry);
    $zip->close();
    if ($kml === false) {
        throw new RuntimeException('Impossible de lire le document KML dans le KMZ.');
    }

    return kml_string_to_geojson($kml);
}

function kml_string_to_geojson(string $kml): array
{
    // Silence libxml warnings; we'll surface any parse error explicitly.
    $previous = libxml_use_internal_errors(true);
    $xml = simplexml_load_string($kml);
    libxml_use_internal_errors($previous);
    if (!$xml) {
        throw new RuntimeException('KML invalide (échec du parsing XML).');
    }

    // Strip the default namespace so XPath queries stay simple regardless
    // of whether the KML uses http://www.opengis.net/kml/2.2 or a vendor
    // namespace like http://earth.google.com/kml/2.2.
    $namespaces = $xml->getDocNamespaces();
    foreach ($namespaces as $prefix => $uri) {
        if ($prefix === '') {
            $xml->registerXPathNamespace('kml', $uri);
        }
    }

    // Try both namespaced and non-namespaced lookups.
    $placemarks = $xml->xpath('//kml:Placemark') ?: $xml->xpath('//Placemark');

    $features = [];
    $bbox = null; // [minLng, minLat, maxLng, maxLat]

    foreach ($placemarks ?: [] as $pm) {
        $feature = placemark_to_feature($pm);
        if ($feature === null) continue;
        $features[] = $feature;
        $fbb = geometry_bbox($feature['geometry'] ?? null);
        if ($fbb) $bbox = bbox_merge($bbox, $fbb);
    }

    return [
        'type' => 'FeatureCollection',
        'features' => $features,
        'bbox' => $bbox,
    ];
}

function placemark_to_feature(SimpleXMLElement $pm): ?array
{
    // Resolve name / description from either namespace.
    $name = (string)($pm->name ?? '');
    $desc = (string)($pm->description ?? '');

    $styleUrl = (string)($pm->styleUrl ?? '');

    $geom = placemark_geometry($pm);
    if ($geom === null) return null;

    $props = [
        'name' => $name !== '' ? $name : 'Zone',
        'description' => $desc,
        'styleUrl' => $styleUrl,
    ];

    // ExtendedData (SimpleData / Data elements) → flat properties.
    if (isset($pm->ExtendedData)) {
        $ed = $pm->ExtendedData;
        if (isset($ed->SchemaData->SimpleData)) {
            foreach ($ed->SchemaData->SimpleData as $sd) {
                $key = (string)($sd['name'] ?? '');
                if ($key !== '') $props[$key] = (string)$sd;
            }
        }
        if (isset($ed->Data)) {
            foreach ($ed->Data as $d) {
                $key = (string)($d['name'] ?? '');
                if ($key !== '') $props[$key] = (string)($d->value ?? '');
            }
        }
    }

    $serialized = json_encode($geom['coordinates'] ?? []) ?: '';
    $props['_featureKey'] = substr(
        md5(($props['name'] ?? '') . '|' . $geom['type'] . '|' . $serialized),
        0,
        24
    );

    return [
        'type' => 'Feature',
        'properties' => $props,
        'geometry' => $geom,
    ];
}

function placemark_geometry(SimpleXMLElement $pm): ?array
{
    if (isset($pm->Point)) {
        $coords = parse_kml_coordinates((string)$pm->Point->coordinates);
        if (count($coords) === 0) return null;
        return ['type' => 'Point', 'coordinates' => $coords[0]];
    }
    if (isset($pm->LineString)) {
        $coords = parse_kml_coordinates((string)$pm->LineString->coordinates);
        if (count($coords) < 2) return null;
        return ['type' => 'LineString', 'coordinates' => $coords];
    }
    if (isset($pm->Polygon)) {
        $poly = polygon_coordinates($pm->Polygon);
        if (!$poly) return null;
        return ['type' => 'Polygon', 'coordinates' => $poly];
    }
    if (isset($pm->MultiGeometry)) {
        return multigeometry_to_geojson($pm->MultiGeometry);
    }
    return null;
}

function polygon_coordinates(SimpleXMLElement $polygon): ?array
{
    $rings = [];

    // Outer boundary.
    if (isset($polygon->outerBoundaryIs->LinearRing->coordinates)) {
        $outer = parse_kml_coordinates((string)$polygon->outerBoundaryIs->LinearRing->coordinates);
        if (count($outer) < 3) return null;
        $rings[] = ring_closed($outer);
    } else {
        return null;
    }

    // Inner boundaries (holes).
    if (isset($polygon->innerBoundaryIs)) {
        foreach ($polygon->innerBoundaryIs as $ibi) {
            if (!isset($ibi->LinearRing->coordinates)) continue;
            $inner = parse_kml_coordinates((string)$ibi->LinearRing->coordinates);
            if (count($inner) >= 3) {
                $rings[] = ring_closed($inner);
            }
        }
    }

    return $rings;
}

function multigeometry_to_geojson(SimpleXMLElement $mg): ?array
{
    $points = [];
    $lines = [];
    $polygons = [];

    foreach ($mg->children() as $child) {
        $tag = $child->getName();
        if ($tag === 'Point') {
            $c = parse_kml_coordinates((string)$child->coordinates);
            if ($c) $points[] = $c[0];
        } elseif ($tag === 'LineString') {
            $c = parse_kml_coordinates((string)$child->coordinates);
            if (count($c) >= 2) $lines[] = $c;
        } elseif ($tag === 'Polygon') {
            $p = polygon_coordinates($child);
            if ($p) $polygons[] = $p;
        }
    }

    // Prefer the most descriptive geometry type available.
    if (count($polygons) > 1) {
        return ['type' => 'MultiPolygon', 'coordinates' => $polygons];
    }
    if (count($polygons) === 1) {
        return ['type' => 'Polygon', 'coordinates' => $polygons[0]];
    }
    if (count($lines) > 1) {
        return ['type' => 'MultiLineString', 'coordinates' => $lines];
    }
    if (count($lines) === 1) {
        return ['type' => 'LineString', 'coordinates' => $lines[0]];
    }
    if (count($points) > 1) {
        return ['type' => 'MultiPoint', 'coordinates' => $points];
    }
    if (count($points) === 1) {
        return ['type' => 'Point', 'coordinates' => $points[0]];
    }
    return null;
}

function parse_kml_coordinates(string $raw): array
{
    // KML is "lng,lat[,alt] lng,lat[,alt] …" separated by whitespace.
    $raw = trim($raw);
    if ($raw === '') return [];
    $points = preg_split('/\s+/', $raw) ?: [];
    $out = [];
    foreach ($points as $p) {
        if ($p === '') continue;
        $parts = explode(',', $p);
        if (count($parts) < 2) continue;
        $lng = (float)$parts[0];
        $lat = (float)$parts[1];
        if (is_nan($lng) || is_nan($lat)) continue;
        if (abs($lat) > 90 || abs($lng) > 180) continue;
        $out[] = [$lng, $lat];
    }
    return $out;
}

function ring_closed(array $ring): array
{
    $n = count($ring);
    if ($n < 2) return $ring;
    [$fx, $fy] = $ring[0];
    [$lx, $ly] = $ring[$n - 1];
    if ($fx !== $lx || $fy !== $ly) {
        $ring[] = [$fx, $fy];
    }
    return $ring;
}

function geometry_bbox(?array $geom): ?array
{
    if (!$geom || !isset($geom['type'], $geom['coordinates'])) return null;
    $bb = null;
    $walk = function ($node) use (&$walk, &$bb) {
        if (!is_array($node)) return;
        if (count($node) === 2 && is_numeric($node[0]) && is_numeric($node[1])) {
            $lng = (float)$node[0];
            $lat = (float)$node[1];
            if ($bb === null) {
                $bb = [$lng, $lat, $lng, $lat];
            } else {
                if ($lng < $bb[0]) $bb[0] = $lng;
                if ($lat < $bb[1]) $bb[1] = $lat;
                if ($lng > $bb[2]) $bb[2] = $lng;
                if ($lat > $bb[3]) $bb[3] = $lat;
            }
            return;
        }
        foreach ($node as $child) $walk($child);
    };
    $walk($geom['coordinates']);
    return $bb;
}

function bbox_merge(?array $a, ?array $b): ?array
{
    if (!$a) return $b;
    if (!$b) return $a;
    return [
        min($a[0], $b[0]),
        min($a[1], $b[1]),
        max($a[2], $b[2]),
        max($a[3], $b[3]),
    ];
}
