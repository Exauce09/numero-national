import { useEffect, useState } from "react";
import { api, type AggregateMetric, type OnipDashboard } from "../../api";

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="metric">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
    </div>
  );
}

export default function DashboardPage() {
  const [onip, setOnip] = useState<OnipDashboard | null>(null);
  const [metrics, setMetrics] = useState<AggregateMetric[]>([]);

  useEffect(() => {
    void Promise.all([api.onipDashboard(), api.gov("interior", "overview")]).then(([d, g]) => {
      setOnip(d);
      setMetrics((g.metrics as AggregateMetric[] | undefined) ?? []);
    });
  }, []);

  if (!onip) return <p className="muted">Chargement…</p>;

  return (
    <div>
      <div className="panel" style={{ marginBottom: "1rem", borderLeft: "4px solid var(--egouv-primary, #1a5f4a)" }}>
        <strong>Portail Intérieur dédié</strong>
        <p className="muted" style={{ margin: "0.35rem 0 0.65rem" }}>
          Mouvements, déplacements, documents manquants et parcours citoyen — même logique que la Présidence.
        </p>
        <a className="btn-primary btn-sm" href="http://localhost:5178/login" target="_blank" rel="noreferrer">
          Ouvrir le portail Intérieur (5178)
        </a>
      </div>
      <h2 className="page-title">Tableau de bord — Intérieur</h2>
      <p className="page-lead">
        Vue ONIP et indicateurs gouvernementaux (intérieur / overview). Généré :{" "}
        {new Date(onip.generated_at).toLocaleString("fr-FR")}
      </p>
      <div className="grid">
        <Metric label="Population totale" value={onip.population.total.toLocaleString("fr-FR")} />
        <Metric label="Population active" value={onip.population.active.toLocaleString("fr-FR")} />
        <Metric label="Couverture %" value={onip.population.coverage_percent} />
        <Metric label="Cartes actives" value={onip.cards.active.toLocaleString("fr-FR")} />
        <Metric label="Cartes en attente" value={onip.cards.pending.toLocaleString("fr-FR")} />
        <Metric label="Doublons ouverts" value={onip.duplicates_open} />
      </div>
      {metrics.length ? (
        <div className="panel" style={{ marginTop: "1.25rem" }}>
          <h3 style={{ marginTop: 0 }}>Métriques gov/interior/overview</h3>
          <table className="data-table">
            <thead>
              <tr>
                <th>Clé</th>
                <th>Valeur</th>
              </tr>
            </thead>
            <tbody>
              {metrics.map((m) => (
                <tr key={m.metric_key}>
                  <td>{m.metric_key}</td>
                  <td>{Number(m.value).toLocaleString("fr-FR")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
