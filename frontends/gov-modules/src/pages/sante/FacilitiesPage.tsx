import { FormEvent, useEffect, useMemo, useState } from "react";
import { api, type Facility } from "../../api";
import { FACILITY_TYPE_LABELS, listMinistryFacilities } from "../../santeData";

type GeoItem = { id: string; code?: string; name: string };

const BASE = import.meta.env.VITE_API_BASE ?? "/api/v1";

async function fetchGeo<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as T;
}

export default function FacilitiesPage() {
  const [tick, setTick] = useState(0);
  const localRows = useMemo(() => listMinistryFacilities(), [tick]);
  const [apiRows, setApiRows] = useState<Facility[]>([]);
  const [q, setQ] = useState("");
  const [type, setType] = useState("ALL");
  const [onlyActive, setOnlyActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [provinces, setProvinces] = useState<GeoItem[]>([]);
  const [communes, setCommunes] = useState<GeoItem[]>([]);
  const [provinceId, setProvinceId] = useState("");
  const [communeId, setCommuneId] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [facilityType, setFacilityType] = useState("HOSPITAL");

  useEffect(() => {
    void api.healthFacilities().then(setApiRows).catch(() => setApiRows([]));
    void fetchGeo<GeoItem[]>("/geo/provinces")
      .then(setProvinces)
      .catch(() => setProvinces([]));
  }, [tick]);

  useEffect(() => {
    if (!provinceId) {
      setCommunes([]);
      setCommuneId("");
      return;
    }
    void fetchGeo<GeoItem[]>(`/geo/communes?province_id=${encodeURIComponent(provinceId)}`)
      .then(setCommunes)
      .catch(() => setCommunes([]));
  }, [provinceId]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(null);
    const prov = provinces.find((p) => p.id === provinceId);
    const com = communes.find((c) => c.id === communeId);
    if (!prov?.code) {
      setError("Sélectionnez une province du référentiel.");
      return;
    }
    try {
      await api.healthFacilityCreate({
        code: code.trim(),
        name: name.trim(),
        facility_type: facilityType,
        province_code: prov.code,
        commune_code: com?.code ?? null,
      });
      setOk("Structure créée et liée à la province/commune.");
      setCode("");
      setName("");
      setCommuneId("");
      setTick((n) => n + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Création impossible");
    }
  }

  const merged = [
    ...apiRows.map((f) => ({
      id: f.id,
      name: f.name,
      facility_type: f.facility_type ?? "HOSPITAL",
      province: f.province_code ?? "—",
      commune_name: f.commune_code ?? "—",
      commune_code: f.commune_code ?? "",
      username: f.code,
      active: (f.status ?? "ACTIVE") !== "INACTIVE",
    })),
    ...localRows.map((f) => ({
      id: f.id,
      name: f.name,
      facility_type: f.facility_type,
      province: f.province,
      commune_name: f.commune_name,
      commune_code: f.commune_code,
      username: f.username,
      active: f.active,
    })),
  ];

  const filtered = merged.filter((f) => {
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
            Structures enregistrées (API PostgreSQL) liées à une province et une commune.
          </p>
        </div>
        <button type="button" className="btn-secondary btn-sm" onClick={() => setTick((n) => n + 1)}>
          Actualiser
        </button>
      </div>

      {error ? <div className="login-error">{error}</div> : null}
      {ok ? <div className="success-banner">{ok}</div> : null}

      <div className="panel" style={{ marginBottom: "1.25rem" }}>
        <h3 style={{ marginTop: 0 }}>Créer une structure</h3>
        <form className="form-grid" onSubmit={onCreate}>
          <div>
            <label className="form-label">Code</label>
            <input className="form-control" required value={code} onChange={(e) => setCode(e.target.value)} />
          </div>
          <div>
            <label className="form-label">Nom</label>
            <input className="form-control" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="form-label">Type</label>
            <select className="form-control" value={facilityType} onChange={(e) => setFacilityType(e.target.value)}>
              {Object.entries(FACILITY_TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label">Province</label>
            <select className="form-control" required value={provinceId} onChange={(e) => setProvinceId(e.target.value)}>
              <option value="">Choisir…</option>
              {provinces.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code ? `${p.code} — ` : ""}
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label">Commune</label>
            <select
              className="form-control"
              value={communeId}
              onChange={(e) => setCommuneId(e.target.value)}
              disabled={!provinceId}
            >
              <option value="">Choisir…</option>
              {communes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code ? `${c.code} — ` : ""}
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="full">
            <button type="submit" className="btn-primary" style={{ width: "auto" }}>
              Enregistrer
            </button>
          </div>
        </form>
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
          {filtered.length} structure(s)
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
                <td>{f.active ? "ACTIVE" : "INACTIVE"}</td>
              </tr>
            ))}
            {!filtered.length ? (
              <tr>
                <td colSpan={6} className="muted">
                  Aucune structure enregistrée.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
