import { geoFromOfficer } from "../officerContext";

type Props = {
  label?: string;
};

/** Lieu d'acte = territoire attribué à l'agent (pas de re-sélection). */
export default function OfficerTerritoryField({
  label = "Lieu d'état civil (bureau de l'agent)",
}: Props) {
  const geo = geoFromOfficer();

  return (
    <div>
      <label className="form-label">{label}</label>
      <div className="person-picker-selected" style={{ display: "block" }}>
        <strong>{geo.label || "—"}</strong>
        <div className="muted small" style={{ marginTop: 4 }}>
          Province : {geo.province_name || "—"}
          {" · "}
          Ville : {geo.ville_name || "—"}
          {" · "}
          Commune : {geo.commune_name || "—"}
          {geo.commune_code ? ` (${geo.commune_code})` : ""}
        </div>
        <div className="muted small" style={{ marginTop: 4 }}>
          Rempli automatiquement selon l&apos;affectation de l&apos;agent connecté.
        </div>
      </div>
    </div>
  );
}
