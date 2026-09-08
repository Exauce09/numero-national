import { useEffect, useState } from "react";
import { api, type Facility } from "../../api";

export default function FacilitiesPage() {
  const [rows, setRows] = useState<Facility[]>([]);

  useEffect(() => {
    void api.healthFacilities().then(setRows);
  }, []);

  return (
    <div>
      <h2 className="page-title">Structures sanitaires</h2>
      <p className="page-lead">Liste des établissements enregistrés dans le domaine santé.</p>
      <div className="panel">
        <table className="data-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Nom</th>
              <th>Type</th>
              <th>Commune</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((f) => (
              <tr key={f.id}>
                <td>{f.code ?? "—"}</td>
                <td>{f.name}</td>
                <td>{f.facility_type ?? "—"}</td>
                <td>{f.commune_code ?? "—"}</td>
                <td>{f.status ?? "—"}</td>
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td colSpan={5} className="muted">
                  Aucune structure.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
