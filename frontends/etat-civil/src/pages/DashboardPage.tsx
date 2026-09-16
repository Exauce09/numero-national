import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { api, type CivilAct } from "../api";
import { ensureAccessToken, getSession } from "../auth";
import { BarChart, LineChart, PieChart } from "../components/Charts";
import { actBelongsToOfficerCommune, getOfficerCommune } from "../commune";
import { isSuperAdminNational } from "../ecUsers";
import {
  IconBaby,
  IconClipboard,
  IconCross,
  IconFile,
  IconRing,
  IconSplit,
} from "../components/Icons";
import { dashboardVariant, primaryRole } from "../rbac";
import { RDC } from "../rdcColors";
import { listActs } from "../registry";

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
  href,
}: {
  title: string;
  value: number;
  subtitle: string;
  icon: ReactNode;
  color: string;
  href: string;
}) {
  const shown = useCountUp(value);
  const navigate = useNavigate();
  return (
    <button type="button" className="dash-kpi" onClick={() => navigate(href)}>
      <div className="dash-kpi-top">
        <span className="dash-kpi-icon" style={{ background: `${color}18`, color }}>
          {icon}
        </span>
      </div>
      <div className="dash-kpi-title">{title}</div>
      <div className="dash-kpi-value">{shown.toLocaleString("fr-CD")}</div>
      <div className="dash-kpi-foot">
        <span className="dash-kpi-sub">{subtitle}</span>
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

/** Tableau de bord bureau d'état civil — actes uniquement (pas de population / recensement). */
export default function DashboardPage() {
  const navigate = useNavigate();
  const session = getSession();
  const variant = dashboardVariant(session?.roles ?? ["OFFICIER_ETAT_CIVIL"]);
  const nationalScope = isSuperAdminNational(session?.roles);
  const officerCommune = getOfficerCommune();
  const localActs = listActs();

  const [apiActs, setApiActs] = useState<CivilAct[]>([]);
  const [, setApiLoaded] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const token = await ensureAccessToken();
      if (!token) {
        if (!cancelled) {
          setApiLoaded(true);
          setApiError("Non connecté à l’API — statistiques sur les actes locaux uniquement");
        }
        return;
      }
      try {
        const communeFilter = nationalScope ? undefined : officerCommune.code;
        const [births, deaths, marriages, divorces, adoptions, recognitions] = await Promise.all([
          api.listActs("births", communeFilter).catch(() => [] as CivilAct[]),
          api.listActs("deaths", communeFilter).catch(() => [] as CivilAct[]),
          api.listActs("marriages", communeFilter).catch(() => [] as CivilAct[]),
          api.listActs("divorces", communeFilter).catch(() => [] as CivilAct[]),
          api.listActs("adoptions", communeFilter).catch(() => [] as CivilAct[]),
          api.listActs("recognitions", communeFilter).catch(() => [] as CivilAct[]),
        ]);
        if (cancelled) return;
        setApiActs([...births, ...deaths, ...marriages, ...divorces, ...adoptions, ...recognitions]);
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
  }, [session?.accessToken, nationalScope, officerCommune.code]);

  const acts = useMemo(() => {
    const fromApi = apiActs.map((a) => ({
      ...a,
      status: a.status || "DRAFT",
    }));
    const apiIds = new Set(fromApi.map((a) => a.id));
    const fromLocal = localActs
      .filter(
        (a) =>
          !["CENSUS", "DISPLACEMENT", "DOCUMENT"].includes(a.type) &&
          !apiIds.has(a.id) &&
          !apiIds.has(String(a.payload?.server_act_id ?? "")) &&
          (nationalScope || actBelongsToOfficerCommune(a.payload, officerCommune)),
      )
      .map((a) => ({
        id: a.id,
        act_type: a.type,
        act_number: a.act_number,
        commune_code: String(a.payload?.commune_code ?? officerCommune.code),
        status: String(a.status ?? a.payload?.status ?? "DRAFT"),
        citizen_id: null as string | null,
        payload: a.payload,
        created_at: a.created_at,
      }));
    const merged = [...fromApi, ...fromLocal];
    if (nationalScope) return merged;
    return merged.filter((a) =>
      actBelongsToOfficerCommune(
        { ...(a.payload ?? {}), commune_code: a.commune_code || (a.payload as { commune_code?: string })?.commune_code },
        officerCommune,
      ),
    );
  }, [apiActs, localActs, nationalScope, officerCommune]);

  const births = acts.filter((a) => a.act_type === "BIRTH" || a.act_type === "births");
  const deaths = acts.filter((a) => a.act_type === "DEATH" || a.act_type === "deaths");
  const marriages = acts.filter((a) => a.act_type === "MARRIAGE" || a.act_type === "marriages");
  const divorces = acts.filter((a) => a.act_type === "DIVORCE" || a.act_type === "divorces");
  const adoptions = acts.filter((a) => a.act_type === "ADOPTION" || a.act_type === "adoptions");
  const recognitions = acts.filter(
    (a) => a.act_type === "RECOGNITION" || a.act_type === "recognitions",
  );

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
  const allActsSeries = countByMonth(acts, months);

  const helloName = session?.displayName || session?.username || "utilisateur";
  const rolePrimary = primaryRole(session?.roles ?? []);
  const roleTitle =
    session?.roleTitle ||
    (variant === "provincial"
      ? "Directrice de l'État civil général de la RDC"
      : variant === "judiciaire"
        ? rolePrimary === "JUGE"
          ? "Juge"
          : "Greffier"
        : "Officier de l'état civil");
  const territory = [session?.commune_province, session?.commune_ville, session?.commune_name]
    .filter(Boolean)
    .join(" · ");
  const scopeLabel = nationalScope
    ? "Vue nationale"
    : territory
      ? `Périmètre : ${territory}`
      : `Périmètre : ${officerCommune.name}`;

  if (variant === "judiciaire") {
    const isJuge = rolePrimary === "JUGE";
    const judicialActs = [...divorces, ...adoptions];
    const judicialSeries = countByMonth(judicialActs, months);
    return (
      <div className="dash-page">
        <div className="dash-welcome">
          <div>
            <h2 className="page-title">Bonjour, {helloName}</h2>
            <p className="page-lead">
              {roleTitle}
              {territory ? ` · ${territory}` : ""}
              {" · "}
              {isJuge
                ? "Module judiciaire (tribunal) — décisions et dossiers de votre juridiction"
                : "Module judiciaire (greffe) — uniquement vos dossiers de jugement"}
            </p>
          </div>
        </div>

        <div className="dash-action-row" style={{ marginBottom: "1.25rem" }}>
          <button type="button" className="dash-action-card" onClick={() => navigate("/juge")}>
            <span className="dash-action-label">{isJuge ? "Cas du juge" : "Cadre juge"}</span>
            <strong className="dash-action-value" style={{ fontSize: "1.05rem" }}>
              Supplétif…
            </strong>
            <span className="btn-add btn-sm">Voir</span>
          </button>
          <button type="button" className="dash-action-card" onClick={() => navigate("/transcriptions")}>
            <span className="dash-action-label">{isJuge ? "Dossiers" : "Transcriptions"}</span>
            <strong className="dash-action-value" style={{ fontSize: "1.05rem" }}>
              Jugements
            </strong>
            <span className="btn-secondary btn-sm">Ouvrir</span>
          </button>
          <button type="button" className="dash-action-card" onClick={() => navigate("/divorces")}>
            <span className="dash-action-label">Divorces</span>
            <strong className="dash-action-value">{divorces.length}</strong>
            <span className="btn-secondary btn-sm">{isJuge ? "Consulter" : "Transcrire"}</span>
          </button>
          <button type="button" className="dash-action-card" onClick={() => navigate("/adoptions")}>
            <span className="dash-action-label">Adoptions</span>
            <strong className="dash-action-value">{adoptions.length}</strong>
            <span className="btn-secondary btn-sm">{isJuge ? "Consulter" : "Transcrire"}</span>
          </button>
        </div>

        <div className="dash-kpi-grid">
          <StatCard
            title="Divorces"
            value={divorces.length}
            subtitle={isJuge ? "Dossiers juridiction" : "Transcriptions greffe"}
            icon={<IconSplit size={22} />}
            color={RDC.redDeep}
            href="/lists/divorce"
          />
          <StatCard
            title="Adoptions"
            value={adoptions.length}
            subtitle="Après jugement"
            icon={<IconClipboard size={22} />}
            color={RDC.blueMid}
            href="/lists/adoption"
          />
          <StatCard
            title="Dossiers judiciaires"
            value={judicialActs.length}
            subtitle="Divorce + adoption"
            icon={<IconFile size={22} />}
            color={RDC.blue}
            href="/transcriptions"
          />
          <StatCard
            title="En cours"
            value={
              judicialActs.filter((a) =>
                ["DRAFT", "SUBMITTED", "UNDER_REVIEW", "PENDING_OFFICER"].includes(actStatus(a)),
              ).length
            }
            subtitle="Brouillons / soumis"
            icon={<IconClipboard size={22} />}
            color={RDC.yellowDeep}
            href="/transcriptions"
          />
        </div>

        <h3 className="dash-section-title">
          {isJuge ? "Activité de la juridiction" : "Activité du greffe"}
        </h3>
        <div className="eg-charts-row dash-charts-main">
          <BarChart
            title="Dossiers judiciaires par type"
            height={200}
            data={[
              { label: "Divorces", value: divorces.length, color: RDC.redSoft },
              { label: "Adoptions", value: adoptions.length, color: RDC.blueMid },
            ]}
          />
          <LineChart
            title="Dossiers (6 mois)"
            labels={months.map((m) => m.label)}
            series={[{ name: "Dossiers", color: RDC.blue, values: judicialSeries }]}
            height={240}
          />
        </div>

        <div className="eg-chart-card" style={{ marginTop: "1rem" }}>
          <h4 className="eg-chart-title">Derniers dossiers</h4>
          {judicialActs.length === 0 ? (
            <p className="muted">Aucun dossier judiciaire pour le moment.</p>
          ) : (
            <ul className="dash-activity">
              {[...judicialActs]
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
        </div>
      </div>
    );
  }

  return (
    <div className="dash-page">
      <div className="dash-welcome">
        <div>
          <h2 className="page-title">Bonjour, {helloName}</h2>
          <p className="page-lead">
            {roleTitle}
            {" · "}
            {scopeLabel}
            {" · "}Bureau d&apos;état civil
          </p>
        </div>
      </div>

      <div className="dash-action-row" style={{ marginBottom: "1.25rem" }}>
        {isSuperAdminNational(session?.roles) ? (
          <button type="button" className="dash-action-card" onClick={() => navigate("/register")}>
            <span className="dash-action-label">Créer un compte</span>
            <strong className="dash-action-value" style={{ fontSize: "1.05rem" }}>
              Plateforme
            </strong>
            <span className="btn-add btn-sm">Formulaire</span>
          </button>
        ) : null}
        <button type="button" className="dash-action-card" onClick={() => navigate("/procedure")}>
          <span className="dash-action-label">Procédure</span>
          <strong className="dash-action-value" style={{ fontSize: "1.05rem" }}>
            Suivre
          </strong>
          <span className="btn-add btn-sm">Pas à pas</span>
        </button>
        {variant === "agent" || variant === "auditeur" ? (
          <>
            <button type="button" className="dash-action-card" onClick={() => navigate("/births")}>
              <span className="dash-action-label">Naissance</span>
              <strong className="dash-action-value" style={{ fontSize: "1.05rem" }}>
                {variant === "auditeur" ? "Consulter" : "Saisir"}
              </strong>
              <span className="btn-secondary btn-sm">
                {variant === "auditeur" ? "Listes" : "Formulaire"}
              </span>
            </button>
            <button type="button" className="dash-action-card" onClick={() => navigate("/marriages")}>
              <span className="dash-action-label">Mariage</span>
              <strong className="dash-action-value" style={{ fontSize: "1.05rem" }}>
                {variant === "auditeur" ? "Consulter" : "Saisir"}
              </strong>
              <span className="btn-secondary btn-sm">Ouvrir</span>
            </button>
            <button type="button" className="dash-action-card" onClick={() => navigate("/deaths")}>
              <span className="dash-action-label">Décès</span>
              <strong className="dash-action-value" style={{ fontSize: "1.05rem" }}>
                {variant === "auditeur" ? "Consulter" : "Saisir"}
              </strong>
              <span className="btn-secondary btn-sm">Ouvrir</span>
            </button>
          </>
        ) : (
          <>
            <button type="button" className="dash-action-card" onClick={() => navigate("/declarations")}>
              <span className="dash-action-label">Déclarations santé</span>
              <strong className="dash-action-value">{submitted}</strong>
              <span className="btn-secondary btn-sm">Valider</span>
            </button>
            <button type="button" className="dash-action-card" onClick={() => navigate("/births")}>
              <span className="dash-action-label">Naissance bureau</span>
              <strong className="dash-action-value" style={{ fontSize: "1.05rem" }}>
                Enregistrer
              </strong>
              <span className="btn-secondary btn-sm">Formulaire</span>
            </button>
            <button type="button" className="dash-action-card" onClick={() => navigate("/juge")}>
              <span className="dash-action-label">Cas juge</span>
              <strong className="dash-action-value" style={{ fontSize: "1.05rem" }}>
                Supplétif…
              </strong>
              <span className="btn-secondary btn-sm">Voir</span>
            </button>
          </>
        )}
      </div>

      {apiError ? (
        <p className="muted small" role="status">
          Stats partielles — {apiError}
        </p>
      ) : null}

      <div className="dash-kpi-grid">
        <StatCard
          title="Actes"
          value={acts.length}
          subtitle={nationalScope ? "Registre national" : `Commune ${officerCommune.name}`}
          icon={<IconFile size={22} />}
          color={RDC.blue}
          href="/acts"
        />
        <StatCard
          title="Naissances"
          value={births.length}
          subtitle="Actes enregistrés"
          icon={<IconBaby size={22} />}
          color={RDC.yellowDeep}
          href="/lists/naissance"
        />
        <StatCard
          title="Mariages"
          value={marriages.length}
          subtitle="Unions civiles"
          icon={<IconRing size={22} />}
          color={RDC.yellow}
          href="/lists/mariage"
        />
        <StatCard
          title="Décès"
          value={deaths.length}
          subtitle="Actes de décès"
          icon={<IconCross size={22} />}
          color={RDC.red}
          href="/lists/deces"
        />
        {variant === "agent" || variant === "auditeur" ? (
          <StatCard
            title="Brouillons"
            value={drafts}
            subtitle="Dossiers en saisie"
            icon={<IconClipboard size={22} />}
            color={RDC.blueDeep}
            href="/acts"
          />
        ) : (
          <>
            <StatCard
              title="Divorces"
              value={divorces.length}
              subtitle="Dissolutions"
              icon={<IconSplit size={22} />}
              color={RDC.redDeep}
              href="/lists/divorce"
            />
            <StatCard
              title="Dossiers en cours"
              value={drafts + submitted}
              subtitle={`${drafts} brouillons · ${submitted} soumis`}
              icon={<IconClipboard size={22} />}
              color={RDC.blueDeep}
              href="/declarations"
            />
          </>
        )}
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
          <button type="button" className="dash-action-card" onClick={() => navigate("/missions")}>
            <span className="dash-action-label">Missions EC RDC</span>
            <strong className="dash-action-value">{adoptions.length + recognitions.length}</strong>
            <span className="btn-secondary btn-sm">Ouvrir</span>
          </button>
        </div>
      )}

      <h3 className="dash-section-title">
        Statistiques {nationalScope ? "nationales" : `de ${officerCommune.name}`}
      </h3>
      <div className="eg-charts-row dash-charts-main">
        <LineChart
          title="Évolution des actes (6 mois)"
          labels={months.map((m) => m.label)}
          series={[
            { name: "Tous actes", color: RDC.blue, values: allActsSeries },
            { name: "Naissances", color: RDC.yellow, values: birthSeries },
            { name: "Décès", color: RDC.red, values: deathSeries },
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
            { label: "Adopt.", value: adoptions.length, color: RDC.blueMid },
            { label: "Reconn.", value: recognitions.length, color: RDC.blueSoft },
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
              <strong>Brouillon</strong> — saisie d&apos;un acte commencée, non finalisée.
            </li>
            <li>
              <strong>Soumis / revue</strong> — transmis pour contrôle par l&apos;officier.
            </li>
            <li>
              <strong>Validé / auth.</strong> — acte authentifié par l&apos;officier.
            </li>
            <li>
              <strong>Rejeté / correction</strong> — dossier à corriger.
            </li>
          </ul>
        </div>
        <LineChart
          title="Naissances vs décès"
          labels={months.map((m) => m.label)}
          series={[
            { name: "Naissances", color: RDC.yellow, values: birthSeries },
            { name: "Décès", color: RDC.red, values: deathSeries },
          ]}
        />
        <div className="eg-chart-card">
          <h4 className="eg-chart-title">Activité récente</h4>
          {acts.length === 0 ? (
            <p className="muted">Aucun acte à afficher pour votre périmètre.</p>
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
          <button
            type="button"
            className="btn-secondary btn-sm"
            style={{ marginTop: "0.75rem" }}
            onClick={() => navigate("/acts")}
          >
            Voir tous les actes
          </button>
        </div>
      </div>
    </div>
  );
}
