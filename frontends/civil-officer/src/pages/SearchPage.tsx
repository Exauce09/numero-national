import { FormEvent, useState } from "react";
import { api, type PopulationHit } from "../api";

export default function SearchPage() {
  const [q, setQ] = useState("");
  const [family, setFamily] = useState("");
  const [given, setGiven] = useState("");
  const [commune, setCommune] = useState("");
  const [hits, setHits] = useState<PopulationHit[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (family) params.set("family_name", family);
      if (given) params.set("given_names", given);
      if (commune) params.set("commune_code", commune);
      const data = await api.searchPopulation(params);
      setHits(data);
    } catch (err) {
      setHits([]);
      setError(
        err instanceof Error
          ? `${err.message} — connectez l'API ou utilisez la saisie d'actes en mode démo.`
          : "Recherche impossible."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h2 className="page-title">Recherche population</h2>
      <p className="page-lead">Recherche dans le registre / références citoyens (périmètre officier).</p>
      <div className="panel">
        <form className="form-grid" onSubmit={onSubmit}>
          <div>
            <label className="form-label">Recherche libre</label>
            <input className="form-control" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div>
            <label className="form-label">Nom de famille</label>
            <input className="form-control" value={family} onChange={(e) => setFamily(e.target.value)} />
          </div>
          <div>
            <label className="form-label">Prénoms</label>
            <input className="form-control" value={given} onChange={(e) => setGiven(e.target.value)} />
          </div>
          <div>
            <label className="form-label">Code commune</label>
            <input className="form-control" value={commune} onChange={(e) => setCommune(e.target.value)} />
          </div>
          <div className="full">
            <button className="btn-primary" style={{ width: "auto", minWidth: 180 }} disabled={busy}>
              {busy ? "Recherche…" : "Rechercher"}
            </button>
          </div>
        </form>
        {error ? <div className="login-error" style={{ marginTop: "1rem" }}>{error}</div> : null}
        {hits.length > 0 ? (
          <table className="data-table" style={{ marginTop: "1rem" }}>
            <thead>
              <tr>
                <th>NIC</th>
                <th>Nom</th>
                <th>Prénoms</th>
                <th>Naissance</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {hits.map((h, i) => (
                <tr key={h.citizen_id ?? String(i)}>
                  <td>{h.nic ?? "—"}</td>
                  <td>{h.family_name ?? "—"}</td>
                  <td>{h.given_names ?? "—"}</td>
                  <td>{h.date_of_birth ?? "—"}</td>
                  <td>{h.status ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </div>
    </div>
  );
}
