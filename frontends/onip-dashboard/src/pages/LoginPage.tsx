import { FormEvent, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import {
  CENSUS_ADMIN_EMAIL,
  CENSUS_ADMIN_PASSWORD,
  DEMO_PASSWORD,
  DEMO_USER,
  getSession,
  login,
} from "../auth";

export default function LoginPage() {
  const navigate = useNavigate();
  const existing = getSession();
  const [username, setUsername] = useState(CENSUS_ADMIN_EMAIL);
  const [password, setPassword] = useState(CENSUS_ADMIN_PASSWORD);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (existing) return <Navigate to="/accounts" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(username, password);
      navigate("/accounts", { replace: true });
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
        <h1 className="login-title">ONIP</h1>
        <p className="login-subtitle">
          Office National d&apos;Identification de la Population
          <br />
          Plateforme E-GOUV — République Démocratique du Congo
        </p>
        <form onSubmit={onSubmit}>
          {error ? <div className="login-error">{error}</div> : null}

          <label className="form-label" htmlFor="username">
            Identifiant
          </label>
          <input
            id="username"
            className="form-control"
            name="username"
            type="text"
            autoComplete="username"
            value={username}
            onChange={(ev) => setUsername(ev.target.value)}
          />

          <label className="form-label" htmlFor="password">
            Mot de passe
          </label>
          <input
            id="password"
            className="form-control"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(ev) => setPassword(ev.target.value)}
          />

          <button className="btn-primary" type="submit" disabled={busy}>
            {busy ? "Connexion…" : "Se connecter"}
          </button>
        </form>
        <div className="login-hints">
          <p>
            <strong>Admin API</strong> — {CENSUS_ADMIN_EMAIL}
            <br />
            {CENSUS_ADMIN_PASSWORD}
          </p>
          <p>
            <strong>2ᵉ accès ONIP</strong> — onip.ops2@example.gov
            <br />
            OnipOps2123!
          </p>
          <p>
            <strong>Démo hors API</strong> — {DEMO_USER} / {DEMO_PASSWORD}
          </p>
        </div>
      </div>
    </div>
  );
}
