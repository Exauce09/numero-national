/** Catalogue des missions d'état civil en RDC. */

import { Link } from "react-router-dom";
import { EC_OUT_OF_SCOPE, EC_RDC_MISSIONS } from "../ecRdc";

export default function MissionsEcPage() {
  return (
    <div>
      <h2 className="page-title">Missions de l&apos;état civil</h2>
      <p className="page-lead">
        Ce portail ne couvre que le service d&apos;état civil tel qu&apos;il est exercé en République
        démocratique du Congo : registres, actes, mentions, transcriptions et délivrance de copies.
      </p>

      <div className="panel" style={{ marginBottom: "1.25rem" }}>
        <h3 className="panel-title">Cadre du bureau</h3>
        <p className="muted" style={{ margin: 0 }}>
          L&apos;officier d&apos;état civil de la commune (ou du ressort territorial compétent) tient
          les registres, reçoit les déclarations, établit les actes, porte les mentions marginales et
          délivre copies et extraits aux personnes habilitées.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gap: "1rem",
          gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
          marginBottom: "1.5rem",
        }}
      >
        {EC_RDC_MISSIONS.map((m) => (
          <Link
            key={m.id}
            to={m.href}
            className="panel"
            style={{ textDecoration: "none", color: "inherit", display: "block" }}
          >
            <h3 className="panel-title" style={{ marginTop: 0 }}>
              {m.title}
            </h3>
            <p className="muted" style={{ margin: "0 0 0.75rem", fontSize: "0.92rem" }}>
              {m.summary}
            </p>
            {m.legalNote ? (
              <p className="muted small" style={{ margin: 0 }}>
                {m.legalNote}
              </p>
            ) : null}
            <span className="btn-add btn-sm" style={{ marginTop: "0.85rem", display: "inline-flex" }}>
              Ouvrir
            </span>
          </Link>
        ))}
      </div>

      <div className="panel">
        <h3 className="panel-title">Hors périmètre de ce portail</h3>
        <ul className="muted" style={{ margin: 0, paddingLeft: "1.2rem" }}>
          {EC_OUT_OF_SCOPE.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p className="muted small" style={{ margin: "0.85rem 0 0" }}>
          Ces fonctions restent dans SIGPOP / civil-officer (port 5176) ou les modules dédiés.
        </p>
      </div>
    </div>
  );
}
