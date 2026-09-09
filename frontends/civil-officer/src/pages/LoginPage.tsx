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

  function fillDemo() {
    setUsername(DEMO_USER);
    setPassword(DEMO_PASSWORD);
    setError(null);
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <img className="login-logo" src="/logo-rdc.jpg" alt="République Démocratique du Congo" />
        <h1 className="login-title">E-GOUV — État civil</h1>
        <p className="login-subtitle">Portail Officier d&apos;état civil · Commune</p>
        <form onSubmit={onSubmit} autoComplete="off">
          {error ? <div className="login-error">{error}</div> : null}
          <label className="form-label" htmlFor="username">
            Nom d&apos;utilisateur
          </label>
          <input
            id="username"
            className="form-control"
            type="text"
            name="civil-demo-user"
            autoComplete="off"
            spellCheck={false}
            value={username}
            onChange={(ev) => setUsername(ev.target.value)}
          />
          <label className="form-label" htmlFor="password">
            Mot de Passe
          </label>
          <input
            id="password"
            className="form-control"
            type="password"
            name="civil-demo-password"
            autoComplete="new-password"
            value={password}
            onChange={(ev) => setPassword(ev.target.value)}
          />
          <div className="login-row">
            <button type="button" className="login-forgot" onClick={fillDemo}>
              Remplir le compte démo
            </button>
          </div>
          <button className="btn-primary" type="submit" disabled={busy}>
            {busy ? "Connexion…" : "Se connecter"}
          </button>
        </form>
        <p className="login-subtitle" style={{ marginTop: "1.25rem", marginBottom: 0 }}>
          Démo locale (sans base) : <strong>{DEMO_USER}</strong> / <strong>{DEMO_PASSWORD}</strong>
          <br />
          <span className="muted small">Attention au « r » final : officie<span style={{ color: "var(--danger, #d32f2f)" }}>r</span></span>
        </p>
      </div>
    </div>
  );
}
