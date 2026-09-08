import { useEffect, useState } from "react";
import { api, type AggregateMetric } from "../../api";

export default function IndicatorsPage() {
  const [rows, setRows] = useState<AggregateMetric[]>([]);
  const [source, setSource] = useState("");

  useEffect(() => {
    void (async () => {
      const gov = await api.gov("ministry", "health");
      const metrics = (gov.metrics as AggregateMetric[] | undefined) ?? [];
      if (metrics.length) {
        setRows(metrics);
        setSource("gov/ministry/health");
        return;
      }
      const health = await api.healthStats();
      const fromHealth: AggregateMetric[] = Object.entries(health)
        .filter(([, v]) => typeof v === "number")
        .map(([k, v]) => ({ metric_key: `health.${k}`, value: v as number }));
      if (fromHealth.length) {
        setRows(fromHealth);
        setSource("health/stats/national");
        return;
      }
      setRows(await api.analyticsMetrics());
      setSource("analytics/metrics");
    })();
  }, []);

  return (
    <div>
      <h2 className="page-title">Indicateurs santé</h2>
      <p className="page-lead">
        Métriques agrégées — source : <code>{source || "…"}</code>
      </p>
      <div className="panel">
        <table className="data-table">
          <thead>
            <tr>
              <th>Clé</th>
              <th>Période</th>
              <th>Valeur</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.metric_key}-${r.period ?? ""}`}>
                <td>{r.metric_key}</td>
                <td>{r.period ?? "—"}</td>
                <td>{Number(r.value).toLocaleString("fr-FR")}</td>
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td colSpan={3} className="muted">
                  Aucun indicateur.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
