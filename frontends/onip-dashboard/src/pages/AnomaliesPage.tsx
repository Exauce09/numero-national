import { useEffect, useState } from "react";

const API = import.meta.env.VITE_API_BASE ?? "/api/v1";

export default function AnomaliesPage() {
  const [items, setItems] = useState<Array<{ code: string; message: string; count: number }>>([]);

  useEffect(() => {
    fetch(`${API}/onip/dashboard`)
      .then((r) => r.json())
      .then((d) => setItems(d.anomalies ?? []))
      .catch(() => setItems([]));
  }, []);

  return (
    <div>
      <h1>Anomalies</h1>
      <div className="panel">
        {items.length === 0 ? (
          <p className="muted">Aucune anomalie ou API indisponible.</p>
        ) : (
          <ul>
            {items.map((a) => (
              <li key={a.code}>
                {a.code}: {a.message} ({a.count})
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
