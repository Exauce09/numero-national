import { useEffect, useMemo, useRef, useState } from "react";
import { fetchOnipMapPoints, type MapPoint } from "../api";

declare global {
  interface Window {
    L?: {
      map: (el: HTMLElement, opts?: object) => LeafletMap;
      tileLayer: (url: string, opts?: object) => { addTo: (m: LeafletMap) => void };
      marker: (latlng: [number, number]) => {
        addTo: (m: LeafletMap) => { bindPopup: (html: string) => void };
      };
      latLngBounds: (latlngs: [number, number][]) => unknown;
    };
  }
}

type LeafletMap = {
  setView: (latlng: [number, number], zoom: number) => LeafletMap;
  fitBounds: (bounds: unknown, opts?: object) => void;
  remove: () => void;
};

function loadLeaflet(): Promise<NonNullable<typeof window.L>> {
  return new Promise((resolve, reject) => {
    if (window.L) {
      resolve(window.L);
      return;
    }
    const cssId = "leaflet-css";
    if (!document.getElementById(cssId)) {
      const link = document.createElement("link");
      link.id = cssId;
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }
    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.async = true;
    script.onload = () => {
      if (window.L) resolve(window.L);
      else reject(new Error("Leaflet non chargé"));
    };
    script.onerror = () => reject(new Error("Impossible de charger Leaflet"));
    document.body.appendChild(script);
  });
}

export default function CartographiePage() {
  const [points, setPoints] = useState<MapPoint[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstance = useRef<LeafletMap | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchOnipMapPoints()
      .then((res) => {
        if (!cancelled) setPoints(res.points ?? []);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const withGps = useMemo(
    () => points.filter((p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude)),
    [points],
  );

  useEffect(() => {
    let disposed = false;
    async function render() {
      if (!mapRef.current || withGps.length === 0) return;
      try {
        const L = await loadLeaflet();
        if (disposed || !mapRef.current) return;
        if (mapInstance.current) {
          mapInstance.current.remove();
          mapInstance.current = null;
        }
        const map = L.map(mapRef.current).setView([withGps[0].latitude, withGps[0].longitude], 12);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 19,
        }).addTo(map);
        const latlngs: [number, number][] = [];
        for (const p of withGps) {
          const ll: [number, number] = [p.latitude, p.longitude];
          latlngs.push(ll);
          L.marker(ll)
            .addTo(map)
            .bindPopup(
              `<strong>${(p.address_line || "Ménage").replace(/</g, "&lt;")}</strong><br/>` +
                `${p.latitude.toFixed(5)}, ${p.longitude.toFixed(5)}`,
            );
        }
        if (latlngs.length > 1) {
          map.fitBounds(L.latLngBounds(latlngs), { padding: [28, 28] });
        }
        mapInstance.current = map;
      } catch (e) {
        if (!disposed) setError(e instanceof Error ? e.message : String(e));
      }
    }
    void render();
    return () => {
      disposed = true;
      mapInstance.current?.remove();
      mapInstance.current = null;
    };
  }, [withGps]);

  return (
    <div>
      <div className="hero-banner">
        <h1>Cartographie</h1>
        <p>
          Points GPS des ménages enregistrés sur le terrain (APK) — la position est capturée à
          l&apos;enregistrement, puis synchronisée.
        </p>
      </div>

      <div className="grid" style={{ marginTop: 0 }}>
        <div className="metric">
          <div className="label">Points sur la carte</div>
          <div className="value">{withGps.length}</div>
        </div>
      </div>

      {loading ? <p className="muted">Chargement de la carte…</p> : null}
      {error ? <p className="error">{error}</p> : null}

      {!loading && withGps.length === 0 && !error ? (
        <div className="panel">
          <p className="muted" style={{ margin: 0 }}>
            Aucun point GPS pour l&apos;instant. Enregistrez un ménage dans l&apos;application terrain
            (le GPS se capture automatiquement), puis synchronisez.
          </p>
        </div>
      ) : null}

      {withGps.length > 0 ? (
        <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
          <div ref={mapRef} style={{ height: 480, width: "100%" }} />
        </div>
      ) : null}

      {withGps.length > 0 ? (
        <div className="panel">
          <h2>Derniers points</h2>
          <table className="data-table">
            <thead>
              <tr>
                <th>Adresse</th>
                <th>Latitude</th>
                <th>Longitude</th>
                <th>Mis à jour</th>
              </tr>
            </thead>
            <tbody>
              {withGps.slice(0, 50).map((p) => (
                <tr key={p.id}>
                  <td>{p.address_line || "—"}</td>
                  <td>{p.latitude.toFixed(6)}</td>
                  <td>{p.longitude.toFixed(6)}</td>
                  <td>{p.updated_at ? new Date(p.updated_at).toLocaleString("fr-FR") : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
