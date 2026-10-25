import { FormEvent, useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { registryApi, type CitizenHit } from "../api";
import { getSession } from "../auth";

/** Recherche autorisée dans le référentiel FGP / core registry. */
export default function PopulationFgpPage() {
  const hasToken = Boolean(getSession()?.accessToken);
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<CitizenHit[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<(CitizenHit & { nic?: string | null }) | null>(null);

  const load = useCallback(
    async (query?: string) => {
      if (!hasToken) return;
      setLoading(true);
      setError(null);
      try {
        const res = await registryApi.searchCitizens(query?.trim() || undefined);
        setRows(res.items);
        setTotal(res.total);
      } catch (e) {
        setRows([]);
        setTotal(0);
        setError(e instanceof Error ? e.message : "Recherche impossible");
      } finally {
        setLoading(false);
      }
    },
    [hasToken],
  );

  useEffect(() => {
    void load();
  }, [load]);

  async function openDetail(id: string) {
    setError(null);
    try {
      const c = await registryApi.getCitizen(id);
      setSelected(c);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Dossier inaccessible");
    }
  }

  return (
    <div>
      <div className="hero-banner">
        <h1>Population / FGP</h1>
        <p>
          Consultation du référentiel central (core registry). Attribution NIN :{" "}
          <Link to="/conformite">conformité</Link> ·{" "}
          <Link to="/campaigns">campagnes</Link>.
        </p>
      </div>

      {!hasToken ? (
        <div className="panel muted">Connexion requise.</div>
      ) : (
        <>
          <form
            className="panel"
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              void load(q);
            }}
            style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
          >
            <input
              className="form-control"
              style={{ flex: "1 1 240px" }}
              placeholder="Nom, prénom, NIC…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? "…" : "Rechercher"}
            </button>
          </form>
          {error ? <div className="login-error">{error}</div> : null}
          <div className="panel">
            <p className="muted small">{total} dossier(s)</p>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Sexe</th>
                  <th>Naissance</th>
                  <th>Statut</th>
                  <th>NIC</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="muted">
                      Aucun résultat.
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => (
                    <tr key={r.id}>
                      <td>
                        {[r.family_name, r.given_names].filter(Boolean).join(" ")}
                      </td>
                      <td>{r.sex || "—"}</td>
                      <td>{r.date_of_birth || "—"}</td>
                      <td>{r.status || "—"}</td>
                      <td>
                        <code>{r.nic || "—"}</code>
                      </td>
                      <td>
                        <button type="button" className="btn-secondary btn-sm" onClick={() => void openDetail(r.id)}>
                          Ouvrir
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {selected ? (
            <div className="panel">
              <h2 className="panel-title">Dossier</h2>
              <p>
                <strong>
                  {[selected.family_name, selected.given_names].filter(Boolean).join(" ")}
                </strong>
              </p>
              <ul className="muted">
                <li>ID interne : {selected.id}</li>
                <li>Statut : {selected.status}</li>
                <li>NIC : {selected.nic || "non attribué"}</li>
                <li>Sexe : {selected.sex}</li>
                <li>Naissance : {selected.date_of_birth}</li>
              </ul>
              <button type="button" className="btn-secondary btn-sm" onClick={() => setSelected(null)}>
                Fermer
              </button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
