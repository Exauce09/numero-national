import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api";
import { getSession } from "../../auth";

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="metric">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
    </div>
  );
}

export default function DashboardPage() {
  const session = getSession("admin");
  const [users, setUsers] = useState(0);
  const [roles, setRoles] = useState(0);
  const [perms, setPerms] = useState(0);
  const [institutions, setInstitutions] = useState(0);
  const [accountStats, setAccountStats] = useState<{
    total: number;
    active: number;
    pending: number;
    suspended: number;
    disabled: number;
  } | null>(null);

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
    void api.accountsList().then((d) => setAccountStats(d.stats)).catch(() => null);
  }, []);

  return (
    <div>
      <h2 className="page-title">Administration système</h2>
      <p className="page-lead">
        {session?.roleTitle ?? "Administrateur"} — synthèse IAM, institutions et contrôles d&apos;accès
        {session?.territoryLabel ? ` · ${session.territoryLabel}` : ""}.
      </p>
      <div className="grid">
        <Metric label="Utilisateurs" value={accountStats?.total ?? users} />
        <Metric label="Actifs" value={accountStats?.active ?? "—"} />
        <Metric label="En attente" value={accountStats?.pending ?? "—"} />
        <Metric label="Suspendus" value={accountStats?.suspended ?? "—"} />
        <Metric label="Rôles" value={roles} />
        <Metric label="Permissions" value={perms} />
        <Metric label="Institutions" value={institutions} />
        <Metric label="Désactivés" value={accountStats?.disabled ?? "—"} />
      </div>
      <div className="panel" style={{ marginTop: "1.25rem" }}>
        <h3 style={{ marginTop: 0 }}>Accès rapides</h3>
        <div className="action-row">
          <Link className="btn-secondary btn-sm" to="/administration/utilisateurs">
            Gestion des utilisateurs
          </Link>
          <Link className="btn-secondary btn-sm" to="/administration/utilisateurs/nouveau">
            + Nouveau compte
          </Link>
          <Link className="btn-secondary btn-sm" to="/admin/roles">
            Rôles
          </Link>
          <Link className="btn-secondary btn-sm" to="/admin/audit">
            Audit
          </Link>
        </div>
      </div>
    </div>
  );
}
