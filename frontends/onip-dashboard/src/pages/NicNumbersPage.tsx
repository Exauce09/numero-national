import { FormEvent, useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { registryApi, type CitizenHit } from "../api";
import { getSession } from "../auth";

/**
 * Liste / recherche des numéros nationaux (NIC) déjà attribués.
 * Distinct de « Campagnes → Contrôle » (fiches avant promotion).
 */
export default function NicNumbersPage() {
  const hasToken = Boolean(getSession()?.accessToken);
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<CitizenHit[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (query?: string) => {
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
      setError(e instanceof Error ? e.message : "Impossible de charger les NIC");
    } finally {
      setLoading(false);
    }
  }, [hasToken]);

  useEffect(() => {
    void load();
  }, [load]);

  function onSearch(e: FormEvent) {
    e.preventDefault();
    void load(q);
  }

  return (
    <div>
      <div className="hero-banner">
        <h1>Numéros nationaux (NIC)</h1>
        <p>
          Ici = citoyens déjà dans le registre avec leur NIC. Pour valider une fiche et attribuer un
          numéro : menu <Link to="/campaigns">Recensement → Campagnes</Link> → onglet « Contrôle
          fiches » → filtre <strong>Promues</strong> ou bouton « Promouvoir NIC ».
        </p>
      </div>

      {!hasToken ? (
        <div className="panel">
          <p className="muted">Connectez-vous pour consulter le registre.</p>
        </div>
      ) : (
        <>
          <div className="panel guide-steps">
            <div className="guide-step">
              <span className="guide-n">1</span>
              <div>
                <strong>Comptes</strong>
                <p className="muted">Créer les agents (téléphone)</p>
              </div>
            </div>
            <div className="guide-step">
              <span className="guide-n">2</span>
              <div>
                <strong>Campagnes</strong>
                <p className="muted">Zones, sync, approuver</p>
              </div>
            </div>
            <div className="guide-step guide-step-active">
              <span className="guide-n">3</span>
              <div>
                <strong>Numéros NIC</strong>
                <p className="muted">Consulter les numéros attribués</p>
              </div>
            </div>
          </div>

          <form className="panel" onSubmit={onSearch} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input
              className="form-control"
              style={{ flex: "1 1 220px" }}
              placeholder="Rechercher nom, prénom ou NIC…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? "…" : "Rechercher"}
            </button>
            <button type="button" className="btn-secondary" disabled={loading} onClick={() => { setQ(""); void load(); }}>
              Tout lister
            </button>
          </form>

          {error ? <div className="login-error" style={{ marginBottom: 12 }}>{error}</div> : null}

          <div className="panel">
            <h2 style={{ marginTop: 0 }}>
              Résultats <span className="muted" style={{ fontWeight: 600 }}>({total})</span>
            </h2>
            <table className="data-table">
              <thead>
                <tr>
                  <th>NIC</th>
                  <th>Nom</th>
                  <th>Prénom</th>
                  <th>Naissance</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <code className="nic-code">{c.nic || "— (pas encore)"}</code>
                    </td>
                    <td>{c.family_name}</td>
                    <td>{c.given_names}</td>
                    <td>{c.date_of_birth}</td>
                    <td>{c.status}</td>
                  </tr>
                ))}
                {!rows.length ? (
                  <tr>
                    <td colSpan={5} className="muted">
                      Aucun citoyen trouvé. Promouvez d’abord une fiche depuis Campagnes → Contrôle.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
