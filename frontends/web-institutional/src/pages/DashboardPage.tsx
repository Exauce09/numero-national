import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BarChart, GroupedBarChart, HorizontalBarChart, PieChart } from "../components/Charts";
import { TYPE_LABELS, getNationalSnapshot } from "../nationalData";

function Metric({ label, value, onClick }: { label: string; value: string | number; onClick?: () => void }) {
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
  const snap = useMemo(() => getNationalSnapshot(), [tick]);

  const typePie = Object.entries(
    snap.health_facilities.reduce<Record<string, number>>((acc, f) => {
      acc[f.type] = (acc[f.type] ?? 0) + 1;
      return acc;
    }, {}),
  ).map(([type, value]) => ({ label: TYPE_LABELS[type] ?? type, value }));

  const sexPie = [
    { label: "Masculin", value: snap.population_m, color: "#3b6ea5" },
    { label: "Féminin", value: snap.population_f, color: "#c45d8a" },
  ];

  const eventsBar = [
    { label: "Naissances", value: snap.births, color: "#1a5f4a" },
    { label: "Décès", value: snap.deaths, color: "#8a4b1a" },
    { label: "Mariages", value: snap.marriages, color: "#3b6ea5" },
    { label: "Divorces", value: snap.divorces, color: "#6b4c9a" },
  ];

  const provinces = snap.population_by_province.slice(0, 8);

  return (
    <div>
      <div className="eg-page-head">
        <div>
          <h2 className="page-title">Tableau de bord — Présidence</h2>
          <p className="page-lead">
            Lecture nationale du système : population, état civil, structures sanitaires et actes.
          </p>
        </div>
        <button type="button" className="btn-secondary btn-sm" onClick={() => setTick((n) => n + 1)}>
          Actualiser
        </button>
      </div>

      <div className="grid">
        <Metric label="Population" value={snap.population_total.toLocaleString("fr-FR")} onClick={() => navigate("/population")} />
        <Metric label="États civils" value={snap.civil_offices.length} onClick={() => navigate("/etat-civil")} />
        <Metric label="Structures sanitaires" value={snap.health_facilities.length} onClick={() => navigate("/structures")} />
        <Metric label="Naissances" value={snap.births.toLocaleString("fr-FR")} onClick={() => navigate("/naissances")} />
        <Metric label="Décès" value={snap.deaths.toLocaleString("fr-FR")} onClick={() => navigate("/deces")} />
        <Metric label="Mariages" value={snap.marriages.toLocaleString("fr-FR")} onClick={() => navigate("/mariages")} />
        <Metric label="Divorces" value={snap.divorces.toLocaleString("fr-FR")} onClick={() => navigate("/divorces")} />
        <Metric label="Documents" value={snap.documents.toLocaleString("fr-FR")} />
      </div>

      <div className="chart-grid" style={{ marginTop: "1rem" }}>
        <PieChart title="Population par sexe (camembert)" data={sexPie} donut />
        <PieChart title="Structures sanitaires par type" data={typePie} />
        <BarChart title="Histogramme — actes d'état civil" data={eventsBar} />
        <HorizontalBarChart
          title="Population par province"
          data={provinces.map((p) => ({ label: p.province, value: p.total }))}
        />
      </div>

      <div className="chart-grid" style={{ marginTop: "1rem" }}>
        <GroupedBarChart
          title="Histogramme groupé — population H/F par province"
          categories={provinces.map((p) => p.province)}
          series={[
            { name: "Hommes", color: "#3b6ea5", values: provinces.map((p) => p.m) },
            { name: "Femmes", color: "#c45d8a", values: provinces.map((p) => p.f) },
          ]}
        />
        <GroupedBarChart
          title="Structures — naissances & décès déclarés"
          categories={snap.health_facilities.slice(0, 6).map((f) => f.name.split("—")[0].trim())}
          series={[
            { name: "Naissances", color: "#1a5f4a", values: snap.health_facilities.slice(0, 6).map((f) => f.births) },
            { name: "Décès", color: "#8a4b1a", values: snap.health_facilities.slice(0, 6).map((f) => f.deaths) },
          ]}
        />
      </div>

      <p className="muted small" style={{ marginTop: "1rem" }}>
        Dernière consolidation : {new Date(snap.updated_at).toLocaleString("fr-CD")} — accès lecture Présidence
        uniquement.
      </p>
    </div>
  );
}
