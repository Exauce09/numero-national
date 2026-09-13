import { FormEvent, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { getSession, homePathForSession, login } from "../auth";

export default function LoginPage() {
  const navigate = useNavigate();
  const existing = getSession();
  const [username, setUsername] = useState("supervisor.recensement@example.gov");
  const [password, setPassword] = useState("CensusSupervisor123!");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (existing) return <Navigate to={homePathForSession(existing)} replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const session = await login(username, password);
      navigate(homePathForSession(session), { replace: true });
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
          Système Intégré de Gouvernance de la Population
          <br />
          Plateforme E-GOUV — République Démocratique du Congo
        </p>
        <form onSubmit={onSubmit} autoComplete="off">
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
      </div>
    </div>
  );
}
