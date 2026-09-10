import { FormEvent, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { DEMO_CREDENTIALS, getSession, login, setActivePortal, type Portal } from "../auth";

type Props = {
  portal: Portal;
  title: string;
  subtitle: string;
};

const PORTALS: Array<{ id: Portal; label: string }> = [
  { id: "sante", label: "Santé" },
  { id: "interieur", label: "Intérieur" },
  { id: "presidence", label: "Présidence" },
  { id: "admin", label: "Administration" },
];

export default function LoginForm({ portal, title, subtitle }: Props) {
  const navigate = useNavigate();
  const existing = getSession(portal);
  const demo = DEMO_CREDENTIALS[portal];
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (existing) {
    setActivePortal(portal);
    return <Navigate to={`/${portal}`} replace />;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(portal, username, password);
      navigate(`/${portal}`, { replace: true });
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
        <h1 className="login-title">{title}</h1>
        <p className="login-subtitle">{subtitle}</p>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: "1rem" }}>
          {PORTALS.map((p) => (
            <Link
              key={p.id}
              to={`/${p.id}/login`}
              className={p.id === portal ? "btn-primary btn-sm" : "btn-secondary btn-sm"}
              style={{ textDecoration: "none" }}
            >
              {p.label}
            </Link>
          ))}
        </div>
        <p className="muted small" style={{ marginTop: 0 }}>
          Changer d&apos;institution / portail sans quitter le système.
        </p>

        <form onSubmit={onSubmit}>
          {error ? <div className="login-error">{error}</div> : null}
          <label className="form-label" htmlFor={`${portal}-username`}>
            Email / nom d&apos;utilisateur
          </label>
          <input
            id={`${portal}-username`}
            className="form-control"
            type="text"
            autoComplete="username"
            value={username}
            onChange={(ev) => setUsername(ev.target.value)}
          />
          <label className="form-label" htmlFor={`${portal}-password`}>
            Mot de passe
          </label>
          <input
            id={`${portal}-password`}
            className="form-control"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(ev) => setPassword(ev.target.value)}
          />
          <button className="btn-primary" type="submit" disabled={busy}>
            {busy ? "Connexion…" : "Se connecter"}
          </button>
        </form>
        <p className="login-subtitle" style={{ marginTop: "1.25rem", marginBottom: 0 }}>
          Démo : <strong>{demo.username}</strong> / <strong>{demo.password}</strong>
        </p>
      </div>
    </div>
  );
}
