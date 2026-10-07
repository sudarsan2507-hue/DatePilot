import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

/**
 * Map of the day: numbered stops, the starting point and the driving route.
 * Uses the real road path from OSRM when available, otherwise a dashed straight line.
 */
export default function RouteMap({ stops, routes }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;

    const map = L.map(el, {
      scrollWheelZoom: false,
      zoomControl: true,
      attributionControl: true,
    });
    mapRef.current = map;
    map.attributionControl.setPrefix(false);
    // OpenStreetMap tiles (no key; attribution required), warmed with CSS to match the palette.
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      className: 'map-tiles',
    }).addTo(map);

    const points = [];
    const start = routes?.start;
    if (start) {
      L.marker([start.lat, start.lng], {
        icon: L.divIcon({ className: '', html: '<span class="map-start" aria-hidden="true"></span>', iconSize: [16, 16], iconAnchor: [8, 8] }),
        title: `Start: ${start.label}`,
      }).bindTooltip(`Start · ${start.label}`).addTo(map);
      points.push([start.lat, start.lng]);
    }

    (routes?.legs || []).forEach((leg) => {
      if (!leg.path?.length) return;
      L.polyline(leg.path, {
        color: '#8f4935',
        weight: 4,
        opacity: 0.85,
        dashArray: leg.is_road ? null : '6 8',
        className: 'map-route',
      }).addTo(map);
      points.push(...leg.path);
    });

    stops.forEach((stop, i) => {
      const { lat, lng, name } = stop.venue;
      if (!lat && !lng) return;
      L.marker([lat, lng], {
        icon: L.divIcon({
          className: '',
          html: `<span class="map-pin" style="animation-delay:${400 + i * 150}ms">${i + 1}</span>`,
          iconSize: [30, 30],
          iconAnchor: [15, 15],
        }),
        title: name,
      }).bindTooltip(`${i + 1}. ${name} · ${stop.arrival_time}`).addTo(map);
      points.push([lat, lng]);
    });

    if (points.length) map.fitBounds(L.latLngBounds(points), { padding: [32, 32] });
    else map.setView([13.0336, 80.252], 12);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [stops, routes]);

  return (
    <div
      ref={containerRef}
      className="isolate h-72 w-full overflow-hidden rounded-xl border border-line md:h-96"
      role="img"
      aria-label={`Map of the route: ${stops.map((s, i) => `${i + 1}. ${s.venue.name}`).join(', ')}`}
    />
  );
}
