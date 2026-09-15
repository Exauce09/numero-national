/** Qui fait quoi dans l'état civil RDC. */

import { Link } from "react-router-dom";
import { EC_HORS_POUVOIR, EC_POUVOIRS_LIMITES, EC_ROLES } from "../ecRdc";

export default function RolesEcPage() {
  return (
    <div>
      <h2 className="page-title">Qui fait quoi</h2>
      <p className="page-lead">
        Répartition des rôles : déclarant, maternité, agent, officier, juge. L&apos;officier
        enregistre ; le juge décide dans les cas exceptionnels.
      </p>

      <div
        style={{
          display: "grid",
          gap: "1rem",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          marginBottom: "1.25rem",
        }}
      >
        {EC_ROLES.map((r) => (
          <div key={r.id} className="panel" style={{ margin: 0 }}>
            <h3 className="panel-title" style={{ marginTop: 0 }}>
              {r.title}
            </h3>
            <p className="muted small" style={{ margin: "0 0 0.35rem" }}>
              Peut
            </p>
            <ul style={{ margin: "0 0 0.75rem", paddingLeft: "1.1rem", fontSize: "0.92rem" }}>
              {r.does.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
            <p className="muted small" style={{ margin: "0 0 0.35rem" }}>
              Ne peut pas
            </p>
            <ul className="muted" style={{ margin: 0, paddingLeft: "1.1rem", fontSize: "0.9rem" }}>
              {r.doesNot.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="panel" style={{ marginBottom: "1rem" }}>
        <h3 className="panel-title">Pouvoir de l&apos;officier (limites)</h3>
        <ul style={{ margin: "0 0 0.75rem", paddingLeft: "1.2rem" }}>
          {EC_POUVOIRS_LIMITES.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
        <p className="muted small" style={{ margin: "0 0 0.35rem" }}>
          Hors pouvoir
        </p>
        <ul className="muted" style={{ margin: 0, paddingLeft: "1.2rem" }}>
          {EC_HORS_POUVOIR.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      </div>

      <p>
        <Link className="btn-add btn-sm" to="/juge">
          Cas où le juge intervient
        </Link>{" "}
        <Link className="btn-secondary btn-sm" to="/procedure">
          Voir la procédure
        </Link>
      </p>
    </div>
  );
}
