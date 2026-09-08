import { useEffect, useState } from "react";

const API = import.meta.env.VITE_API_BASE ?? "/api/v1";

type Metric = {
  metric_key: string;
  value: number;
  period: string;
};

export default function MinistryStatsPortal() {
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API}/gov/ministry/overview`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => setMetrics(d.metrics ?? []))
      .catch((e) => setError(String(e)));
  }, []);

  return (
    <div>
      <h1>Ministère — statistiques</h1>
      <p className="muted">
        Données issues de <code>analytics.aggregate_metrics</code> uniquement (aucune
        requête PII citoyen).
      </p>
      {error && <p className="muted">API: {error} — lancez POST /analytics/refresh.</p>}
      <div className="panel">
        {metrics.length === 0 ? (
          <p className="muted">Aucun agrégat. Déclencher le pipeline de refresh.</p>
        ) : (
          <ul>
            {metrics.map((m) => (
              <li key={`${m.metric_key}-${m.period}`}>
                {m.metric_key}: <strong>{m.value}</strong> ({m.period})
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
