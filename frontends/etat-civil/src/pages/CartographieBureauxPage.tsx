/** Cartographie : bureaux EC (principal / secondaire / appui) + structures sanitaires. */

import { useMemo, useState } from "react";
import {
  collectMapPoints,
  distancesInProvince,
  kindColor,
  zoneActCounts,
  type MapPoint,
} from "../bureauCartographie";

const KIND_FILTERS = [
  { value: "", label: "Tous" },
  { value: "BUREAU_PRINCIPAL", label: "Bureau principal" },
  { value: "BUREAU_SECONDAIRE", label: "Bureau secondaire" },
  { value: "BUREAU_APPUI", label: "Bureau d'appui" },
  { value: "STRUCTURE_SANITAIRE", label: "Structure sanitaire" },
] as const;

/** Projection simple lon/lat → % dans une bbox RDC. */
function project(lat: number, lng: number): { left: string; top: string } {
  const west = 12.0;
  const east = 31.5;
  const south = -13.5;
  const north = 5.5;
  const x = ((lng - west) / (east - west)) * 100;
  const y = ((north - lat) / (north - south)) * 100;
  return {
    left: `${Math.min(98, Math.max(2, x))}%`,
    top: `${Math.min(98, Math.max(2, y))}%`,
  };
}

export default function CartographieBureauxPage() {
  const [province, setProvince] = useState("");
  const [kind, setKind] = useState("");
  const [selected, setSelected] = useState<MapPoint | null>(null);

  const allPoints = useMemo(() => collectMapPoints(), []);
  const provinces = useMemo(
    () =>
      [...new Set(allPoints.map((p) => p.province).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b),
      ),
    [allPoints],
  );

  const points = useMemo(() => {
    return allPoints.filter((p) => {
      if (province && !p.province.toLowerCase().includes(province.toLowerCase())) return false;
      if (kind && p.kind !== kind) return false;
      return true;
    });
  }, [allPoints, province, kind]);

  const distances = useMemo(() => {
    if (!province.trim()) return [];
    return distancesInProvince(allPoints, province).slice(0, 40);
  }, [allPoints, province]);

  const zones = useMemo(() => zoneActCounts(points).slice(0, 30), [points]);

  return (
    <div>
      <h2 className="page-title">Cartographie des bureaux</h2>
      <p className="page-lead">
        Bureau principal, Bureau secondaire, Bureau d&apos;appui et structures sanitaires —
        distances entre bureaux d&apos;état civil dans une province, et nombre de faits enregistrés
        par zone.
      </p>

      <div className="panel form-grid" style={{ marginBottom: "1rem" }}>
        <div>
          <label className="form-label">Province</label>
          <select
            className="form-control"
            value={province}
            onChange={(e) => {
              setProvince(e.target.value);
              setSelected(null);
            }}
          >
            <option value="">— Toutes —</option>
            {provinces.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="form-label">Type</label>
          <select
            className="form-control"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
          >
            {KIND_FILTERS.map((f) => (
              <option key={f.value || "all"} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
        <div className="full muted small">
          {points.length} point(s) affiché(s) ·{" "}
          {points.reduce((s, p) => s + p.actCount, 0)} fait(s) d&apos;état civil liés
        </div>
      </div>

      <div className="carto-layout">
        <div className="carto-map panel" aria-label="Carte RDC">
          <div className="carto-map-inner">
            <div className="carto-map-bg" />
            {points.map((p) => {
              const pos = project(p.lat, p.lng);
              return (
                <button
                  key={p.id}
                  type="button"
                  className={`carto-marker${selected?.id === p.id ? " is-selected" : ""}`}
                  style={{
                    left: pos.left,
                    top: pos.top,
                    background: kindColor(p.kind),
                  }}
                  title={`${p.name} — ${p.kindLabel} — ${p.actCount} fait(s)`}
                  onClick={() => setSelected(p)}
                >
                  <span>{p.actCount}</span>
                </button>
              );
            })}
          </div>
          <div className="carto-legend">
            {KIND_FILTERS.filter((f) => f.value).map((f) => (
              <span key={f.value}>
                <i style={{ background: kindColor(f.value as MapPoint["kind"]) }} />
                {f.label}
              </span>
            ))}
          </div>
        </div>

        <div className="carto-side">
          <div className="panel">
            <h3 className="panel-title">Points</h3>
            <div className="carto-list">
              {points.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`carto-list-item${selected?.id === p.id ? " is-selected" : ""}`}
                  onClick={() => setSelected(p)}
                >
                  <strong>{p.name}</strong>
                  <span className="muted small">
                    {p.kindLabel} · {[p.commune, p.ville, p.province].filter(Boolean).join(" · ")}
                  </span>
                  <span className="carto-badge">{p.actCount} fait(s)</span>
                </button>
              ))}
              {!points.length ? (
                <p className="muted">
                  Aucun point — créez des comptes préposé/officier (type de bureau) ou des structures
                  sanitaires.
                </p>
              ) : null}
            </div>
          </div>

          {selected ? (
            <div className="panel">
              <h3 className="panel-title">Sélection</h3>
              <p>
                <strong>{selected.name}</strong>
              </p>
              <p className="muted small" style={{ marginTop: 0 }}>
                {selected.kindLabel}
                <br />
                {[selected.commune, selected.ville, selected.province].filter(Boolean).join(" · ")}
                <br />
                {selected.actCount} fait(s) d&apos;état civil enregistré(s) dans cette zone
              </p>
            </div>
          ) : null}
        </div>
      </div>

      <div className="panel" style={{ marginTop: "1rem" }}>
        <h3 className="panel-title">Faits d&apos;état civil par zone</h3>
        <table className="data-table">
          <thead>
            <tr>
              <th>Zone</th>
              <th>Type</th>
              <th>Faits enregistrés</th>
            </tr>
          </thead>
          <tbody>
            {zones.map((z) => (
              <tr key={`${z.kind}-${z.zone}`}>
                <td>{z.zone}</td>
                <td>{z.kind}</td>
                <td>{z.count}</td>
              </tr>
            ))}
            {!zones.length ? (
              <tr>
                <td colSpan={3} className="muted">
                  Aucun agrégat pour le filtre courant.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="panel" style={{ marginTop: "1rem" }}>
        <h3 className="panel-title">Distances entre bureaux (province)</h3>
        {!province.trim() ? (
          <p className="muted">Sélectionnez une province pour calculer les distances.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>De</th>
                <th>À</th>
                <th>Distance (km)</th>
              </tr>
            </thead>
            <tbody>
              {distances.map((d) => (
                <tr key={`${d.from}-${d.to}`}>
                  <td>{d.from}</td>
                  <td>{d.to}</td>
                  <td>{d.km}</td>
                </tr>
              ))}
              {!distances.length ? (
                <tr>
                  <td colSpan={3} className="muted">
                    Moins de deux bureaux d&apos;état civil dans cette province.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
