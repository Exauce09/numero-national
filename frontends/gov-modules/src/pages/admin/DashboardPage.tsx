import { useEffect, useState } from "react";
import { api } from "../../api";

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="metric">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
    </div>
  );
}

export default function DashboardPage() {
  const [users, setUsers] = useState(0);
  const [roles, setRoles] = useState(0);
  const [perms, setPerms] = useState(0);
  const [institutions, setInstitutions] = useState(0);

  useEffect(() => {
    void Promise.all([
      api.rbacUsers(),
      api.rbacRoles(),
      api.rbacPermissions(),
      api.institutionsList(),
    ]).then(([u, r, p, i]) => {
      setUsers(u.length);
      setRoles(r.length);
      setPerms(p.length);
      setInstitutions(i.length);
    });
  }, []);

  return (
    <div>
      <h2 className="page-title">Administration système</h2>
      <p className="page-lead">Synthèse IAM, institutions et contrôles d&apos;accès.</p>
      <div className="grid">
        <Metric label="Utilisateurs" value={users} />
        <Metric label="Rôles" value={roles} />
        <Metric label="Permissions" value={perms} />
        <Metric label="Institutions" value={institutions} />
      </div>
    </div>
  );
}
