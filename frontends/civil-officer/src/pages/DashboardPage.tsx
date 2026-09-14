import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { api, type CitizenListItem, type CivilAct } from "../api";
import { ensureAccessToken, getSession } from "../auth";
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
import { RDC } from "../rdcColors";
import {
  listActs,
  listPopulationPersons,
  populationBreakdown,
  type Person,
  type Sexe,
} from "../registry";

function mapApiSex(sex?: string | null): Sexe {
  const s = (sex || "").toUpperCase();
  if (s === "F" || s === "FEMALE" || s === "FEMININ") return "F";
  return "M";
}

function citizenToBreakdownPerson(c: CitizenListItem): Person {
  return {
    id: c.id,
    nom: c.family_name || "",
    postnom: "",
    prenom: c.given_names || "",
    sexe: mapApiSex(c.sex),
    date_naissance: (c.date_of_birth || "").slice(0, 10),
    lieu_naissance: c.place_of_birth || "",
    etat_civil: "UNKNOWN",
    nic: c.nic || "",
    handicap_type: "NORMAL",
    created_at: "",
  };
}

async function fetchAllCitizens(): Promise<{ total: number; items: CitizenListItem[] }> {
  const pageSize = 100;
  const items: CitizenListItem[] = [];
  let page = 1;
  let total = 0;
  for (;;) {
    const data = await api.searchCitizens(
      new URLSearchParams({ page: String(page), page_size: String(pageSize) }),
    );
    total = data.total ?? 0;
    items.push(...(data.items ?? []));
    if (items.length >= total || !(data.items?.length)) break;
    page += 1;
    if (page > 50) break;
  }
  return { total, items };
}

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
  const raw = String(a.status ?? a.payload?.status ?? "DRAFT").toUpperCase().trim();
  return raw || "DRAFT";
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const session = getSession();
  const variant = dashboardVariant(session?.roles ?? ["OFFICIER_ETAT_CIVIL"]);
  const localPop = listPopulationPersons();
  const localActs = listActs();

  const [apiPop, setApiPop] = useState<number | null>(null);
  const [apiCitizens, setApiCitizens] = useState<CitizenListItem[]>([]);
  const [apiActs, setApiActs] = useState<CivilAct[]>([]);
  const [apiLoaded, setApiLoaded] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const token = await ensureAccessToken();
      if (!token) {
        if (!cancelled) {
          setApiLoaded(true);
          setApiError("Non connecté à l’API — KPI Population = cache local du navigateur");
        }
        return;
      }
      try {
        const [citizensPack, births, deaths, marriages, divorces] = await Promise.all([
          fetchAllCitizens(),
          api.listActs("births").catch(() => [] as CivilAct[]),
          api.listActs("deaths").catch(() => [] as CivilAct[]),
          api.listActs("marriages").catch(() => [] as CivilAct[]),
          api.listActs("divorces").catch(() => [] as CivilAct[]),
        ]);
        if (cancelled) return;
        setApiPop(citizensPack.total);
        setApiCitizens(citizensPack.items);
        setApiActs([...births, ...deaths, ...marriages, ...divorces]);
        setApiError(null);
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
  const popSourceNational = apiCitizens.length > 0;
  const popBreakdown = useMemo(() => {
    if (popSourceNational) {
      return populationBreakdown(apiCitizens.map(citizenToBreakdownPerson));
    }
    return populationBreakdown(localPop);
  }, [apiCitizens, localPop, popSourceNational]);
  const acts = useMemo(() => {
    const fromApi = apiActs.map((a) => ({
      ...a,
      status: a.status || "DRAFT",
    }));
    const apiIds = new Set(fromApi.map((a) => a.id));
    const fromLocal = localActs
      .filter((a) => !apiIds.has(a.id) && !apiIds.has(String(a.payload?.server_act_id ?? "")))
      .map((a) => ({
        id: a.id,
        act_type: a.type,
        act_number: a.act_number,
        commune_code: "",
        status: String(a.status ?? a.payload?.status ?? "DRAFT"),
        citizen_id: null as string | null,
        payload: a.payload,
        created_at: a.created_at,
      }));
    return [...fromApi, ...fromLocal];
  }, [apiActs, localActs]);

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

  const helloName = session?.displayName || session?.username || "utilisateur";
  const roleTitle =
    session?.roleTitle ||
    (variant === "officier"
      ? "Officier de l'état civil — Hervé Kinkete"
      : variant === "provincial"
        ? "Directrice de l'État civil général de la RDC"
        : "Officier de l'état civil");
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
          subtitle={
            apiPop != null
              ? "Registre national"
              : `Cache local (${localPop.length}) — reconnectez-vous`
          }
          icon={<IconUsers size={22} />}
          color={RDC.blue}
          spark={demoAll}
          href="/population"
          demo={apiPop == null && localPop.length === 0}
        />
        <StatCard
          title="Naissances"
          value={births.length}
          subtitle="Actes enregistrés"
          icon={<IconBaby size={22} />}
          color={RDC.yellowDeep}
          spark={demoBirth}
          href="/lists/naissance"
        />
        <StatCard
          title="Mariages"
          value={marriages.length}
          subtitle="Unions"
          icon={<IconRing size={22} />}
          color={RDC.yellow}
          spark={marriageSeries.some((v) => v > 0) ? marriageSeries : demoAll}
          href="/lists/mariage"
        />
        <StatCard
          title="Décès"
          value={deaths.length}
          subtitle="Actes de décès"
          icon={<IconCross size={22} />}
          color={RDC.red}
          spark={demoDeath}
          href="/lists/deces"
        />
        <StatCard
          title="Divorces"
          value={divorces.length}
          subtitle="Dissolutions"
          icon={<IconSplit size={22} />}
          color={RDC.redDeep}
          spark={demoAll}
          href="/lists/divorce"
        />
        <StatCard
          title="Dossiers en cours"
          value={drafts + submitted}
          subtitle={`${drafts} brouillons · ${submitted} soumis`}
          icon={<IconClipboard size={22} />}
          color={RDC.blueDeep}
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
            { name: "Tous actes", color: RDC.blue, values: demoAll },
            { name: "Naissances", color: RDC.yellow, values: demoBirth },
            { name: "Décès", color: RDC.red, values: demoDeath },
          ]}
          height={240}
        />
        <BarChart
          title="Actes d'état civil par type"
          height={200}
          data={[
            { label: "Naiss.", value: births.length, color: RDC.yellow },
            { label: "Mariages", value: marriages.length, color: RDC.yellowDeep },
            { label: "Divorces", value: divorces.length, color: RDC.redSoft },
            { label: "Décès", value: deaths.length, color: RDC.red },
          ]}
        />
      </div>

      <div className="eg-charts-row">
        <PieChart
          title="Statut des dossiers"
          data={[
            { label: "Brouillon", value: drafts, color: RDC.blueSoft },
            { label: "Soumis / revue", value: submitted, color: RDC.yellow },
            { label: "Validé / auth.", value: validated, color: RDC.blue },
            { label: "Rejeté / correction", value: rejected, color: RDC.red },
          ]}
        />
        <div className="eg-chart-card" style={{ padding: "0.85rem 1rem" }}>
          <h3 className="panel-title" style={{ marginTop: 0, fontSize: "1rem" }}>
            Que signifient ces statuts ?
          </h3>
          <ul className="muted small" style={{ margin: 0, paddingLeft: "1.1rem", lineHeight: 1.55 }}>
            <li>
              <strong>Brouillon</strong> — l&apos;agent d&apos;état civil a commencé un acte (naissance,
              mariage…) sans le finaliser.
            </li>
            <li>
              <strong>Soumis / revue</strong> — l&apos;acte est transmis pour contrôle ; un officier /
              responsable de bureau doit le vérifier.
            </li>
            <li>
              <strong>Validé / auth.</strong> — l&apos;officier a validé (cachet / workflow) ; l&apos;acte
              est authentique.
            </li>
            <li>
              <strong>Rejeté / correction</strong> — dossier renvoyé pour correction (données
              incomplètes ou erreur).
            </li>
          </ul>
          <p className="muted small" style={{ marginBottom: 0, marginTop: "0.65rem" }}>
            <strong>Qui valide ?</strong> l&apos;officier d&apos;état civil (
            <code>officier</code> / <code>DemoCivil2026!</code>). L&apos;agent saisit et{" "}
            <em>soumet</em> ; l&apos;officier clique <em>Valider l&apos;acte</em> (pas de saut
            Brouillon → Validé).
            {drafts + submitted + validated + rejected === 0
              ? " Graphique à 0 : ouvrez un acte (Naissances…) → Voir → Soumettre / Valider."
              : ""}
          </p>
        </div>
        <PieChart
          title={
            popSourceNational
              ? `Registre national — sexe (${popBreakdown.hommes.total + popBreakdown.femmes.total})`
              : "Population locale — sexe (cache navigateur)"
          }
          data={[
            { label: "Hommes", value: popBreakdown.hommes.total, color: RDC.blue },
            { label: "Femmes", value: popBreakdown.femmes.total, color: RDC.red },
          ]}
        />
        <BarChart
          title={
            popSourceNational
              ? "Registre national — mineurs / majeurs"
              : "Population locale — mineurs / majeurs"
          }
          height={180}
          data={[
            { label: "Mineurs", value: popBreakdown.total.mineurs.total, color: RDC.yellow },
            { label: "Majeurs", value: popBreakdown.total.majeurs.total, color: RDC.blueDeep },
          ]}
        />
      </div>

      <div className="eg-charts-row">
        <LineChart
          title={demoTemporal ? "Naissances vs décès (DEMO)" : "Naissances vs décès"}
          labels={months.map((m) => m.label)}
          series={[
            { name: "Naissances", color: RDC.yellow, values: demoBirth },
            { name: "Décès", color: RDC.red, values: demoDeath },
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
