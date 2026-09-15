/** Création du 1er utilisateur — Responsable de bureau (+ officier). */

import { FormEvent, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { login } from "../auth";
import PasswordField from "../components/PasswordField";
import { DEFAULT_OFFICER_COMMUNE } from "../commune";
import { createFirstEcUser, FIRST_USER_ROLES, hasAnyEcUser } from "../ecUsers";

export default function SetupFirstUserPage() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [communeName, setCommuneName] = useState(DEFAULT_OFFICER_COMMUNE.name);
  const [ville, setVille] = useState(DEFAULT_OFFICER_COMMUNE.ville);
  const [province, setProvince] = useState(DEFAULT_OFFICER_COMMUNE.province);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (hasAnyEcUser()) {
    return <Navigate to="/login" replace />;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("La confirmation du mot de passe ne correspond pas.");
      return;
    }
    setBusy(true);
    try {
      await createFirstEcUser({
        email,
        password,
        fullName,
        commune: {
          ...DEFAULT_OFFICER_COMMUNE,
          name: communeName.trim() || DEFAULT_OFFICER_COMMUNE.name,
          ville: ville.trim() || DEFAULT_OFFICER_COMMUNE.ville,
          province: province.trim() || DEFAULT_OFFICER_COMMUNE.province,
        },
      });
      await login(email.trim().toLowerCase(), password);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Création impossible.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card" style={{ maxWidth: 560 }}>
        <img className="login-logo" src="/logo-rdc.jpg" alt="RDC" />
        <h1 className="login-title">Premier utilisateur</h1>
        <p className="login-subtitle">
          Aucun compte n&apos;existe encore. Créez le <strong>super administrateur national</strong>{" "}
          (1er compte). Il pourra ensuite créer les autres comptes via{" "}
          <strong>Créer un compte</strong>.
        </p>

        <div className="panel" style={{ marginBottom: "1rem", textAlign: "left" }}>
          <h3 className="panel-title" style={{ marginTop: 0 }}>
            Rôle du 1er utilisateur
          </h3>
          <ul className="muted" style={{ margin: 0, paddingLeft: "1.2rem", fontSize: "0.9rem" }}>
            <li>
              <strong>Super administrateur national</strong> — crée les comptes plateforme
            </li>
            <li>
              <strong>Responsable de bureau</strong> — gère les utilisateurs du bureau
            </li>
            <li>
              <strong>Officier d&apos;état civil</strong> — valide les actes (cumulé)
            </li>
            <li>Rôles attribués : {FIRST_USER_ROLES.join(" + ")}</li>
          </ul>
        </div>

        <form onSubmit={(e) => void onSubmit(e)} autoComplete="off">
          {error ? <div className="login-error">{error}</div> : null}
          <label className="form-label">Nom complet *</label>
          <input
            className="form-control"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            disabled={busy}
          />
          <label className="form-label">E-mail (identifiant) *</label>
          <input
            className="form-control"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={busy}
          />
          <PasswordField
            label="Mot de passe * (min. 8)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            disabled={busy}
            autoComplete="new-password"
          />
          <PasswordField
            label="Confirmer *"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            disabled={busy}
            autoComplete="new-password"
          />
          <label className="form-label">Province du bureau</label>
          <input className="form-control" value={province} onChange={(e) => setProvince(e.target.value)} />
          <label className="form-label">Ville</label>
          <input className="form-control" value={ville} onChange={(e) => setVille(e.target.value)} />
          <label className="form-label">Commune</label>
          <input
            className="form-control"
            value={communeName}
            onChange={(e) => setCommuneName(e.target.value)}
          />
          <button className="btn-primary" type="submit" disabled={busy} style={{ marginTop: "0.75rem" }}>
            {busy ? "Création…" : "Créer le super administrateur"}
          </button>
        </form>
        <p className="muted small" style={{ marginTop: "1rem" }}>
          <Link to="/login">Déjà un compte ? Se connecter</Link>
        </p>
      </div>
    </div>
  );
}
