import { useEffect, useState } from "react";
import { biometricApi } from "../api";
import { getSession } from "../auth";

/** Supervision biométrie — stats uniquement, jamais de templates en clair. */
export default function BiometriePage() {
  const hasToken = Boolean(getSession()?.accessToken);
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);
  const [thresholds, setThresholds] = useState<Array<Record<string, unknown>>>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hasToken) return;
    void (async () => {
      setError(null);
      try {
        const [s, t] = await Promise.all([biometricApi.stats(), biometricApi.thresholds()]);
        setStats(s as Record<string, unknown>);
        setThresholds(t as Array<Record<string, unknown>>);
      } catch (e) {
        setStats(null);
        setThresholds([]);
        setError(
          e instanceof Error
            ? e.message
            : "Permission biométrie requise (biometric:match) ou service indisponible",
        );
      }
    })();
  }, [hasToken]);

  return (
    <div>
      <div className="hero-banner">
        <h1>Biométrie</h1>
        <p>
          Contrôle qualité et correspondances 1:N. Les templates restent chiffrés côté serveur — jamais
          affichés ici. Une correspondance algorithmique exige une revue humaine (pas de fusion auto).
        </p>
      </div>
      <div className="panel" style={{ borderLeft: "4px solid #0056b3" }}>
        <strong>Règle FGP</strong>
        <p className="muted" style={{ marginBottom: 0 }}>
          Authentification biométrique exclusive ONIP (Décret 22/07 art. 23). Capture ZK / enrollment
          via API <code>/biometric/*</code>.
        </p>
      </div>
      {!hasToken ? (
        <div className="panel muted">Connexion requise.</div>
      ) : error ? (
        <div className="panel">
          <div className="login-error">{error}</div>
          <p className="muted small">
            Attribuez le droit <code>biometric:match</code> au compte opérateur pour voir les stats.
          </p>
        </div>
      ) : (
        <>
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
