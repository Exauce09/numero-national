import { FormEvent, useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  censusApi,
  fetchOnipDashboard,
  type Campaign,
  type OnipDashboard,
  type OnipDashboardFilters,
} from "../api";
import { getSession, hasPermission } from "../auth";

const CITIZEN_STATUSES = ["", "DRAFT", "PENDING_VALIDATION", "ACTIVE", "DECEASED", "SUSPENDED"];
const CARD_STATUSES = ["", "PENDING", "SENT_TO_COMMUNE", "ACTIVE", "DELIVERED"];

export default function DashboardPage() {
  const session = getSession();
  const [data, setData] = useState<OnipDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [filters, setFilters] = useState<OnipDashboardFilters>({});

  const load = useCallback(
    async (f: OnipDashboardFilters = filters) => {
      if (!session?.accessToken) {
        setError("Connexion requise (permission onip:dashboard).");
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const dash = await fetchOnipDashboard(f);
        setData(dash);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- charge initiale
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

  function exportAggregatesCsv() {
    if (!data) return;
    const rows: string[][] = [
      ["indicateur", "valeur"],
      ["generated_at", data.generated_at],
      ["population_total", String(data.population.total)],
      ["population_active", String(data.population.active)],
      ["population_pending", String(data.population.pending ?? 0)],
      ["nin_assigned", String(data.population.nin_assigned ?? 0)],
      ["coverage_percent", String(data.population.coverage_percent)],
      ["campaigns_active", String(data.campaigns.active)],
      ["sync_rate_percent", String(data.campaigns.sync_rate_percent ?? 0)],
      ["duplicates_open", String(data.duplicates_open)],
      ["biometric_reviews", String(data.biometric_reviews_pending ?? 0)],
      ["cards_produced", String(data.cards.produced ?? 0)],
      ["cards_active", String(data.cards.active)],
      ["cards_pending", String(data.cards.pending)],
      ["cards_delivered", String(data.cards.delivered ?? 0)],
    ];
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `onip-dashboard-aggregates-${data.generated_at.slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  if (error && !data) {
    return (
      <div>
        <div className="hero-banner">
          <h1>Tableau de bord national</h1>
          <p>Module 1 — pilotage identité · recensement · cartes</p>
        </div>
        <p className="error">Impossible de charger le tableau de bord ({error}).</p>
      </div>
    );
  }

  if (!data && loading) return <p className="muted">Chargement…</p>;
  if (!data) return <p className="muted">Chargement…</p>;

  const popMax = Math.max(data.population.total, 1);
  const cardTotal = Math.max(
    (data.cards.active || 0) + (data.cards.pending || 0) + (data.cards.delivered || 0),
    1,
  );
  const bars = [
    { label: "Dossiers", value: data.population.total, color: "#007fff" },
    { label: "Validés", value: data.population.active, color: "#0f6b45" },
    { label: "NIC/NIN", value: data.population.nin_assigned ?? 0, color: "#005bb5" },
    { label: "En attente", value: data.population.pending ?? 0, color: "#b8860b" },
    { label: "Doublons", value: data.duplicates_open, color: "#ce1126" },
    { label: "Cartes produites", value: data.cards.produced ?? 0, color: "#4a6fa5" },
    { label: "Cartes remises", value: data.cards.delivered ?? 0, color: "#2e8b57" },
  ];
  const barMax = Math.max(...bars.map((b) => b.value), 1);

  return (
    <div>
      <div className="hero-banner">
        <h1>Tableau de bord national</h1>
        <p>
          Module 1 — vue consolidée · données au{" "}
          {new Date(data.generated_at).toLocaleString("fr-FR")}
          {loading ? " · actualisation…" : ""}
        </p>
      </div>

      <form className="panel dash-filters" onSubmit={onFilterSubmit}>
        <h2 className="panel-title" style={{ marginTop: 0 }}>
          Filtres
        </h2>
        <div className="dash-filters-grid">
          <label>
            Du
            <input
              type="date"
              className="form-control"
              value={filters.period_from || ""}
              onChange={(e) => setFilters((f) => ({ ...f, period_from: e.target.value || undefined }))}
            />
          </label>
          <label>
            Au
            <input
              type="date"
              className="form-control"
              value={filters.period_to || ""}
              onChange={(e) => setFilters((f) => ({ ...f, period_to: e.target.value || undefined }))}
            />
          </label>
          <label>
            Province
            <input
              className="form-control"
              placeholder="ex. KIN"
              value={filters.province_code || ""}
              onChange={(e) =>
                setFilters((f) => ({ ...f, province_code: e.target.value || undefined }))
              }
            />
          </label>
          <label>
            Commune
            <input
              className="form-control"
              placeholder="code commune"
              value={filters.commune_code || ""}
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
          <button type="button" className="btn-secondary" onClick={resetFilters} disabled={loading}>
            Réinitialiser
          </button>
          <button type="button" className="btn-secondary" onClick={exportAggregatesCsv}>
            Export CSV (agrégats)
          </button>
        </div>
        <p className="muted small" style={{ marginBottom: 0, marginTop: 8 }}>
          Export contrôlé : indicateurs agrégés uniquement — aucune donnée personnelle.
        </p>
      </form>

      {data.empty ? (
        <div className="panel">
          <p className="muted">
            Aucune donnée pour ces filtres. Vérifiez les migrations / campagnes ou élargissez la
            période.
          </p>
        </div>
      ) : null}

      <div className="grid">
        <Metric label="Dossiers enregistrés" value={data.population.total} />
        <Metric label="Dossiers validés" value={data.population.active} />
        <Metric label="Dossiers en attente" value={data.population.pending ?? 0} />
        <Metric label="NIC / NIN attribués" value={data.population.nin_assigned ?? 0} />
        <Metric label="Couverture validés %" value={data.population.coverage_percent} />
        <Metric label="Couverture NIC %" value={data.population.nin_coverage_percent ?? 0} />
        <Metric label="Campagnes actives" value={data.campaigns.active} />
        <Metric label="Taux sync %" value={data.campaigns.sync_rate_percent ?? 0} />
        <Metric label="Doublons ouverts" value={data.duplicates_open} />
        <Metric label="Revues biométrie" value={data.biometric_reviews_pending ?? 0} />
        <Metric label="Cartes produites" value={data.cards.produced ?? 0} />
        <Metric label="Cartes remises" value={data.cards.delivered ?? 0} />
      </div>

      <div className="stats-charts">
        <div className="panel chart-panel">
          <h2>Indicateurs</h2>
          <div className="bar-chart" role="img" aria-label="Graphique en barres des indicateurs">
            {bars.map((b) => (
              <div className="bar-row" key={b.label}>
                <span className="bar-label">{b.label}</span>
                <div className="bar-track">
                  <div
                    className="bar-fill"
                    style={{
                      width: `${Math.max(4, (b.value / barMax) * 100)}%`,
                      background: b.color,
                    }}
                  />
                </div>
                <span className="bar-value">{b.value.toLocaleString("fr-FR")}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="panel chart-panel">
          <h2>Répartition &amp; services</h2>
          <div className="donut-wrap">
            <svg viewBox="0 0 120 120" className="donut" aria-label="Couverture dossiers validés">
              <circle cx="60" cy="60" r="42" fill="none" stroke="#e6ebf2" strokeWidth="16" />
              <circle
                cx="60"
                cy="60"
                r="42"
                fill="none"
                stroke="#007fff"
                strokeWidth="16"
                strokeDasharray={`${(data.population.active / popMax) * 264} 264`}
                strokeLinecap="round"
                transform="rotate(-90 60 60)"
              />
              <circle
                cx="60"
                cy="60"
                r="26"
                fill="none"
                stroke="#ce1126"
                strokeWidth="10"
                strokeDasharray={`${((data.cards.active || 0) / cardTotal) * 163} 163`}
                strokeLinecap="round"
                transform="rotate(-90 60 60)"
              />
              <text x="60" y="58" textAnchor="middle" className="donut-center">
                {data.population.coverage_percent}%
              </text>
              <text x="60" y="72" textAnchor="middle" className="donut-sub">
                validés
              </text>
            </svg>
            <ul className="chart-legend">
              <li>
                <span className="swatch" style={{ background: "#007fff" }} /> Validés / enregistrés
              </li>
              <li>
                <span className="swatch" style={{ background: "#ce1126" }} /> Cartes actives / file
              </li>
              <li>
                Sync campagne : {data.campaigns.sync_rate_percent ?? 0}% (
                {data.campaigns.records_synced ?? 0}/{data.campaigns.records_total ?? 0})
              </li>
              <li>
                API : {data.services?.api ?? "—"} · sync pending :{" "}
                {data.services?.sync_batches_pending ?? 0}
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div className="panel" style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <strong>Parcours</strong>
        {hasPermission("users:manage", session) ? (
          <Link className="btn-secondary" to="/accounts">
            Comptes agents
          </Link>
        ) : null}
        <Link className="btn-primary" to="/campaigns">
          Campagnes &amp; contrôle
        </Link>
        <Link className="btn-secondary" to="/population">
          Population / FGP
        </Link>
        <Link className="btn-secondary" to="/nic">
          NIC / NIN
        </Link>
        <Link className="btn-secondary" to="/biometrie">
          Biométrie
        </Link>
        <Link className="btn-secondary" to="/cards">
          Cartes
        </Link>
        <Link className="btn-secondary" to="/anomalies">
          Anomalies
        </Link>
        <Link className="btn-secondary" to="/admin">
          Services
        </Link>
      </div>

      <div className="panel">
        <h2>Anomalies</h2>
        {data.anomalies.length === 0 ? (
          <p className="muted">Aucune anomalie signalée.</p>
        ) : (
          <ul>
            {data.anomalies.map((a) => (
              <li key={a.code}>
                <strong>{a.code}</strong> [{a.severity}] — {a.message} ({a.count})
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="metric">
      <div className="label">{label}</div>
      <div className="value">{value.toLocaleString("fr-FR")}</div>
    </div>
  );
}
