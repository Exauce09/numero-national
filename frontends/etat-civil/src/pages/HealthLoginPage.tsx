import { FormEvent, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { clearSession, getSession } from "../auth";
import {
  HEALTH_DEMO_PASSWORD,
  HEALTH_DEMO_USER,
  getHealthSession,
  loginHealth,
} from "../healthAuth";

export default function HealthLoginPage() {
  const navigate = useNavigate();
  const civil = getSession();
  const health = getHealthSession();
  const [username, setUsername] = useState(HEALTH_DEMO_USER);
  const [password, setPassword] = useState(HEALTH_DEMO_PASSWORD);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (health) return <Navigate to="/sante" replace />;
  if (civil) return <Navigate to="/" replace />;

  function onLogin(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      clearSession();
      loginHealth(username, password);
      navigate("/sante", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connexion impossible.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card" style={{ maxWidth: 520 }}>
        <img className="login-logo" src="/logo-rdc.jpg" alt="République Démocratique du Congo" />
        <h1 className="login-title">SIGPOP-RDC — Structure sanitaire</h1>
        <p className="login-subtitle">Hôpital · Clinique · Centre de santé · Maternité</p>

        <form onSubmit={onLogin} autoComplete="off">
          {error ? <div className="login-error">{error}</div> : null}
          <label className="form-label">Identifiant</label>
          <input className="form-control" value={username} onChange={(e) => setUsername(e.target.value)} />
          <label className="form-label">Mot de passe</label>
          <input
            className="form-control"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button className="btn-primary" type="submit" disabled={busy} style={{ marginTop: "0.75rem" }}>
            {busy ? "Connexion…" : "Se connecter"}
          </button>
          <p className="muted small" style={{ marginTop: "0.85rem" }}>
            Démo : <strong>{HEALTH_DEMO_USER}</strong> / <strong>{HEALTH_DEMO_PASSWORD}</strong>
          </p>
          <p className="muted small" style={{ marginTop: "0.65rem" }}>
            Compte créé par l&apos;officier d&apos;état civil (Déclarations santé → Créer un compte).
          </p>
        </form>
      </div>
    </div>
  );
}
