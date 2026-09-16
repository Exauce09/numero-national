/** Hôpital — L'acte en cours (déclarations non validées + nouvelles saisies). */

import { Link } from "react-router-dom";
import { getHealthSession } from "../healthAuth";
import { listFacilityDeclarations } from "../civilDeclarations";

export default function HealthActsPendingPage() {
  const session = getHealthSession()!;
  const rows = listFacilityDeclarations(session.facilityId).filter(
    (d) => d.status === "PENDING_OFFICER",
  );

  return (
    <div>
      <div className="eg-page-head">
        <div>
          <h2 className="page-title">L&apos;acte en cours</h2>
          <p className="page-lead">
            Déclarations envoyées à l&apos;officier d&apos;état civil et en attente de validation.
          </p>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: "1rem" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
          <Link className="btn-primary" style={{ width: "auto" }} to="/sante/births">
            + Notification de naissance
          </Link>
          <Link className="btn-secondary" style={{ width: "auto" }} to="/sante/deaths">
            + Notification de décès
          </Link>
        </div>
      </div>

      <div className="panel">
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Identité / résumé</th>
                <th>Statut</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="muted">
                    Aucun acte en cours.
                  </td>
                </tr>
              ) : (
                rows.map((d) => {
                  const p = d.payload;
                  const label =
                    d.declaration_type === "BIRTH"
                      ? [p.nom, p.postnom, p.prenom].filter(Boolean).join(" ") || "Nouveau-né"
                      : String(p.deceased_name ?? p.nom ?? "Décès");
                  return (
                    <tr key={d.id}>
                      <td>{d.declaration_type === "BIRTH" ? "Nouveau-né" : "Décès"}</td>
                      <td>{label}</td>
                      <td>En cours — en attente officier</td>
                      <td>{new Date(d.created_at).toLocaleString("fr-FR")}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
