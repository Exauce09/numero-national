import { useEffect, useState } from "react";
import { api, type AuditList } from "../../api";

export default function SecurityAuditPage() {
  const [data, setData] = useState<AuditList | null>(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    void api.auditList(page).then(setData);
  }, [page]);

  return (
    <div>
      <h2 className="page-title">Audit de sécurité</h2>
      <p className="page-lead">Journal des événements d&apos;audit applicatif.</p>
      <div className="panel">
        <div className="toolbar">
          <button
            type="button"
            className="btn-secondary btn-sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Précédent
          </button>
          <span className="muted">
            Page {data?.page ?? page} — {data?.total ?? 0} événements
          </span>
          <button
            type="button"
            className="btn-secondary btn-sm"
            disabled={!data || page * data.page_size >= data.total}
            onClick={() => setPage((p) => p + 1)}
          >
            Suivant
          </button>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Action</th>
              <th>Ressource</th>
              <th>Résultat</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {(data?.items ?? []).map((item) => (
              <tr key={item.id}>
                <td>{item.action}</td>
                <td>
                  {item.resource_type ?? "—"} {item.resource_id ?? ""}
                </td>
                <td>{item.result ?? "—"}</td>
                <td>{new Date(item.created_at).toLocaleString("fr-FR")}</td>
              </tr>
            ))}
            {!data?.items.length ? (
              <tr>
                <td colSpan={4} className="muted">
                  Aucun événement.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
