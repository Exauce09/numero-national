import { useMemo, useState } from "react";
import { listMinistryDeclarations } from "../../santeData";

export default function DeclarationsPage() {
  const [, bump] = useState(0);
  const rows = useMemo(() => listMinistryDeclarations(), [bump]);
  const [status, setStatus] = useState("ALL");
  const [type, setType] = useState("ALL");

  const filtered = rows.filter((d) => {
    if (status !== "ALL" && d.status !== status) return false;
    if (type !== "ALL" && d.declaration_type !== type) return false;
    return true;
  });

  return (
    <div>
      <div className="eg-page-head">
        <div>
          <h2 className="page-title">Déclarations sanitaires</h2>
          <p className="page-lead">
            File nationale des naissances et décès notifiés par les structures vers l&apos;état civil.
          </p>
        </div>
        <button type="button" className="btn-secondary btn-sm" onClick={() => bump((n) => n + 1)}>
          Actualiser
        </button>
      </div>

      <div className="toolbar">
        <select className="form-control" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="ALL">Tous types</option>
          <option value="BIRTH">Naissances</option>
          <option value="DEATH">Décès</option>
        </select>
        <select className="form-control" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="ALL">Tous statuts</option>
          <option value="PENDING_OFFICER">En attente</option>
          <option value="VALIDATED">Validés</option>
          <option value="REJECTED">Rejetés</option>
        </select>
      </div>

      <div className="panel">
        <table className="data-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Structure</th>
              <th>Commune</th>
              <th>Résumé</th>
              <th>Statut</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((d) => (
              <tr key={d.id}>
                <td>{d.declaration_type === "BIRTH" ? "Naissance" : "Décès"}</td>
                <td>{d.facility_name}</td>
                <td>{d.commune_name || d.commune_code || "—"}</td>
                <td>{d.summary}</td>
                <td>{d.status}</td>
                <td>{new Date(d.created_at).toLocaleString("fr-FR")}</td>
              </tr>
            ))}
            {!filtered.length ? (
              <tr>
                <td colSpan={6} className="muted">
                  Aucune déclaration.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
