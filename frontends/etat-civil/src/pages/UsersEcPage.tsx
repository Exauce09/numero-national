/** Gestion des utilisateurs du bureau — après le 1er responsable. */

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { syncHospitalFacilitiesFromRequests } from "../accountRegistration";
import { getSession } from "../auth";
import {
  canActorManageUser,
  canManageEcUsers,
  createEcUser,
  EC_ROLE_CATALOG,
  getEcUserByEmail,
  isProtectedPlatformAdmin,
  isSuperAdminNational,
  listEcUsers,
  setEcUserActive,
  type EcUserRole,
} from "../ecUsers";
import {
  listFacilityAccounts,
  setFacilityAccountActive,
  type FacilityAccountPublic,
} from "../healthAuth";
import PasswordField from "../components/PasswordField";
import { roleTitleFor } from "../rbac";

function rolesLabel(roles: EcUserRole[]): string {
  return roles.map((r) => roleTitleFor([r])).join(", ");
}

export default function UsersEcPage() {
  const session = getSession();
  const actor = session?.username ? getEcUserByEmail(session.username) : undefined;
  const canManage = canManageEcUsers(session?.roles);
  const isSuper = isSuperAdminNational(session?.roles);
  const roleOptions = EC_ROLE_CATALOG.filter(
    (r) => isSuper || r.code !== "SUPER_ADMIN_NATIONAL",
  );
  const [bump, setBump] = useState(0);
  const users = useMemo(() => {
    const all = listEcUsers();
    // Responsable : ne voit pas le super admin (Hervé) dans sa liste de gestion.
    if (!isSuper) return all.filter((u) => !isProtectedPlatformAdmin(u));
    return all;
  }, [bump, isSuper]);

  const facilities = useMemo((): FacilityAccountPublic[] => {
    if (!isSuper) return [];
    return listFacilityAccounts();
  }, [bump, isSuper]);

  useEffect(() => {
    syncHospitalFacilitiesFromRequests();
    setBump((n) => n + 1);
  }, []);

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
      setMessage(`Compte créé : ${created.fullName} (${rolesLabel(created.roles)})`);
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
            Seul le <strong>responsable de bureau</strong> ou le{" "}
            <strong>super administrateur</strong> peut gérer les comptes bureau. Votre rôle :{" "}
            {roleTitleFor(session?.roles) || "—"}.
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
        {isSuper ? " Les structures sanitaires (/sante) apparaissent aussi ci-dessous." : null}
      </p>

      <div className="panel" style={{ marginBottom: "1.25rem" }}>
        <h3 className="panel-title">Rôles disponibles</h3>
        <ul style={{ margin: 0, paddingLeft: "1.2rem", lineHeight: 1.55 }}>
          {roleOptions.map((r) => (
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
          <PasswordField
            label="Mot de passe temporaire *"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            disabled={busy}
            autoComplete="new-password"
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
            {roleOptions.map((r) => (
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
        <h3 className="panel-title">Comptes bureau (état civil)</h3>
        <table className="data-table">
          <thead>
            <tr>
              <th>Nom</th>
              <th>E-mail / login</th>
              <th>Rôles</th>
              <th>Statut</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.fullName}</td>
                <td>
                  {u.email}
                  {u.username ? (
                    <>
                      <br />
                      <span className="muted small">@{u.username}</span>
                    </>
                  ) : null}
                </td>
                <td>{rolesLabel(u.roles)}</td>
                <td>{u.active ? "Actif" : "Désactivé"}</td>
                <td>
                  {actor && canActorManageUser(actor, u) ? (
                    <button
                      type="button"
                      className="btn-secondary btn-sm"
                      onClick={() => {
                        try {
                          setEcUserActive(u.email, !u.active, actor);
                          setError(null);
                          setBump((n) => n + 1);
                        } catch (err) {
                          setError(err instanceof Error ? err.message : "Action refusée.");
                        }
                      }}
                    >
                      {u.active ? "Désactiver" : "Réactiver"}
                    </button>
                  ) : u.email === session?.username ? (
                    <span className="muted small">Vous</span>
                  ) : (
                    <span className="muted small">Protégé</span>
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

      {isSuper ? (
        <div className="panel" style={{ marginTop: "1rem" }}>
          <h3 className="panel-title">Structures sanitaires (portail /sante)</h3>
          <p className="muted small" style={{ marginTop: 0 }}>
            Les hôpitaux / maternités ne se connectent pas ici : utilisez{" "}
            <Link to="/sante/login">/sante/login</Link>. Ils sont listés pour le suivi national.
          </p>
          <table className="data-table">
            <thead>
              <tr>
                <th>Structure</th>
                <th>Identifiant</th>
                <th>Type</th>
                <th>Lieu</th>
                <th>Statut</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {facilities.map((f) => (
                <tr key={f.id}>
                  <td>{f.facilityName}</td>
                  <td>
                    <code>@{f.username}</code>
                  </td>
                  <td>{f.facilityType}</td>
                  <td>{f.geo_label || [f.commune_name, f.ville, f.province].filter(Boolean).join(" · ")}</td>
                  <td>{f.active ? "Actif" : "Désactivé"}</td>
                  <td>
                    <button
                      type="button"
                      className="btn-secondary btn-sm"
                      onClick={() => {
                        try {
                          setFacilityAccountActive(f.id, !f.active);
                          setError(null);
                          setBump((n) => n + 1);
                        } catch (err) {
                          setError(err instanceof Error ? err.message : "Action refusée.");
                        }
                      }}
                    >
                      {f.active ? "Désactiver" : "Réactiver"}
                    </button>
                  </td>
                </tr>
              ))}
              {!facilities.length ? (
                <tr>
                  <td colSpan={6} className="muted">
                    Aucune structure sanitaire — créez-en via Inscription (type Hôpital) ou
                    Déclarations.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
