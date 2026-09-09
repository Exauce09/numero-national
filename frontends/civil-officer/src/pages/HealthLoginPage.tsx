import { FormEvent, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { clearSession, getSession } from "../auth";
import {
  HEALTH_DEMO_PASSWORD,
  HEALTH_DEMO_USER,
  clearHealthSession,
  createFacilityAccount,
  getHealthSession,
  loginHealth,
} from "../healthAuth";

export default function HealthLoginPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const createMode = params.get("create") === "1";
  const civil = getSession();
  const health = getHealthSession();
  const [mode, setMode] = useState<"login" | "register">(createMode ? "register" : "login");
  const [username, setUsername] = useState(HEALTH_DEMO_USER);
  const [password, setPassword] = useState(HEALTH_DEMO_PASSWORD);
  const [facilityName, setFacilityName] = useState("");
  const [facilityType, setFacilityType] = useState<"HOPITAL" | "CLINIQUE" | "CS" | "MATERNITE">("HOPITAL");
  const [communeName, setCommuneName] = useState("Gombe");
  const [communeCode, setCommuneCode] = useState("KIN-GOMBE");
  const [province, setProvince] = useState("Kinshasa");
  const [ville, setVille] = useState("Kinshasa");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
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

  function onRegister(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(null);
    setBusy(true);
    try {
      createFacilityAccount({
        username,
        password,
        facilityName,
        facilityType,
        commune_code: communeCode,
        commune_name: communeName,
        province,
        ville,
      });
      setOk("Compte créé. Connectez-vous.");
      setMode("login");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Création impossible.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card" style={{ maxWidth: 520 }}>
        <h1 className="login-title">E-GOUV — Structure sanitaire</h1>
        <p className="login-subtitle">Hôpital · Clinique · Centre de santé · Maternité</p>

        {mode === "login" ? (
          <form onSubmit={onLogin} autoComplete="off">
            {error ? <div className="login-error">{error}</div> : null}
            {ok ? <div className="success-banner">{ok}</div> : null}
            <label className="form-label">Identifiant</label>
            <input className="form-control" value={username} onChange={(e) => setUsername(e.target.value)} />
            <label className="form-label">Mot de passe</label>
            <input
              className="form-control"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button className="btn-primary" type="submit" disabled={busy} style={{ marginTop: "0.75rem" }}>
              {busy ? "Connexion…" : "Se connecter"}
            </button>
            <p className="muted small" style={{ marginTop: "0.85rem" }}>
              Démo : <strong>{HEALTH_DEMO_USER}</strong> / <strong>{HEALTH_DEMO_PASSWORD}</strong>
            </p>
            <button
              type="button"
              className="login-forgot"
              onClick={() => {
                setMode("register");
                setUsername("");
                setPassword("");
                setError(null);
              }}
            >
              Créer un compte structure
            </button>
          </form>
        ) : (
          <form className="form-grid" onSubmit={onRegister} autoComplete="off">
            {error ? <div className="login-error full">{error}</div> : null}
            <div className="full">
              <label className="form-label">Nom de la structure</label>
              <input
                className="form-control"
                value={facilityName}
                onChange={(e) => setFacilityName(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="form-label">Type</label>
              <select
                className="form-control"
                value={facilityType}
                onChange={(e) => setFacilityType(e.target.value as typeof facilityType)}
              >
                <option value="HOPITAL">Hôpital</option>
                <option value="CLINIQUE">Clinique</option>
                <option value="CS">Centre de santé</option>
                <option value="MATERNITE">Maternité</option>
              </select>
            </div>
            <div>
              <label className="form-label">Province</label>
              <input className="form-control" value={province} onChange={(e) => setProvince(e.target.value)} />
            </div>
            <div>
              <label className="form-label">Ville</label>
              <input className="form-control" value={ville} onChange={(e) => setVille(e.target.value)} />
            </div>
            <div>
              <label className="form-label">Commune</label>
              <input className="form-control" value={communeName} onChange={(e) => setCommuneName(e.target.value)} />
            </div>
            <div>
              <label className="form-label">Code commune</label>
              <input className="form-control" value={communeCode} onChange={(e) => setCommuneCode(e.target.value)} />
            </div>
            <div>
              <label className="form-label">Identifiant</label>
              <input className="form-control" value={username} onChange={(e) => setUsername(e.target.value)} required />
            </div>
            <div>
              <label className="form-label">Mot de passe</label>
              <input
                className="form-control"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div className="full">
              <button className="btn-primary" type="submit" disabled={busy} style={{ width: "auto" }}>
                Créer le compte
              </button>{" "}
              <button type="button" className="btn-secondary" onClick={() => setMode("login")}>
                Retour connexion
              </button>
            </div>
          </form>
        )}

        <p className="muted small" style={{ marginTop: "1rem" }}>
          Officier d&apos;état civil ? <Link to="/login">Connexion état civil</Link>
        </p>
      </div>
    </div>
  );
}
