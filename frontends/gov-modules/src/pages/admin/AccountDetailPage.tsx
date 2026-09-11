import { FormEvent, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  api,
  type AccountDetail,
  type AssignableRolesResponse,
  type Bureau,
  type GeoItem,
  type HistoryEvent,
} from "../../api";

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Actif",
  PENDING: "En attente",
  SUSPENDED: "Suspendu",
  DISABLED: "Désactivé",
};

export default function AccountDetailPage() {
  const { id = "" } = useParams();
  const [detail, setDetail] = useState<AccountDetail | null>(null);
  const [history, setHistory] = useState<HistoryEvent[]>([]);
  const [rolesPack, setRolesPack] = useState<AssignableRolesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [roleModal, setRoleModal] = useState(false);
  const [newRole, setNewRole] = useState("");
  const [roleReason, setRoleReason] = useState("");

  const [statusModal, setStatusModal] = useState<"suspend" | "disable" | "activate" | null>(null);
  const [statusReason, setStatusReason] = useState("");
  const [until, setUntil] = useState("");

  const [assignModal, setAssignModal] = useState(false);
  const [provinces, setProvinces] = useState<GeoItem[]>([]);
  const [bureaux, setBureaux] = useState<Bureau[]>([]);
  const [provinceId, setProvinceId] = useState("");
  const [bureauId, setBureauId] = useState("");
  const [functionCode, setFunctionCode] = useState("AGENT_ETAT_CIVIL");
  const [inviteToken, setInviteToken] = useState<string | null>(null);

  async function refresh() {
    if (!id) return;
    setError(null);
    try {
      const [d, h, roles] = await Promise.all([
        api.accountDetail(id),
        api.accountHistory(id),
        api.assignableRoles(),
      ]);
      setDetail(d);
      setHistory(h);
      setRolesPack(roles);
      setNewRole(d.user.role_codes[0] || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chargement impossible");
    }
  }

  useEffect(() => {
    void refresh();
    void api.geoProvinces().then(setProvinces);
  }, [id]);

  useEffect(() => {
    if (!provinceId) return;
    void api.listBureaux({ province_id: provinceId }).then(setBureaux);
  }, [provinceId]);

  async function onChangeRole(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.changeRole(id, { role_code: newRole, reason: roleReason.trim() });
      setRoleModal(false);
      setRoleReason("");
      setOk("Rôle modifié — audit ROLE_CHANGED enregistré.");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Modification refusée");
    } finally {
      setBusy(false);
    }
  }

  async function onStatus(e: FormEvent) {
    e.preventDefault();
    if (!statusModal) return;
    setBusy(true);
    setError(null);
    try {
      if (statusModal === "suspend") await api.suspendUser(id, statusReason, until || undefined);
      if (statusModal === "disable") await api.disableUser(id, statusReason);
      if (statusModal === "activate") await api.activateUser(id, statusReason);
      setStatusModal(null);
      setStatusReason("");
      setOk("Statut du compte mis à jour.");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Opération refusée");
    } finally {
      setBusy(false);
    }
  }

  async function onChangeAssignment(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.changeAssignment(id, {
        province_id: provinceId || null,
        bureau_id: bureauId,
        function_code: functionCode,
        start_date: new Date().toISOString().slice(0, 10),
        open_ended: true,
        justification: "Mutation administrative",
      });
      setAssignModal(false);
      setOk("Affectation mise à jour — ancien bureau clôturé.");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Mutation refusée");
    } finally {
      setBusy(false);
    }
  }

  async function onResetAccess() {
    setBusy(true);
    setError(null);
    try {
      const res = await api.resetAccess(id);
      setInviteToken(res.invite_token || null);
      setOk("Invitation régénérée.");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Réinitialisation refusée");
    } finally {
      setBusy(false);
    }
  }

  if (!detail) {
    return <div className="panel">{error || "Chargement…"}</div>;
  }

  const u = detail.user;
  const st = u.account_status;

  return (
    <div>
      <div className="page-header-row">
        <div>
          <h2 className="page-title">{u.full_name}</h2>
          <p className="page-lead">
            {u.email} · {STATUS_LABEL[st] || st}
          </p>
        </div>
        <Link className="btn-secondary" to="..">
          Retour liste
        </Link>
      </div>

      {error ? <div className="login-error">{error}</div> : null}
      {ok ? <div className="success-banner">{ok}</div> : null}
      {inviteToken ? (
        <div className="success-banner">
          Jeton d'invitation : <code>{inviteToken}</code>
          <button
            type="button"
            className="btn-sm btn-secondary"
            style={{ marginLeft: "0.75rem" }}
            onClick={() => void navigator.clipboard.writeText(inviteToken)}
          >
            Copier
          </button>
        </div>
      ) : null}

      <div className="action-row" style={{ marginBottom: "1rem" }}>
        <button type="button" className="btn-secondary btn-sm" onClick={() => setRoleModal(true)}>
          Modifier le rôle
        </button>
        <button type="button" className="btn-secondary btn-sm" onClick={() => setAssignModal(true)}>
          Changer l'affectation
        </button>
        {st !== "SUSPENDED" ? (
          <button type="button" className="btn-secondary btn-sm" onClick={() => setStatusModal("suspend")}>
            Suspendre
          </button>
        ) : null}
        {st !== "DISABLED" ? (
          <button type="button" className="btn-secondary btn-sm" onClick={() => setStatusModal("disable")}>
            Désactiver
          </button>
        ) : null}
        {st === "DISABLED" || st === "SUSPENDED" || st === "PENDING" ? (
          <button type="button" className="btn-secondary btn-sm" onClick={() => setStatusModal("activate")}>
            Réactiver
          </button>
        ) : null}
        <button type="button" className="btn-secondary btn-sm" disabled={busy} onClick={() => void onResetAccess()}>
          Réinitialiser accès
        </button>
      </div>

      <div className="detail-grid">
        <section className="panel">
          <h3>Informations personnelles / personnel</h3>
          {detail.personnel ? (
            <>
              <p>
                {detail.personnel.given_names} {detail.personnel.postnom || ""} {detail.personnel.family_name}
              </p>
              <p>Matricule : {detail.personnel.matricule}</p>
              <p>Fonction : {detail.personnel.function_title || "—"}</p>
              <p>Statut personnel : {detail.personnel.status}</p>
            </>
          ) : (
            <p className="muted">Aucun dossier personnel lié.</p>
          )}
        </section>

        <section className="panel">
          <h3>Affectation</h3>
          {detail.assignment ? (
            <>
              <p>Fonction : {detail.assignment.function_code}</p>
              <p>Bureau : {u.bureau_name || detail.assignment.bureau_id || "—"}</p>
              <p>
                Du {detail.assignment.start_date}
                {detail.assignment.end_date ? ` au ${detail.assignment.end_date}` : " (sans fin)"}
              </p>
              <p>Statut : {detail.assignment.status}</p>
            </>
          ) : (
            <p className="muted">Pas d'affectation active.</p>
          )}
        </section>

        <section className="panel">
          <h3>Compte</h3>
          <p>Email : {u.email}</p>
          <p>Statut : {STATUS_LABEL[st] || st}</p>
          <p>Actif (legacy) : {u.is_active ? "oui" : "non"}</p>
          <p>
            Dernière connexion :{" "}
            {u.last_login_at ? new Date(u.last_login_at).toLocaleString("fr-CD") : "—"}
          </p>
        </section>

        <section className="panel">
          <h3>Rôle & permissions</h3>
          <p>{(u.role_codes || []).join(", ") || "—"}</p>
          <ul className="perm-list">
            {detail.permissions.slice(0, 20).map((p) => (
              <li key={p}>✓ {p}</li>
            ))}
          </ul>
        </section>

        <section className="panel">
          <h3>Périmètre (scopes)</h3>
          {detail.scopes.length === 0 ? (
            <p className="muted">Aucun scope explicite.</p>
          ) : (
            <ul>
              {detail.scopes.map((s) => (
                <li key={s.id}>
                  {s.scope_type}
                  {s.territory_id ? ` · territoire ${s.territory_id.slice(0, 8)}…` : ""}
                  {s.bureau_id ? ` · bureau ${s.bureau_id.slice(0, 8)}…` : ""}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel full">
          <h3>Historique / audit</h3>
          <div className="timeline">
            {history.length === 0 ? (
              <p className="muted">Aucun événement.</p>
            ) : (
              history.map((h) => (
                <div key={h.id} className="timeline-item">
                  <div className="timeline-date">
                    {new Date(h.created_at).toLocaleString("fr-CD")}
                  </div>
                  <div>
                    <strong>{h.action}</strong>
                    {h.justification ? <div className="muted">{h.justification}</div> : null}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {roleModal ? (
        <div className="modal-backdrop">
          <form className="modal-panel" onSubmit={onChangeRole}>
            <h3>Modifier le rôle</h3>
            <p>
              Ancien rôle : <strong>{(u.role_codes || []).join(", ")}</strong>
            </p>
            <label className="form-label">Nouveau rôle</label>
            <select className="form-control" value={newRole} onChange={(e) => setNewRole(e.target.value)}>
              {(rolesPack?.roles || []).map((r) => (
                <option key={r.code} value={r.code}>
                  {r.code}
                </option>
              ))}
            </select>
            <label className="form-label">Motif *</label>
            <textarea
              className="form-control"
              required
              minLength={3}
              value={roleReason}
              onChange={(e) => setRoleReason(e.target.value)}
            />
            <div className="wizard-actions">
              <button type="button" className="btn-secondary" onClick={() => setRoleModal(false)}>
                Annuler
              </button>
              <button type="submit" className="btn-primary" disabled={busy}>
                Confirmer
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {statusModal ? (
        <div className="modal-backdrop">
          <form className="modal-panel" onSubmit={onStatus}>
            <h3>
              {statusModal === "suspend"
                ? "Suspendre le compte"
                : statusModal === "disable"
                  ? "Désactiver le compte"
                  : "Réactiver le compte"}
            </h3>
            {statusModal === "disable" ? (
              <p className="muted">
                Cette opération empêchera toute nouvelle connexion. L'historique sera conservé.
              </p>
            ) : null}
            <label className="form-label">Motif *</label>
            <textarea
              className="form-control"
              required
              minLength={3}
              value={statusReason}
              onChange={(e) => setStatusReason(e.target.value)}
            />
            {statusModal === "suspend" ? (
              <>
                <label className="form-label">Date de fin (optionnel)</label>
                <input
                  className="form-control"
                  type="datetime-local"
                  value={until}
                  onChange={(e) => setUntil(e.target.value)}
                />
              </>
            ) : null}
            <div className="wizard-actions">
              <button type="button" className="btn-secondary" onClick={() => setStatusModal(null)}>
                Annuler
              </button>
              <button type="submit" className="btn-primary" disabled={busy}>
                Confirmer
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {assignModal ? (
        <div className="modal-backdrop">
          <form className="modal-panel" onSubmit={onChangeAssignment}>
            <h3>Changer l'affectation</h3>
            <p className="muted">
              Affectation actuelle : {u.bureau_name || "—"} → nouvelle affectation
            </p>
            <label className="form-label">Province</label>
            <select
              className="form-control"
              value={provinceId}
              onChange={(e) => setProvinceId(e.target.value)}
            >
              <option value="">—</option>
              {provinces.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <label className="form-label">Nouveau bureau *</label>
            <select
              className="form-control"
              required
              value={bureauId}
              onChange={(e) => setBureauId(e.target.value)}
            >
              <option value="">—</option>
              {bureaux.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            <label className="form-label">Fonction *</label>
            <input
              className="form-control"
              required
              value={functionCode}
              onChange={(e) => setFunctionCode(e.target.value)}
            />
            <div className="wizard-actions">
              <button type="button" className="btn-secondary" onClick={() => setAssignModal(false)}>
                Annuler
              </button>
              <button type="submit" className="btn-primary" disabled={busy}>
                Valider la mutation
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
