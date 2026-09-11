import { useEffect, useMemo, useRef, useState } from "react";
import { fetchOnipMapByMilieu, fetchOnipMapPoints, type MapMilieu, type MapPoint } from "../api";

declare global {
  interface Window {
    L?: {
      map: (el: HTMLElement, opts?: object) => LeafletMap;
      tileLayer: (url: string, opts?: object) => { addTo: (m: LeafletMap) => void };
      marker: (latlng: [number, number]) => {
        addTo: (m: LeafletMap) => { bindPopup: (html: string) => void };
      };
      circleMarker: (
        latlng: [number, number],
        opts?: object,
      ) => {
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

type Mode = "persons" | "milieu";
type AddressFilter = "all" | "gps" | "online" | "manual";

function sourceColor(src: string | null | undefined): { color: string; fill: string } {
  switch ((src || "gps").toLowerCase()) {
    case "manual":
      return { color: "#ce1126", fill: "#f7d618" };
    case "online":
      return { color: "#0aad8a", fill: "#0aad8a" };
    default:
      return { color: "#007fff", fill: "#007fff" };
  }
}

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

function esc(s: string): string {
  return s.replace(/</g, "&lt;").replace(/"/g, "&quot;");
}

export default function CartographiePage() {
  const [mode, setMode] = useState<Mode>("persons");
  const [addressFilter, setAddressFilter] = useState<AddressFilter>("all");
  const [points, setPoints] = useState<MapPoint[]>([]);
  const [milieux, setMilieux] = useState<MapMilieu[]>([]);
  const [personsTotal, setPersonsTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstance = useRef<LeafletMap | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const load =
      mode === "persons"
        ? fetchOnipMapPoints(addressFilter).then((res) => {
            if (cancelled) return;
            setPoints(res.points ?? []);
            setMilieux([]);
            setPersonsTotal(res.count ?? 0);
          })
        : fetchOnipMapByMilieu(addressFilter).then((res) => {
            if (cancelled) return;
            setMilieux(res.milieux ?? []);
            setPoints([]);
            setPersonsTotal(res.persons ?? 0);
          });
    load
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [mode, addressFilter]);

  const markers = useMemo(() => {
    if (mode === "persons") {
      return points
        .filter((p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude))
        .map((p) => {
          const c = sourceColor(p.address_source);
          const srcLabel =
            p.address_source === "manual"
              ? "Saisie manuelle"
              : p.address_source === "online"
                ? "GPS + internet"
                : "GPS";
          return {
            id: p.id,
            lat: p.latitude,
            lng: p.longitude,
            popup:
              `<strong>${esc(p.label || p.address_line || "Personne")}</strong><br/>` +
              `${esc(p.address_line || "—")}<br/>` +
              `<em>${srcLabel}</em><br/>` +
              `${p.latitude.toFixed(5)}, ${p.longitude.toFixed(5)}`,
            radius: 6,
            color: c.color,
            fill: c.fill,
          };
        });
    }
    return milieux
      .filter((m) => Number.isFinite(m.latitude) && Number.isFinite(m.longitude))
      .map((m) => ({
        id: m.milieu,
        lat: m.latitude,
        lng: m.longitude,
        popup:
          `<strong>${esc(m.milieu)}</strong><br/>` +
          `${m.count} personne(s)<br/>` +
          `H: ${m.male} · F: ${m.female}` +
          (m.other ? ` · Autre: ${m.other}` : ""),
        radius: Math.min(28, 8 + Math.sqrt(m.count) * 3),
        color: "#ce1126",
        fill: "#f7d618",
      }));
  }, [mode, points, milieux]);

  useEffect(() => {
    let disposed = false;
    async function render() {
      if (!mapRef.current || markers.length === 0) return;
      try {
        const L = await loadLeaflet();
        if (disposed || !mapRef.current) return;
        if (mapInstance.current) {
          mapInstance.current.remove();
          mapInstance.current = null;
        }
        const map = L.map(mapRef.current).setView([markers[0].lat, markers[0].lng], 12);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 19,
        }).addTo(map);
        const latlngs: [number, number][] = [];
        for (const m of markers) {
          const ll: [number, number] = [m.lat, m.lng];
          latlngs.push(ll);
          L.circleMarker(ll, {
            radius: m.radius,
            color: m.color,
            fillColor: m.fill,
            fillOpacity: 0.75,
            weight: 2,
          })
            .addTo(map)
            .bindPopup(m.popup);
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
  }, [markers, mode]);

  return (
    <div>
      <div className="hero-banner">
        <h1>Cartographie</h1>
        <p>
          Chaque personne recensée apparaît comme un endroit distinct. La vue « Par milieu »
          regroupe les statistiques par zone / adresse.
        </p>
      </div>

      <div className="panel" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          type="button"
          className={mode === "persons" ? "btn-primary" : "btn-secondary"}
          style={{ width: "auto" }}
          onClick={() => setMode("persons")}
        >
          Personnes (1 point = 1 fiche)
        </button>
        <button
          type="button"
          className={mode === "milieu" ? "btn-primary" : "btn-secondary"}
          style={{ width: "auto" }}
          onClick={() => setMode("milieu")}
        >
          Par milieu (stats)
        </button>
        <span className="muted" style={{ alignSelf: "center", marginLeft: 8 }}>
          Adresse :
        </span>
        {(
          [
            ["all", "Toutes"],
            ["gps", "GPS"],
            ["online", "GPS + internet"],
            ["manual", "Saisie manuelle"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={addressFilter === id ? "btn-primary" : "btn-secondary"}
            style={{ width: "auto" }}
            onClick={() => setAddressFilter(id)}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="muted small">
        Légende personnes : bleu = GPS · vert = GPS+internet · jaune/rouge = saisie manuelle.
      </p>

      <div className="grid" style={{ marginTop: 0 }}>
        <div className="metric">
          <div className="label">{mode === "persons" ? "Personnes sur la carte" : "Milieux"}</div>
          <div className="value">{markers.length}</div>
        </div>
        <div className="metric">
          <div className="label">Personnes totales</div>
          <div className="value">{personsTotal}</div>
        </div>
      </div>

      {loading ? <p className="muted">Chargement de la carte…</p> : null}
      {error ? <p className="error">{error}</p> : null}

      {!loading && markers.length === 0 && !error ? (
        <div className="panel">
          <p className="muted" style={{ margin: 0 }}>
            Aucun point GPS. Enregistrez des fiches via l&apos;APK (GPS ménage), puis synchronisez.
          </p>
        </div>
      ) : null}

      {markers.length > 0 ? (
        <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
          <div ref={mapRef} style={{ height: 480, width: "100%" }} />
        </div>
      ) : null}

      {mode === "persons" && points.length > 0 ? (
        <div className="panel">
          <h2>Personnes ({points.length})</h2>
          <table className="data-table">
            <thead>
              <tr>
                <th>Nom</th>
                <th>Adresse / milieu</th>
                <th>Source</th>
                <th>Lat</th>
                <th>Lng</th>
              </tr>
            </thead>
            <tbody>
              {points.slice(0, 100).map((p) => (
                <tr key={p.id}>
                  <td>{p.label || "—"}</td>
                  <td>{p.milieu || p.address_line || "—"}</td>
                  <td>
                    {p.address_source === "manual"
                      ? "Manuelle"
                      : p.address_source === "online"
                        ? "GPS+net"
                        : "GPS"}
                  </td>
                  <td>{p.latitude.toFixed(5)}</td>
                  <td>{p.longitude.toFixed(5)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {mode === "milieu" && milieux.length > 0 ? (
        <div className="panel">
          <h2>Statistiques par milieu</h2>
          <table className="data-table">
            <thead>
              <tr>
                <th>Milieu</th>
                <th>Total</th>
                <th>H</th>
                <th>F</th>
                <th>Autre</th>
              </tr>
            </thead>
            <tbody>
              {milieux.map((m) => (
                <tr key={m.milieu}>
                  <td>{m.milieu}</td>
                  <td>{m.count}</td>
                  <td>{m.male}</td>
                  <td>{m.female}</td>
                  <td>{m.other}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
