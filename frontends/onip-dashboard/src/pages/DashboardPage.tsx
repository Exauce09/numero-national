import { useEffect, useState } from "react";

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

  useEffect(() => {
    fetch(`${API}/onip/dashboard`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(String(e)));
  }, []);

  if (error) {
    return (
      <div>
        <h1>Vue nationale</h1>
        <p className="error">Impossible de charger le tableau de bord ({error}).</p>
        <p className="muted">Vérifiez que l’API tourne sur :8000 et le proxy Vite.</p>
      </div>
    );
  }

  if (!data) return <p className="muted">Chargement…</p>;

  return (
    <div>
      <h1>Vue nationale</h1>
      <p className="muted">Généré : {new Date(data.generated_at).toLocaleString()}</p>
      <div className="grid">
        <Metric label="Population totale" value={data.population.total} />
        <Metric label="Actifs" value={data.population.active} />
        <Metric label="Couverture %" value={data.population.coverage_percent} />
        <Metric label="Campagnes actives" value={data.campaigns.active} />
        <Metric label="Doublons ouverts" value={data.duplicates_open} />
        <Metric label="Cartes actives" value={data.cards.active} />
      </div>
      <div className="panel">
        <h2>Anomalies</h2>
        <ul>
          {data.anomalies.map((a) => (
            <li key={a.code}>
              <strong>{a.code}</strong> [{a.severity}] — {a.message} ({a.count})
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="metric">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
    </div>
  );
}
