import { FormEvent, useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { clearSession, getSession, login } from "../auth";
import PasswordField from "../components/PasswordField";
import { syncHospitalFacilitiesFromRequests } from "../accountRegistration";
import { ensureCanonicalAccounts, hasAnyEcUser } from "../ecUsers";
import { findFacilityByUsername, loginHealth } from "../healthAuth";

export default function LoginPage() {
  const navigate = useNavigate();
  const civil = getSession();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void ensureCanonicalAccounts();
    syncHospitalFacilitiesFromRequests();
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
    } catch (civilErr) {
      try {
        clearSession();
        await loginHealth(username, password);
        navigate("/sante", { replace: true });
        return;
      } catch {
        const looksHealth = Boolean(findFacilityByUsername(username));
        setError(
          looksHealth
            ? "Compte structure sanitaire : utilisez /sante/login (ou vérifiez le mot de passe)."
            : civilErr instanceof Error
              ? civilErr.message
              : "Identifiants incorrects.",
        );
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <img className="login-logo" src="/logo-rdc.jpg" alt="République Démocratique du Congo" />
        <h1 className="login-title">État civil — RDC</h1>
        <p className="login-subtitle">Connexion bureau d&apos;état civil</p>
        <form onSubmit={(e) => void onSubmit(e)} method="post" action="#" autoComplete="off">
          {error ? <div className="login-error" role="alert">{error}</div> : null}
          <label className="form-label" htmlFor="username">
            E-mail / identifiant
          </label>
          <input
            id="username"
            className="form-control"
            type="text"
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
        <p className="login-subtitle" style={{ marginTop: "0.75rem" }}>
          <Link to="/sante/login">Accès maternité / structure sanitaire →</Link>
        </p>
      </div>
    </div>
  );
}
