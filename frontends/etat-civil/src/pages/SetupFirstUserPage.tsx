/** Initialisation : Hervé (État civil national) + Tshidibi (divinter). */

import { FormEvent, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { login } from "../auth";
import {
  CANONICAL_EC_ACCOUNTS,
  ensureCanonicalAccounts,
  hasAnyEcUser,
} from "../ecUsers";

export default function SetupFirstUserPage() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [asWho, setAsWho] = useState<"herve" | "tshidibi">("herve");

  if (hasAnyEcUser()) {
    return <Navigate to="/login" replace />;
  }

  async function onInit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await ensureCanonicalAccounts();
      const account =
        asWho === "herve" ? CANONICAL_EC_ACCOUNTS[0] : CANONICAL_EC_ACCOUNTS[1];
      await login(account.email, account.initialPassword);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Initialisation impossible.");
    } finally {
      setBusy(false);
    }
  }

  const herve = CANONICAL_EC_ACCOUNTS[0];
  const tshidibi = CANONICAL_EC_ACCOUNTS[1];

  return (
    <div className="login-page">
      <div className="login-card" style={{ maxWidth: 560 }}>
        <img className="login-logo" src="/logo-rdc.jpg" alt="RDC" />
        <h1 className="login-title">Comptes plateforme</h1>
        <p className="login-subtitle">
          Initialisation nominative : <strong>Hervé</strong> = État civil national,{" "}
          <strong>Tshidibi</strong> = divinter (division provinciale).
        </p>

        <div className="panel" style={{ marginBottom: "1rem", textAlign: "left" }}>
          <h3 className="panel-title" style={{ marginTop: 0 }}>
            Comptes créés
          </h3>
          <ul className="muted" style={{ margin: 0, paddingLeft: "1.2rem", fontSize: "0.9rem" }}>
            <li>
              <strong>{herve.fullName}</strong> — État civil national
              <br />
              <code>{herve.email}</code>
            </li>
            <li style={{ marginTop: "0.65rem" }}>
              <strong>{tshidibi.fullName}</strong> — Divinter (+ officier)
              <br />
              <code>{tshidibi.email}</code>
            </li>
          </ul>
        </div>

        <form onSubmit={(e) => void onInit(e)}>
          {error ? <div className="login-error">{error}</div> : null}
          <label className="form-label">Se connecter ensuite en tant que</label>
          <select
            className="form-control"
            value={asWho}
            onChange={(e) => setAsWho(e.target.value as "herve" | "tshidibi")}
            disabled={busy}
          >
            <option value="herve">
              {herve.fullName} (État civil national)
            </option>
            <option value="tshidibi">
              {tshidibi.fullName} (divinter)
            </option>
          </select>
          <button className="btn-primary" type="submit" disabled={busy} style={{ marginTop: "0.75rem" }}>
            {busy ? "Initialisation…" : "Initialiser Hervé + Tshidibi et se connecter"}
          </button>
        </form>
        <p className="muted small" style={{ marginTop: "1rem" }}>
          <Link to="/login">Déjà initialisé ? Se connecter</Link>
        </p>
      </div>
    </div>
  );
}
