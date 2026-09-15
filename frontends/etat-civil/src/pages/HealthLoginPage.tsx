import { FormEvent, useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { clearSession, getSession } from "../auth";
import PasswordField from "../components/PasswordField";
import { syncHospitalFacilitiesFromRequests } from "../accountRegistration";
import { getHealthSession, loginHealth } from "../healthAuth";

export default function HealthLoginPage() {
  const navigate = useNavigate();
  const civil = getSession();
  const health = getHealthSession();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    syncHospitalFacilitiesFromRequests();
  }, []);

  if (health) return <Navigate to="/sante" replace />;

  async function onLogin(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      clearSession();
      await loginHealth(username, password);
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

        {civil ? (
          <div className="panel" style={{ marginBottom: "1rem", textAlign: "left" }}>
            <p className="muted small" style={{ margin: 0 }}>
              Session bureau EC active ({civil.displayName || civil.username}). La connexion santé
              déconnectera le bureau.
            </p>
            <button
              type="button"
              className="btn-secondary btn-sm"
              style={{ marginTop: "0.5rem" }}
              onClick={() => {
                clearSession();
                window.location.reload();
              }}
            >
              Déconnecter le bureau EC
            </button>
          </div>
        ) : null}

        <form onSubmit={(e) => void onLogin(e)} autoComplete="off">
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
            Compte créé via <strong>Créer un compte</strong> (hôpital) ou{" "}
            <strong>Déclarations → Créer une structure</strong>.
          </p>
          <p className="muted small" style={{ marginTop: "0.65rem" }}>
            <Link to="/login">← Retour bureau état civil</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
