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

  if (existing) return <Navigate to="/" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
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
        <h1 className="login-title">E-GOUV — ONIP</h1>
        <p className="login-subtitle">Office National d&apos;Identification de la Population</p>
        <form onSubmit={onSubmit}>
          {error ? <div className="login-error">{error}</div> : null}

          <label className="form-label" htmlFor="username">
            Email (API) ou identifiant démo
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
            Mot de Passe
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
        <div className="login-subtitle" style={{ marginTop: "1.25rem", marginBottom: 0, textAlign: "left" }}>
          <p style={{ margin: "0 0 0.5rem" }}>
            <strong>Admin API</strong> (créer des comptes → menu Comptes)
            <br />
            {CENSUS_ADMIN_EMAIL}
            <br />
            {CENSUS_ADMIN_PASSWORD}
          </p>
          <p style={{ margin: 0 }}>
            <strong>Démo hors API</strong> (pas de création de comptes) : {DEMO_USER} / {DEMO_PASSWORD}
          </p>
        </div>
      </div>
    </div>
  );
}
