import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getSession } from "../auth";

type Dashboard = {
  generated_at: string;
  population: { total: number; active: number; coverage_percent: number };
  campaigns: { total: number; active: number };
  duplicates_open: number;
  cards: { active: number; pending: number };
  anomalies: Array<{ code: string; severity: string; count: number; message: string }>;
};

const API = import.meta.env.VITE_API_BASE ?? "/api/v1";

export default function DashboardPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const session = getSession();

  useEffect(() => {
    const headers: HeadersInit = {};
    if (session?.accessToken) headers.Authorization = `Bearer ${session.accessToken}`;
    fetch(`${API}/onip/dashboard`, { headers })
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(String(e)));
  }, [session?.accessToken]);

  if (error) {
    return (
      <div>
        <div className="hero-banner">
          <h1>Vue nationale ONIP</h1>
          <p>Pilotage identité · recensement · cartes — République Démocratique du Congo</p>
        </div>
        <p className="error">Impossible de charger le tableau de bord ({error}).</p>
      </div>
    );
  }

  if (!data) return <p className="muted">Chargement…</p>;

  const popMax = Math.max(data.population.total, 1);
  const cardTotal = Math.max(data.cards.active + data.cards.pending, 1);
  const bars = [
    { label: "Population", value: data.population.total, color: "#007fff" },
    { label: "Actifs", value: data.population.active, color: "#0f6b45" },
    { label: "Campagnes", value: data.campaigns.active, color: "#f7d618" },
    { label: "Doublons", value: data.duplicates_open, color: "#ce1126" },
    { label: "Cartes actives", value: data.cards.active, color: "#005bb5" },
    { label: "Cartes en attente", value: data.cards.pending, color: "#b8860b" },
  ];
  const barMax = Math.max(...bars.map((b) => b.value), 1);

  return (
    <div>
      <div className="hero-banner">
        <h1>Vue nationale</h1>
        <p>
          Pilotage de l&apos;identité et de la population — données au{" "}
          {new Date(data.generated_at).toLocaleString("fr-FR")}
        </p>
      </div>

      <div className="grid">
        <Metric label="Population totale" value={data.population.total} />
        <Metric label="Citoyens actifs" value={data.population.active} />
        <Metric label="Couverture %" value={data.population.coverage_percent} />
        <Metric label="Campagnes actives" value={data.campaigns.active} />
        <Metric label="Doublons ouverts" value={data.duplicates_open} />
        <Metric label="Cartes actives" value={data.cards.active} />
      </div>

      <div className="stats-charts">
        <div className="panel chart-panel">
          <h2>Indicateurs (graphique)</h2>
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
          <h2>Répartition</h2>
          <div className="donut-wrap">
            <svg viewBox="0 0 120 120" className="donut" aria-label="Répartition population et cartes">
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
                strokeDasharray={`${(data.cards.active / cardTotal) * 163} 163`}
                strokeLinecap="round"
                transform="rotate(-90 60 60)"
              />
              <text x="60" y="58" textAnchor="middle" className="donut-center">
                {data.population.coverage_percent}%
              </text>
              <text x="60" y="72" textAnchor="middle" className="donut-sub">
                couverture
              </text>
            </svg>
            <ul className="chart-legend">
              <li>
                <span className="swatch" style={{ background: "#007fff" }} /> Citoyens actifs / total
              </li>
              <li>
                <span className="swatch" style={{ background: "#ce1126" }} /> Cartes actives / file
              </li>
              <li>
                <span className="swatch" style={{ background: "#f7d618" }} /> Campagnes :{" "}
                {data.campaigns.active}/{data.campaigns.total}
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div className="panel" style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <strong>Parcours</strong>
        <Link className="btn-primary" to="/accounts">
          Comptes agents
        </Link>
        <Link className="btn-secondary" to="/campaigns">
          Campagnes
        </Link>
        <Link className="btn-secondary" to="/cards">
          Cartes d&apos;identité
        </Link>
        <Link className="btn-secondary" to="/anomalies">
          Anomalies
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
