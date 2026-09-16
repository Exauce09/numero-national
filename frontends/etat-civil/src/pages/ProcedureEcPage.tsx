/** Procédure d'enregistrement — guide pas à pas pour l'officier / agent. */

import { Link } from "react-router-dom";
import {
  EC_ACTES_LIES,
  EC_DELAI_NAISSANCE_JOURS,
  EC_PROCEDURE_NAISSANCE,
  EC_REGISTRES,
} from "../ecRdc";

export default function ProcedureEcPage() {
  return (
    <div>
      <h2 className="page-title">Procédure d&apos;enregistrement</h2>
      <p className="page-lead">
        Suivez cet ordre pour enregistrer correctement un fait d&apos;état civil en RDC. Commencez
        toujours par le bon canal et le bon registre.
      </p>

      <div className="panel" style={{ marginBottom: "1.25rem" }} id="canaux">
        <h3 className="panel-title">1. Choisir le canal</h3>
        <div className="dash-action-row" style={{ margin: 0 }}>
          <Link className="dash-action-card" to="/sante/login" style={{ textDecoration: "none" }}>
            <span className="dash-action-label">Canal A — Maternité / santé</span>
            <strong className="dash-action-value" style={{ fontSize: "1rem" }}>
              Déclaration
            </strong>
            <span className="muted small">
              Login structure → nouveau-né / décès → sync → file officier
            </span>
            <span className="btn-add btn-sm">Ouvrir maternité</span>
          </Link>
          <Link className="dash-action-card" to="/births" style={{ textDecoration: "none" }}>
            <span className="dash-action-label">Canal B — Bureau EC</span>
            <strong className="dash-action-value" style={{ fontSize: "1rem" }}>
              Saisie directe
            </strong>
            <span className="muted small">Agent / officier enregistre au guichet de la commune</span>
            <span className="btn-secondary btn-sm">Enregistrement de nouveau-né</span>
          </Link>
          <Link className="dash-action-card" to="/declarations" style={{ textDecoration: "none" }}>
            <span className="dash-action-label">File officier</span>
            <strong className="dash-action-value" style={{ fontSize: "1rem" }}>
              À valider
            </strong>
            <span className="muted small">Déclarations santé en attente de validation</span>
            <span className="btn-secondary btn-sm">Déclarations</span>
          </Link>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: "1.25rem" }} id="naissance">
        <h3 className="panel-title">2. Enregistrement de nouveau-né — étapes</h3>
        <ol style={{ margin: 0, paddingLeft: "1.25rem", lineHeight: 1.65 }}>
          {EC_PROCEDURE_NAISSANCE.map((s) => (
            <li key={s.step} style={{ marginBottom: "0.85rem" }}>
              <strong>
                Étape {s.step}. {s.title}
              </strong>
              <p className="muted" style={{ margin: "0.25rem 0 0.5rem" }}>
                {s.detail}
              </p>
              <span style={{ display: "inline-flex", gap: "0.5rem", flexWrap: "wrap" }}>
                <Link className="btn-add btn-sm" to={s.href}>
                  Ouvrir
                </Link>
                {"hrefBureau" in s && s.hrefBureau ? (
                  <Link className="btn-secondary btn-sm" to={s.hrefBureau}>
                    Bureau
                  </Link>
                ) : null}
              </span>
            </li>
          ))}
        </ol>
      </div>

      <div className="panel" style={{ marginBottom: "1.25rem" }} id="delai">
        <h3 className="panel-title">3. Délai de naissance (≤ {EC_DELAI_NAISSANCE_JOURS} jours)</h3>
        <ul className="muted" style={{ margin: 0, paddingLeft: "1.2rem", lineHeight: 1.6 }}>
          <li>
            <strong>Dans le délai</strong> — enregistrement classique (sans ou avec procuration).
          </li>
          <li>
            <strong>Hors délai</strong> — mode « jugement supplétif » +{" "}
            <strong>référence du jugement</strong> obligatoire. Voir{" "}
            <Link to="/juge">Quand le juge intervient</Link>.
          </li>
        </ul>
        <p style={{ margin: "0.85rem 0 0" }}>
          <Link className="btn-primary btn-sm" to="/births">
            Commencer une naissance
          </Link>
        </p>
      </div>

      <div className="panel" style={{ marginBottom: "1.25rem" }}>
        <h3 className="panel-title">4. Les trois registres</h3>
        <div
          style={{
            display: "grid",
            gap: "0.75rem",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          }}
        >
          {EC_REGISTRES.map((r) => (
            <Link
              key={r.id}
              to={r.href}
              className="panel"
              style={{ margin: 0, textDecoration: "none", color: "inherit" }}
            >
              <strong>{r.title}</strong>
              <p className="muted small" style={{ margin: "0.35rem 0 0" }}>
                {r.summary}
              </p>
            </Link>
          ))}
        </div>
        <h4 className="panel-title" style={{ marginTop: "1.1rem" }}>
          Actes liés
        </h4>
        <ul style={{ margin: 0, paddingLeft: "1.2rem" }}>
          {EC_ACTES_LIES.map((a) => (
            <li key={a.id}>
              <Link to={a.href}>{a.title}</Link>
              {a.needsJudge ? " — juge d'abord" : ""}
            </li>
          ))}
        </ul>
      </div>

      <div className="panel">
        <h3 className="panel-title">5. Après l&apos;acte</h3>
        <ul className="muted" style={{ margin: 0, paddingLeft: "1.2rem", lineHeight: 1.6 }}>
          <li>
            <Link to="/documents">Copies &amp; extraits</Link>
          </li>
          <li>
            <Link to="/transcriptions">Transcriptions</Link>
          </li>
          <li>
            <Link to="/corrections">Rectifications / mentions</Link>
          </li>
          <li>
            <Link to="/acts">Registre global des actes</Link>
          </li>
        </ul>
      </div>
    </div>
  );
}
