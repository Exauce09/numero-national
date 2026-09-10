import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BarChart, GroupedBarChart, HorizontalBarChart, PieChart } from "../components/Charts";
import ExportToolbar from "../components/ExportToolbar";
import { fetchGovOverview, metricValue } from "../govApi";
import {
  TYPE_LABELS,
  dashboardKpiRows,
  getNationalSnapshot,
  monthlyTrends,
} from "../nationalData";

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
  const [apiBirths, setApiBirths] = useState(0);
  const [apiDeaths, setApiDeaths] = useState(0);
  const [apiCards, setApiCards] = useState(0);
  const [apiSource, setApiSource] = useState("…");
  const snap = useMemo(() => getNationalSnapshot(), [tick]);
  const trends = useMemo(() => monthlyTrends(), [tick]);

  useEffect(() => {
    void fetchGovOverview("presidency").then((g) => {
      setApiPop(metricValue(g.metrics, "population.total"));
      setApiBirths(metricValue(g.metrics, "civil.births"));
      setApiDeaths(metricValue(g.metrics, "civil.deaths"));
      setApiCards(metricValue(g.metrics, "cards.active"));
      setApiSource(g.source);
    });
  }, [tick]);

  useEffect(() => {
    if (!live) return;
    const id = window.setInterval(() => setTick((n) => n + 1), 45000);
    return () => window.clearInterval(id);
  }, [live]);

  const population = apiPop || snap.population_total;
  const births = apiBirths || snap.births;
  const deaths = apiDeaths || snap.deaths;

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
    { label: "Naissances", value: births, color: "#1a5f4a" },
    { label: "Décès", value: deaths, color: "#8a4b1a" },
    { label: "Mariages", value: snap.marriages, color: "#3b6ea5" },
    { label: "Divorces", value: snap.divorces, color: "#6b4c9a" },
  ];

  const provinces = snap.population_by_province.slice(0, 8);

  const monthlyRows = trends.months.map((m, i) => ({
    mois: m,
    naissances: trends.births[i],
    deces: trends.deaths[i],
    mariages: trends.marriages[i],
    divorces: trends.divorces[i],
  }));

  const provinceRows = snap.population_by_province.map((p) => ({
    province: p.province,
    total: p.total,
    hommes: p.m,
    femmes: p.f,
  }));

  return (
    <div className="print-area">
      <div className="eg-page-head">
        <div>
          <h2 className="page-title">Tableau de bord — Présidence</h2>
          <p className="page-lead">
            Données enregistrées uniquement (PostgreSQL + actes saisis). Source API : {apiSource}.
            Cartes actives : {apiCards.toLocaleString("fr-FR")}.
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

      <ExportToolbar
        filename="presidence_dashboard_kpi"
        title="Indicateurs nationaux — Présidence"
        rows={dashboardKpiRows()}
        columns={["indicateur", "valeur"]}
        tableName="presidence_kpi"
      />

      <div className="grid">
        <Metric label="Population" value={population.toLocaleString("fr-FR")} onClick={() => navigate("/population")} />
        <Metric label="États civils" value={snap.civil_offices.length} onClick={() => navigate("/etat-civil")} />
        <Metric label="Structures sanitaires" value={snap.health_facilities.length} onClick={() => navigate("/structures")} />
        <Metric label="Naissances" value={births.toLocaleString("fr-FR")} onClick={() => navigate("/naissances")} />
        <Metric label="Décès" value={deaths.toLocaleString("fr-FR")} onClick={() => navigate("/deces")} />
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
          title="Évolution mensuelle — naissances & décès"
          categories={trends.months}
          series={[
            { name: "Naissances", color: "#1a5f4a", values: trends.births },
            { name: "Décès", color: "#8a4b1a", values: trends.deaths },
          ]}
        />
        <GroupedBarChart
          title="Évolution mensuelle — mariages & divorces"
          categories={trends.months}
          series={[
            { name: "Mariages", color: "#3b6ea5", values: trends.marriages },
            { name: "Divorces", color: "#6b4c9a", values: trends.divorces },
          ]}
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

      <div className="panel" style={{ marginTop: "1rem" }}>
        <h3 className="panel-title">Série mensuelle (export)</h3>
        <ExportToolbar
          filename="presidence_serie_mensuelle"
          title="Série mensuelle nationale"
          rows={monthlyRows}
          columns={["mois", "naissances", "deces", "mariages", "divorces"]}
          tableName="presidence_mensuel"
        />
        <ExportToolbar
          filename="presidence_population_provinces"
          title="Population par province"
          rows={provinceRows}
          columns={["province", "total", "hommes", "femmes"]}
          tableName="presidence_pop_province"
        />
      </div>

      <p className="muted small" style={{ marginTop: "1rem" }}>
        Dernière consolidation : {new Date(snap.updated_at).toLocaleString("fr-CD")}
        {live ? " · auto-actualisation 45 s" : ""} — accès lecture Présidence uniquement.
      </p>
    </div>
  );
}
