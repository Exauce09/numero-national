import { FormEvent, useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ninOnipApi,
  registryApi,
  type CitizenHit,
  type NinEligibleItem,
} from "../api";
import { getSession, hasPermission } from "../auth";

/**
 * Liste NIC attribués + éligibles provisoire + historique.
 * Pas de bouton « NIN officiel » (générateur bloqué).
 */
export default function NicNumbersPage() {
  const session = getSession();
  const hasToken = Boolean(session?.accessToken);
  const canAssign = hasPermission("registry:citizen:validate", session);
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<CitizenHit[]>([]);
  const [total, setTotal] = useState(0);
  const [eligible, setEligible] = useState<NinEligibleItem[]>([]);
  const [log, setLog] = useState<
    Array<{ nic: string; citizen_id: string; issued_at?: string | null; algorithm_version: string }>
  >([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [assignMsg, setAssignMsg] = useState<string | null>(null);

  const load = useCallback(
    async (query?: string) => {
      if (!hasToken) return;
      setLoading(true);
      setError(null);
      try {
        const [res, el, hist] = await Promise.all([
          registryApi.searchCitizens(query?.trim() || undefined),
          ninOnipApi.eligible(40).catch(() => ({ items: [] as NinEligibleItem[] })),
          ninOnipApi.issuanceLog(30).catch(() => ({ items: [] })),
        ]);
        setRows(res.items);
        setTotal(res.total);
        setEligible(el.items);
        setLog(hist.items);
      } catch (e) {
        setRows([]);
        setTotal(0);
        setError(e instanceof Error ? e.message : "Impossible de charger les NIC");
      } finally {
        setLoading(false);
      }
    },
    [hasToken],
  );

  useEffect(() => {
    void load();
  }, [load]);

  function onSearch(e: FormEvent) {
    e.preventDefault();
    void load(q);
  }

  async function assignProvisional(citizenId: string) {
    setAssignMsg(null);
    try {
      const r = await ninOnipApi.assignProvisional(citizenId);
      setAssignMsg(
        r.already_assigned
          ? `Déjà attribué (idempotent) : ${r.nin}`
          : `NIC provisoire attribué : ${r.nin}`,
      );
      void load(q);
    } catch (e) {
      setAssignMsg(e instanceof Error ? e.message : "Attribution refusée");
    }
  }

  return (
    <div>
      <div className="hero-banner">
        <h1>Numéros nationaux (NIC / NIN)</h1>
        <p>
          Historique et éligibles pour attribution <strong>provisoire</strong> uniquement. Voir{" "}
          <Link to="/conformite">Conformité FGP / NIN</Link>. Aucun bouton NIN officiel.
        </p>
      </div>

      {!hasToken ? (
        <div className="panel">
          <p className="muted">Connectez-vous pour consulter le registre.</p>
        </div>
      ) : (
        <>
          {assignMsg ? (
            <div className="panel" style={{ borderLeft: "4px solid #0056b3" }}>
              {assignMsg}
            </div>
          ) : null}

          <div className="panel">
            <h2 className="panel-title">Éligibles (sans NIC)</h2>
            <p className="muted small">
              Refus automatique si dossier incomplet ou doublon OPEN. Mode officiel indisponible.
            </p>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Prénom</th>
                  <th>Statut</th>
                  <th>Doublons</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {eligible.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="muted">
                      Aucun éligible listé.
                    </td>
                  </tr>
                ) : (
                  eligible.map((c) => (
                    <tr key={c.id}>
                      <td>{c.family_name}</td>
                      <td>{c.given_names}</td>
                      <td>{c.status}</td>
                      <td>{c.open_duplicates}</td>
                      <td>
                        {canAssign && c.eligible_provisional ? (
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => void assignProvisional(c.id)}
                          >
                            NIC provisoire
                          </button>
                        ) : (
                          <span className="muted small">
                            {c.eligible_provisional ? "Droit validate requis" : "Non éligible"}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="panel">
            <h2 className="panel-title">Historique d&apos;émission</h2>
            <table className="data-table">
              <thead>
                <tr>
                  <th>NIC</th>
                  <th>Citoyen</th>
                  <th>Date</th>
                  <th>Algo</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {log.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="muted">
                      Aucune émission journalisée.
                    </td>
                  </tr>
                ) : (
                  log.map((r, i) => (
                    <tr key={`${r.nic}-${i}`}>
                      <td>
                        <code className="nic-code">{r.nic}</code>
                      </td>
                      <td>
                        <code className="small">{r.citizen_id.slice(0, 8)}…</code>
                      </td>
                      <td>{r.issued_at ? r.issued_at.slice(0, 19) : "—"}</td>
                      <td className="small">{r.algorithm_version}</td>
                      <td>PROVISIONAL</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
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
          </form>

          {error ? (
            <div className="login-error" style={{ marginBottom: 12 }}>
              {error}
            </div>
          ) : null}

          <div className="panel">
            <h2 style={{ marginTop: 0 }}>
              Registre <span className="muted" style={{ fontWeight: 600 }}>({total})</span>
            </h2>
            <table className="data-table">
              <thead>
                <tr>
                  <th>NIC</th>
                  <th>Nom</th>
                  <th>Prénom</th>
                  <th>Naissance</th>
                  <th>Statut</th>
                  <th>NIN</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <code className="nic-code">{c.nic || "—"}</code>
                    </td>
                    <td>{c.family_name}</td>
                    <td>{c.given_names}</td>
                    <td>{c.date_of_birth}</td>
                    <td>{c.status}</td>
                    <td>{c.nic ? "PROVISIONAL" : "—"}</td>
                  </tr>
                ))}
                {!rows.length ? (
                  <tr>
                    <td colSpan={6} className="muted">
                      Aucun citoyen trouvé.
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
