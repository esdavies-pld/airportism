'use client';

import { useEffect, useRef } from 'react';
import maplibregl, { type StyleSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

export interface PinCoord {
  lat: number;
  lon: number;
}

interface GlobeProps {
  onPinChange?: (coord: PinCoord) => void;
  locked?: boolean;
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

export default function Globe({ onPinChange, locked = false }: GlobeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onPinChangeRef = useRef(onPinChange);
  const lockedRef = useRef(locked);

  useEffect(() => {
    onPinChangeRef.current = onPinChange;
  }, [onPinChange]);
  useEffect(() => {
    lockedRef.current = locked;
  }, [locked]);

  useEffect(() => {
    if (!containerRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE,
      center: [0, 20],
      zoom: 1.2,
    });

    let marker: maplibregl.Marker | null = null;

    map.on('click', (e) => {
      if (lockedRef.current) return;
      const { lng, lat } = e.lngLat;

      if (marker) {
        marker.setLngLat([lng, lat]);
      } else {
        marker = new maplibregl.Marker({ draggable: true, color: '#f97316' })
          .setLngLat([lng, lat])
          .addTo(map);
        marker.on('dragend', () => {
          if (!marker) return;
          const ll = marker.getLngLat();
          onPinChangeRef.current?.({ lat: ll.lat, lon: ll.lng });
        });
      }
      onPinChangeRef.current?.({ lat, lon: lng });
    });

    return () => {
      map.remove();
      marker = null;
    };
  }, []);

  return <div ref={containerRef} className="h-full w-full" />;
}
