import { getLoggedOfficer, type LoggedOfficer } from "../officerContext";

type Props = {
  /** Affiche aussi le territoire (province / ville / commune) sous le nom. */
  showTerritory?: boolean;
};

/** Champ lecture seule : l'agent d'état civil connecté (pas une recherche population). */
export default function OfficerSessionField({ showTerritory = true }: Props) {
  const officer: LoggedOfficer | null = getLoggedOfficer();

  if (!officer) {
    return (
      <div>
        <label className="form-label">Officier d&apos;état civil</label>
        <div className="muted small">Aucun agent connecté — reconnectez-vous.</div>
      </div>
    );
  }

  return (
    <div>
      <label className="form-label">Officier d&apos;état civil</label>
      <div className="person-picker-selected" style={{ display: "block" }}>
        <strong>{officer.displayName}</strong>
        <div className="muted small">{officer.roleTitle}</div>
        <div className="muted small">Compte : {officer.username}</div>
        {officer.userId ? (
          <div className="muted small">Id agent : {officer.userId}</div>
        ) : null}
        {showTerritory ? (
          <div className="muted small" style={{ marginTop: 4 }}>
            Bureau : {[officer.commune.province, officer.commune.ville, officer.commune.name]
              .filter(Boolean)
              .join(" · ")}
          </div>
        ) : null}
      </div>
    </div>
  );
}
