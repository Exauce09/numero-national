import { useEffect, useState } from "react";
import { api } from "../api";
import { getSession } from "../auth";
import { canValidateActs } from "../rbac";

type Correction = {
  id: string;
  citizen_id: string;
  field_name: string;
  current_value: string | null;
  requested_value: string;
  justification: string;
  status: string;
  review_note?: string | null;
  created_at: string;
};

export default function CorrectionsInboxPage() {
  const session = getSession();
  const canReview = canValidateActs(session?.roles, session?.permissions);

  const [rows, setRows] = useState<Correction[]>([]);
  const [status, setStatus] = useState("SUBMITTED");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    if (!session?.accessToken) {
      setError("Connexion API requise.");
      return;
    }
    setError(null);
    try {
      setRows(await api.listCorrections(status || undefined));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chargement impossible");
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, session?.accessToken]);

  async function review(id: string, approve: boolean) {
    if (!canReview) return;
    const note = approve
      ? undefined
      : window.prompt("Motif du rejet (optionnel)") || undefined;
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      await api.reviewCorrection(id, { approve, review_note: note });
      setMessage(approve ? "Demande approuvée." : "Demande rejetée.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action impossible");
    }
    setBusy(false);
  }

  return (
    <div>
      <h2 className="page-title">Demandes de correction</h2>
      <p className="page-lead">
        Boîte de réception officier — demandes citoyennes de rectification d&apos;identité / état civil.
      </p>
      {error ? <div className="login-error">{error}</div> : null}
      {message ? <div className="success-banner">{message}</div> : null}

      <div className="panel">
        <div className="toolbar">
          <select
            className="form-control"
            style={{ width: "auto", marginBottom: 0 }}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="SUBMITTED">Soumises</option>
            <option value="APPROVED">Approuvées</option>
            <option value="REJECTED">Rejetées</option>
            <option value="">Toutes</option>
          </select>
          <button type="button" className="btn-secondary" onClick={() => void load()}>
            Actualiser
          </button>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Citoyen</th>
              <th>Champ</th>
              <th>Valeur actuelle</th>
              <th>Valeur demandée</th>
              <th>Justification</th>
              <th>Statut</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="muted">
                  Aucune demande.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id}>
                  <td>{new Date(r.created_at).toLocaleString("fr-CD")}</td>
                  <td>
                    <code>{r.citizen_id.slice(0, 8)}…</code>
                  </td>
                  <td>{r.field_name}</td>
                  <td>{r.current_value ?? "—"}</td>
                  <td>{r.requested_value}</td>
                  <td>{r.justification}</td>
                  <td>{r.status}</td>
                  <td className="table-actions">
                    {canReview && r.status === "SUBMITTED" ? (
                      <>
                        <button
                          type="button"
                          className="btn-primary btn-sm"
                          disabled={busy}
                          onClick={() => void review(r.id, true)}
                        >
                          Approuver
                        </button>{" "}
                        <button
                          type="button"
                          className="btn-secondary btn-sm"
                          disabled={busy}
                          onClick={() => void review(r.id, false)}
                        >
                          Rejeter
                        </button>
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
