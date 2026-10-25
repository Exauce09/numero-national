import { useEffect, useState } from "react";
import { biometricApi } from "../api";
import { getSession, hasPermission } from "../auth";

/** Supervision biométrie + file revue humaine — jamais de templates en clair. */
export default function BiometriePage() {
  const session = getSession();
  const hasToken = Boolean(session?.accessToken);
  const canReview = hasPermission("biometric:review", session) || hasPermission("biometric:match", session);
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);
  const [thresholds, setThresholds] = useState<Array<Record<string, unknown>>>([]);
  const [pending, setPending] = useState<
    Array<{
      id: string;
      matched_citizen_id: string;
      match_score: number;
      threshold_used: number;
      decision: string;
      review_status: string;
      created_at: string;
    }>
  >([]);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function refresh() {
    if (!hasToken) return;
    setError(null);
    try {
      const [s, t, p] = await Promise.all([
        biometricApi.stats(),
        biometricApi.thresholds(),
        biometricApi.pendingMatches(40).catch(() => []),
      ]);
      setStats(s as Record<string, unknown>);
      setThresholds(t as Array<Record<string, unknown>>);
      setPending(p);
    } catch (e) {
      setStats(null);
      setThresholds([]);
      setPending([]);
      setError(
        e instanceof Error
          ? e.message
          : "Permission biométrie requise (biometric:match) ou service indisponible",
      );
    }
  }

  useEffect(() => {
    void refresh();
  }, [hasToken]);

  async function decide(id: string, approve: boolean) {
    setMsg(null);
    const reason = approve
      ? "Exception approuvée après revue humaine ONIP (justification opérationnelle)."
      : "Correspondance rejetée après revue humaine.";
    try {
      await biometricApi.reviewMatch(id, approve, reason);
      setMsg(approve ? "Exception enregistrée." : "Match rejeté.");
      void refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Revue impossible");
    }
  }

  return (
    <div>
      <div className="hero-banner">
        <h1>Biométrie</h1>
        <p>
          Correspondances 1:N = candidats uniquement. Revue humaine obligatoire — pas de fusion
          automatique. Templates jamais affichés.
        </p>
      </div>
      <div className="panel" style={{ borderLeft: "4px solid #0056b3" }}>
        <strong>Règle FGP</strong>
        <p className="muted" style={{ marginBottom: 0 }}>
          Authentification biométrique exclusive ONIP (Décret 22/07 art. 23). Pas de NIN définitif
          offline.
        </p>
      </div>
      {msg ? <div className="panel">{msg}</div> : null}
      {!hasToken ? (
        <div className="panel muted">Connexion requise.</div>
      ) : error ? (
        <div className="panel">
          <div className="login-error">{error}</div>
        </div>
      ) : (
        <>
          <div className="panel">
            <h2 className="panel-title">File revue humaine</h2>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Score</th>
                  <th>Seuil</th>
                  <th>Décision algo</th>
                  <th>Citoyen matché</th>
                  <th>Date</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {pending.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="muted">
                      Aucun match en attente.
                    </td>
                  </tr>
                ) : (
                  pending.map((m) => (
                    <tr key={m.id}>
                      <td>{m.match_score.toFixed(3)}</td>
                      <td>{m.threshold_used.toFixed(3)}</td>
                      <td>{m.decision}</td>
                      <td>
                        <code className="small">{m.matched_citizen_id.slice(0, 8)}…</code>
                      </td>
                      <td>{m.created_at?.slice(0, 19)}</td>
                      <td style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {canReview ? (
                          <>
                            <button type="button" className="btn-secondary" onClick={() => void decide(m.id, false)}>
                              Rejeter
                            </button>
                            <button type="button" className="btn-primary" onClick={() => void decide(m.id, true)}>
                              Exception
                            </button>
                          </>
                        ) : (
                          <span className="muted small">biometric:review</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="panel">
            <h2 className="panel-title">Indicateurs</h2>
            {stats ? (
              <ul>
                {Object.entries(stats).map(([k, v]) => (
                  <li key={k}>
                    <strong>{k}</strong> : {String(v)}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">Chargement…</p>
            )}
          </div>
          <div className="panel">
            <h2 className="panel-title">Seuils actifs</h2>
            {thresholds.length === 0 ? (
              <p className="muted">Aucun seuil exposé.</p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Valeur</th>
                    <th>Actif</th>
                  </tr>
                </thead>
                <tbody>
                  {thresholds.map((t, i) => (
                    <tr key={i}>
                      <td>{String(t.code ?? t.name ?? "—")}</td>
                      <td>{String(t.value ?? t.threshold ?? "—")}</td>
                      <td>{String(t.active ?? true)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
