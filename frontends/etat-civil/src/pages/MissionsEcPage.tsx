/** Catalogue des missions d'état civil en RDC. */

import { Link } from "react-router-dom";
import { getSession } from "../auth";
import {
  EC_OUT_OF_SCOPE,
  EC_RDC_MISSIONS,
  EC_REGISTRES,
} from "../ecRdc";
import { canSeeNav } from "../rbac";

export default function MissionsEcPage() {
  const roles = getSession()?.roles ?? [];
  const missions = EC_RDC_MISSIONS.filter((m) => {
    if (m.id === "rectification") return canSeeNav("mentions", roles);
    if (m.id === "transcription") return canSeeNav("transcriptions", roles);
    return true;
  });

  return (
    <div>
      <h2 className="page-title">Missions de l&apos;état civil</h2>
      <p className="page-lead">
        Service d&apos;état civil RDC : registres, actes, mentions, transcriptions et copies — hors
        recensement, biométrie et numéro national.
      </p>

      <div className="dash-action-row" style={{ marginBottom: "1.25rem" }}>
        <Link className="dash-action-card" to="/procedure" style={{ textDecoration: "none" }}>
          <span className="dash-action-label">Procédure</span>
          <strong className="dash-action-value" style={{ fontSize: "1rem" }}>
            Pas à pas
          </strong>
          <span className="btn-add btn-sm">Suivre</span>
        </Link>
        <Link className="dash-action-card" to="/roles" style={{ textDecoration: "none" }}>
          <span className="dash-action-label">Rôles</span>
          <strong className="dash-action-value" style={{ fontSize: "1rem" }}>
            Qui fait quoi
          </strong>
          <span className="btn-secondary btn-sm">Voir</span>
        </Link>
        <Link className="dash-action-card" to="/juge" style={{ textDecoration: "none" }}>
          <span className="dash-action-label">Juge</span>
          <strong className="dash-action-value" style={{ fontSize: "1rem" }}>
            Cas spéciaux
          </strong>
          <span className="btn-secondary btn-sm">Ouvrir</span>
        </Link>
      </div>

      <div className="panel" style={{ marginBottom: "1.25rem" }}>
        <h3 className="panel-title">Trois registres principaux</h3>
        <ul style={{ margin: 0, paddingLeft: "1.2rem" }}>
          {EC_REGISTRES.map((r) => (
            <li key={r.id}>
              <Link to={r.href}>{r.title}</Link> — {r.summary}
            </li>
          ))}
        </ul>
      </div>

      <div
        style={{
          display: "grid",
          gap: "1rem",
          gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
          marginBottom: "1.5rem",
        }}
      >
        {missions.map((m) => (
          <Link
            key={m.id}
            to={m.href}
            className="panel"
            style={{ textDecoration: "none", color: "inherit", display: "block" }}
          >
            <h3 className="panel-title" style={{ marginTop: 0 }}>
              {m.title}
              {m.needsJudge ? (
                <span className="status-badge" style={{ marginLeft: 8, fontSize: "0.7rem" }}>
                  JUGE
                </span>
              ) : null}
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
        <h3 className="panel-title">Hors périmètre</h3>
        <ul className="muted" style={{ margin: 0, paddingLeft: "1.2rem" }}>
          {EC_OUT_OF_SCOPE.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p className="muted small" style={{ margin: "0.85rem 0 0" }}>
          Ces fonctions restent sur SIGPOP (port 5176 / 5183).
        </p>
      </div>
    </div>
  );
}
