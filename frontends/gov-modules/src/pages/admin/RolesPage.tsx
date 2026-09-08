import { useEffect, useState } from "react";
import { api, type Permission, type Role } from "../../api";

export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [perms, setPerms] = useState<Permission[]>([]);

  useEffect(() => {
    void Promise.all([api.rbacRoles(), api.rbacPermissions()]).then(([r, p]) => {
      setRoles(r);
      setPerms(p);
    });
  }, []);

  return (
    <div>
      <h2 className="page-title">Rôles et permissions</h2>
      <p className="page-lead">Catalogue RBAC du registre national.</p>

      <div className="panel" style={{ marginBottom: "1.25rem" }}>
        <h3 style={{ marginTop: 0 }}>Rôles</h3>
        <table className="data-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Nom</th>
              <th>Permissions liées</th>
            </tr>
          </thead>
          <tbody>
            {roles.map((r) => (
              <tr key={r.id}>
                <td>
                  <strong>{r.code}</strong>
                </td>
                <td>{r.name}</td>
                <td>
                  {(r.permissions ?? []).map((p) => p.code).join(", ") || "—"}
                </td>
              </tr>
            ))}
            {!roles.length ? (
              <tr>
                <td colSpan={3} className="muted">
                  Aucun rôle.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="panel">
        <h3 style={{ marginTop: 0 }}>Permissions</h3>
        <table className="data-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Nom</th>
              <th>Ressource</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {perms.map((p) => (
              <tr key={p.id}>
                <td>{p.code}</td>
                <td>{p.name}</td>
                <td>{p.resource}</td>
                <td>{p.action}</td>
              </tr>
            ))}
            {!perms.length ? (
              <tr>
                <td colSpan={4} className="muted">
                  Aucune permission.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
