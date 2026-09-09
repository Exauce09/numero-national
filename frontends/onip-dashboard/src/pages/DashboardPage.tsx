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
          <p>Pilotité · recensement · cartes</p>
        </div>
        <p className="error">Impossible de charger le tableau de bord ({error}).</p>
        <p className="muted">Vérifiez l’API (:8000) et une connexion JWT admin.</p>
      </div>
    );
  }

  if (!data) return <p className="muted">Chargement…</p>;

  return (
    <div>
      <div className="hero-banner">
        <h1>Vue nationale</h1>
        <p>
          Pilotage identité &amp; population — généré {new Date(data.generated_at).toLocaleString()}
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

      <div className="panel" style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <strong>Parcours</strong>
        <Link className="btn-primary" to="/accounts">
          Étape 1 — Créer les comptes
        </Link>
        <Link className="btn-secondary" to="/campaigns">
          Campagnes &amp; contrôle
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
