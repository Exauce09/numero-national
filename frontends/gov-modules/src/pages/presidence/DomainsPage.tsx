import { useEffect, useState } from "react";
import { api, type AggregateMetric } from "../../api";

const DOMAINS = [
  { id: "population", label: "Population" },
  { id: "civil", label: "État civil" },
  { id: "census", label: "Recensement" },
  { id: "cards", label: "Cartes" },
  { id: "health", label: "Santé" },
  { id: "duplicates", label: "Doublons" },
] as const;

export default function DomainsPage() {
  const [domain, setDomain] = useState<(typeof DOMAINS)[number]["id"]>("population");
  const [metrics, setMetrics] = useState<AggregateMetric[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setBusy(true);
    void api
      .gov("presidency", domain)
      .then((g) => setMetrics((g.metrics as AggregateMetric[] | undefined) ?? []))
      .finally(() => setBusy(false));
  }, [domain]);

  return (
    <div>
      <h2 className="page-title">Domaines stratégiques</h2>
      <p className="page-lead">Navigation par domaine agrégé (présidence).</p>
      <div className="tab-bar">
        {DOMAINS.map((d) => (
          <button
            key={d.id}
            type="button"
            className={domain === d.id ? "active" : ""}
            onClick={() => setDomain(d.id)}
          >
            {d.label}
          </button>
        ))}
      </div>
      <div className="panel">
        {busy ? <p className="muted">Chargement…</p> : null}
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
              <tr key={`${m.metric_key}-${m.period ?? ""}`}>
                <td>{m.metric_key}</td>
                <td>{m.period ?? "—"}</td>
                <td>{Number(m.value).toLocaleString("fr-FR")}</td>
              </tr>
            ))}
            {!busy && !metrics.length ? (
              <tr>
                <td colSpan={3} className="muted">
                  Aucune métrique pour ce domaine.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
