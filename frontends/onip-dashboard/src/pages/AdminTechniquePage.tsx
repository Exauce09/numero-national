import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchNinCompliance, fetchOnipOpsHealth } from "../api";
import { getSession } from "../auth";

export default function AdminTechniquePage() {
  const hasToken = Boolean(getSession()?.accessToken);
  const [health, setHealth] = useState<Record<string, unknown> | null>(null);
  const [nin, setNin] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hasToken) return;
    void (async () => {
      try {
        const [h, n] = await Promise.all([fetchOnipOpsHealth(), fetchNinCompliance()]);
        setHealth(h as unknown as Record<string, unknown>);
        setNin(n as unknown as Record<string, unknown>);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Santé indisponible");
      }
    })();
  }, [hasToken]);

  return (
    <div>
      <div className="hero-banner">
        <h1>Administration technique</h1>
        <p>Santé des services ONIP, fichiers de conformité et inventaire NIC (sans secrets).</p>
      </div>
      {!hasToken ? (
        <div className="panel muted">Connexion requise.</div>
      ) : error ? (
        <div className="login-error">{error}</div>
      ) : (
        <>
          <div className="panel">
            <h2 className="panel-title">Ops health</h2>
            {health ? (
              <ul>
                {Object.entries(health).map(([k, v]) => (
                  <li key={k}>
                    <strong>{k}</strong> :{" "}
                    {typeof v === "object" && v !== null ? JSON.stringify(v) : String(v)}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">Chargement…</p>
            )}
          </div>
          <div className="panel">
            <h2 className="panel-title">NIN</h2>
            {nin ? (
              <ul>
                <li>
                  Officiel confirmé : {String(nin.official_nin_format_confirmed)}
                </li>
                <li>Génération officielle : {String(nin.official_generation_enabled)}</li>
                <li>Algo provisoire : {String(nin.provisional_algorithm)}</li>
              </ul>
            ) : null}
            <p>
              <Link to="/conformite">Ouvrir conformité</Link>
            </p>
          </div>
          <div className="panel">
            <h2 className="panel-title">Inventaire données</h2>
            <p className="muted">
              Sur le serveur / poste ops :
              <br />
              <code>python scripts/inventory_nic_nin.py</code>
            </p>
          </div>
        </>
      )}
    </div>
  );
}
