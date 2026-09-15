/** Gestion des utilisateurs du bureau — après le 1er responsable. */

import { FormEvent, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getSession } from "../auth";
import {
  canManageEcUsers,
  createEcUser,
  EC_ROLE_CATALOG,
  getEcUserByEmail,
  listEcUsers,
  setEcUserActive,
  type EcUserRole,
} from "../ecUsers";

export default function UsersEcPage() {
  const session = getSession();
  const actor = session?.username ? getEcUserByEmail(session.username) : undefined;
  const canManage = canManageEcUsers(session?.roles);
  const [bump, setBump] = useState(0);
  const users = useMemo(() => listEcUsers(), [bump]);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<EcUserRole>("AGENT_ETAT_CIVIL");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    if (!actor) {
      setError("Session locale introuvable — reconnectez-vous.");
      return;
    }
    setBusy(true);
    try {
      const created = await createEcUser(actor, {
        email,
        password,
        fullName,
        roles: [role],
      });
      setMessage(`Compte créé : ${created.fullName} (${created.roles.join(", ")})`);
      setFullName("");
      setEmail("");
      setPassword("");
      setRole("AGENT_ETAT_CIVIL");
      setBump((n) => n + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Création impossible");
    } finally {
      setBusy(false);
    }
  }

  if (!canManage) {
    return (
      <div>
        <h2 className="page-title">Utilisateurs</h2>
        <div className="panel">
          <p className="muted">
            Seul le <strong>responsable de bureau</strong> peut créer des comptes. Votre rôle :{" "}
            {(session?.roles ?? []).join(", ") || "—"}.
          </p>
          <Link className="btn-secondary btn-sm" to="/roles">
            Voir qui fait quoi
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="page-title">Utilisateurs du bureau</h2>
      <p className="page-lead">
        Créez les comptes suivants. Choisissez le rôle selon la fonction réelle.
      </p>

      <div className="panel" style={{ marginBottom: "1.25rem" }}>
        <h3 className="panel-title">Rôles disponibles</h3>
        <ul style={{ margin: 0, paddingLeft: "1.2rem", lineHeight: 1.55 }}>
          {EC_ROLE_CATALOG.map((r) => (
            <li key={r.code}>
              <strong>{r.label}</strong> — {r.summary}
            </li>
          ))}
        </ul>
      </div>

      {error ? <div className="login-error">{error}</div> : null}
      {message ? <div className="success-banner">{message}</div> : null}

      <form className="panel form-grid" onSubmit={(e) => void onCreate(e)}>
        <h3 className="panel-title full" style={{ marginTop: 0 }}>
          Nouveau compte
        </h3>
        <div>
          <label className="form-label">Nom complet *</label>
          <input
            className="form-control"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            disabled={busy}
          />
        </div>
        <div>
          <label className="form-label">E-mail *</label>
          <input
            className="form-control"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={busy}
          />
        </div>
        <div>
          <label className="form-label">Mot de passe temporaire *</label>
          <input
            className="form-control"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            disabled={busy}
          />
        </div>
        <div>
          <label className="form-label">Rôle *</label>
          <select
            className="form-control"
            value={role}
            onChange={(e) => setRole(e.target.value as EcUserRole)}
            disabled={busy}
          >
            {EC_ROLE_CATALOG.map((r) => (
              <option key={r.code} value={r.code}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
        <div className="full">
          <button className="btn-primary" type="submit" disabled={busy} style={{ width: "auto" }}>
            {busy ? "Création…" : "Créer l'utilisateur"}
          </button>
        </div>
      </form>

      <div className="panel" style={{ marginTop: "1rem" }}>
        <h3 className="panel-title">Comptes existants</h3>
        <table className="data-table">
          <thead>
            <tr>
              <th>Nom</th>
              <th>E-mail</th>
              <th>Rôles</th>
              <th>Statut</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.fullName}</td>
                <td>{u.email}</td>
                <td>{u.roles.join(", ")}</td>
                <td>{u.active ? "Actif" : "Désactivé"}</td>
                <td>
                  {u.email !== session?.username ? (
                    <button
                      type="button"
                      className="btn-secondary btn-sm"
                      onClick={() => {
                        setEcUserActive(u.email, !u.active);
                        setBump((n) => n + 1);
                      }}
                    >
                      {u.active ? "Désactiver" : "Réactiver"}
                    </button>
                  ) : (
                    <span className="muted small">Vous</span>
                  )}
                </td>
              </tr>
            ))}
            {!users.length ? (
              <tr>
                <td colSpan={5} className="muted">
                  Aucun compte
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
