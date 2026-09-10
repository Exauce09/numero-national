import { FormEvent, useEffect, useState } from "react";
import { api } from "../api";
import { getSession } from "../auth";

export default function AccountRequestsPage() {
  const session = getSession();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [personnel, setPersonnel] = useState<Array<Record<string, unknown>>>([]);
  const [bureaux, setBureaux] = useState<Array<Record<string, unknown>>>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [personnelId, setPersonnelId] = useState("");
  const [role, setRole] = useState("AGENT_ETAT_CIVIL");
  const [bureauId, setBureauId] = useState("");
  const [reason, setReason] = useState("");
  const [approvePwd, setApprovePwd] = useState("ChangeMe123!");

  async function load() {
    setError(null);
    try {
      const [reqs, pers, burs] = await Promise.all([
        api.listAccountRequests("PENDING"),
        api.listPersonnel(),
        api.listBureaux(),
      ]);
      setRows(reqs);
      setPersonnel(pers);
      setBureaux(burs);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chargement impossible");
    }
  }

  useEffect(() => {
    if (session?.accessToken) void load();
  }, [session?.accessToken]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    try {
      await api.createAccountRequest({
        personnel_id: personnelId,
        requested_role: role,
        requested_scope_type: bureauId ? "BUREAU" : "COMMUNE",
        requested_bureau_id: bureauId || null,
        reason: reason || null,
      });
      setMessage("Demande créée — en attente d'approbation.");
      setReason("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Demande refusée");
    }
  }

  async function approve(id: string) {
    setError(null);
    try {
      await api.approveAccountRequest(id, { temporary_password: approvePwd });
      setMessage("Compte créé et activé.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Approbation impossible");
    }
  }

  async function reject(id: string) {
    const why = window.prompt("Motif du rejet ?");
    if (!why) return;
    try {
      await api.rejectAccountRequest(id, why);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rejet impossible");
    }
  }

  if (!session?.accessToken) {
    return (
      <div className="panel">
        <p className="muted">Connectez-vous pour gérer les demandes de compte.</p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="page-title">Demandes de compte</h2>
      <p className="page-lead">
        Fonction + affectation d&apos;abord ; le compte informatique est créé seulement après
        approbation (pas d&apos;auto-élévation).
      </p>
      {error ? <div className="login-error">{error}</div> : null}
      {message ? <div className="success-banner">{message}</div> : null}

      <form className="panel form-grid" onSubmit={onCreate}>
        <div className="full">
          <label className="form-label">Personnel *</label>
          <select
            className="form-control"
            value={personnelId}
            onChange={(e) => setPersonnelId(e.target.value)}
            required
          >
            <option value="">— choisir —</option>
            {personnel.map((p) => (
              <option key={String(p.id)} value={String(p.id)}>
                {String(p.matricule)} — {String(p.given_names)} {String(p.family_name)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="form-label">Rôle demandé</label>
          <select className="form-control" value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="AGENT_ETAT_CIVIL">Agent d&apos;état civil</option>
            <option value="OFFICIER_ETAT_CIVIL">Officier d&apos;état civil</option>
            <option value="RESPONSABLE_BUREAU">Responsable de bureau</option>
            <option value="CIVIL_OFFICER">Officier (compat)</option>
          </select>
        </div>
        <div>
          <label className="form-label">Bureau (scope)</label>
          <select className="form-control" value={bureauId} onChange={(e) => setBureauId(e.target.value)}>
            <option value="">— optionnel —</option>
            {bureaux.map((b) => (
              <option key={String(b.id)} value={String(b.id)}>
                {String(b.code)} — {String(b.name)}
              </option>
            ))}
          </select>
        </div>
        <div className="full">
          <label className="form-label">Motif</label>
          <input className="form-control" value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        <div className="full">
          <button type="submit" className="btn-primary">
            Déposer la demande
          </button>
        </div>
      </form>

      <div className="panel">
        <label className="form-label">Mot de passe temporaire (approbation)</label>
        <input
          className="form-control"
          style={{ maxWidth: 280, marginBottom: 12 }}
          value={approvePwd}
          onChange={(e) => setApprovePwd(e.target.value)}
        />
        <table className="data-table">
          <thead>
            <tr>
              <th>Rôle</th>
              <th>Personnel</th>
              <th>Statut</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={String(r.id)}>
                <td>{String(r.requested_role)}</td>
                <td>
                  <code>{String(r.personnel_id).slice(0, 8)}</code>
                </td>
                <td>{String(r.status)}</td>
                <td style={{ display: "flex", gap: 8 }}>
                  <button type="button" className="btn-primary" onClick={() => void approve(String(r.id))}>
                    Approuver
                  </button>
                  <button type="button" className="btn-secondary" onClick={() => void reject(String(r.id))}>
                    Rejeter
                  </button>
                </td>
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td colSpan={4} className="muted">
                  Aucune demande en attente.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
