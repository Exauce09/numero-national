/** Cas où le juge intervient — puis retour à l'officier pour transcription. */

import { Link } from "react-router-dom";
import { EC_JUDGE_CASES } from "../ecRdc";

export default function JugeEcPage() {
  return (
    <div>
      <h2 className="page-title">Quand le juge intervient</h2>
      <p className="page-lead">
        Règle : faits clairs et déclaration régulière → <strong>officier</strong>. Fait tardif,
        conflictuel ou changement de statut → <strong>juge</strong>, puis l&apos;officier{" "}
        <em>transcrit / mentionne</em>.
      </p>

      <div className="panel" style={{ marginBottom: "1.25rem" }}>
        <h3 className="panel-title">Principe</h3>
        <p className="muted" style={{ margin: 0 }}>
          L&apos;état civil <strong>écrit</strong> la vie civile dans les registres. Le juge{" "}
          <strong>décide</strong> quand l&apos;écriture n&apos;est plus possible normalement
          (supplétif, divorce, adoption, rectification, filiation contestée).
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gap: "1rem",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
        }}
      >
        {EC_JUDGE_CASES.map((c) => (
          <div key={c.id} className="panel" style={{ margin: 0 }}>
            <h3 className="panel-title" style={{ marginTop: 0 }}>
              {c.title}
            </h3>
            <p style={{ margin: "0 0 0.5rem", fontSize: "0.92rem" }}>
              <strong>Quand :</strong> {c.when}
            </p>
            <p className="muted" style={{ margin: "0 0 0.75rem", fontSize: "0.9rem" }}>
              <strong>Puis l&apos;officier :</strong> {c.thenOfficer}
            </p>
            <Link className="btn-add btn-sm" to={c.href}>
              Aller au formulaire
            </Link>
          </div>
        ))}
      </div>

      <p style={{ marginTop: "1.25rem" }}>
        <Link className="btn-secondary btn-sm" to="/procedure">
          Retour procédure
        </Link>{" "}
        <Link className="btn-secondary btn-sm" to="/roles">
          Qui fait quoi
        </Link>
      </p>
    </div>
  );
}
