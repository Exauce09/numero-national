import { FormEvent, useEffect, useState } from "react";
import { api, type Declaration } from "../../api";

export default function CivilSupervisionPage() {
  const [decls, setDecls] = useState<Declaration[]>([]);
  const [commune, setCommune] = useState("KIN-GOMBE");
  const [stats, setStats] = useState<{
    commune_code: string;
    counts: Record<string, number>;
    total: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api.civilDeclarations().then(setDecls);
  }, []);

  async function loadStats(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      setStats(await api.civilStats(commune.trim()));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur statistiques");
    }
  }

  return (
    <div>
      <h2 className="page-title">Supervision état civil</h2>
      <p className="page-lead">Déclarations en attente et statistiques par commune.</p>

      <div className="panel" style={{ marginBottom: "1.25rem" }}>
        <h3 style={{ marginTop: 0 }}>Statistiques commune</h3>
        <form className="toolbar" onSubmit={loadStats}>
          <div className="form-control" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="commune">
              Code commune
            </label>
            <input
              id="commune"
              className="form-control"
              value={commune}
              onChange={(ev) => setCommune(ev.target.value)}
            />
          </div>
          <button type="submit" className="btn-primary" style={{ width: "auto" }}>
            Charger
          </button>
        </form>
        {error ? <div className="login-error">{error}</div> : null}
        {stats ? (
          <div className="grid" style={{ marginTop: "1rem" }}>
            {Object.entries(stats.counts).map(([k, v]) => (
              <div className="metric" key={k}>
                <div className="label">{k}</div>
                <div className="value">{v}</div>
              </div>
            ))}
            <div className="metric">
              <div className="label">Total</div>
              <div className="value">{stats.total}</div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="panel">
        <h3 style={{ marginTop: 0 }}>Déclarations en attente</h3>
        <table className="data-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Source</th>
              <th>Statut</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {decls.map((d) => (
              <tr key={d.id}>
                <td>{d.declaration_type}</td>
                <td>{d.source}</td>
                <td>{d.status}</td>
                <td>{new Date(d.created_at).toLocaleString("fr-FR")}</td>
              </tr>
            ))}
            {!decls.length ? (
              <tr>
                <td colSpan={4} className="muted">
                  Aucune déclaration en attente.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
