import { useEffect, useState } from "react";
import { api, type AggregateMetric } from "../../api";

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="metric">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
    </div>
  );
}

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<AggregateMetric[]>([]);
  const [generated, setGenerated] = useState("");

  useEffect(() => {
    void api.gov("presidency", "overview").then((g) => {
      setMetrics((g.metrics as AggregateMetric[] | undefined) ?? []);
      setGenerated(String(g.generated_at ?? new Date().toISOString()));
    });
  }, []);

  const pick = (key: string) => metrics.find((m) => m.metric_key === key)?.value;

  return (
    <div>
      <h2 className="page-title">Tableau de bord stratégique</h2>
      <p className="page-lead">
        KPI Présidence (gov/presidency/overview). Généré :{" "}
        {generated ? new Date(generated).toLocaleString("fr-FR") : "…"}
      </p>
      <div className="grid">
        <Metric
          label="Population"
          value={Number(pick("population.total") ?? 0).toLocaleString("fr-FR")}
        />
        <Metric
          label="Naissances"
          value={Number(pick("civil.births") ?? pick("civil.acts.total") ?? 0).toLocaleString("fr-FR")}
        />
        <Metric
          label="Cartes actives"
          value={Number(pick("cards.active") ?? 0).toLocaleString("fr-FR")}
        />
        <Metric
          label="Doublons ouverts"
          value={Number(pick("duplicates.open") ?? 0).toLocaleString("fr-FR")}
        />
      </div>
      <div className="panel" style={{ marginTop: "1.25rem" }}>
        <h3 style={{ marginTop: 0 }}>Tous les indicateurs</h3>
        <table className="data-table">
          <thead>
            <tr>
              <th>Clé</th>
              <th>Période</th>
              <th>Valeur</th>
            </tr>
          </thead>
          <tbody>
            {metrics.map((m) => (
              <tr key={m.metric_key}>
                <td>{m.metric_key}</td>
                <td>{m.period ?? "—"}</td>
                <td>{Number(m.value).toLocaleString("fr-FR")}</td>
              </tr>
            ))}
            {!metrics.length ? (
              <tr>
                <td colSpan={3} className="muted">
                  Chargement / aucune donnée.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
