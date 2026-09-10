import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api";
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
  const [apiBirths, setApiBirths] = useState<number | null>(null);
  const [apiDeaths, setApiDeaths] = useState<number | null>(null);
  const [apiFacilities, setApiFacilities] = useState<number | null>(null);
  const [source, setSource] = useState("local");

  const dashLocal = useMemo(() => getMinistryDashboard(), [tick]);
  const decls = useMemo(() => listMinistryDeclarations(), [tick]);

  useEffect(() => {
    void (async () => {
      const [stats, facilities] = await Promise.all([api.healthStats(), api.healthFacilities()]);
      const births = Number(
        stats.birth_notifications ?? stats.births_declared ?? 0,
      );
      const deaths = Number(
        stats.death_notifications ?? stats.deaths_declared ?? 0,
      );
      const fac =
        Number(stats.facilities_count ?? stats.facilities ?? 0) || facilities.length;
      setApiBirths(births);
      setApiDeaths(deaths);
      setApiFacilities(fac);
      setSource(fac + births + deaths > 0 || facilities.length > 0 ? "postgresql" : dashLocal.source);
    })();
  }, [tick, dashLocal.source]);

  const births = apiBirths ?? dashLocal.births;
  const deaths = apiDeaths ?? dashLocal.deaths;
  const facilitiesTotal = apiFacilities ?? dashLocal.facilities_total;

  const typePie = Object.entries(dashLocal.by_type).map(([type, value]) => ({
    label: FACILITY_TYPE_LABELS[type] ?? type,
    value,
  }));

  const statusPie = [
    { label: "En attente", value: dashLocal.pending, color: "#c9a227" },
    { label: "Validés", value: dashLocal.validated, color: "#1a5f4a" },
    { label: "Rejetés", value: dashLocal.rejected, color: "#b03a3a" },
  ];

  const eventsBar = [
    { label: "Naissances", value: births, color: "#2d7a5f" },
    { label: "Décès", value: deaths, color: "#8a4b1a" },
    { label: "Structures", value: facilitiesTotal, color: "#3b6ea5" },
  ];

  const birthSex = [
    {
      label: "Garçons",
      value: decls.filter(
        (d) => d.declaration_type === "BIRTH" && String(d.sexe ?? "M").toUpperCase() !== "F",
      ).length,
      color: "#3b6ea5",
    },
    {
      label: "Filles",
      value: decls.filter(
        (d) => d.declaration_type === "BIRTH" && String(d.sexe ?? "").toUpperCase() === "F",
      ).length,
      color: "#c45d8a",
    },
  ];

  const provinces = dashLocal.by_province.slice(0, 8);
  const facilityBars = Object.entries(dashLocal.by_type).map(([type, value]) => ({
    label: FACILITY_TYPE_LABELS[type] ?? type,
    value,
  }));

  return (
    <div>
      <div className="eg-page-head">
        <div>
          <h2 className="page-title">Tableau de bord — Santé</h2>
          <p className="page-lead">
            Indicateurs issus des enregistrements réels (API PostgreSQL + déclarations saisies). Source :{" "}
            {source}.
          </p>
        </div>
        <button type="button" className="btn-secondary btn-sm" onClick={() => setTick((n) => n + 1)}>
          Actualiser
        </button>
      </div>

      <div className="grid">
        <Metric label="Structures" value={facilitiesTotal} onClick={() => navigate("/sante/structures")} />
        <Metric label="Naissances" value={births} onClick={() => navigate("/sante/declarations")} />
        <Metric label="Décès" value={deaths} onClick={() => navigate("/sante/declarations")} />
        <Metric label="En attente" value={dashLocal.pending} onClick={() => navigate("/sante/declarations")} />
      </div>

      <div className="charts-grid" style={{ marginTop: "1.25rem" }}>
        <PieChart title="Types de structures (enregistrées)" data={typePie} />
        <PieChart title="Statut déclarations" data={statusPie} />
        <BarChart title="Événements" data={eventsBar} />
        <BarChart title="Naissances par sexe (déclarations)" data={birthSex} />
        <HorizontalBarChart
          title="Par province"
          data={provinces.map((p) => ({ label: p.province, value: p.births + p.deaths }))}
        />
        <GroupedBarChart
          title="Structures par type"
          series={[{ name: "Structures", color: "#3b6ea5", values: facilityBars.map((f) => f.value) }]}
          labels={facilityBars.map((f) => f.label)}
        />
      </div>
    </div>
  );
}
