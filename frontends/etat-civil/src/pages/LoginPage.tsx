import { FormEvent, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { getSession, login } from "../auth";
import { hasAnyEcUser } from "../ecUsers";

export default function LoginPage() {
  const navigate = useNavigate();
  const civil = getSession();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (civil) return <Navigate to="/" replace />;
  if (!hasAnyEcUser()) return <Navigate to="/setup" replace />;

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
        <h1 className="login-title">État civil — RDC</h1>
        <p className="login-subtitle">Connexion bureau d&apos;état civil — aucun compte démo</p>
        <form onSubmit={(e) => void onSubmit(e)} method="post" action="#" autoComplete="off">
          {error ? <div className="login-error" role="alert">{error}</div> : null}
          <label className="form-label" htmlFor="username">
            E-mail
          </label>
          <input
            id="username"
            className="form-control"
            type="email"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            disabled={busy}
            required
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
            required
          />
          <button className="btn-primary" type="submit" disabled={busy}>
            {busy ? "Connexion…" : "Se connecter"}
          </button>
        </form>
        <p className="muted small" style={{ marginTop: "1rem" }}>
          Mot de passe oublié — contactez le responsable de bureau.
        </p>
        <p className="login-subtitle" style={{ marginTop: "0.75rem" }}>
          <Link to="/sante/login">Accès maternité / structure sanitaire →</Link>
        </p>
      </div>
    </div>
  );
}
