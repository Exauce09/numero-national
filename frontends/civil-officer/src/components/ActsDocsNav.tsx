import { Link, useLocation } from "react-router-dom";

const LINKS = [
  { to: "/acts", label: "Registre" },
  { to: "/declarations", label: "Déclarations santé" },
  { to: "/transcriptions", label: "Transcriptions" },
  { to: "/corrections", label: "Corrections" },
  { to: "/verify-document", label: "Vérifier document" },
] as const;

/** Sous-navigation du module Actes & documents. */
export default function ActsDocsNav() {
  const { pathname } = useLocation();
  return (
    <div className="dash-quick" style={{ margin: "0.75rem 0 1rem", flexWrap: "wrap" }}>
      {LINKS.map((l) => (
        <Link
          key={l.to}
          className={`btn-secondary btn-sm${pathname.startsWith(l.to) ? " active" : ""}`}
          to={l.to}
        >
          {l.label}
        </Link>
      ))}
    </div>
  );
}
