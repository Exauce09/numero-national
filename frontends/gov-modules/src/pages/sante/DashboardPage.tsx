import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FACILITY_TYPE_LABELS, getMinistryDashboard } from "../../santeData";

function Metric({
  label,
  value,
  onClick,
}: {
  label: string;
  value: string | number;
  onClick?: () => void;
}) {
  return (
    <button type="button" className="metric metric-btn" onClick={onClick} disabled={!onClick}>
      <div className="label">{label}</div>
      <div className="value">{value}</div>
    </button>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const [, bump] = useState(0);
  const dash = useMemo(() => getMinistryDashboard(), [bump]);

  return (
    <div>
      <div className="eg-page-head">
        <div>
          <h2 className="page-title">Tableau de bord — Santé</h2>
          <p className="page-lead">
            Vue nationale dynamique : structures sanitaires du système, naissances et décès déclarés.
          </p>
        </div>
        <button type="button" className="btn-secondary btn-sm" onClick={() => bump((n) => n + 1)}>
          Actualiser
        </button>
      </div>

      <div className="grid">
        <Metric
          label="Structures sanitaires"
          value={dash.facilities_total.toLocaleString("fr-FR")}
          onClick={() => navigate("/sante/structures")}
        />
        <Metric
          label="Structures actives"
          value={dash.facilities_active.toLocaleString("fr-FR")}
          onClick={() => navigate("/sante/structures")}
        />
        <Metric
          label="Naissances déclarées"
          value={dash.births.toLocaleString("fr-FR")}
          onClick={() => navigate("/sante/synoptique/naissances")}
        />
        <Metric
          label="Décès déclarés"
          value={dash.deaths.toLocaleString("fr-FR")}
          onClick={() => navigate("/sante/synoptique/deces")}
        />
        <Metric
          label="En attente état civil"
          value={dash.pending.toLocaleString("fr-FR")}
          onClick={() => navigate("/sante/declarations")}
        />
        <Metric
          label="Validés"
          value={dash.validated.toLocaleString("fr-FR")}
          onClick={() => navigate("/sante/declarations")}
        />
      </div>

      <div className="panel" style={{ marginTop: "1rem" }}>
        <h3 className="panel-title">Répartition par type de structure</h3>
        <table className="data-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Nombre</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(dash.by_type).map(([type, n]) => (
              <tr key={type}>
                <td>{FACILITY_TYPE_LABELS[type] ?? type}</td>
                <td>{n}</td>
              </tr>
            ))}
            {!Object.keys(dash.by_type).length ? (
              <tr>
                <td colSpan={2} className="muted">
                  Aucune structure.
                </td>
              </tr>
            ) : null}
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
            {dash.by_province.map((r) => (
              <tr key={r.province}>
                <td>{r.province}</td>
                <td>{r.facilities}</td>
                <td>{r.births}</td>
                <td>{r.deaths}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="panel" style={{ marginTop: "1rem" }}>
        <div className="panel-head">
          <h3 className="panel-title" style={{ margin: 0 }}>
            Dernières déclarations
          </h3>
          <button type="button" className="btn-secondary btn-sm" onClick={() => navigate("/sante/declarations")}>
            Tout voir
          </button>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Structure</th>
              <th>Résumé</th>
              <th>Statut</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {dash.recent.map((d) => (
              <tr key={d.id}>
                <td>{d.declaration_type === "BIRTH" ? "Naissance" : "Décès"}</td>
                <td>{d.facility_name}</td>
                <td>{d.summary}</td>
                <td>{d.status}</td>
                <td>{new Date(d.created_at).toLocaleString("fr-FR")}</td>
              </tr>
            ))}
            {!dash.recent.length ? (
              <tr>
                <td colSpan={5} className="muted">
                  Aucune déclaration — les structures sanitaires alimentent cette file.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
