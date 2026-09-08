import { FormEvent, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { DEMO_PASSWORD, DEMO_USER, getSession, login } from "../auth";

export default function LoginPage() {
  const navigate = useNavigate();
  const existing = getSession();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (existing) return <Navigate to="/identity" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(username, password);
      navigate("/identity", { replace: true });
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
        <h1 className="login-title">E-GOUV — Portail Citoyen</h1>
        <p className="login-subtitle">Numéro National · Identité &amp; services</p>
        <form onSubmit={onSubmit}>
          {error ? <div className="login-error">{error}</div> : null}

          <label className="form-label" htmlFor="username">
            Nom d&apos;utilisateur
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

          <div className="login-row">
            <a className="login-forgot" href="#">
              Mot de Passe oublié ?
            </a>
          </div>

          <button className="btn-primary" type="submit" disabled={busy}>
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
