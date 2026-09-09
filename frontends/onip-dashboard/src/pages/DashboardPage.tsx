import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getSession, isLocalSession } from "../auth";

type Dashboard = {
  generated_at: string;
  population: { total: number; active: number; coverage_percent: number };
  campaigns: { total: number; active: number };
  duplicates_open: number;
  cards: { active: number; pending: number };
  anomalies: Array<{ code: string; severity: string; count: number; message: string }>;
};

const API = import.meta.env.VITE_API_BASE ?? "/api/v1";

function demoDashboard(): Dashboard {
  return {
    generated_at: new Date().toISOString(),
    population: { total: 2_900_000, active: 2_640_000, coverage_percent: 91.2 },
    campaigns: { total: 4, active: 2 },
    duplicates_open: 128,
    cards: { active: 1_240_000, pending: 18_400 },
    anomalies: [
      {
        code: "DUP_BATCH",
        severity: "warning",
        count: 42,
        message: "Doublons potentiels en attente de revue (mode démo)",
      },
      {
        code: "CARD_PENDING",
        severity: "info",
        count: 18400,
        message: "Cartes en file de production (agrégat démo)",
      },
    ],
  };
}

export default function DashboardPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [localMode, setLocalMode] = useState(false);
  const session = getSession();

  useEffect(() => {
    if (isLocalSession() || !session?.accessToken) {
      setLocalMode(true);
      setData(demoDashboard());
      setError(null);
      return;
    }

    const headers: HeadersInit = {
      Authorization: `Bearer ${session.accessToken}`,
    };
    fetch(`${API}/onip/dashboard`, { headers })
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<Dashboard>;
      })
      .then((d) => {
        setLocalMode(false);
        setData(d);
        setError(null);
      })
      .catch(() => {
        setLocalMode(true);
        setData(demoDashboard());
        setError(null);
      });
  }, [session?.accessToken]);

  if (error) {
    return (
      <div>
        <div className="hero-banner">
          <h1>Vue nationale ONIP</h1>
          <p>Pilotage identité · recensement · cartes — République Démocratique du Congo</p>
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
          Pilotage de l&apos;identité et de la population — données au{" "}
          {new Date(data.generated_at).toLocaleString("fr-FR")}
        </p>
      </div>

      {localMode ? (
        <div className="panel" style={{ borderLeft: "4px solid #8a4b1a", marginBottom: "1rem" }}>
          <strong>Mode démo local</strong>
          <p className="muted" style={{ margin: "0.35rem 0 0" }}>
            API (:8000) indisponible ou session sans JWT — affichage d&apos;agrégats de démonstration. Les actions
            Campagnes / Comptes nécessitent l&apos;API démarrée et un compte seedé.
          </p>
        </div>
      ) : null}

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
