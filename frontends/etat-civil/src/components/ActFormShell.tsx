import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import type { ActFormSchema } from "../ecActForms";

type Props = {
  schema: ActFormSchema;
  children: ReactNode;
  extraLead?: ReactNode;
};

/** En-tête standardisé pour les formulaires d'actes (termes officiels). */
export default function ActFormShell({ schema, children, extraLead }: Props) {
  return (
    <div>
      <h2 className="page-title">{schema.title}</h2>
      <p className="page-lead">{schema.subtitle}</p>
      {extraLead}
      {schema.needsJudge ? (
        <div className="panel" style={{ marginBottom: "1rem", borderLeft: "4px solid var(--rdc-yellow, #f0c400)" }}>
          <strong>Après décision judiciaire</strong>
          <p className="muted" style={{ margin: "0.35rem 0 0" }}>
            {schema.judgeBanner ||
              "L'officier exécute la transcription ou la mention après transmission du greffe."}
          </p>
          <p style={{ margin: "0.5rem 0 0" }}>
            <Link className="btn-secondary btn-sm" to="/juge">
              Quand le juge intervient
            </Link>
          </p>
        </div>
      ) : null}
      {children}
    </div>
  );
}
