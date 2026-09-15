import { FormEvent, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { clearSession, getSession } from "../auth";
import PasswordField from "../components/PasswordField";
import { getHealthSession, loginHealth } from "../healthAuth";

export default function HealthLoginPage() {
  const navigate = useNavigate();
  const civil = getSession();
  const health = getHealthSession();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
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
        <h1 className="login-title">État civil — Maternité</h1>
        <p className="login-subtitle">
          Structure sanitaire : déclaration de naissance / décès → validation par l&apos;officier
        </p>

        <form onSubmit={onLogin} autoComplete="off">
          {error ? <div className="login-error">{error}</div> : null}
          <label className="form-label">Identifiant</label>
          <input
            className="form-control"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            disabled={busy}
          />
          <PasswordField
            label="Mot de passe"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={busy}
            autoComplete="current-password"
          />
          <button className="btn-primary" type="submit" disabled={busy} style={{ marginTop: "0.75rem" }}>
            {busy ? "Connexion…" : "Se connecter"}
          </button>
          <p className="muted small" style={{ marginTop: "0.85rem" }}>
            Compte créé par l&apos;officier d&apos;état civil (Déclarations → Créer un compte structure).
          </p>
          <p className="muted small" style={{ marginTop: "0.65rem" }}>
            <Link to="/login">← Retour bureau état civil</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
