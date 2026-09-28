import { useMemo, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type { CivilDeclaration } from "../civilDeclarations";
import { rdcColor } from "../rdcColors";
import DataToolbar from "./DataToolbar";
import { SimpleStatBlocks } from "./StatBlocks";

export type HealthListColumn = {
  label: string;
  value: (d: CivilDeclaration) => string;
  render?: (d: CivilDeclaration) => ReactNode;
};

export function declarationStatusLabel(status: CivilDeclaration["status"]): string {
  if (status === "VALIDATED") return "Validé";
  if (status === "REJECTED") return "Rejeté";
  return "À valider";
}

/** Liste des notifications IT : total validé + à valider (cliquables), recherche, puis « + Ajouter ». */
export default function HealthDeclarationList({
  title,
  listTitle,
  lead,
  rows,
  columns,
  exportName,
  onAdd,
  banner,
}: {
  title: string;
  listTitle: string;
  lead: ReactNode;
  rows: CivilDeclaration[];
  columns: HealthListColumn[];
  exportName: string;
  onAdd: () => void;
  banner?: ReactNode;
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const focus = searchParams.get("focus");
  const [q, setQ] = useState("");

  const validated = rows.filter((d) => d.status === "VALIDATED");
  const pending = rows.filter((d) => d.status === "PENDING_OFFICER");

  function setFocus(next: "validated" | "pending" | null) {
    const params = new URLSearchParams(searchParams);
    if (!next || next === focus) params.delete("focus");
    else params.set("focus", next);
    setSearchParams(params, { replace: true });
  }

  const shown = useMemo(() => {
    let list =
      focus === "validated" ? validated : focus === "pending" ? pending : rows;
    const needle = q.trim().toLowerCase();
    if (needle) {
      list = list.filter((d) =>
        columns.some((c) => c.value(d).toLowerCase().includes(needle)),
      );
    }
    return [...list].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
  }, [rows, focus, q, columns, validated, pending]);

  const exportRows = shown.map((d) =>
    Object.fromEntries([
      ...columns.map((c) => [c.label, c.value(d)]),
      ["Statut", declarationStatusLabel(d.status)],
    ]),
  );

  return (
    <div>
      <div className="eg-page-head">
        <div>
          <p className="eg-breadcrumb">
            <Link to="/sante">Accueil</Link> / {title}
          </p>
          <h2 className="page-title">{title}</h2>
          <p className="page-lead">{lead}</p>
        </div>
        <button type="button" className="btn-add" onClick={onAdd}>
          + Ajouter
        </button>
      </div>

      {banner}

      <SimpleStatBlocks
        title={listTitle}
        items={[
          {
            label: "TOTAL GÉNÉRAL",
            value: validated.length + pending.length,
            unit: "total",
            color: rdcColor(0),
            onClick: () => setFocus(null),
            active: !focus,
          },
          {
            label: "VALIDÉS",
            value: validated.length,
            unit: "validated",
            color: rdcColor(1),
            onClick: () => setFocus("validated"),
            active: focus === "validated",
          },
          {
            label: "À VALIDER",
            value: pending.length,
            unit: "pending",
            color: rdcColor(3),
            onClick: () => setFocus("pending"),
            active: focus === "pending",
          },
        ]}
      />

      <div className="panel">
        <div className="panel-head">
          <div className="eg-filter-bar">
            <label className="muted small" htmlFor={`search-${exportName}`}>
              Rechercher :
            </label>
            <input
              id={`search-${exportName}`}
              className="form-control"
              style={{ marginBottom: 0, minWidth: 220 }}
              placeholder="Nom, date, statut…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <DataToolbar filename={exportName} rows={exportRows} />
        </div>
        <div className="eg-acts-table-caption">
          <strong>
            {focus === "validated"
              ? "Notifications validées"
              : focus === "pending"
                ? "Notifications à valider"
                : "Toutes les notifications"}
          </strong>
          <span className="muted small">
            {shown.length} enregistrement{shown.length > 1 ? "s" : ""}
          </span>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>#</th>
              {columns.map((c) => (
                <th key={c.label}>{c.label}</th>
              ))}
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 2} className="muted">
                  Aucune notification — cliquez sur « + Ajouter ».
                </td>
              </tr>
            ) : (
              shown.map((d, i) => (
                <tr key={d.id}>
                  <td>{i + 1}</td>
                  {columns.map((c) => (
                    <td key={c.label}>{c.render ? c.render(d) : c.value(d) || "—"}</td>
                  ))}
                  <td>
                    <span
                      className={`status-badge${d.status === "VALIDATED" ? " is-ok" : ""}`}
                    >
                      {declarationStatusLabel(d.status)}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
