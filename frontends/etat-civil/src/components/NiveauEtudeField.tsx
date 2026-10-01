/** Champ Niveau d'étude — réutilisable sur tous les formulaires d'identité. */

import { NIVEAUX_ETUDES, normalizeNiveauCode } from "../etudesFaites";

type Props = {
  value: string;
  onChange: (code: string) => void;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  id?: string;
  className?: string;
};

export default function NiveauEtudeField({
  value,
  onChange,
  label = "Niveau d'étude — diplôme / certificat (RDC)",
  required,
  disabled,
  id,
  className,
}: Props) {
  const normalized = normalizeNiveauCode(value);
  return (
    <div className={className}>
      <label className="form-label" htmlFor={id}>
        {label}
        {required ? " *" : ""}
      </label>
      <select
        id={id}
        className="form-control"
        value={normalized}
        required={required}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      >
        {NIVEAUX_ETUDES.map((n) => (
          <option key={n.value || "empty"} value={n.value}>
            {n.label}
          </option>
        ))}
      </select>
    </div>
  );
}
