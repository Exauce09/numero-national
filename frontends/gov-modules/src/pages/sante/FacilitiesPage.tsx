import { FormEvent, useMemo, useState } from "react";
import { FACILITY_TYPE_LABELS, listMinistryFacilities, upsertFacilityAccount } from "../../santeData";

export default function FacilitiesPage() {
  const [tick, bump] = useState(0);
  const rows = useMemo(() => listMinistryFacilities(), [tick]);
  const [q, setQ] = useState("");
  const [type, setType] = useState("ALL");
  const [onlyActive, setOnlyActive] = useState(false);
  const [name, setName] = useState("");
  const [facilityType, setFacilityType] = useState("HOPITAL");
  const [province, setProvince] = useState("");
  const [commune, setCommune] = useState("");
  const [username, setUsername] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const filtered = rows.filter((f) => {
    if (onlyActive && !f.active) return false;
    if (type !== "ALL" && f.facility_type !== type) return false;
    const hay = `${f.name} ${f.commune_name} ${f.province} ${f.username ?? ""}`.toLowerCase();
    return hay.includes(q.trim().toLowerCase());
  });

  function onAdd(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!name.trim() || !province.trim() || !commune.trim()) {
      setMsg("Nom, province et commune sont requis.");
      return;
    }
    const id = `fac-${Date.now().toString(36)}`;
    upsertFacilityAccount({
      id,
      username: username.trim() || undefined,
      facilityName: name.trim(),
      facilityType,
      commune_code: commune.trim().toUpperCase().replace(/\s+/g, "-"),
      commune_name: commune.trim(),
      province: province.trim(),
      ville: province.trim(),
      active: true,
      created_at: new Date().toISOString(),
    });
    setName("");
    setProvince("");
    setCommune("");
    setUsername("");
    setMsg("Structure enregistrée.");
    bump((n) => n + 1);
  }

  return (
    <div>
      <div className="eg-page-head">
        <div>
          <h2 className="page-title">Structures sanitaires</h2>
          <p className="page-lead">Registre vierge — ajoutez les structures sanitaires du système.</p>
        </div>
        <button type="button" className="btn-secondary btn-sm" onClick={() => bump((n) => n + 1)}>
          Actualiser
        </button>
      </div>

      <div className="panel" style={{ marginBottom: "1rem" }}>
        <h3 className="panel-title" style={{ marginTop: 0 }}>
          Nouvelle structure
        </h3>
        <form onSubmit={onAdd} className="toolbar" style={{ flexWrap: "wrap" }}>
          <input className="form-control" placeholder="Nom de la structure" value={name} onChange={(e) => setName(e.target.value)} />
          <select className="form-control" value={facilityType} onChange={(e) => setFacilityType(e.target.value)}>
            {Object.entries(FACILITY_TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <input className="form-control" placeholder="Province" value={province} onChange={(e) => setProvince(e.target.value)} />
          <input className="form-control" placeholder="Commune" value={commune} onChange={(e) => setCommune(e.target.value)} />
          <input className="form-control" placeholder="Identifiant (optionnel)" value={username} onChange={(e) => setUsername(e.target.value)} />
          <button type="submit" className="btn-primary btn-sm">
            Ajouter
          </button>
        </form>
        {msg ? <p className="muted small">{msg}</p> : null}
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
                  Aucune structure — utilisez le formulaire ci-dessus pour en ajouter.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
