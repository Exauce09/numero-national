import { Link } from "react-router-dom";
import { getHealthSession } from "../healthAuth";
import { listFacilityDeclarations } from "../civilDeclarations";

export default function HealthDashboardPage() {
  const session = getHealthSession()!;
  const rows = listFacilityDeclarations(session.facilityId);
  const pending = rows.filter((d) => d.status === "PENDING_OFFICER").length;
  const births = rows.filter((d) => d.declaration_type === "BIRTH").length;
  const deaths = rows.filter((d) => d.declaration_type === "DEATH").length;
  const validated = rows.filter((d) => d.status === "VALIDATED").length;

  return (
    <div>
      <h2 className="page-title">Tableau de bord — Structure sanitaire</h2>
      <p className="page-lead">
        {session.facilityName} · {session.commune_name}. Chaque enregistrement notifie l&apos;état civil.
      </p>
      <div className="metrics-row" style={{ marginBottom: "1rem" }}>
        <div className="metric-card">
          <span className="muted">Nouveaux-nés</span>
          <strong>{births}</strong>
        </div>
        <div className="metric-card">
          <span className="muted">Décès</span>
          <strong>{deaths}</strong>
        </div>
        <div className="metric-card">
          <span className="muted">En attente officier</span>
          <strong>{pending}</strong>
        </div>
        <div className="metric-card">
          <span className="muted">Validés</span>
          <strong>{validated}</strong>
        </div>
      </div>
      <div className="panel">
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <Link className="btn-primary" style={{ width: "auto", textDecoration: "none" }} to="/sante/births">
            + Nouveau-né
          </Link>
          <Link className="btn-secondary" style={{ width: "auto", textDecoration: "none" }} to="/sante/deaths">
            + Décès
          </Link>
        </div>
      </div>
    </div>
  );
}
