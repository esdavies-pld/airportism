'use client';

import { useEffect, useRef, useState } from 'react';
import maplibregl, { type StyleSpecification } from 'maplibre-gl';
import { mesh as topoMesh } from 'topojson-client';
import type { Topology } from 'topojson-specification';
import 'maplibre-gl/dist/maplibre-gl.css';

export interface PinCoord {
  lat: number;
  lon: number;
}

export interface GlobeReveal {
  guess: PinCoord;
  actual: PinCoord;
}

interface GlobeProps {
  pin?: PinCoord | null;
  onPinChange?: (coord: PinCoord) => void;
  locked?: boolean;
  reveal?: GlobeReveal | null;
}

const STYLE: StyleSpecification = {
  version: 8,
  projection: { type: 'globe' },
  sources: {
    esri: {
      type: 'raster',
      tiles: [
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      ],
      tileSize: 256,
      maxzoom: 19,
      attribution: 'Tiles © Esri — World Imagery',
    },
  },
  layers: [{ id: 'esri-imagery', type: 'raster', source: 'esri' }],
};

const GREAT_CIRCLE_SRC = 'great-circle';
const GREAT_CIRCLE_LAYER = 'great-circle-line';
const COUNTRIES_SRC = 'countries';
const COUNTRIES_LAYER = 'countries-line';
const US_STATES_SRC = 'us-states';
const US_STATES_LAYER = 'us-states-line';
const COUNTRIES_URL = '/borders/world-countries-50m.json';
const US_STATES_URL = '/borders/us-states-10m.json';

// Natural Earth geometry crosses the antimeridian, and MapLibre draws each
// segment planar-wise — so a hop from +179 to -179 is rendered the long way,
// as a line clear around the globe. Fiji (lat -16.4), Russia and Antarctica
// all do it. Cut those segments; the gap left at ±180 is sub-pixel.
function splitAtAntimeridian(lines: GeoJSON.Position[][]): GeoJSON.Position[][] {
  const out: GeoJSON.Position[][] = [];
  for (const line of lines) {
    let run: GeoJSON.Position[] = [];
    for (let i = 0; i < line.length; i++) {
      if (i > 0 && Math.abs(line[i][0] - line[i - 1][0]) > 180) {
        if (run.length > 1) out.push(run);
        run = [];
      }
      run.push(line[i]);
    }
    if (run.length > 1) out.push(run);
  }
  return out;
}

// mesh() yields the shared arcs, so a border between two countries is drawn
// once rather than once per polygon — keeps every line the same weight.
function borderLines(topo: Topology, key: string): GeoJSON.Feature {
  const merged = topoMesh(topo, topo.objects[key] as unknown as Parameters<typeof topoMesh>[1]);
  return {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'MultiLineString',
      coordinates: splitAtAntimeridian(merged.coordinates),
    },
  };
}

async function loadBorders(map: maplibregl.Map) {
  const [world, us] = await Promise.all([
    fetch(COUNTRIES_URL).then((r) => r.json() as Promise<Topology>),
    fetch(US_STATES_URL).then((r) => r.json() as Promise<Topology>),
  ]);

  if (!map.getStyle()) return; // map was removed mid-fetch

  if (!map.getSource(COUNTRIES_SRC)) {
    map.addSource(COUNTRIES_SRC, { type: 'geojson', data: borderLines(world, 'countries') });
    map.addLayer(
      {
        id: COUNTRIES_LAYER,
        type: 'line',
        source: COUNTRIES_SRC,
        paint: {
          'line-color': '#ffffff',
          'line-width': 0.6,
          'line-opacity': 0.45,
        },
      },
      map.getLayer(GREAT_CIRCLE_LAYER) ? GREAT_CIRCLE_LAYER : undefined,
    );
  }

  if (!map.getSource(US_STATES_SRC)) {
    map.addSource(US_STATES_SRC, { type: 'geojson', data: borderLines(us, 'states') });
    map.addLayer(
      {
        id: US_STATES_LAYER,
        type: 'line',
        source: US_STATES_SRC,
        paint: {
          'line-color': '#fbbf24',
          'line-width': 0.5,
          'line-opacity': 0.55,
        },
      },
      map.getLayer(GREAT_CIRCLE_LAYER) ? GREAT_CIRCLE_LAYER : undefined,
    );
  }
}

function interpolateGreatCircle(a: PinCoord, b: PinCoord, steps = 64): [number, number][] {
  const lat1 = (a.lat * Math.PI) / 180;
  const lon1 = (a.lon * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const lon2 = (b.lon * Math.PI) / 180;
  const sinHalfDLat = Math.sin((lat2 - lat1) / 2);
  const sinHalfDLon = Math.sin((lon2 - lon1) / 2);
  const h = sinHalfDLat ** 2 + Math.cos(lat1) * Math.cos(lat2) * sinHalfDLon ** 2;
  const d = 2 * Math.asin(Math.sqrt(h));
  if (d < 1e-9) {
    return [
      [a.lon, a.lat],
      [b.lon, b.lat],
    ];
  }
  const result: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const f = i / steps;
    const A = Math.sin((1 - f) * d) / Math.sin(d);
    const B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.cos(lat1) * Math.cos(lon1) + B * Math.cos(lat2) * Math.cos(lon2);
    const y = A * Math.cos(lat1) * Math.sin(lon1) + B * Math.cos(lat2) * Math.sin(lon2);
    const z = A * Math.sin(lat1) + B * Math.sin(lat2);
    const lat = Math.atan2(z, Math.sqrt(x * x + y * y));
    const lon = Math.atan2(y, x);
    result.push([(lon * 180) / Math.PI, (lat * 180) / Math.PI]);
  }
  return result;
}

function emptyLine(): GeoJSON.Feature<GeoJSON.LineString> {
  return {
    type: 'Feature',
    geometry: { type: 'LineString', coordinates: [] },
    properties: {},
  };
}

export default function Globe({ pin = null, onPinChange, locked = false, reveal = null }: GlobeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const guessMarkerRef = useRef<maplibregl.Marker | null>(null);
  const actualMarkerRef = useRef<maplibregl.Marker | null>(null);
  const onPinChangeRef = useRef(onPinChange);
  const lockedRef = useRef(locked);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    onPinChangeRef.current = onPinChange;
  }, [onPinChange]);
  useEffect(() => {
    lockedRef.current = locked;
  }, [locked]);

  // Init map once.
  useEffect(() => {
    if (!containerRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE,
      center: [0, 20],
      zoom: 1.2,
    });
    mapRef.current = map;

    map.on('click', (e) => {
      if (lockedRef.current) return;
      onPinChangeRef.current?.({ lat: e.lngLat.lat, lon: e.lngLat.lng });
    });

    map.on('load', () => {
      setLoaded(true);
      if (!map.getSource(GREAT_CIRCLE_SRC)) {
        map.addSource(GREAT_CIRCLE_SRC, { type: 'geojson', data: emptyLine() });
        map.addLayer({
          id: GREAT_CIRCLE_LAYER,
          type: 'line',
          source: GREAT_CIRCLE_SRC,
          paint: {
            'line-color': '#f97316',
            'line-width': 2,
            'line-dasharray': [2, 2],
          },
        });
      }
      void loadBorders(map).catch((err) => {
        console.error('Failed to load border data', err);
      });
    });

    return () => {
      map.remove();
      mapRef.current = null;
      guessMarkerRef.current = null;
      actualMarkerRef.current = null;
    };
  }, []);

  // Sync guess marker to `pin` prop.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (pin) {
      if (guessMarkerRef.current) {
        guessMarkerRef.current.setLngLat([pin.lon, pin.lat]);
        guessMarkerRef.current.setDraggable(!locked);
      } else {
        const m = new maplibregl.Marker({ draggable: !locked, color: '#f97316' })
          .setLngLat([pin.lon, pin.lat])
          .addTo(map);
        m.on('dragend', () => {
          const ll = m.getLngLat();
          onPinChangeRef.current?.({ lat: ll.lat, lon: ll.lng });
        });
        guessMarkerRef.current = m;
      }
    } else if (guessMarkerRef.current) {
      guessMarkerRef.current.remove();
      guessMarkerRef.current = null;
    }
  }, [pin, locked]);

  // Sync reveal: actual marker + great-circle line + fitBounds. Reset on clear.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const apply = () => {
      if (reveal) {
        if (actualMarkerRef.current) {
          actualMarkerRef.current.setLngLat([reveal.actual.lon, reveal.actual.lat]);
        } else {
          actualMarkerRef.current = new maplibregl.Marker({ color: '#10b981' })
            .setLngLat([reveal.actual.lon, reveal.actual.lat])
            .addTo(map);
        }
        const src = map.getSource(GREAT_CIRCLE_SRC) as maplibregl.GeoJSONSource | undefined;
        src?.setData({
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: interpolateGreatCircle(reveal.guess, reveal.actual) },
          properties: {},
        });
        const bounds = new maplibregl.LngLatBounds()
          .extend([reveal.guess.lon, reveal.guess.lat])
          .extend([reveal.actual.lon, reveal.actual.lat]);
        map.fitBounds(bounds, { padding: 80, duration: 1500, maxZoom: 6 });
      } else {
        if (actualMarkerRef.current) {
          actualMarkerRef.current.remove();
          actualMarkerRef.current = null;
        }
        const src = map.getSource(GREAT_CIRCLE_SRC) as maplibregl.GeoJSONSource | undefined;
        src?.setData(emptyLine());
        map.easeTo({ center: [0, 20], zoom: 1.2, duration: 1000 });
      }
    };

    if (map.isStyleLoaded()) {
      apply();
    } else {
      map.once('load', apply);
    }
  }, [reveal]);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      {!loaded && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/80 text-sm uppercase tracking-widest text-gray-400">
          Loading globe…
        </div>
      )}
    </div>
  );
}
