import { FormEvent, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { DEMO_PASSWORD, DEMO_USER, clearSession, getSession, login } from "../auth";
import {
  HEALTH_DEMO_PASSWORD,
  HEALTH_DEMO_USER,
  clearHealthSession,
  createFacilityAccount,
  getHealthSession,
  loginHealth,
} from "../healthAuth";

type Gate = "menu" | "civil-login" | "health-login" | "health-register";

export default function LoginPage() {
  const navigate = useNavigate();
  const civil = getSession();
  const health = getHealthSession();
  const [gate, setGate] = useState<Gate>("menu");
  const [username, setUsername] = useState(DEMO_USER);
  const [password, setPassword] = useState(DEMO_PASSWORD);
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

  async function onCivilLogin(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      clearHealthSession();
      await login(username, password);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connexion impossible.");
    } finally {
      setBusy(false);
    }
  }

  function onHealthLogin(e: FormEvent) {
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
      setGate("health-login");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Création impossible.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card" style={{ maxWidth: 540 }}>
        <img className="login-logo" src="/logo-rdc.jpg" alt="République Démocratique du Congo" />
        <h1 className="login-title">E-GOUV — Menu utilisateurs</h1>
        <p className="login-subtitle">État civil ou structure sanitaire</p>

        {gate === "menu" ? (
          <div className="user-menu-grid">
            <button
              type="button"
              className="user-menu-card"
              onClick={() => {
                setGate("civil-login");
                setUsername(DEMO_USER);
                setPassword(DEMO_PASSWORD);
                setError(null);
              }}
            >
              <strong>Officier d&apos;état civil</strong>
              <span>Registre + validation des déclarations hôpital</span>
            </button>
            <button
              type="button"
              className="user-menu-card"
              onClick={() => {
                setGate("health-register");
                setUsername("");
                setPassword("");
                setError(null);
              }}
            >
              <strong>Créer compte sanitaire</strong>
              <span>Hôpital, clinique, CS, maternité</span>
            </button>
            <button
              type="button"
              className="user-menu-card"
              style={{ gridColumn: "1 / -1" }}
              onClick={() => {
                setGate("health-login");
                setUsername(HEALTH_DEMO_USER);
                setPassword(HEALTH_DEMO_PASSWORD);
                setError(null);
              }}
            >
              <strong>Connexion structure sanitaire</strong>
              <span>Tableau de bord, nouveaux-nés, décès → notifier l&apos;état civil</span>
            </button>
          </div>
        ) : null}

        {gate === "civil-login" ? (
          <form onSubmit={(e) => void onCivilLogin(e)} autoComplete="off">
            {error ? <div className="login-error">{error}</div> : null}
            <label className="form-label">Identifiant</label>
            <input className="form-control" value={username} onChange={(e) => setUsername(e.target.value)} />
            <label className="form-label">Mot de passe</label>
            <input className="form-control" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            <button className="btn-primary" type="submit" disabled={busy} style={{ marginTop: "0.75rem" }}>
              {busy ? "Connexion…" : "Se connecter"}
            </button>
            <p className="muted small">Démo : {DEMO_USER} / {DEMO_PASSWORD}</p>
            <button type="button" className="login-forgot" onClick={() => setGate("menu")}>
              ← Menu
            </button>
          </form>
        ) : null}

        {gate === "health-login" ? (
          <form onSubmit={onHealthLogin} autoComplete="off">
            {error ? <div className="login-error">{error}</div> : null}
            {ok ? <div className="success-banner">{ok}</div> : null}
            <label className="form-label">Identifiant</label>
            <input className="form-control" value={username} onChange={(e) => setUsername(e.target.value)} />
            <label className="form-label">Mot de passe</label>
            <input className="form-control" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            <button className="btn-primary" type="submit" disabled={busy} style={{ marginTop: "0.75rem" }}>
              {busy ? "Connexion…" : "Se connecter"}
            </button>
            <p className="muted small">Démo : {HEALTH_DEMO_USER} / {HEALTH_DEMO_PASSWORD}</p>
            <button type="button" className="login-forgot" onClick={() => setGate("menu")}>
              ← Menu
            </button>
          </form>
        ) : null}

        {gate === "health-register" ? (
          <form className="form-grid" onSubmit={onRegister} autoComplete="off">
            {error ? <div className="login-error full">{error}</div> : null}
            <div className="full">
              <label className="form-label">Nom de la structure</label>
              <input className="form-control" value={facilityName} onChange={(e) => setFacilityName(e.target.value)} required />
            </div>
            <div>
              <label className="form-label">Type</label>
              <select className="form-control" value={facilityType} onChange={(e) => setFacilityType(e.target.value as typeof facilityType)}>
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
              <input className="form-control" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <div className="full">
              <button className="btn-primary" type="submit" disabled={busy} style={{ width: "auto" }}>
                Créer le compte
              </button>{" "}
              <button type="button" className="btn-secondary" onClick={() => setGate("menu")}>
                Annuler
              </button>
            </div>
          </form>
        ) : null}
      </div>
    </div>
  );
}
