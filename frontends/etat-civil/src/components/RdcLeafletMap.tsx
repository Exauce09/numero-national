/** Carte Leaflet OpenStreetMap centrée sur la RDC. */

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { kindColor, type MapPoint } from "../bureauCartographie";

const RDC_CENTER: L.LatLngExpression = [-2.5, 23.5];
const RDC_SW: L.LatLngTuple = [-13.6, 12.0];
const RDC_NE: L.LatLngTuple = [5.5, 31.5];

type Props = {
  points: MapPoint[];
  selectedId?: string | null;
  onSelect?: (p: MapPoint) => void;
  provinceFilter?: string;
};

export default function RdcLeafletMap({ points, selectedId, onSelect, provinceFilter }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const bounds = L.latLngBounds(RDC_SW, RDC_NE);
    const map = L.map(containerRef.current, {
      center: RDC_CENTER,
      zoom: 5,
      minZoom: 4,
      maxZoom: 14,
      maxBounds: bounds.pad(0.15),
      maxBoundsViscosity: 0.8,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    L.rectangle(bounds, {
      color: "#0b3d91",
      weight: 2,
      fillColor: "#0b3d91",
      fillOpacity: 0.04,
      dashArray: "6 4",
    }).addTo(map);

    L.control
      .scale({ imperial: false, metric: true, position: "bottomleft" })
      .addTo(map);

    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    const t = window.setTimeout(() => map.invalidateSize(), 80);
    return () => {
      window.clearTimeout(t);
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();

    const latLngs: L.LatLngExpression[] = [];
    for (const p of points) {
      const color = kindColor(p.kind);
      const isSelected = selectedId === p.id;
      const marker = L.circleMarker([p.lat, p.lng], {
        radius: isSelected ? 11 : 8,
        color: isSelected ? "#f7d618" : "#fff",
        weight: isSelected ? 3 : 2,
        fillColor: color,
        fillOpacity: 0.95,
      });
      marker.bindPopup(
        `<strong>${escapeHtml(p.name)}</strong><br/>${escapeHtml(p.kindLabel)}<br/>` +
          `${escapeHtml([p.commune, p.ville, p.province].filter(Boolean).join(" · "))}<br/>` +
          `<em>${p.actCount} fait(s)</em>`,
      );
      marker.on("click", () => onSelect?.(p));
      marker.addTo(layer);
      latLngs.push([p.lat, p.lng]);
    }

    map.invalidateSize();

    if (latLngs.length === 1) {
      map.setView(latLngs[0], provinceFilter ? 8 : 6, { animate: true });
    } else if (latLngs.length > 1) {
      map.fitBounds(L.latLngBounds(latLngs), { padding: [36, 36], maxZoom: provinceFilter ? 9 : 7 });
    } else {
      map.setView(RDC_CENTER, 5, { animate: true });
    }
  }, [points, selectedId, onSelect, provinceFilter]);

  return (
    <div className="carto-map-inner carto-map-leaflet">
      <div ref={containerRef} className="carto-leaflet-root" role="img" aria-label="Carte de la République démocratique du Congo" />
    </div>
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
