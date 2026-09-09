import { useMemo, useState } from "react";
import { getMinistryDashboard, listMinistryDeclarations } from "../../santeData";

export default function IndicatorsPage() {
  const [, bump] = useState(0);
  const dash = useMemo(() => getMinistryDashboard(), [bump]);
  const decls = useMemo(() => listMinistryDeclarations(), [bump]);

  const rows = [
    { key: "structures.total", label: "Structures sanitaires (total)", value: dash.facilities_total },
    { key: "structures.active", label: "Structures actives", value: dash.facilities_active },
    { key: "births.declared", label: "Naissances déclarées", value: dash.births },
    { key: "deaths.declared", label: "Décès déclarés", value: dash.deaths },
    { key: "declarations.pending", label: "Déclarations en attente", value: dash.pending },
    { key: "declarations.validated", label: "Déclarations validées", value: dash.validated },
    { key: "declarations.rejected", label: "Déclarations rejetées", value: dash.rejected },
    {
      key: "ratio.births_per_facility",
      label: "Naissances / structure",
      value: dash.facilities_total ? Number((dash.births / dash.facilities_total).toFixed(2)) : 0,
    },
    {
      key: "ratio.deaths_per_facility",
      label: "Décès / structure",
      value: dash.facilities_total ? Number((dash.deaths / dash.facilities_total).toFixed(2)) : 0,
    },
  ];

  const birthM = decls.filter((d) => d.declaration_type === "BIRTH" && String(d.sexe ?? "M").toUpperCase() !== "F").length;
  const birthF = decls.filter((d) => d.declaration_type === "BIRTH" && String(d.sexe ?? "").toUpperCase() === "F").length;

  return (
    <div>
      <div className="eg-page-head">
        <div>
          <h2 className="page-title">Indicateurs santé</h2>
          <p className="page-lead">Indicateurs dynamiques calculés sur les données du système (structures + déclarations).</p>
        </div>
        <button type="button" className="btn-secondary btn-sm" onClick={() => bump((n) => n + 1)}>
          Actualiser
        </button>
      </div>

      <div className="grid" style={{ marginBottom: "1rem" }}>
        <div className="metric">
          <div className="label">Naissances G</div>
          <div className="value">{birthM}</div>
        </div>
        <div className="metric">
          <div className="label">Naissances F</div>
          <div className="value">{birthF}</div>
        </div>
        <div className="metric">
          <div className="label">Taux validation</div>
          <div className="value">
            {decls.length ? Math.round((dash.validated / decls.length) * 100) : 0}%
          </div>
        </div>
      </div>

      <div className="panel">
        <table className="data-table">
          <thead>
            <tr>
              <th>Indicateur</th>
              <th>Clé</th>
              <th>Valeur</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key}>
                <td>{r.label}</td>
                <td>
                  <code>{r.key}</code>
                </td>
                <td>{Number(r.value).toLocaleString("fr-FR")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="panel" style={{ marginTop: "1rem" }}>
        <h3 className="panel-title">Par province</h3>
        <table className="data-table">
          <thead>
            <tr>
              <th>Province</th>
              <th>Structures</th>
              <th>Naissances</th>
              <th>Décès</th>
            </tr>
          </thead>
          <tbody>
            {dash.by_province.map((p) => (
              <tr key={p.province}>
                <td>{p.province}</td>
                <td>{p.facilities}</td>
                <td>{p.births}</td>
                <td>{p.deaths}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
