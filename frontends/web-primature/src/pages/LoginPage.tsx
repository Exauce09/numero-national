import { FormEvent, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { DEMO_PASSWORD, DEMO_USER, getSession, login } from "../auth";

export default function LoginPage() {
  const navigate = useNavigate();
  const existing = getSession();
  const [username, setUsername] = useState(DEMO_USER);
  const [password, setPassword] = useState(DEMO_PASSWORD);
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
        <h1 className="login-title">E-GOUV — Primature</h1>
        <p className="login-subtitle">Coordination gouvernementale · Lecture des données concernées</p>
        <form onSubmit={(e) => void onSubmit(e)} autoComplete="off">
          {error ? <div className="login-error">{error}</div> : null}
          <label className="form-label" htmlFor="username">
            Identifiant
          </label>
          <input id="username" className="form-control" value={username} onChange={(e) => setUsername(e.target.value)} />
          <label className="form-label" htmlFor="password">
            Mot de passe
          </label>
          <input
            id="password"
            className="form-control"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button className="btn-primary" type="submit" disabled={busy} style={{ marginTop: "0.75rem" }}>
            {busy ? "Connexion…" : "Se connecter"}
          </button>
        </form>
        <p className="login-subtitle" style={{ marginTop: "1.25rem", marginBottom: 0 }}>
          Démo : <strong>{DEMO_USER}</strong> / <strong>{DEMO_PASSWORD}</strong>
        </p>
      </div>
    </div>
  );
}
