import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BarChart, GroupedBarChart, PieChart } from "../components/Charts";
import ExportToolbar from "../components/ExportToolbar";
import {
  DISP_STATUS_LABELS,
  DOC_STATUS_LABELS,
  KIND_LABELS,
  dashboardKpis,
  getInteriorSnapshot,
  monthlyMovementTrends,
} from "../interiorData";

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
  const snap = useMemo(() => getInteriorSnapshot(), [tick]);
  const kpi = useMemo(() => dashboardKpis(), [tick]);
  const trends = useMemo(() => monthlyMovementTrends(), [tick]);

  useEffect(() => {
    if (!live) return;
    const id = window.setInterval(() => setTick((n) => n + 1), 45000);
    return () => window.clearInterval(id);
  }, [live]);

  const kindPie = Object.entries(
    snap.movements.reduce<Record<string, number>>((acc, m) => {
      acc[m.kind] = (acc[m.kind] ?? 0) + 1;
      return acc;
    }, {}),
  ).map(([k, value]) => ({ label: KIND_LABELS[k as keyof typeof KIND_LABELS] ?? k, value }));

  const dispPie = Object.entries(
    snap.displacements.reduce<Record<string, number>>((acc, d) => {
      acc[d.status] = (acc[d.status] ?? 0) + 1;
      return acc;
    }, {}),
  ).map(([k, value]) => ({
    label: DISP_STATUS_LABELS[k as keyof typeof DISP_STATUS_LABELS] ?? k,
    value,
  }));

  const docBar = Object.entries(
    snap.missing_docs.reduce<Record<string, number>>((acc, d) => {
      acc[d.status] = (acc[d.status] ?? 0) + 1;
      return acc;
    }, {}),
  ).map(([k, value]) => ({
    label: DOC_STATUS_LABELS[k as keyof typeof DOC_STATUS_LABELS] ?? k,
    value,
    color: k === "MANQUANT" || k === "REJETE" ? "#8a4b1a" : k === "EN_COURS" ? "#3b6ea5" : "#1a5f4a",
  }));

  const kpiRows = [
    { indicateur: "Citoyens suivis", valeur: kpi.citizens },
    { indicateur: "Mouvements", valeur: kpi.movements },
    { indicateur: "Déplacements", valeur: kpi.displacements },
    { indicateur: "Déplacements en cours", valeur: kpi.displacements_open },
    { indicateur: "Documents ouverts", valeur: kpi.docs_open },
    { indicateur: "Documents priorité haute", valeur: kpi.docs_high },
    { indicateur: "En transit / déplacés", valeur: kpi.en_transit },
    { indicateur: "Mis à jour", valeur: kpi.updated_at },
  ];

  const monthlyRows = trends.months.map((m, i) => ({
    mois: m,
    entrees: trends.entrees[i],
    sorties: trends.sorties[i],
    deplacements: trends.deplacements[i],
    documents: trends.docs[i],
  }));

  return (
    <div className="print-area">
      <div className="eg-page-head">
        <div>
          <h2 className="page-title">Tableau de bord — Intérieur</h2>
          <p className="page-lead">
            Supervision des mouvements, déplacements, documents manquants et parcours citoyens.
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
        filename="interieur_dashboard_kpi"
        title="Indicateurs Ministère de l'Intérieur"
        rows={kpiRows}
        columns={["indicateur", "valeur"]}
        tableName="interieur_kpi"
      />

      <div className="grid">
        <Metric label="Citoyens suivis" value={kpi.citizens} onClick={() => navigate("/parcours")} />
        <Metric label="Mouvements" value={kpi.movements} onClick={() => navigate("/mouvements")} />
        <Metric label="Déplacements" value={kpi.displacements} onClick={() => navigate("/deplacements")} />
        <Metric label="En cours" value={kpi.displacements_open} onClick={() => navigate("/deplacements")} />
        <Metric label="Docs ouverts" value={kpi.docs_open} onClick={() => navigate("/documents-manquants")} />
        <Metric label="Priorité haute" value={kpi.docs_high} onClick={() => navigate("/documents-manquants")} />
        <Metric label="Transit / déplacés" value={kpi.en_transit} onClick={() => navigate("/parcours")} />
      </div>

      <div className="chart-grid" style={{ marginTop: "1rem" }}>
        <PieChart title="Mouvements par type" data={kindPie} donut />
        <PieChart title="Déplacements par statut" data={dispPie} />
        <BarChart title="Documents — statut" data={docBar} />
        <GroupedBarChart
          title="Évolution mensuelle — entrées & sorties"
          categories={trends.months}
          series={[
            { name: "Entrées", color: "#1a5f4a", values: trends.entrees },
            { name: "Sorties", color: "#8a4b1a", values: trends.sorties },
          ]}
        />
      </div>

      <div className="chart-grid" style={{ marginTop: "1rem" }}>
        <GroupedBarChart
          title="Évolution — déplacements & documents"
          categories={trends.months}
          series={[
            { name: "Déplacements", color: "#3b6ea5", values: trends.deplacements },
            { name: "Documents", color: "#6b4c9a", values: trends.docs },
          ]}
        />
      </div>

      <div className="panel" style={{ marginTop: "1rem" }}>
        <h3 className="panel-title">Série mensuelle (export)</h3>
        <ExportToolbar
          filename="interieur_serie_mensuelle"
          title="Série mensuelle Intérieur"
          rows={monthlyRows}
          columns={["mois", "entrees", "sorties", "deplacements", "documents"]}
          tableName="interieur_mensuel"
        />
      </div>

      <p className="muted small" style={{ marginTop: "1rem" }}>
        Dernière consolidation : {new Date(snap.updated_at).toLocaleString("fr-CD")}
        {live ? " · auto-actualisation 45 s" : ""} — lecture Ministère de l&apos;Intérieur.
      </p>
    </div>
  );
}
