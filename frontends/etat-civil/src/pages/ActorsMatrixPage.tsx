/** Matrice des acteurs & permissions — livrable conception. */

import { Link } from "react-router-dom";
import {
  EC_ACTOR_MATRIX,
  EC_AUDIT_RULES,
  EC_JUSTICE_EC_RULES,
  EC_ROLE_CONFLICTS,
  EC_SEPARATION_RULES,
  EC_WORKFLOWS,
  loginStatusLabel,
  type ActorPermissionCell,
  type PermLevel,
} from "../ecActorsMatrix";

const PERM_COLS: Array<{ key: keyof (typeof EC_ACTOR_MATRIX)[0]["permissions"]; label: string }> = [
  { key: "creer", label: "Créer" },
  { key: "consulter", label: "Consulter" },
  { key: "modifier", label: "Modifier" },
  { key: "valider", label: "Valider" },
  { key: "transmettre", label: "Transmettre" },
  { key: "executer", label: "Exécuter" },
  { key: "annuler", label: "Annuler" },
  { key: "imprimer", label: "Imprimer" },
  { key: "telecharger", label: "Télécharger" },
  { key: "exporter", label: "Exporter" },
  { key: "auditer", label: "Auditer" },
];

function levelBadge(level: PermLevel): string {
  return level.replace(/_/g, " ");
}

function Cell({ cell }: { cell: ActorPermissionCell }) {
  return (
    <td title={cell.detail} style={{ fontSize: "0.78rem", verticalAlign: "top", maxWidth: 140 }}>
      <strong>{levelBadge(cell.level)}</strong>
      <div className="muted" style={{ marginTop: 2, lineHeight: 1.35 }}>
        {cell.detail}
      </div>
    </td>
  );
}

export default function ActorsMatrixPage() {
  const missing = EC_ACTOR_MATRIX.filter((a) => a.loginStatus === "missing" || a.loginStatus === "docs_only");
  const ok = EC_ACTOR_MATRIX.filter((a) => a.loginStatus === "implemented");

  return (
    <div>
      <h2 className="page-title">Matrice des acteurs & permissions</h2>
      <p className="page-lead">
        Séparation des responsabilités : celui qui crée ne valide pas automatiquement ; celui qui juge
        n&apos;exécute pas automatiquement à l&apos;état civil.
      </p>

      <div className="panel" style={{ marginBottom: "1rem" }}>
        <h3 className="panel-title" style={{ marginTop: 0 }}>
          Écart d&apos;implémentation (portail EC)
        </h3>
        <p className="muted small">
          <strong>Login OK :</strong> {ok.map((a) => a.title).join(", ")}.
        </p>
        <p className="muted small" style={{ marginBottom: 0 }}>
          <strong>Manquant ou docs seules :</strong> {missing.map((a) => a.title).join(", ")}.
        </p>
      </div>

      <div className="panel" style={{ overflowX: "auto", marginBottom: "1.25rem" }}>
        <h3 className="panel-title" style={{ marginTop: 0 }}>
          Matrice détaillée
        </h3>
        <table className="data-table">
          <thead>
            <tr>
              <th>Acteur</th>
              <th>Statut</th>
              {PERM_COLS.map((c) => (
                <th key={c.key}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {EC_ACTOR_MATRIX.map((actor) => (
              <tr key={actor.id}>
                <td>
                  <strong>{actor.title}</strong>
                  <div className="muted small">{actor.loginNote}</div>
                </td>
                <td className="muted small">{loginStatusLabel(actor.loginStatus)}</td>
                {PERM_COLS.map((c) => (
                  <Cell key={c.key} cell={actor.permissions[c.key]} />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div
        style={{
          display: "grid",
          gap: "1rem",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          marginBottom: "1.25rem",
        }}
      >
        {EC_ACTOR_MATRIX.map((a) => (
          <div key={a.id} className="panel" style={{ margin: 0 }}>
            <h3 className="panel-title" style={{ marginTop: 0 }}>
              {a.title}
            </h3>
            <p className="muted small">{loginStatusLabel(a.loginStatus)}</p>
            <p className="muted small" style={{ margin: "0 0 0.35rem" }}>
              Ne peut pas
            </p>
            <ul className="muted" style={{ margin: 0, paddingLeft: "1.1rem", fontSize: "0.9rem" }}>
              {a.restrictions.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="panel" style={{ marginBottom: "1rem" }}>
        <h3 className="panel-title">Conflits de rôles interdits</h3>
        <ul style={{ margin: 0, paddingLeft: "1.2rem" }}>
          {EC_ROLE_CONFLICTS.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      </div>

      <div className="panel" style={{ marginBottom: "1rem" }}>
        <h3 className="panel-title">Workflows principaux</h3>
        {EC_WORKFLOWS.map((w) => (
          <div key={w.id} style={{ marginBottom: "0.85rem" }}>
            <strong>{w.title}</strong>
            <ol style={{ margin: "0.35rem 0 0", paddingLeft: "1.2rem", fontSize: "0.92rem" }}>
              {w.steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
          </div>
        ))}
      </div>

      <div className="panel" style={{ marginBottom: "1rem" }}>
        <h3 className="panel-title">Séparation des responsabilités</h3>
        <ul style={{ margin: 0, paddingLeft: "1.2rem" }}>
          {EC_SEPARATION_RULES.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      </div>

      <div className="panel" style={{ marginBottom: "1rem" }}>
        <h3 className="panel-title">Règles d&apos;audit</h3>
        <ul style={{ margin: 0, paddingLeft: "1.2rem" }}>
          {EC_AUDIT_RULES.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      </div>

      <div className="panel" style={{ marginBottom: "1rem" }}>
        <h3 className="panel-title">Transmission justice → état civil</h3>
        <ul style={{ margin: 0, paddingLeft: "1.2rem" }}>
          {EC_JUSTICE_EC_RULES.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      </div>

      <p>
        <Link className="btn-add btn-sm" to="/roles">
          Qui fait quoi
        </Link>{" "}
        <Link className="btn-secondary btn-sm" to="/juge">
          Quand le juge intervient
        </Link>{" "}
        <Link className="btn-secondary btn-sm" to="/procedure">
          Procédure
        </Link>
      </p>
    </div>
  );
}
