import { FormEvent, useEffect, useState } from "react";
import { civilOnipApi } from "../api";
import { getSession } from "../auth";

/** File d'événements état civil visibles depuis le cockpit ONIP. */
export default function EtatCivilOnipPage() {
  const hasToken = Boolean(getSession()?.accessToken);
  const [q, setQ] = useState("");
  const [acts, setActs] = useState<
    Array<{ id: string; act_type?: string; act_number?: string; status?: string; created_at?: string }>
  >([]);
  const [declarations, setDeclarations] = useState<
    Array<{ id: string; declaration_type?: string; status?: string; created_at?: string; facility_name?: string }>
  >([]);
  const [corrections, setCorrections] = useState<
    Array<{ id: string; status?: string; created_at?: string; reason?: string }>
  >([]);
  const [conflicts, setConflicts] = useState<
    Array<{ id: string; status: string; reason?: string | null; created_at?: string | null; kind: string }>
  >([]);
  const [policy, setPolicy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function refresh(query?: string) {
    if (!hasToken) return;
    setLoading(true);
    setError(null);
    try {
      const [a, d, c, conf] = await Promise.all([
        civilOnipApi.searchActs(query, 40),
        civilOnipApi.listDeclarations("PENDING_OFFICER").catch(() => civilOnipApi.listDeclarations()),
        civilOnipApi.listCorrections().catch(() => []),
        civilOnipApi.conflicts().catch(() => ({ items: [], policy: null, note: "" })),
      ]);
      setActs(a);
      setDeclarations(d);
      setCorrections(c);
      setConflicts(conf.items || []);
      setPolicy(conf.policy || null);
    } catch (e) {
      setActs([]);
      setDeclarations([]);
      setCorrections([]);
      setError(
        e instanceof Error
          ? e.message
          : "Accès civil refusé — permission civil:read / civil:validate requise",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, [hasToken]);

  return (
    <div>
      <div className="hero-banner">
        <h1>État civil → FGP</h1>
        <p>
          Événements et déclarations reçus. Mise à jour du FGP avec référence d&apos;acte, sans
          attribution automatique de NIN définitif à chaque naissance.
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
              void refresh(q);
            }}
            style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
          >
            <input
              className="form-control"
              style={{ flex: "1 1 220px" }}
              placeholder="Recherche actes…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? "…" : "Actualiser"}
            </button>
          </form>
          {error ? <div className="login-error">{error}</div> : null}

          <div className="panel" style={{ borderLeft: "4px solid #b35c00" }}>
            <h2 className="panel-title">Conflits / file résolution</h2>
            <p className="muted small">
              Politique : {policy || "no_silent_overwrite"} — pas d&apos;écrasement silencieux ; les
              événements répétés sont refusés côté API.
            </p>
            {conflicts.length === 0 ? (
              <p className="muted">Aucun conflit ouvert listé.</p>
            ) : (
              <ul>
                {conflicts.map((x) => (
                  <li key={x.id}>
                    [{x.kind}] {x.status} — {x.reason || x.id}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="panel">
            <h2 className="panel-title">Déclarations (file)</h2>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Statut</th>
                  <th>Structure</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {declarations.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="muted">
                      Aucune déclaration.
                    </td>
                  </tr>
                ) : (
                  declarations.slice(0, 30).map((d) => (
                    <tr key={d.id}>
                      <td>{d.declaration_type || "—"}</td>
                      <td>{d.status || "—"}</td>
                      <td>{d.facility_name || "—"}</td>
                      <td>{d.created_at ? new Date(d.created_at).toLocaleString("fr-CD") : "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="panel">
            <h2 className="panel-title">Actes récents</h2>
            <table className="data-table">
              <thead>
                <tr>
                  <th>N°</th>
                  <th>Type</th>
                  <th>Statut</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {acts.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="muted">
                      Aucun acte.
                    </td>
                  </tr>
                ) : (
                  acts.map((a) => (
                    <tr key={a.id}>
                      <td>
                        <code>{a.act_number || a.id.slice(0, 8)}</code>
                      </td>
                      <td>{a.act_type || "—"}</td>
                      <td>{a.status || "—"}</td>
                      <td>{a.created_at ? new Date(a.created_at).toLocaleString("fr-CD") : "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="panel">
            <h2 className="panel-title">Corrections</h2>
            {corrections.length === 0 ? (
              <p className="muted">Aucune demande.</p>
            ) : (
              <ul>
                {corrections.slice(0, 20).map((c) => (
                  <li key={c.id}>
                    {c.status} — {c.reason || c.id}{" "}
                    <span className="muted small">
                      {c.created_at ? new Date(c.created_at).toLocaleString("fr-CD") : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
