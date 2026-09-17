/** Hôpital — Nos validés (déclarations prises en compte par l'officier). */

import { getHealthSession } from "../healthAuth";
import { listFacilityDeclarations } from "../civilDeclarations";

export default function HealthActsValidatedPage() {
  const session = getHealthSession()!;
  const rows = listFacilityDeclarations(session.facilityId).filter((d) => d.status === "VALIDATED");

  return (
    <div>
      <div className="eg-page-head">
        <div>
          <h2 className="page-title">Nos validés</h2>
          <p className="page-lead">
            Actes déclarés par {session.facilityName} et validés par l&apos;officier d&apos;état civil.
          </p>
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
                    Aucun acte validé pour le moment.
                  </td>
                </tr>
              ) : (
                rows.map((d) => {
                  const p = d.payload;
                  const label =
                    d.declaration_type === "BIRTH"
                      ? [p.nom, p.postnom, p.prenom].filter(Boolean).join(" ") || "Nouveau-né"
                      : String(p.deceased_name ?? p.nom ?? "Enregistrement de décès");
                  return (
                    <tr key={d.id}>
                      <td>{d.declaration_type === "BIRTH" ? "Nouveau-né" : "Enregistrement de décès"}</td>
                      <td>{label}</td>
                      <td>Validé</td>
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
