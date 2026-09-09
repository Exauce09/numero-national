import { useEffect, useState } from "react";
import { fetchOnipDashboard } from "../api";
import { getSession } from "../auth";

export default function AnomaliesPage() {
  const [items, setItems] = useState<Array<{ code: string; message: string; count: number }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        if (!getSession()?.accessToken) {
          // Dashboard endpoint is public, still try
        }
        const d = await fetchOnipDashboard();
        if (cancelled) return;
        setItems(d.anomalies ?? []);
      } catch (e) {
        if (cancelled) return;
        setItems([]);
        setError(e instanceof Error ? e.message : "Impossible de charger les anomalies");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <h1>Anomalies</h1>
      <div className="panel">
        {loading ? <p className="muted">Chargement…</p> : null}
        {error ? <div className="login-error">{error}</div> : null}
        {!loading && !error && items.length === 0 ? (
          <p className="muted">Aucune anomalie détectée.</p>
        ) : null}
        {!loading && items.length > 0 ? (
          <ul>
            {items.map((a) => (
              <li key={a.code}>
                <strong>{a.code}</strong>: {a.message} ({a.count})
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
