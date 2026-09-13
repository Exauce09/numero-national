import { FormEvent, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import {
  CIVIL_DEMO_ACCOUNTS,
  DEMO_API_EMAIL,
  DEMO_API_PASSWORD,
  getSession,
  login,
} from "../auth";
import { clearHealthSession, getHealthSession } from "../healthAuth";

export default function LoginPage() {
  const navigate = useNavigate();
  const civil = getSession();
  const health = getHealthSession();
  const [username, setUsername] = useState(DEMO_API_EMAIL);
  const [password, setPassword] = useState(DEMO_API_PASSWORD);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (health) return <Navigate to="/sante" replace />;
  if (civil) return <Navigate to="/" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      clearHealthSession();
      await login(username, password);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connexion impossible.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <img className="login-logo" src="/logo-rdc.jpg" alt="République Démocratique du Congo" />
        <h1 className="login-title">SIGPOP-RDC</h1>
        <p className="login-subtitle">
          Système intégré de gouvernance de la population — État civil
        </p>
        <form onSubmit={(e) => void onSubmit(e)} method="post" action="#" autoComplete="off">
          {error ? <div className="login-error" role="alert">{error}</div> : null}
          <label className="form-label" htmlFor="username">
            Identifiant / email
          </label>
          <input
            id="username"
            className="form-control"
            type="text"
            inputMode="email"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            disabled={busy}
          />
          <label className="form-label" htmlFor="password">
            Mot de passe
          </label>
          <input
            id="password"
            className="form-control"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            disabled={busy}
          />
          <div className="login-demo-roles" style={{ display: "grid", gap: "0.35rem", margin: "0.75rem 0" }}>
            {CIVIL_DEMO_ACCOUNTS.map((acc) => (
              <button
                key={acc.alias}
                type="button"
                className="login-forgot"
                style={{ textAlign: "left" }}
                onClick={() => {
                  setUsername(acc.alias);
                  setPassword(acc.uiPassword);
                  setError(null);
                }}
                disabled={busy}
              >
                Remplir : {acc.label} ({acc.alias})
              </button>
            ))}
          </div>
          <button className="btn-primary" type="submit" disabled={busy}>
            {busy ? "Connexion…" : "Se connecter"}
          </button>
        </form>
        <p className="login-subtitle" style={{ marginTop: "1.25rem", marginBottom: 0 }}>
          Comptes démo par rôle (alias / mot de passe UI) :
          <br />
          {CIVIL_DEMO_ACCOUNTS.map((acc) => (
            <span key={acc.alias} className="muted" style={{ display: "block" }}>
              {acc.alias} / {acc.uiPassword} — {acc.label}
            </span>
          ))}
          <br />
          <span className="muted">Mot de passe oublié — contactez votre administrateur territorial.</span>
        </p>
      </div>
    </div>
  );
}
