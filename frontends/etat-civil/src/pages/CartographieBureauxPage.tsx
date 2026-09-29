/** Cartographie : bureaux EC (principal / secondaire / appui) + structures sanitaires. */

import { useMemo, useState } from "react";
import RdcLeafletMap from "../components/RdcLeafletMap";
import {
  collectMapPoints,
  countByKind,
  countByProvince,
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

export default function CartographieBureauxPage() {
  const [province, setProvince] = useState("");
  const [kind, setKind] = useState("");
  const [selected, setSelected] = useState<MapPoint | null>(null);

  const allPoints = useMemo(() => collectMapPoints(), []);
  const nationalTotals = useMemo(() => countByKind(allPoints), [allPoints]);
  const provinceSummaries = useMemo(() => countByProvince(allPoints), [allPoints]);

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

  const filteredTotals = useMemo(() => countByKind(points), [points]);

  const distances = useMemo(() => {
    if (!province.trim()) return [];
    return distancesInProvince(allPoints, province).slice(0, 40);
  }, [allPoints, province]);

  const zones = useMemo(() => zoneActCounts(points).slice(0, 30), [points]);

  return (
    <div>
      <h2 className="page-title">Cartographie des bureaux</h2>
      <p className="page-lead">
        Carte de la RDC — totaux nationaux et par province des bureaux principal, secondaire et
        d&apos;appui.
      </p>

      <div className="carto-totals">
        <div className="carto-total-card" style={{ borderColor: kindColor("BUREAU_PRINCIPAL") }}>
          <span className="carto-total-dot" style={{ background: kindColor("BUREAU_PRINCIPAL") }} />
          <div>
            <strong>{nationalTotals.principal}</strong>
            <span>Bureau principal</span>
          </div>
        </div>
        <div className="carto-total-card" style={{ borderColor: kindColor("BUREAU_SECONDAIRE") }}>
          <span className="carto-total-dot" style={{ background: kindColor("BUREAU_SECONDAIRE") }} />
          <div>
            <strong>{nationalTotals.secondaire}</strong>
            <span>Bureau secondaire</span>
          </div>
        </div>
        <div className="carto-total-card" style={{ borderColor: kindColor("BUREAU_APPUI") }}>
          <span className="carto-total-dot" style={{ background: kindColor("BUREAU_APPUI") }} />
          <div>
            <strong>{nationalTotals.appui}</strong>
            <span>Bureau d&apos;appui</span>
          </div>
        </div>
        <div className="carto-total-card carto-total-sum">
          <div>
            <strong>{nationalTotals.totalBureaux}</strong>
            <span>Total bureaux EC</span>
          </div>
        </div>
      </div>

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
            <option value="">— Toutes (vue RDC + totaux par province) —</option>
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
          Filtre : {filteredTotals.principal} principal · {filteredTotals.secondaire} secondaire ·{" "}
          {filteredTotals.appui} appui · {filteredTotals.sanitaire} structure(s) sanitaire(s)
        </div>
      </div>

      <div className="carto-layout">
        <div className="carto-map panel" aria-label="Carte RDC">
          <div className="carto-map-stack">
            <RdcLeafletMap
              points={points}
              provinceSummaries={provinceSummaries}
              selectedId={selected?.id}
              onSelect={setSelected}
              onSelectProvince={(p) => {
                setProvince(p);
                setSelected(null);
              }}
              provinceFilter={province}
            />
            <div className="carto-map-overlay">
              <strong>Totaux RDC</strong>
              <ul>
                <li>
                  <i style={{ background: kindColor("BUREAU_PRINCIPAL") }} />
                  Principal <b>{nationalTotals.principal}</b>
                </li>
                <li>
                  <i style={{ background: kindColor("BUREAU_SECONDAIRE") }} />
                  Secondaire <b>{nationalTotals.secondaire}</b>
                </li>
                <li>
                  <i style={{ background: kindColor("BUREAU_APPUI") }} />
                  Appui <b>{nationalTotals.appui}</b>
                </li>
              </ul>
            </div>
          </div>
          <div className="carto-legend">
            {KIND_FILTERS.filter((f) => f.value).map((f) => (
              <span key={f.value} className="carto-legend-item">
                <i style={{ background: kindColor(f.value as MapPoint["kind"]) }} />
                {f.label}
              </span>
            ))}
          </div>
          <p className="muted small" style={{ margin: "0.5rem 0 0" }}>
            Sur la carte nationale : pastilles par province (P / S / A). Cliquez une province pour
            zoomer.
          </p>
        </div>

        <div className="carto-side">
          <div className="panel">
            <h3 className="panel-title">Totaux par province</h3>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Province</th>
                  <th title="Principal">
                    <i className="carto-th-dot" style={{ background: kindColor("BUREAU_PRINCIPAL") }} />
                    P
                  </th>
                  <th title="Secondaire">
                    <i className="carto-th-dot" style={{ background: kindColor("BUREAU_SECONDAIRE") }} />
                    S
                  </th>
                  <th title="Appui">
                    <i className="carto-th-dot" style={{ background: kindColor("BUREAU_APPUI") }} />
                    A
                  </th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {provinceSummaries.map((r) => (
                  <tr
                    key={r.province}
                    className={
                      province && province.toLowerCase() === r.province.toLowerCase()
                        ? "is-active-row"
                        : undefined
                    }
                    style={{ cursor: "pointer" }}
                    onClick={() => setProvince(r.province)}
                  >
                    <td>{r.province}</td>
                    <td>{r.principal}</td>
                    <td>{r.secondaire}</td>
                    <td>{r.appui}</td>
                    <td>
                      <strong>{r.total}</strong>
                    </td>
                  </tr>
                ))}
                {!provinceSummaries.length ? (
                  <tr>
                    <td colSpan={5} className="muted">
                      Aucun bureau EC enregistré.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

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
                    <i
                      className="carto-th-dot"
                      style={{ background: kindColor(p.kind), marginRight: 6 }}
                    />
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
