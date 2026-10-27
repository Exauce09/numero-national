import { FormEvent, useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  censusApi,
  downloadOnipDashboardExport,
  fetchOnipDashboard,
  fetchOnipDashboardHealth,
  fetchOnipDashboardTerritories,
  fetchOnipDashboardTrends,
  type Campaign,
  type OnipDashboard,
  type OnipDashboardFilters,
} from "../api";
import { getSession } from "../auth";

const CITIZEN_STATUSES = ["", "DRAFT", "PENDING_VALIDATION", "ACTIVE", "DECEASED", "SUSPENDED"];
const CARD_STATUSES = ["", "PENDING", "SENT_TO_COMMUNE", "ACTIVE", "DELIVERED", "EXPIRED"];

function fmt(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toLocaleString("fr-FR");
}

function periodPreset(days: number): OnipDashboardFilters {
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - (days - 1));
  return {
    period_from: from.toISOString().slice(0, 10),
    period_to: to.toISOString().slice(0, 10),
  };
}

export default function DashboardPage() {
  const session = getSession();
  const [data, setData] = useState<OnipDashboard | null>(null);
  const [trends, setTrends] = useState<Array<{ day: string; registered: number; validated: number }>>(
    [],
  );
  const [zones, setZones] = useState<
    Array<{ zone: string; registered: number; validated: number; nin_assigned: number }>
  >([]);
  const [health, setHealth] = useState<
    Array<{ service: string; state: string; checked_at: string; detail?: string | null }>
  >([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [filters, setFilters] = useState<OnipDashboardFilters>({});
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [widgetErrors, setWidgetErrors] = useState<Record<string, string>>({});

  const load = useCallback(
    async (f: OnipDashboardFilters = filters) => {
      if (!session?.accessToken) {
        setError("Connexion requise (permission onip:dashboard).");
        return;
      }
      setLoading(true);
      setError(null);
      setWidgetErrors({});
      try {
        const dash = await fetchOnipDashboard(f);
        setData(dash);
        // Si périmètre forcé, synchroniser le filtre province affiché
        if (dash.meta?.territory?.forced && dash.meta.territory.allowed_province) {
          setFilters((prev) => ({
            ...prev,
            ...f,
            province_code: dash.meta?.territory?.allowed_province || f.province_code,
            commune_code:
              dash.meta?.territory?.allowed_commune || f.commune_code || prev.commune_code,
          }));
        }
        const [tr, ter, h] = await Promise.all([
          fetchOnipDashboardTrends(f, 30).catch((e) => {
            setWidgetErrors((w) => ({
              ...w,
              trends: e instanceof Error ? e.message : "Tendances indisponibles",
            }));
            return { series: [] };
          }),
          fetchOnipDashboardTerritories(f).catch((e) => {
            setWidgetErrors((w) => ({
              ...w,
              territories: e instanceof Error ? e.message : "Territoires indisponibles",
            }));
            return { zones: [] };
          }),
          fetchOnipDashboardHealth().catch((e) => {
            setWidgetErrors((w) => ({
              ...w,
              health: e instanceof Error ? e.message : "Santé indisponible",
            }));
            return { services: [] };
          }),
        ]);
        setTrends(tr.series || []);
        setZones(ter.zones || []);
        setHealth(h.services || []);
      } catch (e) {
        setData(null);
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    },
    [session?.accessToken, filters],
  );

  useEffect(() => {
    void load({});
    if (session?.accessToken) {
      void censusApi
        .listCampaigns()
        .then(setCampaigns)
        .catch(() => setCampaigns([]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.accessToken]);

  function onFilterSubmit(e: FormEvent) {
    e.preventDefault();
    void load(filters);
  }

  function resetFilters() {
    const empty: OnipDashboardFilters = {};
    setFilters(empty);
    void load(empty);
  }

  function applyPreset(days: number) {
    const next = { ...filters, ...periodPreset(days) };
    setFilters(next);
    void load(next);
  }

  async function exportAggregatesCsv() {
    try {
      await downloadOnipDashboardExport(filters);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export refusé");
    }
  }

  if (error && !data) {
    return (
      <div>
        <div className="hero-banner">
          <h1>Tableau de bord national</h1>
          <p>Module 1 — supervision ONIP</p>
        </div>
        <p className="error">Accès refusé ou erreur ({error}).</p>
      </div>
    );
  }

  if (!data) return <p className="muted">Chargement…</p>;

  const k = data.kpis;
  const drill = data.drilldown || {};
  const freshness = data.meta?.freshness || "current";
  const territory = data.meta?.territory;
  const provinceLocked = Boolean(territory?.forced && territory.allowed_province);
  const trendMax = Math.max(1, ...trends.flatMap((t) => [t.registered, t.validated]));
  const zoneMax = Math.max(1, ...zones.map((z) => z.registered));

  const kpiCards: Array<{
    label: string;
    value: number | null | undefined;
    href?: string;
    hint?: string;
  }> = [
    {
      label: "Dossiers enregistrés",
      value: k?.registered_records ?? data.population.total,
      href: drill.population,
    },
    {
      label: "Dossiers validés",
      value: k?.validated_records ?? data.population.active,
      href: drill.population,
    },
    {
      label: "NIN / NIC attribués",
      value: k?.assigned_nins ?? data.population.nin_assigned,
      href: drill.population || "/population",
      hint: "NIN générable — format opérationnel confirmé",
    },
    {
      label: "Cartes remises",
      value: k?.cards_delivered ?? data.cards.delivered,
      href: drill.cards,
    },
    {
      label: "Cartes en attente",
      value: k?.cards_pending ?? data.cards.pending,
      href: drill.cards,
    },
  ];

  return (
    <div>
      {/* A. En-tête */}
      <div className="hero-banner">
        <h1>Tableau de bord national</h1>
        <p>
          Module 1 ONIP · mis à jour à {new Date(data.generated_at).toLocaleString("fr-FR")} (UTC) ·
          fraîcheur : <strong>{freshness === "current" ? "à jour" : freshness}</strong>
          {territory?.forced
            ? ` · périmètre forcé : ${territory.allowed_province || "—"}${
                territory.allowed_commune ? ` / ${territory.allowed_commune}` : ""
              }`
            : " · vue nationale"}
          {loading ? " · actualisation…" : ""}
        </p>
      </div>

      {freshness !== "current" ? (
        <div className="panel" style={{ borderLeft: "4px solid #b8860b" }}>
          <strong>Données potentiellement dégradées</strong>
          <p className="muted" style={{ marginBottom: 0 }}>
            Au moins une source est indisponible. Les widgets concernés peuvent afficher « — »
            plutôt qu&apos;un faux zéro.
          </p>
        </div>
      ) : null}

      {/* B. Filtres */}
      <form className="panel dash-filters" onSubmit={onFilterSubmit}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
          <h2 className="panel-title" style={{ margin: 0 }}>
            Filtres
          </h2>
          <button type="button" className="btn-secondary" onClick={() => setFiltersOpen((o) => !o)}>
            {filtersOpen ? "Replier" : "Déplier"}
          </button>
        </div>
        {filtersOpen ? (
          <>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "10px 0" }}>
              <button type="button" className="btn-secondary" onClick={() => applyPreset(1)}>
                Aujourd&apos;hui
              </button>
              <button type="button" className="btn-secondary" onClick={() => applyPreset(7)}>
                7 jours
              </button>
              <button type="button" className="btn-secondary" onClick={() => applyPreset(30)}>
                30 jours
              </button>
            </div>
            <div className="dash-filters-grid">
              <label>
                Du
                <input
                  type="date"
                  className="form-control"
                  value={filters.period_from || ""}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, period_from: e.target.value || undefined }))
                  }
                />
              </label>
              <label>
                Au
                <input
                  type="date"
                  className="form-control"
                  value={filters.period_to || ""}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, period_to: e.target.value || undefined }))
                  }
                />
              </label>
              <label>
                Province
                <input
                  className="form-control"
                  placeholder="ex. KIN"
                  value={filters.province_code || territory?.allowed_province || ""}
                  disabled={provinceLocked}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, province_code: e.target.value || undefined }))
                  }
                />
              </label>
              <label>
                Commune
                <input
                  className="form-control"
                  value={filters.commune_code || territory?.allowed_commune || ""}
                  disabled={Boolean(territory?.forced && territory.allowed_commune)}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, commune_code: e.target.value || undefined }))
                  }
                />
              </label>
              <label>
                Campagne
                <select
                  className="form-control"
                  value={filters.campaign_id || ""}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, campaign_id: e.target.value || undefined }))
                  }
                >
                  <option value="">Toutes</option>
                  {campaigns.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} — {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Statut dossier
                <select
                  className="form-control"
                  value={filters.citizen_status || ""}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, citizen_status: e.target.value || undefined }))
                  }
                >
                  {CITIZEN_STATUSES.map((s) => (
                    <option key={s || "all"} value={s}>
                      {s || "Tous"}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Statut carte
                <select
                  className="form-control"
                  value={filters.card_status || ""}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, card_status: e.target.value || undefined }))
                  }
                >
                  {CARD_STATUSES.map((s) => (
                    <option key={s || "all"} value={s}>
                      {s || "Tous"}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
              <button type="submit" className="btn-primary" disabled={loading}>
                Appliquer
              </button>
              <button type="button" className="btn-secondary" onClick={resetFilters}>
                Réinitialiser
              </button>
              <button type="button" className="btn-secondary" onClick={exportAggregatesCsv}>
                Export CSV agrégats
              </button>
            </div>
          </>
        ) : null}
      </form>

      {data.empty ? (
        <div className="panel">
          <p className="muted">Aucune donnée pour les filtres choisis. Modifiez ou réinitialisez.</p>
        </div>
      ) : null}

      {/* C. Ligne KPI + drill-down */}
      <div className="grid">
        {kpiCards.map((c) => (
          <KpiCard key={c.label} {...c} />
        ))}
      </div>

      <div className="grid">
        <Metric label="Campagnes actives" value={k?.campaigns_active ?? data.campaigns.active} />
        <Metric label="Dossiers en attente" value={k?.pending_records ?? data.population.pending ?? 0} />
      </div>

      {(data.population.pending_by_status || k?.pending_by_status) && (
        <div className="panel">
          <h2 className="panel-title">Ventilation dossiers en attente</h2>
          <ul>
            {Object.entries(data.population.pending_by_status || k?.pending_by_status || {}).map(
              ([st, n]) => (
                <li key={st}>
                  <strong>{st}</strong> : {fmt(n)}
                </li>
              ),
            )}
          </ul>
        </div>
      )}

      <div className="stats-charts">
        {/* D. Tendance */}
        <div className="panel chart-panel">
          <h2>Activité dans le temps (30 j.)</h2>
          {widgetErrors.trends ? (
            <p className="error">{widgetErrors.trends}</p>
          ) : trends.length === 0 ? (
            <p className="muted">Aucune série temporelle.</p>
          ) : (
            <div className="bar-chart" role="img" aria-label="Tendance dossiers reçus et validés">
              {trends.filter((_, i) => i % Math.ceil(trends.length / 14) === 0 || i === trends.length - 1).map((t) => (
                <div className="bar-row" key={t.day}>
                  <span className="bar-label">{t.day.slice(5)}</span>
                  <div className="bar-track">
                    <div
                      className="bar-fill"
                      style={{
                        width: `${Math.max(2, (t.registered / trendMax) * 100)}%`,
                        background: "#007fff",
                      }}
                      title={`Reçus ${t.registered}`}
                    />
                  </div>
                  <span className="bar-value">
                    {t.registered}/{t.validated}
                  </span>
                </div>
              ))}
            </div>
          )}
          <p className="muted small">Reçus / validés — même périmètre que les filtres.</p>
        </div>

        {/* E. Territoires */}
        <div className="panel chart-panel">
          <h2>Répartition territoriale</h2>
          {widgetErrors.territories ? (
            <p className="error">{widgetErrors.territories}</p>
          ) : zones.length === 0 ? (
            <p className="muted">Aucune zone agrégée.</p>
          ) : (
            <div className="bar-chart">
              {zones.slice(0, 12).map((z) => (
                <div className="bar-row" key={z.zone}>
                  <span className="bar-label">{z.zone}</span>
                  <div className="bar-track">
                    <div
                      className="bar-fill"
                      style={{
                        width: `${Math.max(2, (z.registered / zoneMax) * 100)}%`,
                        background: "#0f6b45",
                      }}
                    />
                  </div>
                  <span className="bar-value">{fmt(z.registered)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* F + G CIN / campagnes */}
      <div className="stats-charts">
        <div className="panel chart-panel">
          <h2>État CIN (stock)</h2>
          <ul className="chart-legend">
            <li>Produites : {fmt(data.cards.produced)}</li>
            <li>Actives : {fmt(data.cards.active)}</li>
            <li>En attente : {fmt(data.cards.pending)}</li>
            <li>Remises : {fmt(data.cards.delivered)}</li>
            <li>Expirées : {fmt(data.cards.expired)}</li>
          </ul>
          <p className="muted small">
            Produite ≠ remise. Expirée distincte de révoquée/remplacée.
          </p>
          <Link className="btn-secondary" to={drill.cards || "/cards"}>
            Suivi CIN
          </Link>
        </div>
        <div className="panel chart-panel">
          <h2>Campagnes &amp; synchronisation</h2>
          <ul className="chart-legend">
            <li>
              Actives : {fmt(data.campaigns.active)} / {fmt(data.campaigns.total)}
            </li>
            <li>
              Fiches : {fmt(data.campaigns.records_synced)} sync / {fmt(data.campaigns.records_total)}
            </li>
            <li>Taux sync : {fmtRate(data.campaigns.sync_rate_percent)}</li>
            <li>Échecs / partiels : {fmt(data.campaigns.sync_failures)}</li>
            <li>Promues FGP : {fmt(data.campaigns.records_promoted)}</li>
          </ul>
          <Link className="btn-secondary" to={drill.campaigns || "/campaigns"}>
            Campagnes
          </Link>
        </div>
      </div>

      {/* H. Alertes */}
      <div className="panel">
        <h2>Centre d&apos;alertes</h2>
        {data.alerts ? (
          <p className="muted small">
            Critique {data.alerts.critical ?? 0} · Élevé {data.alerts.high ?? 0} · Moyen{" "}
            {data.alerts.medium ?? 0} · Faible {data.alerts.low ?? 0}
          </p>
        ) : null}
        {data.anomalies.length === 0 ? (
          <p className="muted">Aucune alerte ouverte.</p>
        ) : (
          <ul>
            {data.anomalies.map((a) => (
              <li key={a.id || a.code}>
                <strong>{a.code}</strong> [{a.severity}] — {a.message} ({a.count}){" "}
                {a.link ? (
                  <Link to={a.link}>ouvrir</Link>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        <p className="muted small">Pas de fusion automatique depuis une alerte doublon.</p>
      </div>

      {/* I. Santé technique */}
      <div className="panel">
        <h2>Santé technique</h2>
        {widgetErrors.health ? <p className="error">{widgetErrors.health}</p> : null}
        {health.length === 0 ? (
          <p className="muted">Sondes non disponibles.</p>
        ) : (
          <ul>
            {health.map((s) => (
              <li key={s.service}>
                <strong>{s.service}</strong> :{" "}
                {s.state === "operational" ? "opérationnel" : "inconnu / non surveillé"}
                <span className="muted small"> · {new Date(s.checked_at).toLocaleString("fr-FR")}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function fmtRate(n: number | null | undefined): string {
  if (n == null) return "N/A";
  return `${n.toLocaleString("fr-FR")} %`;
}

function Metric({ label, value }: { label: string; value: number | null | undefined }) {
  return (
    <div className="metric">
      <div className="label">{label}</div>
      <div className="value">{fmt(value)}</div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  href,
  hint,
}: {
  label: string;
  value: number | null | undefined;
  href?: string;
  hint?: string;
}) {
  const inner = (
    <>
      <div className="label">{label}</div>
      <div className="value">{fmt(value)}</div>
      {hint ? <p className="muted small" style={{ margin: "6px 0 0" }}>{hint}</p> : null}
    </>
  );
  if (href) {
    return (
      <Link to={href} className="metric" style={{ textDecoration: "none", color: "inherit" }}>
        {inner}
      </Link>
    );
  }
  return <div className="metric">{inner}</div>;
}
