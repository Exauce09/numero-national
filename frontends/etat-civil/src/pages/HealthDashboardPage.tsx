import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { BarChart, LineChart, PieChart } from "../components/Charts";
import { countByMonth, lastNMonths, StatCard } from "../components/DashKpi";
import { IconBaby, IconCross } from "../components/Icons";
import { listFacilityDeclarations } from "../civilDeclarations";
import { getHealthSession, HEALTH_ROLE_TITLE } from "../healthAuth";
import { RDC } from "../rdcColors";

/** Tableau de bord infirmier titulaire — même présentation que l'État civil national (naissance et décès). */
export default function HealthDashboardPage() {
  const navigate = useNavigate();
  const session = getHealthSession()!;
  const rows = listFacilityDeclarations(session.facilityId);

  const birthAll = rows.filter((d) => d.declaration_type === "BIRTH");
  const deathAll = rows.filter((d) => d.declaration_type === "DEATH");
  const validatedOf = (list: typeof rows) => list.filter((d) => d.status === "VALIDATED");
  const pendingOf = (list: typeof rows) => list.filter((d) => d.status === "PENDING_OFFICER");

  const births = validatedOf(birthAll);
  const deaths = validatedOf(deathAll);
  const pending = pendingOf(rows).length;
  const validated = validatedOf(rows).length;
  const rejected = rows.filter((d) => d.status === "REJECTED").length;

  const months = useMemo(() => lastNMonths(6), []);
  const birthSeries = countByMonth(births, months);
  const deathSeries = countByMonth(deaths, months);

  const territory = [session.commune_name].filter(Boolean).join(" · ");

  return (
    <div className="dash-page">
      <div className="dash-welcome">
        <div>
          <h2 className="page-title">Bonjour, {session.displayName || session.username}</h2>
          <p className="page-lead">
            {session.roleTitle || HEALTH_ROLE_TITLE}
            {territory ? ` · Périmètre : ${territory}` : ""}
            {" · "}
            {session.facilityName}
          </p>
        </div>
      </div>

      <div className="dash-kpi-grid">
        <StatCard
          title="Naissance"
          value={births.length}
          subtitle={`${pendingOf(birthAll).length} à valider`}
          icon={<IconBaby size={22} />}
          color={RDC.yellowDeep}
          href="/sante/births?focus=validated"
        />
        <StatCard
          title="Décès"
          value={deaths.length}
          subtitle={`${pendingOf(deathAll).length} à valider`}
          icon={<IconCross size={22} />}
          color={RDC.red}
          href="/sante/deaths?focus=validated"
        />
      </div>

      <h3 className="dash-section-title">Statistiques de {session.facilityName}</h3>
      <div className="eg-charts-row dash-charts-main">
        <BarChart
          title="Déclarations par type (validées)"
          height={200}
          data={[
            { label: "Naissance", value: births.length, color: RDC.yellow },
            { label: "Décès", value: deaths.length, color: RDC.red },
          ]}
        />
      </div>

      <div className="eg-charts-row">
        <PieChart
          title="Statut des déclarations"
          data={[
            { label: "En attente", value: pending, color: RDC.yellow },
            { label: "Validé", value: validated, color: RDC.blue },
            { label: "Rejeté", value: rejected, color: RDC.red },
          ]}
        />
        <div className="eg-chart-card" style={{ padding: "0.85rem 1rem" }}>
          <h3 className="panel-title" style={{ marginTop: 0, fontSize: "1rem" }}>
            Que signifient ces statuts ?
          </h3>
          <ul className="muted small" style={{ margin: 0, paddingLeft: "1.1rem", lineHeight: 1.55 }}>
            <li>
              <strong>En attente</strong> — déclaration transmise à l&apos;état civil, en attente de
              validation par l&apos;officier.
            </li>
            <li>
              <strong>Validé</strong> — déclaration prise en compte par l&apos;officier.
            </li>
            <li>
              <strong>Rejeté</strong> — déclaration à corriger.
            </li>
          </ul>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.75rem" }}>
            <button
              type="button"
              className="btn-secondary btn-sm"
              onClick={() => navigate("/sante/actes-en-cours")}
            >
              En attente ({pending})
            </button>
            <button
              type="button"
              className="btn-secondary btn-sm"
              onClick={() => navigate("/sante/nos-valides")}
            >
              Validés ({validated})
            </button>
          </div>
        </div>
        <LineChart
          title="Naissance vs décès"
          labels={months.map((m) => m.label)}
          series={[
            { name: "Naissance", color: RDC.yellow, values: birthSeries },
            { name: "Décès", color: RDC.red, values: deathSeries },
          ]}
        />
      </div>
    </div>
  );
}
