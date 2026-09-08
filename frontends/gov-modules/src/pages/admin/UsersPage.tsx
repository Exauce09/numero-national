import { FormEvent, useEffect, useState } from "react";
import { api, type UserMe } from "../../api";

export default function UsersPage() {
  const [users, setUsers] = useState<UserMe[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [roleCodes, setRoleCodes] = useState("ADMIN");

  async function refresh() {
    setUsers(await api.rbacUsers());
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function onRegister(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(null);
    try {
      await api.registerUser({
        email: email.trim(),
        password,
        full_name: fullName.trim(),
        role_codes: roleCodes
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      });
      setOk("Utilisateur enregistré.");
      setEmail("");
      setPassword("");
      setFullName("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Enregistrement impossible");
    }
  }

  async function toggleActive(u: UserMe) {
    setError(null);
    try {
      await api.setUserActive(u.id, !u.is_active);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Mise à jour impossible");
    }
  }

  async function assign(u: UserMe) {
    const codes = window.prompt("Codes rôles (séparés par des virgules)", (u.role_codes ?? u.roles ?? []).join(","));
    if (codes == null) return;
    setError(null);
    try {
      await api.assignRoles(
        u.id,
        codes
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      );
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Affectation impossible");
    }
  }

  return (
    <div>
      <h2 className="page-title">Utilisateurs</h2>
      <p className="page-lead">Gestion des comptes, activation et rôles.</p>
      {error ? <div className="login-error">{error}</div> : null}
      {ok ? <div className="success-banner">{ok}</div> : null}

      <div className="panel" style={{ marginBottom: "1.25rem" }}>
        <h3 style={{ marginTop: 0 }}>Enregistrer un utilisateur</h3>
        <form className="form-grid" onSubmit={onRegister}>
          <div>
            <label className="form-label" htmlFor="email">
              E-mail
            </label>
            <input
              id="email"
              className="form-control"
              type="email"
              required
              value={email}
              onChange={(ev) => setEmail(ev.target.value)}
            />
          </div>
          <div>
            <label className="form-label" htmlFor="password">
              Mot de passe
            </label>
            <input
              id="password"
              className="form-control"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(ev) => setPassword(ev.target.value)}
            />
          </div>
          <div>
            <label className="form-label" htmlFor="full_name">
              Nom complet
            </label>
            <input
              id="full_name"
              className="form-control"
              required
              value={fullName}
              onChange={(ev) => setFullName(ev.target.value)}
            />
          </div>
          <div>
            <label className="form-label" htmlFor="role_codes">
              Rôles (codes, virgules)
            </label>
            <input
              id="role_codes"
              className="form-control"
              value={roleCodes}
              onChange={(ev) => setRoleCodes(ev.target.value)}
            />
          </div>
          <div className="full">
            <button type="submit" className="btn-primary" style={{ width: "auto" }}>
              Enregistrer
            </button>
          </div>
        </form>
      </div>

      <div className="panel">
        <table className="data-table">
          <thead>
            <tr>
              <th>Nom</th>
              <th>E-mail</th>
              <th>Rôles</th>
              <th>Actif</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.full_name}</td>
                <td>{u.email}</td>
                <td>{(u.role_codes ?? u.roles ?? []).join(", ") || "—"}</td>
                <td>{u.is_active ? "Oui" : "Non"}</td>
                <td>
                  <button type="button" className="btn-secondary btn-sm" onClick={() => void toggleActive(u)}>
                    {u.is_active ? "Désactiver" : "Activer"}
                  </button>{" "}
                  <button type="button" className="btn-secondary btn-sm" onClick={() => void assign(u)}>
                    Rôles
                  </button>
                </td>
              </tr>
            ))}
            {!users.length ? (
              <tr>
                <td colSpan={5} className="muted">
                  Aucun utilisateur.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
