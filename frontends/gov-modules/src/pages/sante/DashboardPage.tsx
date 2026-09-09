import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BarChart, GroupedBarChart, HorizontalBarChart, PieChart } from "../../components/Charts";
import { FACILITY_TYPE_LABELS, getMinistryDashboard, listMinistryDeclarations } from "../../santeData";

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
  const [tick, setTick] = useState(0);
  const dash = useMemo(() => getMinistryDashboard(), [tick]);
  const decls = useMemo(() => listMinistryDeclarations(), [tick]);

  const typePie = Object.entries(dash.by_type).map(([type, value]) => ({
    label: FACILITY_TYPE_LABELS[type] ?? type,
    value,
  }));

  const statusPie = [
    { label: "En attente", value: dash.pending, color: "#c9a227" },
    { label: "Validés", value: dash.validated, color: "#1a5f4a" },
    { label: "Rejetés", value: dash.rejected, color: "#b03a3a" },
  ];

  const eventsBar = [
    { label: "Naissances", value: dash.births, color: "#2d7a5f" },
    { label: "Décès", value: dash.deaths, color: "#8a4b1a" },
    { label: "Structures", value: dash.facilities_total, color: "#3b6ea5" },
  ];

  const birthSex = [
    {
      label: "Garçons",
      value: decls.filter((d) => d.declaration_type === "BIRTH" && String(d.sexe ?? "M").toUpperCase() !== "F").length,
      color: "#3b6ea5",
    },
    {
      label: "Filles",
      value: decls.filter((d) => d.declaration_type === "BIRTH" && String(d.sexe ?? "").toUpperCase() === "F").length,
      color: "#c45d8a",
    },
  ];

  const provinces = dash.by_province.slice(0, 8);
  const facilityBars = Object.entries(dash.by_type).map(([type, value]) => ({
    label: FACILITY_TYPE_LABELS[type] ?? type,
    value,
  }));

  return (
    <div>
      <div className="eg-page-head">
        <div>
          <h2 className="page-title">Tableau de bord — Santé</h2>
          <p className="page-lead">
            Vue nationale dynamique avec indicateurs et graphiques (histogrammes, camemberts, barres).
          </p>
        </div>
        <button type="button" className="btn-secondary btn-sm" onClick={() => setTick((n) => n + 1)}>
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

      <div className="chart-grid" style={{ marginTop: "1rem" }}>
        <PieChart title="Répartition des structures (camembert)" data={typePie} />
        <PieChart title="Statut des déclarations (donut)" data={statusPie} donut />
        <BarChart title="Histogramme — activité nationale" data={eventsBar} />
        <PieChart title="Naissances par sexe" data={birthSex} />
      </div>

      <div className="chart-grid" style={{ marginTop: "1rem" }}>
        <GroupedBarChart
          title="Histogramme groupé — naissances & décès par province"
          categories={provinces.map((p) => p.province)}
          series={[
            { name: "Naissances", color: "#1a5f4a", values: provinces.map((p) => p.births) },
            { name: "Décès", color: "#8a4b1a", values: provinces.map((p) => p.deaths) },
          ]}
        />
        <HorizontalBarChart title="Structures par type (barres horizontales)" data={facilityBars} />
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
