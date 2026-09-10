import { FormEvent, useEffect, useState } from "react";
import {
  api,
  demoListDeclarations,
  demoValidateDeclaration,
  type Declaration,
} from "../api";
import { addAct, addPerson, getPersonByNic, type Sexe } from "../registry";
import { pushNotification } from "../prefs";
import { setDeclarationStatus } from "../civilDeclarations";
import {
  HEALTH_DEMO_USER,
  createFacilityAccount,
  deleteFacilityAccount,
  listFacilityAccounts,
  setFacilityAccountActive,
  updateFacilityAccount,
  type FacilityAccount,
  type FacilityAccountPublic,
} from "../healthAuth";
import GpsLocatePanel from "../components/GpsLocatePanel";

const FACILITY_TYPES: { value: FacilityAccount["facilityType"]; label: string }[] = [
  { value: "HOPITAL", label: "Hôpital" },
  { value: "CLINIQUE", label: "Clinique" },
  { value: "CS", label: "Centre de santé" },
  { value: "MATERNITE", label: "Maternité" },
];

const emptyAccountForm = {
  facilityName: "",
  facilityType: "HOPITAL" as FacilityAccount["facilityType"],
  province: "Kinshasa",
  ville: "Kinshasa",
  communeName: "Gombe",
  communeCode: "KIN-GOMBE",
  username: "",
  password: "",
  confirmPassword: "",
};

type PendingAction =
  | { type: "activate" | "deactivate" | "delete"; account: FacilityAccountPublic }
  | null;

export default function DeclarationsPage() {
  const [rows, setRows] = useState<Declaration[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Declaration | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<FacilityAccountPublic[]>(() => listFacilityAccounts());
  const [form, setForm] = useState(emptyAccountForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [formOk, setFormOk] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingAction>(null);
  const [actionBusy, setActionBusy] = useState(false);

  async function refresh() {
    try {
      setRows(await api.listDeclarations("PENDING_OFFICER"));
    } catch {
      setRows(demoListDeclarations());
    }
  }

  function refreshAccounts() {
    setAccounts(listFacilityAccounts());
  }

  useEffect(() => {
    void refresh();
    refreshAccounts();
  }, []);

  function applyToRegistry(d: Declaration) {
    const commune = String(d.payload.commune_code ?? "KIN-GOMBE");
    if (d.declaration_type === "BIRTH") {
      const sexe = (String(d.payload.sexe ?? "M").toUpperCase() === "F" ? "F" : "M") as Sexe;
      const child = addPerson({
        nom: String(d.payload.child_nom ?? "INCONNU"),
        postnom: String(d.payload.child_postnom ?? ""),
        prenom: String(d.payload.child_prenom ?? ""),
        sexe,
        date_naissance: String(d.payload.date_naissance ?? ""),
        lieu_naissance: String(d.payload.lieu_naissance ?? d.payload.facility_name ?? ""),
        etat_civil: "CELIBATAIRE",
      });
      await addAct(
        "BIRTH",
        {
          ...d.payload,
          child_id: child.id,
          nom: child.nom,
          postnom: child.postnom,
          prenom: child.prenom,
          sexe: child.sexe,
          date_naissance: child.date_naissance,
          lieu_naissance: child.lieu_naissance,
          commune_code: commune,
          source: "HOSPITAL",
          declaration_id: d.id,
        },
        child.nic,
      );
      return child.nic;
    }
    if (d.declaration_type === "DEATH") {
      const name = String(d.payload.deceased_name ?? "INCONNU");
      const existing = getPersonByNic(String(d.payload.deceased_nic ?? ""));
      await addAct(
        "DEATH",
        {
          ...d.payload,
          deceased_id: existing?.id ?? null,
          deceased_name: name,
          commune_code: commune,
          source: "HOSPITAL",
          declaration_id: d.id,
        },
        existing?.nic ?? `HOSP-${d.id.slice(0, 8)}`,
      );
      return name;
    }
    return null;
  }

  async function onValidate(id: string, reject: boolean) {
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      await api.validateDeclaration(id, {
        commune_code: String(rows.find((r) => r.id === id)?.payload.commune_code ?? "KIN-GOMBE"),
        reject,
        rejection_reason: reject ? "Rejeté par l'officier" : undefined,
      });
      setMessage(reject ? "Déclaration rejetée." : "Déclaration validée via API.");
    } catch {
      const d = rows.find((x) => x.id === id);
      if (!reject && d) {
        try {
          applyToRegistry(d);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Validation locale partielle.");
        }
      }
      demoValidateDeclaration(id, reject);
      setDeclarationStatus(id, reject ? "REJECTED" : "VALIDATED");
      setMessage(
        reject
          ? "Déclaration rejetée (mode local)."
          : "Déclaration validée — registre mis à jour (naissance/décès).",
      );
      pushNotification({
        title: reject ? "Déclaration rejetée" : "Déclaration validée",
        body: reject
          ? "La structure sanitaire a été informée du rejet (statut local)."
          : "Le registre communal a été mis à jour suite à la validation hôpital.",
        href: d?.declaration_type === "DEATH" ? "/deaths" : "/births",
      });
    }
    setSelected(null);
    await refresh();
    setBusy(false);
  }

  function openCreate() {
    setEditingId(null);
    setForm(emptyAccountForm);
    setFormError(null);
    setFormOk(null);
    setFormOpen(true);
  }

  function startEdit(account: FacilityAccountPublic) {
    setPending(null);
    setEditingId(account.id);
    setForm({
      facilityName: account.facilityName,
      facilityType: account.facilityType,
      province: account.province || "Kinshasa",
      ville: account.ville || "Kinshasa",
      communeName: account.commune_name || "Gombe",
      communeCode: account.commune_code || "KIN-GOMBE",
      username: account.username,
      password: "",
      confirmPassword: "",
    });
    setFormError(null);
    setFormOk(null);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingId(null);
    setForm(emptyAccountForm);
    setFormError(null);
    setFormOk(null);
  }

  function onSaveAccount(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setFormOk(null);
    setError(null);

    const pwd = form.password.trim();
    const confirm = form.confirmPassword.trim();
    if (pwd || confirm) {
      if (pwd !== confirm) {
        setFormError("La confirmation du mot de passe ne correspond pas.");
        return;
      }
      if (pwd.length < 8) {
        setFormError("Le mot de passe doit contenir au moins 8 caractères.");
        return;
      }
    }

    try {
      if (editingId) {
        const account = updateFacilityAccount(editingId, {
          username: form.username,
          password: pwd || undefined,
          facilityName: form.facilityName,
          facilityType: form.facilityType,
          commune_code: form.communeCode,
          commune_name: form.communeName,
          province: form.province,
          ville: form.ville,
        });
        refreshAccounts();
        setMessage(`Compte modifié : ${account.facilityName} (@${account.username}).`);
        pushNotification({
          title: "Compte structure sanitaire modifié",
          body: `${account.facilityName} — identifiant ${account.username}.`,
          href: "/declarations",
        });
        closeForm();
      } else {
        if (!pwd) {
          setFormError("Le mot de passe est requis pour un nouveau compte.");
          return;
        }
        const account = createFacilityAccount({
          username: form.username,
          password: pwd,
          facilityName: form.facilityName,
          facilityType: form.facilityType,
          commune_code: form.communeCode,
          commune_name: form.communeName,
          province: form.province,
          ville: form.ville,
        });
        refreshAccounts();
        setMessage(
          `Compte créé : ${account.facilityName} (@${account.username}). Connexion : /sante/login`,
        );
        pushNotification({
          title: "Compte structure sanitaire créé",
          body: `${account.facilityName} — identifiant ${account.username}. L'administrateur peut se connecter sur /sante/login.`,
          href: "/declarations",
        });
        closeForm();
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Enregistrement impossible.");
    }
  }

  function requestAction(type: "activate" | "deactivate" | "delete", account: FacilityAccountPublic) {
    setError(null);
    setMessage(null);
    if (type === "delete" && account.username === HEALTH_DEMO_USER) {
      setError("Le compte démo ne peut pas être supprimé (désactivez-le si besoin).");
      return;
    }
    setPending({ type, account });
  }

  function runPendingAction() {
    if (!pending) return;
    setActionBusy(true);
    setError(null);
    setMessage(null);
    const { type, account } = pending;
    try {
      if (type === "delete") {
        deleteFacilityAccount(account.id);
        if (editingId === account.id) closeForm();
        setMessage(`Compte supprimé : ${account.facilityName} (@${account.username}).`);
        pushNotification({
          title: "Compte structure sanitaire supprimé",
          body: `${account.facilityName} (@${account.username}).`,
          href: "/declarations",
        });
      } else {
        const active = type === "activate";
        const updated = setFacilityAccountActive(account.id, active);
        if (!updated.active && editingId === account.id) closeForm();
        setMessage(
          active
            ? `Compte activé : ${updated.facilityName} (@${updated.username}).`
            : `Compte désactivé : ${updated.facilityName} (@${updated.username}).`,
        );
        pushNotification({
          title: active ? "Compte sanitaire activé" : "Compte sanitaire désactivé",
          body: `${updated.facilityName} (@${updated.username}).`,
          href: "/declarations",
        });
      }
      refreshAccounts();
      setPending(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action impossible.");
    } finally {
      setActionBusy(false);
    }
  }

  return (
    <div>
      <h2 className="page-title">Déclarations structures sanitaires</h2>
      <p className="page-lead">
        File d&apos;attente des naissances et décès notifiés par les hôpitaux / cliniques — à valider pour mise à
        jour du système. Gérez aussi les comptes administrateurs des structures sanitaires.
      </p>

      {message ? <div className="success-banner">{message}</div> : null}
      {error ? <div className="login-error">{error}</div> : null}

      <div className="panel">
        <div className="panel-head">
          <h3 className="panel-title" style={{ margin: 0 }}>
            Comptes structures sanitaires
          </h3>
          <div className="toolbar" style={{ margin: 0 }}>
            <button type="button" className="btn-secondary btn-sm" onClick={refreshAccounts}>
              Actualiser
            </button>
            <button type="button" className="btn-primary btn-sm" onClick={openCreate}>
              Créer un compte
            </button>
          </div>
        </div>
        <p className="muted small" style={{ marginTop: 0 }}>
          Modifier, activer, désactiver ou supprimer un compte. Un compte désactivé ne peut plus se connecter
          sur <code>/sante/login</code>.
        </p>
        <table className="data-table">
          <thead>
            <tr>
              <th>Structure</th>
              <th>Type</th>
              <th>Identifiant</th>
              <th>Commune</th>
              <th>Statut</th>
              <th>Créé</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {accounts.length === 0 ? (
              <tr>
                <td colSpan={7} className="muted">
                  Aucun compte.
                </td>
              </tr>
            ) : (
              accounts.map((a) => (
                <tr key={a.id}>
                  <td>{a.facilityName}</td>
                  <td>{FACILITY_TYPES.find((t) => t.value === a.facilityType)?.label ?? a.facilityType}</td>
                  <td>
                    <code>{a.username}</code>
                  </td>
                  <td>{a.commune_name}</td>
                  <td>
                    <strong style={{ color: a.active ? "#1a5f4a" : "#8a4b1a" }}>
                      {a.active ? "Actif" : "Désactivé"}
                    </strong>
                  </td>
                  <td>{new Date(a.created_at).toLocaleString("fr-FR")}</td>
                  <td>
                    <div className="table-actions">
                      <button type="button" className="btn-secondary btn-sm" onClick={() => startEdit(a)}>
                        Modifier
                      </button>
                      {a.active ? (
                        <button
                          type="button"
                          className="btn-secondary btn-sm"
                          onClick={() => requestAction("deactivate", a)}
                        >
                          Désactiver
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn-primary btn-sm"
                          onClick={() => requestAction("activate", a)}
                        >
                          Activer
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn-secondary btn-sm"
                        disabled={a.username === HEALTH_DEMO_USER}
                        title={
                          a.username === HEALTH_DEMO_USER
                            ? "Le compte démo ne peut pas être supprimé"
                            : "Supprimer"
                        }
                        onClick={() => requestAction("delete", a)}
                      >
                        Supprimer
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="panel">
        <div className="toolbar">
          <button type="button" className="btn-secondary" onClick={() => void refresh()}>
            Actualiser la file
          </button>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Structure</th>
              <th>Résumé</th>
              <th>Créée</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="muted">
                  Aucune déclaration en attente.
                </td>
              </tr>
            ) : (
              rows.map((d) => (
                <tr key={d.id}>
                  <td>{d.declaration_type === "BIRTH" ? "Naissance" : "Décès"}</td>
                  <td>{String(d.payload.facility_name ?? d.source)}</td>
                  <td>
                    {d.declaration_type === "BIRTH"
                      ? `${d.payload.child_nom ?? ""} ${d.payload.child_prenom ?? ""}`.trim() || "—"
                      : String(d.payload.deceased_name ?? "—")}
                  </td>
                  <td>{new Date(d.created_at).toLocaleString("fr-FR")}</td>
                  <td>
                    <div className="table-actions">
                      <button type="button" className="btn-secondary btn-sm" onClick={() => setSelected(d)}>
                        Voir
                      </button>
                      <button
                        type="button"
                        className="btn-primary btn-sm"
                        disabled={busy}
                        onClick={() => void onValidate(d.id, false)}
                      >
                        Valider
                      </button>
                      <button
                        type="button"
                        className="btn-secondary btn-sm"
                        disabled={busy}
                        onClick={() => void onValidate(d.id, true)}
                      >
                        Rejeter
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pending ? (
        <div className="modal-backdrop" onClick={() => !actionBusy && setPending(null)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <h3>
              {pending.type === "delete"
                ? "Supprimer le compte"
                : pending.type === "activate"
                  ? "Activer le compte"
                  : "Désactiver le compte"}
            </h3>
            <p>
              {pending.type === "delete"
                ? "Cette action est irréversible."
                : pending.type === "deactivate"
                  ? "L'administrateur ne pourra plus se connecter au module santé."
                  : "L'administrateur pourra à nouveau se connecter au module santé."}
            </p>
            <p>
              <strong>{pending.account.facilityName}</strong> — <code>@{pending.account.username}</code>
            </p>
            <div className="modal-actions">
              <button
                type="button"
                className="btn-secondary"
                disabled={actionBusy}
                onClick={() => setPending(null)}
              >
                Annuler
              </button>
              <button
                type="button"
                className="btn-primary"
                style={{ width: "auto" }}
                disabled={actionBusy}
                onClick={runPendingAction}
              >
                {actionBusy
                  ? "En cours…"
                  : pending.type === "delete"
                    ? "Confirmer la suppression"
                    : pending.type === "activate"
                      ? "Confirmer l'activation"
                      : "Confirmer la désactivation"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {formOpen ? (
        <div className="modal-backdrop" onClick={() => !actionBusy && closeForm()}>
          <div className="modal-panel modal-wide" onClick={(e) => e.stopPropagation()}>
            <div className="panel-head">
              <h3 className="panel-title" style={{ margin: 0 }}>
                {editingId ? "Modifier le compte" : "Créer un compte administrateur"}
              </h3>
              <button type="button" className="btn-secondary btn-sm" onClick={closeForm}>
                Fermer
              </button>
            </div>
            <p className="muted" style={{ marginTop: 0 }}>
              Accès module santé : <code>/sante/login</code>
            </p>

            <form className="form-grid" onSubmit={onSaveAccount} autoComplete="off">
              {formError ? <div className="login-error full">{formError}</div> : null}
              {formOk ? <div className="success-banner full">{formOk}</div> : null}

              <div className="full">
                <label className="form-label">Nom de la structure</label>
                <input
                  className="form-control"
                  value={form.facilityName}
                  onChange={(e) => setForm({ ...form, facilityName: e.target.value })}
                  required
                  placeholder="Ex. Hôpital Général de Référence — Gombe"
                />
              </div>
              <div>
                <label className="form-label">Type</label>
                <select
                  className="form-control"
                  value={form.facilityType}
                  onChange={(e) =>
                    setForm({ ...form, facilityType: e.target.value as FacilityAccount["facilityType"] })
                  }
                >
                  {FACILITY_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="full">
                <GpsLocatePanel
                  title="GPS de la structure"
                  onResolved={(g) =>
                    setForm((f) => ({
                      ...f,
                      province: g.province || f.province,
                      ville: g.ville || f.ville,
                      communeName: g.commune || f.communeName,
                    }))
                  }
                />
              </div>
              <div>
                <label className="form-label">Province</label>
                <input
                  className="form-control"
                  value={form.province}
                  onChange={(e) => setForm({ ...form, province: e.target.value })}
                />
              </div>
              <div>
                <label className="form-label">Ville</label>
                <input
                  className="form-control"
                  value={form.ville}
                  onChange={(e) => setForm({ ...form, ville: e.target.value })}
                />
              </div>
              <div>
                <label className="form-label">Commune</label>
                <input
                  className="form-control"
                  value={form.communeName}
                  onChange={(e) => setForm({ ...form, communeName: e.target.value })}
                />
              </div>
              <div>
                <label className="form-label">Code commune</label>
                <input
                  className="form-control"
                  value={form.communeCode}
                  onChange={(e) => setForm({ ...form, communeCode: e.target.value })}
                />
              </div>
              <div>
                <label className="form-label">Identifiant administrateur</label>
                <input
                  className="form-control"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  required
                  placeholder="ex. hopital.gombe"
                />
              </div>
              <div>
                <label className="form-label">
                  {editingId ? "Nouveau mot de passe (optionnel)" : "Mot de passe"}
                </label>
                <input
                  className="form-control"
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required={!editingId}
                  placeholder={editingId ? "Laisser vide pour conserver" : undefined}
                />
              </div>
              <div>
                <label className="form-label">
                  {editingId ? "Confirmer le nouveau mot de passe" : "Confirmer le mot de passe"}
                </label>
                <input
                  className="form-control"
                  type="password"
                  value={form.confirmPassword}
                  onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                  required={!editingId || Boolean(form.password.trim())}
                />
              </div>
              <div className="full" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button type="submit" className="btn-primary" style={{ width: "auto", minWidth: 180 }}>
                  {editingId ? "Enregistrer" : "Créer le compte"}
                </button>
                <button type="button" className="btn-secondary" onClick={closeForm}>
                  Annuler
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {selected ? (
        <div className="modal-backdrop" onClick={() => setSelected(null)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <h3>
              Déclaration {selected.declaration_type === "BIRTH" ? "naissance" : "décès"}
            </h3>
            <pre style={{ whiteSpace: "pre-wrap", fontSize: "0.85rem" }}>
              {JSON.stringify(selected.payload, null, 2)}
            </pre>
            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={() => setSelected(null)}>
                Fermer
              </button>
              <button
                type="button"
                className="btn-primary"
                style={{ width: "auto" }}
                disabled={busy}
                onClick={() => void onValidate(selected.id, false)}
              >
                Valider et mettre à jour
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
