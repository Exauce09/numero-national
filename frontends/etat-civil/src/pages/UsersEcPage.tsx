/** Gestion des utilisateurs du bureau — après le 1er divinter. */

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { syncHospitalFacilitiesFromRequests } from "../accountRegistration";
import { getSession } from "../auth";
import {
  canActorManageUser,
  canManageEcUsers,
  createEcUser,
  deleteEcUser,
  EC_ROLE_CATALOG,
  getEcUserByEmail,
  isProtectedPlatformAdmin,
  isSuperAdminNational,
  listEcUsers,
  setEcUserActive,
  updateEcUser,
  type EcUser,
  type EcUserRole,
} from "../ecUsers";
import {
  deleteFacilityAccount,
  listFacilityAccounts,
  setFacilityAccountActive,
  updateFacilityAccount,
  type FacilityAccount,
  type FacilityAccountPublic,
} from "../healthAuth";
import PasswordField from "../components/PasswordField";
import { roleTitleFor } from "../rbac";

function rolesLabel(roles: EcUserRole[]): string {
  return [...new Set(roles.map((r) => roleTitleFor([r])))].join(", ");
}

const FACILITY_TYPES: { value: FacilityAccount["facilityType"]; label: string }[] = [
  { value: "HOPITAL", label: "Hôpital" },
  { value: "CLINIQUE", label: "Clinique" },
  { value: "CS", label: "Centre de santé" },
  { value: "MATERNITE", label: "Maternité" },
];

type UserForm = {
  id: string;
  fullName: string;
  email: string;
  role: EcUserRole;
  active: boolean;
  password: string;
};

type FacilityForm = {
  id: string;
  facilityName: string;
  facilityType: FacilityAccount["facilityType"];
  username: string;
  email: string;
  province: string;
  ville: string;
  commune_name: string;
  password: string;
};

type PendingDelete =
  | { kind: "user"; user: EcUser }
  | { kind: "facility"; facility: FacilityAccountPublic };

export default function UsersEcPage() {
  const session = getSession();
  const actor = session?.username ? getEcUserByEmail(session.username) : undefined;
  const canManage = canManageEcUsers(session?.roles);
  const isSuper = isSuperAdminNational(session?.roles);
  const roleOptions = EC_ROLE_CATALOG.filter(
    (r) => (isSuper || r.code !== "SUPER_ADMIN_NATIONAL") && r.code !== "ADMIN_PROVINCIAL",
  );
  const [bump, setBump] = useState(0);
  const users = useMemo(() => {
    const all = listEcUsers();
    // Divinter : ne voit pas l'État civil national (Hervé) dans sa liste de gestion.
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

  const [userForm, setUserForm] = useState<UserForm | null>(null);
  const [facilityForm, setFacilityForm] = useState<FacilityForm | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const editRoleOptions = roleOptions.filter((r) => r.code !== "SUPER_ADMIN_NATIONAL");

  function openUserEdit(u: EcUser) {
    setFormError(null);
    setUserForm({
      id: u.id,
      fullName: u.fullName,
      email: u.email,
      role: u.roles.find((r) => r !== "SUPER_ADMIN_NATIONAL" && r !== "ADMIN_PROVINCIAL") ??
        (u.roles.includes("ADMIN_PROVINCIAL") ? "RESPONSABLE_BUREAU" : "AGENT_ETAT_CIVIL"),
      active: u.active,
      password: "",
    });
  }

  function openFacilityEdit(f: FacilityAccountPublic) {
    setFormError(null);
    setFacilityForm({
      id: f.id,
      facilityName: f.facilityName,
      facilityType: f.facilityType,
      username: f.username,
      email: f.email ?? "",
      province: f.province,
      ville: f.ville,
      commune_name: f.commune_name,
      password: "",
    });
  }

  async function saveUserEdit(e: FormEvent) {
    e.preventDefault();
    if (!actor || !userForm) return;
    setFormError(null);
    setBusy(true);
    try {
      const saved = await updateEcUser(actor, userForm.id, {
        fullName: userForm.fullName,
        email: userForm.email,
        roles: [userForm.role],
        active: userForm.active,
        password: userForm.password || undefined,
      });
      setMessage(`Compte modifié : ${saved.fullName} (${rolesLabel(saved.roles)})`);
      setError(null);
      setUserForm(null);
      setBump((n) => n + 1);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Modification impossible");
    } finally {
      setBusy(false);
    }
  }

  async function saveFacilityEdit(e: FormEvent) {
    e.preventDefault();
    if (!facilityForm) return;
    const prev = facilities.find((f) => f.id === facilityForm.id);
    if (!prev) return;
    setFormError(null);
    setBusy(true);
    try {
      const geoChanged =
        prev.province !== facilityForm.province.trim() ||
        prev.ville !== facilityForm.ville.trim() ||
        prev.commune_name !== facilityForm.commune_name.trim();
      const commune = facilityForm.commune_name.trim();
      const saved = await updateFacilityAccount(facilityForm.id, {
        username: facilityForm.username,
        password: facilityForm.password || undefined,
        facilityName: facilityForm.facilityName,
        facilityType: facilityForm.facilityType,
        email: facilityForm.email || undefined,
        province: facilityForm.province,
        ville: facilityForm.ville,
        commune_name: commune,
        commune_code: geoChanged ? commune.toUpperCase().replace(/\s+/g, "-") : prev.commune_code,
        quartier_name: geoChanged ? undefined : prev.quartier_name,
        district_name: geoChanged ? undefined : prev.district_name,
        localite_name: geoChanged ? undefined : prev.localite_name,
        geo_label: geoChanged
          ? [commune, facilityForm.ville.trim(), facilityForm.province.trim()].filter(Boolean).join(" · ")
          : prev.geo_label,
        geo_mode: geoChanged
          ? /kinshasa/i.test(facilityForm.province)
            ? "kinshasa"
            : "province"
          : prev.geo_mode,
      });
      setMessage(`Structure modifiée : ${saved.facilityName} (@${saved.username})`);
      setError(null);
      setFacilityForm(null);
      setBump((n) => n + 1);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Modification impossible");
    } finally {
      setBusy(false);
    }
  }

  function confirmDelete() {
    if (!pendingDelete || !actor) return;
    try {
      if (pendingDelete.kind === "user") {
        const removed = deleteEcUser(actor, pendingDelete.user.id);
        setMessage(`Compte supprimé : ${removed.fullName} (${removed.email})`);
      } else {
        deleteFacilityAccount(pendingDelete.facility.id);
        setMessage(
          `Structure supprimée : ${pendingDelete.facility.facilityName} (@${pendingDelete.facility.username})`,
        );
      }
      setError(null);
      setBump((n) => n + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Suppression impossible");
    } finally {
      setPendingDelete(null);
    }
  }

  if (!canManage) {
    return (
      <div>
        <h2 className="page-title">Utilisateurs</h2>
        <div className="panel">
          <p className="muted">
            Seul l&apos;<strong>État civil national</strong> peut gérer les comptes bureau. Votre rôle :{" "}
            {roleTitleFor(session?.roles ?? []) || "—"}.
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
                    <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
                      <button
                        type="button"
                        className="btn-secondary btn-sm"
                        onClick={() => openUserEdit(u)}
                      >
                        Modifier
                      </button>
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
                      <button
                        type="button"
                        className="btn-secondary btn-sm btn-danger"
                        onClick={() => setPendingDelete({ kind: "user", user: u })}
                      >
                        Supprimer
                      </button>
                    </div>
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
          <h3 className="panel-title">Infirmiers titulaires — structures sanitaires (portail /sante)</h3>
          <p className="muted small" style={{ marginTop: 0 }}>
            Les infirmiers titulaires ne se connectent pas ici : utilisez{" "}
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
                    <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
                      <button
                        type="button"
                        className="btn-secondary btn-sm"
                        onClick={() => openFacilityEdit(f)}
                      >
                        Modifier
                      </button>
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
                      <button
                        type="button"
                        className="btn-secondary btn-sm btn-danger"
                        onClick={() => setPendingDelete({ kind: "facility", facility: f })}
                      >
                        Supprimer
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!facilities.length ? (
                <tr>
                  <td colSpan={6} className="muted">
                    Aucune structure sanitaire — créez-en via Inscription (type Infirmier titulaire) ou
                    Déclarations.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : null}

      {userForm ? (
        <div className="modal-backdrop" onClick={() => !busy && setUserForm(null)}>
          <form
            className="modal-panel form-grid"
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => void saveUserEdit(e)}
          >
            <h3 className="full">Modifier le compte</h3>
            {formError ? <div className="login-error full">{formError}</div> : null}
            <div>
              <label className="form-label">Nom complet *</label>
              <input
                className="form-control"
                value={userForm.fullName}
                onChange={(e) => setUserForm({ ...userForm, fullName: e.target.value })}
                required
                disabled={busy}
              />
            </div>
            <div>
              <label className="form-label">E-mail *</label>
              <input
                className="form-control"
                type="email"
                value={userForm.email}
                onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                required
                disabled={busy}
              />
            </div>
            <div>
              <label className="form-label">Rôle *</label>
              <select
                className="form-control"
                value={userForm.role}
                onChange={(e) => setUserForm({ ...userForm, role: e.target.value as EcUserRole })}
                disabled={busy}
              >
                {editRoleOptions.map((r) => (
                  <option key={r.code} value={r.code}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">Statut</label>
              <select
                className="form-control"
                value={userForm.active ? "1" : "0"}
                onChange={(e) => setUserForm({ ...userForm, active: e.target.value === "1" })}
                disabled={busy}
              >
                <option value="1">Actif</option>
                <option value="0">Désactivé</option>
              </select>
            </div>
            <div className="full">
              <PasswordField
                label="Nouveau mot de passe (laisser vide pour ne pas changer)"
                value={userForm.password}
                onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                minLength={8}
                disabled={busy}
                autoComplete="new-password"
              />
            </div>
            <div className="modal-actions full">
              <button
                type="button"
                className="btn-secondary"
                disabled={busy}
                onClick={() => setUserForm(null)}
              >
                Annuler
              </button>
              <button type="submit" className="btn-primary" style={{ width: "auto" }} disabled={busy}>
                {busy ? "Enregistrement…" : "Enregistrer"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {facilityForm ? (
        <div className="modal-backdrop" onClick={() => !busy && setFacilityForm(null)}>
          <form
            className="modal-panel modal-wide form-grid"
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => void saveFacilityEdit(e)}
          >
            <h3 className="full">Modifier la structure sanitaire</h3>
            {formError ? <div className="login-error full">{formError}</div> : null}
            <div>
              <label className="form-label">Nom de la structure *</label>
              <input
                className="form-control"
                value={facilityForm.facilityName}
                onChange={(e) => setFacilityForm({ ...facilityForm, facilityName: e.target.value })}
                required
                disabled={busy}
              />
            </div>
            <div>
              <label className="form-label">Type *</label>
              <select
                className="form-control"
                value={facilityForm.facilityType}
                onChange={(e) =>
                  setFacilityForm({
                    ...facilityForm,
                    facilityType: e.target.value as FacilityAccount["facilityType"],
                  })
                }
                disabled={busy}
              >
                {FACILITY_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">Identifiant *</label>
              <input
                className="form-control"
                value={facilityForm.username}
                onChange={(e) => setFacilityForm({ ...facilityForm, username: e.target.value })}
                required
                disabled={busy}
              />
            </div>
            <div>
              <label className="form-label">E-mail</label>
              <input
                className="form-control"
                type="email"
                value={facilityForm.email}
                onChange={(e) => setFacilityForm({ ...facilityForm, email: e.target.value })}
                disabled={busy}
              />
            </div>
            <div>
              <label className="form-label">Province *</label>
              <input
                className="form-control"
                value={facilityForm.province}
                onChange={(e) => setFacilityForm({ ...facilityForm, province: e.target.value })}
                required
                disabled={busy}
              />
            </div>
            <div>
              <label className="form-label">Ville / territoire</label>
              <input
                className="form-control"
                value={facilityForm.ville}
                onChange={(e) => setFacilityForm({ ...facilityForm, ville: e.target.value })}
                disabled={busy}
              />
            </div>
            <div>
              <label className="form-label">Commune / secteur *</label>
              <input
                className="form-control"
                value={facilityForm.commune_name}
                onChange={(e) => setFacilityForm({ ...facilityForm, commune_name: e.target.value })}
                required
                disabled={busy}
              />
            </div>
            <div>
              <PasswordField
                label="Nouveau mot de passe (facultatif)"
                value={facilityForm.password}
                onChange={(e) => setFacilityForm({ ...facilityForm, password: e.target.value })}
                minLength={8}
                disabled={busy}
                autoComplete="new-password"
              />
            </div>
            <div className="modal-actions full">
              <button
                type="button"
                className="btn-secondary"
                disabled={busy}
                onClick={() => setFacilityForm(null)}
              >
                Annuler
              </button>
              <button type="submit" className="btn-primary" style={{ width: "auto" }} disabled={busy}>
                {busy ? "Enregistrement…" : "Enregistrer"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {pendingDelete ? (
        <div className="modal-backdrop" onClick={() => setPendingDelete(null)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <h3>{pendingDelete.kind === "user" ? "Supprimer le compte" : "Supprimer la structure"}</h3>
            <p>
              Cette action est irréversible : le compte ne pourra plus se connecter et ne sera pas recréé
              automatiquement.
            </p>
            <p>
              {pendingDelete.kind === "user" ? (
                <>
                  <strong>{pendingDelete.user.fullName}</strong> — {pendingDelete.user.email} (
                  {rolesLabel(pendingDelete.user.roles)})
                </>
              ) : (
                <>
                  <strong>{pendingDelete.facility.facilityName}</strong> —{" "}
                  <code>@{pendingDelete.facility.username}</code>
                </>
              )}
            </p>
            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={() => setPendingDelete(null)}>
                Annuler
              </button>
              <button
                type="button"
                className="btn-primary btn-danger"
                style={{ width: "auto" }}
                onClick={confirmDelete}
              >
                Confirmer la suppression
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
