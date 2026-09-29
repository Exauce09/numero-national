/** Carte Leaflet OpenStreetMap centrée sur la RDC. */

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  kindColor,
  type MapPoint,
  type ProvinceBureauTotals,
} from "../bureauCartographie";

const RDC_CENTER: L.LatLngExpression = [-2.5, 23.5];
const RDC_SW: L.LatLngTuple = [-13.6, 12.0];
const RDC_NE: L.LatLngTuple = [5.5, 31.5];

type Props = {
  points: MapPoint[];
  provinceSummaries?: ProvinceBureauTotals[];
  selectedId?: string | null;
  onSelect?: (p: MapPoint) => void;
  onSelectProvince?: (province: string) => void;
  provinceFilter?: string;
};

export default function RdcLeafletMap({
  points,
  provinceSummaries = [],
  selectedId,
  onSelect,
  onSelectProvince,
  provinceFilter = "",
}: Props) {
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
      color: "#6b849c",
      weight: 1.5,
      fillColor: "#6b849c",
      fillOpacity: 0.03,
      dashArray: "5 4",
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

    // Totaux par province (affichés d'abord, sous les points individuels)
    if (!provinceFilter.trim()) {
      for (const s of provinceSummaries) {
        if (s.total <= 0) continue;
        const html = `<div class="carto-prov-chip" title="${escapeHtml(s.province)}">
          <strong>${escapeHtml(s.province)}</strong>
          <span>${s.total} bureau${s.total > 1 ? "x" : ""}</span>
          <small>
            <em style="background:${kindColor("BUREAU_PRINCIPAL")}"></em>${s.principal}
            <em style="background:${kindColor("BUREAU_SECONDAIRE")}"></em>${s.secondaire}
            <em style="background:${kindColor("BUREAU_APPUI")}"></em>${s.appui}
          </small>
        </div>`;
        const icon = L.divIcon({
          className: "carto-prov-icon",
          html,
          iconSize: [120, 54],
          iconAnchor: [60, 27],
        });
        const m = L.marker([s.lat, s.lng], { icon, zIndexOffset: 100 });
        m.on("click", () => onSelectProvince?.(s.province));
        m.addTo(layer);
        latLngs.push([s.lat, s.lng]);
      }
    }

    for (const p of points) {
      const color = kindColor(p.kind);
      const isSelected = selectedId === p.id;
      const marker = L.circleMarker([p.lat, p.lng], {
        radius: isSelected ? 10 : 7,
        color: isSelected ? "#c9b458" : "#fff",
        weight: isSelected ? 2.5 : 1.5,
        fillColor: color,
        fillOpacity: 0.88,
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

    if (provinceFilter.trim() && latLngs.length) {
      map.fitBounds(L.latLngBounds(latLngs), { padding: [40, 40], maxZoom: 8 });
    } else if (latLngs.length > 1) {
      map.fitBounds(L.latLngBounds(latLngs), { padding: [40, 40], maxZoom: 6 });
    } else if (latLngs.length === 1) {
      map.setView(latLngs[0], 7, { animate: true });
    } else {
      map.setView(RDC_CENTER, 5, { animate: true });
    }
  }, [points, provinceSummaries, selectedId, onSelect, onSelectProvince, provinceFilter]);

  return (
    <div className="carto-map-inner carto-map-leaflet">
      <div
        ref={containerRef}
        className="carto-leaflet-root"
        role="img"
        aria-label="Carte de la République démocratique du Congo"
      />
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
