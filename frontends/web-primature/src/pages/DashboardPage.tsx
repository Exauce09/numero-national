import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BarChart, GroupedBarChart, PieChart } from "../components/Charts";
import ExportToolbar from "../components/ExportToolbar";
import { fetchGovOverview, metricValue } from "../govApi";
import {
  STATUS_LABELS,
  dashboardKpis,
  getPrimatureSnapshot,
  monthlyCoordinationTrends,
} from "../primatureData";

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
  const [live, setLive] = useState(true);
  const [apiPop, setApiPop] = useState(0);
  const [apiCivil, setApiCivil] = useState(0);
  const [apiHealth, setApiHealth] = useState(0);
  const [apiCards, setApiCards] = useState(0);
  const [apiSource, setApiSource] = useState("…");
  const snap = useMemo(() => getPrimatureSnapshot(), [tick]);
  const kpi = useMemo(() => dashboardKpis(), [tick]);
  const trends = useMemo(() => monthlyCoordinationTrends(), [tick]);

  useEffect(() => {
    void fetchGovOverview("primature").then((g) => {
      setApiPop(metricValue(g.metrics, "population.total"));
      setApiCivil(metricValue(g.metrics, "civil.acts.total"));
      setApiHealth(metricValue(g.metrics, "health.birth_notifications"));
      setApiCards(metricValue(g.metrics, "cards.active"));
      setApiSource(g.source);
    });
  }, [tick]);

  useEffect(() => {
    if (!live) return;
    const id = window.setInterval(() => setTick((n) => n + 1), 45000);
    return () => window.clearInterval(id);
  }, [live]);

  const population = apiPop || kpi.population;
  const civilActs = apiCivil || kpi.civil_acts;
  const health = apiHealth || kpi.health;
  const cards = apiCards || kpi.cards;

  const statusPie = Object.entries(
    snap.ministries.reduce<Record<string, number>>((acc, m) => {
      acc[m.status] = (acc[m.status] ?? 0) + 1;
      return acc;
    }, {}),
  ).map(([k, value]) => ({
    label: STATUS_LABELS[k as keyof typeof STATUS_LABELS] ?? k,
    value,
    color: k === "OK" ? "#1a5f4a" : k === "ATTENTION" ? "#8a4b1a" : k === "CRITIQUE" ? "#9b2c2c" : "#5a6b63",
  }));

  const domainBar = snap.indicators.slice(0, 6).map((i) => ({
    label: i.label.split(" ")[0],
    value: i.domain === "ONIP" || i.key.includes("population") || i.key.includes("cards") ? Math.round(i.value / 1000) : i.value,
    color: "#3b6ea5",
  }));

  const kpiRows = [
    { indicateur: "Population consolidée", valeur: population },
    { indicateur: "Actes état civil", valeur: civilActs },
    { indicateur: "Déclarations santé", valeur: health },
    { indicateur: "Mouvements intérieur", valeur: kpi.movements },
    { indicateur: "Cartes actives", valeur: cards },
    { indicateur: "Ministères nominaux", valeur: kpi.ministries_ok },
    { indicateur: "Ministères en attention", valeur: kpi.ministries_attention },
    { indicateur: "Alertes ouvertes", valeur: kpi.alerts_open },
    { indicateur: "Dossiers ouverts", valeur: kpi.dossiers_open },
    { indicateur: "Source API", valeur: apiSource },
    { indicateur: "Mis à jour", valeur: kpi.updated_at },
  ];

  return (
    <div className="print-area">
      <div className="eg-page-head">
        <div>
          <h2 className="page-title">Tableau de bord — Primature</h2>
          <p className="page-lead">
            Agrégats PostgreSQL uniquement (pas de simulation). Source : {apiSource}.
          </p>
        </div>
        <div className="page-actions no-print">
          <label className="live-toggle">
            <input type="checkbox" checked={live} onChange={(e) => setLive(e.target.checked)} />
            Auto-actualiser
          </label>
          <button type="button" className="btn-secondary btn-sm" onClick={() => setTick((n) => n + 1)}>
            Actualiser
          </button>
        </div>
      </div>

      <div className="read-only-banner no-print">
        Accès <strong>lecture seule</strong> — la Primature consulte les informations qui lui sont destinées dans le système général.
      </div>

      <ExportToolbar
        filename="primature_dashboard_kpi"
        title="Indicateurs Primature"
        rows={kpiRows}
        columns={["indicateur", "valeur"]}
        tableName="primature_kpi"
      />

      <div className="grid">
        <Metric label="Population" value={population.toLocaleString("fr-FR")} onClick={() => navigate("/indicateurs")} />
        <Metric label="Actes civil" value={civilActs.toLocaleString("fr-FR")} onClick={() => navigate("/indicateurs")} />
        <Metric label="Santé" value={health} onClick={() => navigate("/ministeres")} />
        <Metric label="Mouvements" value={kpi.movements} onClick={() => navigate("/ministeres")} />
        <Metric label="Cartes actives" value={cards.toLocaleString("fr-FR")} onClick={() => navigate("/indicateurs")} />
        <Metric label="Alertes ouvertes" value={kpi.alerts_open} onClick={() => navigate("/alertes")} />
        <Metric label="Dossiers ouverts" value={kpi.dossiers_open} onClick={() => navigate("/dossiers")} />
        <Metric label="Attention ministères" value={kpi.ministries_attention} onClick={() => navigate("/ministeres")} />
      </div>

      <div className="chart-grid" style={{ marginTop: "1rem" }}>
        <PieChart title="État des domaines / ministères" data={statusPie} donut />
        <BarChart title="Indicateurs clés (échelle adaptée)" data={domainBar} />
        <GroupedBarChart
          title="Tendance mensuelle — civil & santé"
          categories={trends.months}
          series={[
            { name: "État civil", color: "#1a5f4a", values: trends.civil },
            { name: "Santé", color: "#3b6ea5", values: trends.sante },
          ]}
        />
        <GroupedBarChart
          title="Tendance — intérieur & alertes"
          categories={trends.months}
          series={[
            { name: "Intérieur", color: "#8a4b1a", values: trends.interieur },
            { name: "Alertes", color: "#9b2c2c", values: trends.alertes },
          ]}
        />
      </div>

      <p className="muted small" style={{ marginTop: "1rem" }}>
        Dernière consolidation : {new Date(snap.updated_at).toLocaleString("fr-CD")}
        {live ? " · auto-actualisation 45 s" : ""} — Primature · lecture seule.
      </p>
    </div>
  );
}
