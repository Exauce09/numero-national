import { useId, useState, type InputHTMLAttributes } from "react";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label?: string;
  /** Affiche le label au-dessus (défaut true si `label` fourni). */
  showLabel?: boolean;
};

/** Champ mot de passe avec bascule Afficher / Masquer. */
export default function PasswordField({
  label,
  showLabel = Boolean(label),
  id,
  className,
  ...rest
}: Props) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const [visible, setVisible] = useState(false);

  return (
    <div className="password-field">
      {showLabel && label ? (
        <label className="form-label" htmlFor={inputId}>
          {label}
        </label>
      ) : null}
      <div className="password-field-wrap">
        <input
          {...rest}
          id={inputId}
          className={className ?? "form-control"}
          type={visible ? "text" : "password"}
        />
        <button
          type="button"
          className="password-field-toggle"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
          aria-pressed={visible}
          tabIndex={-1}
        >
          {visible ? "Masquer" : "Afficher"}
        </button>
      </div>
    </div>
  );
}
