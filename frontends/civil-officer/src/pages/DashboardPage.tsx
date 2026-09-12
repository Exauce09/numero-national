import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { api, type CivilAct } from "../api";
import { getSession } from "../auth";
import { BarChart, LineChart, PieChart, Sparkline } from "../components/Charts";
import {
  IconBaby,
  IconClipboard,
  IconCross,
  IconFile,
  IconRing,
  IconSplit,
  IconUsers,
} from "../components/Icons";
import { dashboardVariant } from "../rbac";
import { listActs, listPopulationPersons, populationBreakdown } from "../registry";

const MONTHS_FR = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];

function useCountUp(target: number, durationMs = 700): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce || target <= 0) {
      setN(target);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - (1 - t) * (1 - t);
      setN(Math.round(target * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);
  return n;
}

function StatCard({
  title,
  value,
  subtitle,
  icon,
  color,
  spark,
  href,
  demo,
}: {
  title: string;
  value: number;
  subtitle: string;
  icon: ReactNode;
  color: string;
  spark: number[];
  href: string;
  demo?: boolean;
}) {
  const shown = useCountUp(value);
  const navigate = useNavigate();
  return (
    <button type="button" className="dash-kpi" onClick={() => navigate(href)}>
      <div className="dash-kpi-top">
        <span className="dash-kpi-icon" style={{ background: `${color}18`, color }}>
          {icon}
        </span>
        {demo ? <span className="dash-demo-tag">DEMO</span> : null}
      </div>
      <div className="dash-kpi-title">{title}</div>
      <div className="dash-kpi-value">{shown.toLocaleString("fr-CD")}</div>
      <div className="dash-kpi-foot">
        <span className="dash-kpi-sub">{subtitle}</span>
        <Sparkline values={spark} color={color} />
      </div>
    </button>
  );
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function lastNMonths(n: number): { key: string; label: string }[] {
  const out: { key: string; label: string }[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({ key: monthKey(d), label: MONTHS_FR[d.getMonth()] });
  }
  return out;
}

function countByMonth(acts: Array<{ created_at: string }>, months: { key: string }[]): number[] {
  const map = new Map(months.map((m) => [m.key, 0]));
  for (const a of acts) {
    const d = new Date(a.created_at);
    if (Number.isNaN(d.getTime())) continue;
    const k = monthKey(d);
    if (map.has(k)) map.set(k, (map.get(k) ?? 0) + 1);
  }
  return months.map((m) => map.get(m.key) ?? 0);
}

function actStatus(a: { status?: string; payload?: Record<string, unknown> }): string {
  return String(a.status ?? a.payload?.status ?? "").toUpperCase();
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const session = getSession();
  const variant = dashboardVariant(session?.roles ?? ["OFFICIER_ETAT_CIVIL"]);
  const localPop = listPopulationPersons();
  const localActs = listActs();

  const [apiPop, setApiPop] = useState<number | null>(null);
  const [apiActs, setApiActs] = useState<CivilAct[]>([]);
  const [apiLoaded, setApiLoaded] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.accessToken) {
      setApiLoaded(true);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const [citizens, births, deaths, marriages, divorces] = await Promise.all([
          api.searchCitizens(new URLSearchParams({ page: "1", page_size: "1" })),
          api.listActs("births").catch(() => [] as CivilAct[]),
          api.listActs("deaths").catch(() => [] as CivilAct[]),
          api.listActs("marriages").catch(() => [] as CivilAct[]),
          api.listActs("divorces").catch(() => [] as CivilAct[]),
        ]);
        if (cancelled) return;
        setApiPop(citizens.total ?? 0);
        setApiActs([...births, ...deaths, ...marriages, ...divorces]);
      } catch (e) {
        if (!cancelled) setApiError(e instanceof Error ? e.message : "Stats API indisponibles");
      } finally {
        if (!cancelled) setApiLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session?.accessToken]);

  const popCount = apiPop ?? localPop.length;
  const acts = apiActs.length ? apiActs : localActs.map((a) => ({
    id: a.id,
    act_type: a.type,
    act_number: a.act_number,
    commune_code: "",
    status: String(a.payload?.status ?? "DRAFT"),
    citizen_id: null,
    payload: a.payload,
    created_at: a.created_at,
  }));

  const births = acts.filter((a) => a.act_type === "BIRTH" || a.act_type === "births");
  const deaths = acts.filter((a) => a.act_type === "DEATH" || a.act_type === "deaths");
  const marriages = acts.filter((a) => a.act_type === "MARRIAGE" || a.act_type === "marriages");
  const divorces = acts.filter((a) => a.act_type === "DIVORCE" || a.act_type === "divorces");

  const drafts = acts.filter((a) => actStatus(a) === "DRAFT").length;
  const submitted = acts.filter((a) =>
    ["SUBMITTED", "UNDER_REVIEW", "VERIFIED", "PENDING_OFFICER"].includes(actStatus(a)),
  ).length;
  const validated = acts.filter((a) =>
    ["VALIDATED", "AUTHENTICATED"].includes(actStatus(a)),
  ).length;
  const rejected = acts.filter((a) =>
    ["REJECTED", "CORRECTION_REQUIRED"].includes(actStatus(a)),
  ).length;

  const months = useMemo(() => lastNMonths(6), []);
  const birthSeries = countByMonth(births, months);
  const deathSeries = countByMonth(deaths, months);
  const marriageSeries = countByMonth(marriages, months);
  const allActsSeries = countByMonth(acts, months);

  const hasTemporal = [...birthSeries, ...deathSeries, ...allActsSeries].some((v) => v > 0);
  /** Illustration uniquement si aucune série réelle — clairement marquée DEMO. */
  const demoTemporal = !hasTemporal && apiLoaded;
  const demoBirth = demoTemporal ? [2, 3, 4, 3, 5, 4] : birthSeries;
  const demoDeath = demoTemporal ? [1, 1, 2, 1, 2, 1] : deathSeries;
  const demoAll = demoTemporal ? [4, 5, 7, 6, 9, 8] : allActsSeries;

  const popBreakdown = useMemo(() => populationBreakdown(localPop), [localPop]);

  const helloName =
    variant === "officier"
      ? "Officier de l'état civil"
      : session?.displayName || session?.username || "utilisateur";
  const roleTitle = session?.roleTitle || "Agent opérationnel";
  const territory = [session?.commune_province, session?.commune_ville, session?.commune_name]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="dash-page">
      <div className="dash-welcome">
        <div>
          <h2 className="page-title">Bonjour, {helloName}</h2>
          <p className="page-lead">
            {roleTitle}
            {territory ? ` · ${territory}` : ""}
          </p>
        </div>
      </div>

      {apiError ? (
        <p className="muted small" role="status">
          Stats partielles (local) — {apiError}
        </p>
      ) : null}
      {demoTemporal ? (
        <div className="dash-demo-banner" role="note">
          Courbes temporelles en <strong>données de démonstration</strong> (illustration) — les KPI
          ci-dessous utilisent les données réelles disponibles.
        </div>
      ) : null}

      <div className="dash-kpi-grid">
        <StatCard
          title="Population"
          value={popCount}
          subtitle={apiPop != null ? "Registre national" : "Registre local"}
          icon={<IconUsers size={22} />}
          color="#0b3d91"
          spark={demoAll}
          href="/population"
          demo={apiPop == null && localPop.length === 0}
        />
        <StatCard
          title="Naissances"
          value={births.length}
          subtitle="Actes enregistrés"
          icon={<IconBaby size={22} />}
          color="#0aad8a"
          spark={demoBirth}
          href="/lists/naissance"
        />
        <StatCard
          title="Mariages"
          value={marriages.length}
          subtitle="Unions"
          icon={<IconRing size={22} />}
          color="#f7a800"
          spark={marriageSeries.some((v) => v > 0) ? marriageSeries : demoAll}
          href="/lists/mariage"
        />
        <StatCard
          title="Décès"
          value={deaths.length}
          subtitle="Actes de décès"
          icon={<IconCross size={22} />}
          color="#ce1126"
          spark={demoDeath}
          href="/lists/deces"
        />
        <StatCard
          title="Divorces"
          value={divorces.length}
          subtitle="Dissolutions"
          icon={<IconSplit size={22} />}
          color="#5b6b7c"
          spark={demoAll}
          href="/lists/divorce"
        />
        <StatCard
          title="Dossiers en cours"
          value={drafts + submitted}
          subtitle={`${drafts} brouillons · ${submitted} soumis`}
          icon={<IconClipboard size={22} />}
          color="#3b6ea5"
          spark={demoAll}
          href="/declarations"
        />
      </div>

      {(variant === "officier" || variant === "bureau") && (
        <div className="dash-action-row">
          <button type="button" className="dash-action-card" onClick={() => navigate("/declarations")}>
            <span className="dash-action-label">À vérifier / valider</span>
            <strong className="dash-action-value">{submitted}</strong>
            <span className="btn-add btn-sm">Consulter</span>
          </button>
          <button type="button" className="dash-action-card" onClick={() => navigate("/acts")}>
            <span className="dash-action-label">Validés / authentifiés</span>
            <strong className="dash-action-value">{validated}</strong>
            <span className="btn-secondary btn-sm">Voir actes</span>
          </button>
          <button type="button" className="dash-action-card" onClick={() => navigate("/declarations")}>
            <span className="dash-action-label">Corrections / rejetés</span>
            <strong className="dash-action-value">{rejected}</strong>
            <span className="btn-secondary btn-sm">Ouvrir</span>
          </button>
        </div>
      )}

      <h3 className="dash-section-title">Statistiques &amp; graphiques</h3>
      <div className="eg-charts-row dash-charts-main">
        <LineChart
          title={demoTemporal ? "Évolution des actes (DEMO)" : "Évolution des actes (6 mois)"}
          labels={months.map((m) => m.label)}
          series={[
            { name: "Tous actes", color: "#0b3d91", values: demoAll },
            { name: "Naissances", color: "#0aad8a", values: demoBirth },
            { name: "Décès", color: "#ce1126", values: demoDeath },
          ]}
          height={240}
        />
        <BarChart
          title="Actes d'état civil par type"
          height={200}
          data={[
            { label: "Naiss.", value: births.length, color: "#0aad8a" },
            { label: "Mariages", value: marriages.length, color: "#f7a800" },
            { label: "Divorces", value: divorces.length, color: "#5b6b7c" },
            { label: "Décès", value: deaths.length, color: "#ce1126" },
          ]}
        />
      </div>

      <div className="eg-charts-row">
        <PieChart
          title="Statut des dossiers"
          data={[
            { label: "Brouillon", value: drafts, color: "#9aa8c0" },
            { label: "Soumis / revue", value: submitted, color: "#f7a800" },
            { label: "Validé / auth.", value: validated, color: "#0aad8a" },
            { label: "Rejeté / correction", value: rejected, color: "#ce1126" },
          ]}
        />
        <PieChart
          title="Population locale — sexe"
          data={[
            { label: "Hommes", value: popBreakdown.hommes.total, color: "#0b3d91" },
            { label: "Femmes", value: popBreakdown.femmes.total, color: "#ce1126" },
          ]}
        />
        <BarChart
          title="Population — mineurs / majeurs"
          height={180}
          data={[
            { label: "Mineurs", value: popBreakdown.total.mineurs.total, color: "#3b6ea5" },
            { label: "Majeurs", value: popBreakdown.total.majeurs.total, color: "#0b3d91" },
          ]}
        />
      </div>

      <div className="eg-charts-row">
        <LineChart
          title={demoTemporal ? "Naissances vs décès (DEMO)" : "Naissances vs décès"}
          labels={months.map((m) => m.label)}
          series={[
            { name: "Naissances", color: "#0aad8a", values: demoBirth },
            { name: "Décès", color: "#ce1126", values: demoDeath },
          ]}
        />
        <div className="eg-chart-card">
          <h4 className="eg-chart-title">Activité récente</h4>
          {acts.length === 0 ? (
            <p className="muted">Aucun acte à afficher pour le moment.</p>
          ) : (
            <ul className="dash-activity">
              {[...acts]
                .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
                .slice(0, 8)
                .map((a) => (
                  <li key={a.id}>
                    <IconFile size={14} />
                    <span>
                      <strong>{a.act_type}</strong> · {a.act_number || a.id.slice(0, 8)}
                    </span>
                    <span className="status-badge">{actStatus(a) || "—"}</span>
                  </li>
                ))}
            </ul>
          )}
          <button type="button" className="btn-secondary btn-sm" style={{ marginTop: "0.75rem" }} onClick={() => navigate("/acts")}>
            Voir tous les actes
          </button>
        </div>
      </div>
    </div>
  );
}
