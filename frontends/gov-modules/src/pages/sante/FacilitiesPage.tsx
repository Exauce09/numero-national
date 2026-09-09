import { useMemo, useState } from "react";
import { FACILITY_TYPE_LABELS, listMinistryFacilities } from "../../santeData";

export default function FacilitiesPage() {
  const [, bump] = useState(0);
  const rows = useMemo(() => listMinistryFacilities(), [bump]);
  const [q, setQ] = useState("");
  const [type, setType] = useState("ALL");
  const [onlyActive, setOnlyActive] = useState(false);

  const filtered = rows.filter((f) => {
    if (onlyActive && !f.active) return false;
    if (type !== "ALL" && f.facility_type !== type) return false;
    const hay = `${f.name} ${f.commune_name} ${f.province} ${f.username ?? ""}`.toLowerCase();
    return hay.includes(q.trim().toLowerCase());
  });

  return (
    <div>
      <div className="eg-page-head">
        <div>
          <h2 className="page-title">Structures sanitaires</h2>
          <p className="page-lead">
            Toutes les structures du système (comptes créés côté état civil + démo ministère).
          </p>
        </div>
        <button type="button" className="btn-secondary btn-sm" onClick={() => bump((n) => n + 1)}>
          Actualiser
        </button>
      </div>

      <div className="toolbar">
        <input
          className="form-control"
          placeholder="Rechercher nom, commune, province…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select className="form-control" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="ALL">Tous les types</option>
          {Object.entries(FACILITY_TYPE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <label className="muted small" style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
          <input type="checkbox" checked={onlyActive} onChange={(e) => setOnlyActive(e.target.checked)} />
          Actives seulement
        </label>
      </div>

      <div className="panel">
        <p className="muted small" style={{ marginTop: 0 }}>
          {filtered.length} / {rows.length} structure(s)
        </p>
        <table className="data-table">
          <thead>
            <tr>
              <th>Nom</th>
              <th>Type</th>
              <th>Province</th>
              <th>Commune</th>
              <th>Identifiant</th>
              <th>Statut</th>
              <th>Naissances</th>
              <th>Décès</th>
              <th>En attente</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((f) => (
              <tr key={f.id}>
                <td>{f.name}</td>
                <td>{FACILITY_TYPE_LABELS[f.facility_type] ?? f.facility_type}</td>
                <td>{f.province}</td>
                <td>{f.commune_name || f.commune_code || "—"}</td>
                <td>
                  <code>{f.username ?? "—"}</code>
                </td>
                <td style={{ color: f.active ? "#1a5f4a" : "#8a4b1a", fontWeight: 700 }}>
                  {f.active ? "Actif" : "Désactivé"}
                </td>
                <td>{f.births}</td>
                <td>{f.deaths}</td>
                <td>{f.pending}</td>
              </tr>
            ))}
            {!filtered.length ? (
              <tr>
                <td colSpan={9} className="muted">
                  Aucune structure.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
