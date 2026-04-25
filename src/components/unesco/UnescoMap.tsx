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
  /**
   * When set, the map zooms to this bounding box ([minLng, minLat,
   * maxLng, maxLat]). Used when a legend entry is clicked so the user
   * jumps straight to that zone. Re-applied whenever the tuple changes.
   */
  focusBbox?: [number, number, number, number] | null;
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
  focusBbox,
}: UnescoMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const geoLayerRef = useRef<L.GeoJSON | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const pickHandlerRef = useRef<UnescoMapProps['onPick']>(onPick);
  const zoneHandlerRef = useRef<UnescoMapProps['onZoneClick']>(onZoneClick);
  // Snapshot of every rendered feature's geometry + properties, kept in
  // sync with the GeoJSON layer. Used to detect overlapping zones at a
  // click point so the user can disambiguate from a popup menu.
  const featuresRef = useRef<Array<{ properties: Record<string, any>; geometry: { type: string; coordinates: any } }>>([]);

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
    // Hybrid overlay — we tried Esri's `World_Boundaries_and_Places` and
    // CartoDB's `voyager_only_labels` and found both essentially empty
    // over Djerba at the zoom levels members actually use (the label
    // rasters return ~200-byte blank tiles). OSM's standard tile set has
    // the dense labelling we need (roads, villages, neighbourhoods). The
    // earlier 45% opacity approach washed every label out; we now layer
    // OSM at full opacity with `mix-blend-mode: multiply` (CSS class
    // `unesco-hybrid-osm` in index.css). Multiply keeps the satellite
    // intact under light OSM regions and darkens it under labels/roads,
    // so place names remain crisp without dimming the imagery.
    const hybridOsm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      className: 'unesco-hybrid-osm',
      attribution: '&copy; OpenStreetMap contributors',
    });
    const hybrid = L.layerGroup([imagery, hybridOsm]);

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
      // When `onZoneClick` is set, zone clicks stop propagation so this
      // handler doesn't fire on top of the zone popup. When it isn't
      // (e.g. the permit form), zone clicks bubble through and we drop
      // the pin even if the user clicked inside a coloured polygon.
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

    featuresRef.current = features.map((f) => ({
      properties: (f.properties ?? {}) as Record<string, any>,
      geometry: f.geometry,
    }));

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
          // No zone-click consumer (e.g. in the permit form): let the
          // click bubble up so the map's `click` listener can place the
          // pin even when the user clicked inside a coloured polygon.
          if (!zoneHandlerRef.current) return;
          // Halt both Leaflet's own event and the underlying DOM event so
          // document-level listeners (e.g. the ZonePopup click-outside
          // handler) don't fire when the user switches from one zone to
          // another.
          L.DomEvent.stopPropagation(e as unknown as Event);
          const oe = (e as unknown as { originalEvent?: MouseEvent }).originalEvent;
          if (oe && typeof oe.stopPropagation === 'function') oe.stopPropagation();

          // Leaflet only fires the click on the topmost feature, but
          // zones genuinely overlap (e.g. a buffer zone inscribed in a
          // protected zone). Hit-test every feature at the click point
          // — when more than one matches, show a disambiguation popup
          // so the user can pick the layer they meant.
          const handler = zoneHandlerRef.current;
          const me = e as L.LeafletMouseEvent;
          const hits = collectOverlapping(me.latlng, props, featuresRef.current);
          if (hits.length > 1) {
            openOverlapPopup(map, me.latlng, hits, (chosen) => handler(chosen));
          } else {
            handler(props);
          }
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

  // --- focusBbox : zoom on a specific zone when the parent requests it ---
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focusBbox) return;
    map.fitBounds(
      [
        [focusBbox[1], focusBbox[0]],
        [focusBbox[3], focusBbox[2]],
      ],
      { padding: [32, 32], maxZoom: 16 }
    );
  }, [focusBbox?.[0], focusBbox?.[1], focusBbox?.[2], focusBbox?.[3]]);

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

// --- Overlap detection --------------------------------------------------
// Used when a zone is clicked: returns every feature whose geometry
// contains the click point, deduped by zoneId. The clicked feature is
// always included first so point-only features (which the polygon hit
// test can't match) still appear.
function collectOverlapping(
  latlng: L.LatLng,
  clickedProps: Record<string, any>,
  pool: Array<{ properties: Record<string, any>; geometry: { type: string; coordinates: any } }>
): Record<string, any>[] {
  const lng = latlng.lng;
  const lat = latlng.lat;
  const out: Record<string, any>[] = [];
  const seen = new Set<string>();
  const keyOf = (p: Record<string, any>): string | null => {
    if (typeof p.zoneId === 'string' && p.zoneId) return `z:${p.zoneId}`;
    if (typeof p.featureKey === 'string' && p.featureKey) return `f:${p.featureKey}`;
    return null;
  };
  const push = (p: Record<string, any>) => {
    const k = keyOf(p);
    if (k && seen.has(k)) return;
    if (k) seen.add(k);
    out.push(p);
  };
  push(clickedProps);
  for (const f of pool) {
    if (pointInGeometry(lng, lat, f.geometry)) push(f.properties);
  }
  return out;
}

function pointInGeometry(lng: number, lat: number, geom: { type: string; coordinates: any } | null | undefined): boolean {
  if (!geom) return false;
  if (geom.type === 'Polygon') return pointInRings(lng, lat, geom.coordinates as number[][][]);
  if (geom.type === 'MultiPolygon') {
    for (const poly of geom.coordinates as number[][][][]) {
      if (pointInRings(lng, lat, poly)) return true;
    }
  }
  return false;
}

function pointInRings(lng: number, lat: number, rings: number[][][]): boolean {
  if (!Array.isArray(rings) || rings.length === 0) return false;
  if (!pointInRing(lng, lat, rings[0])) return false;
  for (let i = 1; i < rings.length; i++) {
    if (pointInRing(lng, lat, rings[i])) return false;
  }
  return true;
}

function pointInRing(lng: number, lat: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const intersect =
      yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi || 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

// --- Disambiguation popup ----------------------------------------------
// Renders a small list of overlapping zones at the click point. Picking
// one closes the popup and forwards the choice to `onZoneClick`. Built
// with raw DOM to stay consistent with the rest of this component (no
// react-leaflet dependency).
function openOverlapPopup(
  map: L.Map,
  latlng: L.LatLng,
  hits: Record<string, any>[],
  onPick: (props: Record<string, any>) => void
) {
  const root = document.createElement('div');
  root.className = 'unesco-overlap-menu';

  const title = document.createElement('p');
  title.className = 'unesco-overlap-title';
  title.textContent = `${hits.length} zones ici`;
  root.appendChild(title);

  const list = document.createElement('div');
  list.className = 'unesco-overlap-list';
  for (const props of hits) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'unesco-overlap-item';

    const swatch = document.createElement('span');
    swatch.className = 'unesco-overlap-swatch';
    swatch.style.background = typeof props.color === 'string' ? props.color : '#2563EB';
    btn.appendChild(swatch);

    const label = document.createElement('span');
    label.className = 'unesco-overlap-label';
    label.textContent = typeof props.name === 'string' && props.name ? props.name : 'Zone';
    btn.appendChild(label);

    L.DomEvent.on(btn, 'click', (ev) => {
      L.DomEvent.stopPropagation(ev);
      L.DomEvent.preventDefault(ev);
      map.closePopup();
      onPick(props);
    });
    list.appendChild(btn);
  }
  root.appendChild(list);

  L.popup({
    closeButton: true,
    autoClose: true,
    maxWidth: 280,
    className: 'unesco-overlap-popup',
  })
    .setLatLng(latlng)
    .setContent(root)
    .openOn(map);
}
