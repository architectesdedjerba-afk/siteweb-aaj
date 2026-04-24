/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Leaflet-backed map for the Djerba UNESCO feature.
 *
 * Renders a GeoJSON FeatureCollection (served by /api/unesco/geojson),
 * colour-codes each zone using the admin-defined palette, and exposes
 * two optional callbacks:
 *
 *   - `onZoneClick` fires with the full feature properties when a zone
 *     polygon is clicked — consumers show a floating panel with the
 *     regulation excerpt + a link to the full document.
 *
 *   - `onPick` fires with a {lat, lng} when the map itself is clicked
 *     outside any zone — used by the permit form to let the architect
 *     drop a pin on the project location.
 *
 * The component does not depend on react-leaflet; a single useEffect
 * handles imperative Leaflet setup/teardown. This keeps the bundle
 * lean and avoids wrestling with the React-leaflet lifecycle.
 */

import { useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Leaflet's default icon assumes the marker assets live next to the JS
// file, which Vite doesn't preserve. Point to the canonical CDN URLs so
// markers render without 404s. Called once at module load.
const iconDefault = (L.Icon.Default.prototype as unknown as { _getIconUrl?: () => string }) || {};
delete iconDefault._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

export interface UnescoGeoJson {
  type: 'FeatureCollection';
  features: Array<{
    type: 'Feature';
    properties: Record<string, any>;
    geometry: { type: string; coordinates: any };
  }>;
  bbox: [number, number, number, number] | null;
  sources?: Array<{
    id: string;
    title: string;
    description: string | null;
    featureCount: number;
    sortOrder: number;
    bbox: [number, number, number, number] | null;
  }>;
}

interface UnescoMapProps {
  geojson: UnescoGeoJson | null;
  onZoneClick?: (props: Record<string, any>) => void;
  onPick?: (coords: { lat: number; lng: number }) => void;
  marker?: { lat: number; lng: number; label?: string } | null;
  height?: number | string;
  fitKey?: string | number;
}

// Djerba's approximate centre — used when the FeatureCollection has no
// bbox (e.g. empty collection, first load before KMZ upload).
const DJERBA_CENTER: [number, number] = [33.807, 10.852];
const DJERBA_ZOOM = 11;

export function UnescoMap({
  geojson,
  onZoneClick,
  onPick,
  marker,
  height = 480,
  fitKey,
}: UnescoMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const geoLayerRef = useRef<L.GeoJSON | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const pickHandlerRef = useRef<UnescoMapProps['onPick']>(onPick);
  const zoneHandlerRef = useRef<UnescoMapProps['onZoneClick']>(onZoneClick);

  pickHandlerRef.current = onPick;
  zoneHandlerRef.current = onZoneClick;

  const features = useMemo(() => geojson?.features ?? [], [geojson]);

  // --- mount / unmount ---
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      center: DJERBA_CENTER,
      zoom: DJERBA_ZOOM,
      zoomControl: true,
      scrollWheelZoom: true,
    });

    // Plan (OSM)
    const osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    });
    // Satellite imagery (Esri World Imagery)
    const imagery = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {
        maxZoom: 19,
        attribution:
          'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
      }
    );
    // Labels + roads overlays on top of imagery. Stays in the default
    // tilePane (below overlayPane) so our zone polygons render above the
    // labels. Since polygons use a 0.25 fillOpacity, labels still show
    // through — the exact feel of Google Maps' satellite-with-labels.
    const hybridLabels = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
      { maxZoom: 19 }
    );
    const hybridRoads = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}',
      { maxZoom: 19 }
    );
    const hybrid = L.layerGroup([imagery, hybridRoads, hybridLabels]);

    // Default = Hybride (satellite + labels), matching the Google-Maps
    // satellite experience. Users can switch to plain satellite or OSM.
    hybrid.addTo(map);
    L.control
      .layers(
        { Hybride: hybrid, Satellite: imagery, Plan: osm },
        {},
        { position: 'topright' }
      )
      .addTo(map);

    map.on('click', (e: L.LeafletMouseEvent) => {
      // Don't fire `onPick` when the click landed on a zone (the zone
      // handler ran first via propagation).
      if (!pickHandlerRef.current) return;
      pickHandlerRef.current({ lat: e.latlng.lat, lng: e.latlng.lng });
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      geoLayerRef.current = null;
      markerRef.current = null;
    };
  }, []);

  // --- redraw the GeoJSON layer when features change ---
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (geoLayerRef.current) {
      map.removeLayer(geoLayerRef.current);
      geoLayerRef.current = null;
    }

    if (features.length === 0) return;

    const layer = L.geoJSON({ type: 'FeatureCollection', features } as any, {
      style: (feat) => {
        const p = (feat?.properties ?? {}) as Record<string, any>;
        const color = typeof p.color === 'string' ? p.color : '#2563EB';
        return {
          color,
          weight: 2,
          opacity: 0.9,
          fillColor: color,
          fillOpacity: 0.25,
        };
      },
      pointToLayer: (feat, latlng) => {
        const p = (feat?.properties ?? {}) as Record<string, any>;
        const color = typeof p.color === 'string' ? p.color : '#2563EB';
        return L.circleMarker(latlng, {
          radius: 8,
          color,
          weight: 2,
          fillColor: color,
          fillOpacity: 0.5,
        });
      },
      onEachFeature: (feat, lyr) => {
        const props = (feat?.properties ?? {}) as Record<string, any>;
        const name = typeof props.name === 'string' ? props.name : 'Zone';
        const short =
          typeof props.regulationShort === 'string' && props.regulationShort
            ? props.regulationShort
            : null;
        const tooltip = `<strong>${escapeHtml(name)}</strong>${
          short ? `<br><span style="font-size:11px">${escapeHtml(truncate(short, 120))}</span>` : ''
        }`;
        lyr.bindTooltip(tooltip, { direction: 'top', sticky: true });
        lyr.on('click', (e) => {
          // Halt both Leaflet's own event and the underlying DOM event so
          // document-level listeners (e.g. the ZonePopup click-outside
          // handler) don't fire when the user switches from one zone to
          // another.
          L.DomEvent.stopPropagation(e as unknown as Event);
          const oe = (e as unknown as { originalEvent?: MouseEvent }).originalEvent;
          if (oe && typeof oe.stopPropagation === 'function') oe.stopPropagation();
          zoneHandlerRef.current?.(props);
        });
      },
    });
    layer.addTo(map);
    geoLayerRef.current = layer;
  }, [features]);

  // --- fit to bbox when the geojson or a caller-provided key changes ---
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const bbox = geojson?.bbox ?? null;
    if (bbox) {
      map.fitBounds(
        [
          [bbox[1], bbox[0]],
          [bbox[3], bbox[2]],
        ],
        { padding: [24, 24] }
      );
    } else {
      map.setView(DJERBA_CENTER, DJERBA_ZOOM);
    }
  }, [geojson?.bbox, fitKey]);

  // --- marker sync ---
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (markerRef.current) {
      map.removeLayer(markerRef.current);
      markerRef.current = null;
    }
    if (marker) {
      const m = L.marker([marker.lat, marker.lng], { draggable: false });
      if (marker.label) m.bindTooltip(marker.label, { permanent: true, direction: 'top' });
      m.addTo(map);
      markerRef.current = m;
    }
  }, [marker?.lat, marker?.lng, marker?.label]);

  const heightStyle = typeof height === 'number' ? `${height}px` : height;
  return (
    <div
      ref={containerRef}
      className="w-full border border-aaj-border rounded overflow-hidden"
      style={{ height: heightStyle, minHeight: 240 }}
      aria-label="Carte Djerba UNESCO"
    />
  );
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;'
  );
}
function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s;
}
