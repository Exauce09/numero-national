import { NATIONALITES } from "../nationalites";

type Props = {
  id?: string;
  label: string;
  value: string;
  onChange: (code: string) => void;
  required?: boolean;
  allowEmpty?: boolean;
};

/** Liste déroulante nationalité en français (congolaise + étrangers). */
export default function NationaliteSelect({
  id,
  label,
  value,
  onChange,
  required,
  allowEmpty,
}: Props) {
  return (
    <label htmlFor={id}>
      {label}
      <select
        id={id}
        className="form-control"
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {allowEmpty ? <option value="">—</option> : null}
        <optgroup label="Nationale">
          {NATIONALITES.filter((n) => n.code === "COD").map((n) => (
            <option key={n.code} value={n.code}>
              {n.label}
            </option>
          ))}
        </optgroup>
        <optgroup label="Étrangères / autres">
          {NATIONALITES.filter((n) => n.code !== "COD").map((n) => (
            <option key={n.code} value={n.code}>
              {n.label}
            </option>
          ))}
        </optgroup>
      </select>
    </label>
  );
}
