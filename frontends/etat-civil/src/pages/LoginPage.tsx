import { FormEvent, useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { getSession, login } from "../auth";
import PasswordField from "../components/PasswordField";
import {
  CANONICAL_EC_ACCOUNTS,
  ensureCanonicalAccounts,
  hasAnyEcUser,
} from "../ecUsers";

export default function LoginPage() {
  const navigate = useNavigate();
  const civil = getSession();
  const [username, setUsername] = useState(CANONICAL_EC_ACCOUNTS[0].email);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void ensureCanonicalAccounts();
  }, []);

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

  const herve = CANONICAL_EC_ACCOUNTS[0];
  const tshidibi = CANONICAL_EC_ACCOUNTS[1];

  return (
    <div className="login-page">
      <div className="login-card">
        <img className="login-logo" src="/logo-rdc.jpg" alt="République Démocratique du Congo" />
        <h1 className="login-title">État civil — RDC</h1>
        <p className="login-subtitle">Connexion bureau d&apos;état civil</p>
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
          <PasswordField
            id="password"
            label="Mot de passe"
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
        <div className="panel" style={{ marginTop: "1rem", textAlign: "left" }}>
          <p className="muted small" style={{ margin: "0 0 0.5rem" }}>
            <strong>Hervé</strong> — super admin · <code>{herve.email}</code>
            <br />
            MDP initial : <code>{herve.initialPassword}</code>
          </p>
          <p className="muted small" style={{ margin: 0 }}>
            <strong>Tshidibi</strong> — responsable bureau · <code>{tshidibi.email}</code>
            <br />
            MDP initial : <code>{tshidibi.initialPassword}</code>
          </p>
        </div>
        <p className="login-subtitle" style={{ marginTop: "0.75rem" }}>
          <Link to="/sante/login">Accès maternité / structure sanitaire →</Link>
        </p>
      </div>
    </div>
  );
}
