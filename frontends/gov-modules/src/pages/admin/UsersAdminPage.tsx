import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, type AccountListItem, type AccountStats } from "../../api";

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Actif",
  PENDING: "En attente",
  SUSPENDED: "Suspendu",
  DISABLED: "Désactivé",
  EXPIRED: "Expiré",
};

function statusBadge(status: string) {
  const cls =
    status === "ACTIVE"
      ? "badge badge-ok"
      : status === "PENDING"
        ? "badge badge-warn"
        : status === "SUSPENDED"
          ? "badge badge-warn"
          : "badge badge-danger";
  return <span className={cls}>{STATUS_LABEL[status] ?? status}</span>;
}

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("fr-CD", {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export default function UsersAdminPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<AccountListItem[]>([]);
  const [stats, setStats] = useState<AccountStats | null>(null);
  const [filter, setFilter] = useState<string>("");
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh(status?: string) {
    setBusy(true);
    setError(null);
    try {
      const data = await api.accountsList(status || undefined);
      setStats(data.stats);
      setItems(data.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chargement impossible");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void refresh(filter);
  }, [filter]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((u) =>
      [u.full_name, u.email, u.personnel_name, u.personnel_matricule, u.bureau_name, ...(u.role_codes || [])]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [items, q]);

  return (
    <div>
      <div className="page-header-row">
        <div>
          <h2 className="page-title">Gestion des utilisateurs</h2>
          <p className="page-lead">
            Personnel → affectation → compte → rôle → périmètre. Les contrôles sont appliqués côté serveur.
          </p>
        </div>
        <button type="button" className="btn-primary" onClick={() => navigate("nouveau")}>
          + Nouveau compte
        </button>
      </div>

      {error ? <div className="login-error">{error}</div> : null}

      <div className="stat-grid">
        <div className="metric-card">
          <div className="metric-label">Total</div>
          <div className="metric-value">{stats?.total ?? "—"}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Actifs</div>
          <div className="metric-value">{stats?.active ?? "—"}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">En attente</div>
          <div className="metric-value">{stats?.pending ?? "—"}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Suspendus</div>
          <div className="metric-value">{stats?.suspended ?? "—"}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Désactivés</div>
          <div className="metric-value">{stats?.disabled ?? "—"}</div>
        </div>
      </div>

      <div className="toolbar">
        <div>
          <label className="form-label">Recherche</label>
          <input
            className="form-control"
            placeholder="Nom, email, matricule, bureau…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div>
          <label className="form-label">Statut</label>
          <select className="form-control" value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="">Tous</option>
            <option value="ACTIVE">Actifs</option>
            <option value="PENDING">En attente</option>
            <option value="SUSPENDED">Suspendus</option>
            <option value="DISABLED">Désactivés</option>
          </select>
        </div>
        <button type="button" className="btn-secondary" disabled={busy} onClick={() => void refresh(filter)}>
          Actualiser
        </button>
      </div>

      <div className="panel table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Utilisateur</th>
              <th>Personnel</th>
              <th>Fonction</th>
              <th>Rôle</th>
              <th>Affectation</th>
              <th>Statut</th>
              <th>Dernière connexion</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8}>{busy ? "Chargement…" : "Aucun compte."}</td>
              </tr>
            ) : (
              filtered.map((u) => (
                <tr key={u.id}>
                  <td>
                    <strong>{u.full_name}</strong>
                    <div className="muted">{u.email}</div>
                  </td>
                  <td>
                    {u.personnel_name || "—"}
                    {u.personnel_matricule ? <div className="muted">{u.personnel_matricule}</div> : null}
                  </td>
                  <td>{u.function_code || "—"}</td>
                  <td>{(u.role_codes || []).join(", ") || "—"}</td>
                  <td>{u.bureau_name || "—"}</td>
                  <td>{statusBadge(u.account_status)}</td>
                  <td>{fmtDate(u.last_login_at)}</td>
                  <td>
                    <div className="action-row">
                      <Link className="btn-secondary btn-sm" to={u.id}>
                        Voir
                      </Link>
                      <Link className="btn-secondary btn-sm" to={u.id}>
                        Modifier
                      </Link>
                    </div>
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
