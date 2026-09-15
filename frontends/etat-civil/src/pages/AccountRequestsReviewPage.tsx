/** Validation des demandes de compte institutionnelles — identité seulement, pas d'auto-rôle. */

import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  decideAccountRequest,
  getAccountTypeOption,
  listPendingInstitutionalRequests,
  listAccountRequests,
} from "../accountRegistration";
import { getSession } from "../auth";
import { canManageEcUsers } from "../ecUsers";

export default function AccountRequestsReviewPage() {
  const session = getSession();
  const canReview = canManageEcUsers(session?.roles);
  const [bump, setBump] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pending = useMemo(() => listPendingInstitutionalRequests(), [bump]);
  const all = useMemo(() => listAccountRequests().slice(0, 40), [bump]);

  if (!canReview) {
    return (
      <div>
        <h2 className="page-title">Demandes de compte</h2>
        <div className="panel">
          <p className="muted">
            Seul le <strong>responsable de bureau</strong> (ou autorité habilitée) peut valider les
            demandes institutionnelles.
          </p>
          <Link className="btn-secondary btn-sm" to="/matrice">
            Voir la matrice des acteurs
          </Link>
        </div>
      </div>
    );
  }

  function decide(id: string, decision: "approve_identity" | "reject") {
    setError(null);
    setMessage(null);
    try {
      const row = decideAccountRequest(id, decision, session?.username || "authority");
      setMessage(
        decision === "reject"
          ? `Demande rejetée (${row.email}).`
          : `Identité validée pour ${row.email} — attribuez le rôle séparément (Utilisateurs).`,
      );
      setBump((n) => n + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action impossible.");
    }
  }

  return (
    <div>
      <h2 className="page-title">Demandes de création de compte</h2>
      <p className="page-lead">
        Validation de l&apos;identité et de l&apos;institution.{" "}
        <strong>Aucun rôle n&apos;est attribué ici</strong> — utilisez ensuite Utilisateurs /
        habilitation.
      </p>
      {error ? <div className="login-error">{error}</div> : null}
      {message ? <div className="success-banner">{message}</div> : null}

      <div className="panel" style={{ marginBottom: "1rem" }}>
        <h3 className="panel-title" style={{ marginTop: 0 }}>
          En attente de validation ({pending.length})
        </h3>
        <table className="data-table">
          <thead>
            <tr>
              <th>Nom</th>
              <th>Type demandé</th>
              <th>Institution</th>
              <th>Contact</th>
              <th>Date</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {pending.length === 0 ? (
              <tr>
                <td colSpan={6} className="muted">
                  Aucune demande en attente.
                </td>
              </tr>
            ) : (
              pending.map((r) => (
                <tr key={r.id}>
                  <td>
                    {r.prenom} {r.postnom} {r.nom}
                  </td>
                  <td>{getAccountTypeOption(r.accountType).label}</td>
                  <td>
                    {r.institution || "—"}
                    {r.province ? (
                      <div className="muted small">
                        {r.province}
                        {r.ville_territoire ? ` · ${r.ville_territoire}` : ""}
                      </div>
                    ) : null}
                  </td>
                  <td>
                    <div>{r.email}</div>
                    <div className="muted small">{r.telephone}</div>
                  </td>
                  <td className="muted small">{new Date(r.created_at).toLocaleString("fr-CD")}</td>
                  <td>
                    <div className="table-actions">
                      <button
                        type="button"
                        className="btn-primary btn-sm"
                        onClick={() => decide(r.id, "approve_identity")}
                      >
                        Valider identité
                      </button>
                      <button
                        type="button"
                        className="btn-secondary btn-sm"
                        onClick={() => decide(r.id, "reject")}
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

      <div className="panel">
        <h3 className="panel-title" style={{ marginTop: 0 }}>
          Historique récent
        </h3>
        <table className="data-table">
          <thead>
            <tr>
              <th>Nom</th>
              <th>Type</th>
              <th>Statut</th>
              <th>Téléphone vérifié</th>
            </tr>
          </thead>
          <tbody>
            {all.map((r) => (
              <tr key={r.id}>
                <td>
                  {r.prenom} {r.nom}
                </td>
                <td>{getAccountTypeOption(r.accountType).label}</td>
                <td>{r.status}</td>
                <td>{r.phone_verified ? "Oui" : "Non"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
