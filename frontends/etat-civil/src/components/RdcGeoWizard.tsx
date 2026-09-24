/** Cascade adresse RDC : Province → Ville|Territoire → … → Avenue/Rue. */

import { useEffect, useState } from "react";
import { fallbackForGeoPath } from "../geoFallback";

export type RdcGeoValue = {
  province_id?: string;
  province_name?: string;
  zoneKind?: "ville" | "territoire";
  ville_id?: string;
  ville_name?: string;
  district_id?: string;
  district_name?: string;
  commune_id?: string;
  commune_name?: string;
  commune_type?: string;
  quartier_id?: string;
  quartier_name?: string;
  groupement_id?: string;
  groupement_name?: string;
  village_id?: string;
  village_name?: string;
  avenue_id?: string;
  avenue_name?: string;
  numero?: string;
  label?: string;
};

type Item = { id: string; code: string; name: string; voie_type?: string };

const BASE = import.meta.env.VITE_API_BASE ?? "/api/v1";

async function fetchItems(path: string): Promise<Item[]> {
  try {
    const res = await fetch(`${BASE}${path}`);
    if (res.ok) {
      const rows = (await res.json()) as Item[];
      if (Array.isArray(rows) && rows.length > 0) return rows;
    }
  } catch {
    /* fallback */
  }
  return (fallbackForGeoPath(path) as Item[]) || [];
}

function isKinshasa(name?: string): boolean {
  return (name || "").toLowerCase().includes("kinshasa");
}

function buildLabel(v: RdcGeoValue): string {
  const parts = [
    v.numero ? `n° ${v.numero}` : "",
    v.avenue_name,
    v.quartier_name,
    v.village_name,
    v.groupement_name,
    v.commune_name,
    v.ville_name || v.district_name,
    v.province_name,
  ].filter(Boolean);
  return parts.join(", ");
}

type Props = {
  value?: RdcGeoValue;
  onChange: (v: RdcGeoValue) => void;
  label?: string;
};

export default function RdcGeoWizard({ value, onChange, label = "Adresse / origine" }: Props) {
  const [provinces, setProvinces] = useState<Item[]>([]);
  const [villes, setVilles] = useState<Item[]>([]);
  const [districts, setDistricts] = useState<Item[]>([]);
  const [communes, setCommunes] = useState<Item[]>([]);
  const [quartiers, setQuartiers] = useState<Item[]>([]);
  const [localites, setLocalites] = useState<Item[]>([]);
  const [avenues, setAvenues] = useState<Item[]>([]);
  const [sel, setSel] = useState<RdcGeoValue>(value ?? {});

  useEffect(() => {
    void (async () => {
      await fetch(`${BASE}/geo/seed`, { method: "POST" }).catch(() => undefined);
      setProvinces(await fetchItems("/geo/provinces"));
    })();
  }, []);

  useEffect(() => {
    if (value) setSel(value);
  }, [value]);

  function emit(next: RdcGeoValue) {
    const withLabel = { ...next, label: buildLabel(next) };
    setSel(withLabel);
    onChange(withLabel);
  }

  async function onProvince(id: string) {
    const p = provinces.find((x) => x.id === id);
    const kin = isKinshasa(p?.name);
    const next: RdcGeoValue = {
      province_id: id || undefined,
      province_name: p?.name,
      zoneKind: kin ? "ville" : undefined,
      ville_id: undefined,
      ville_name: undefined,
      district_id: undefined,
      district_name: undefined,
      commune_id: undefined,
      commune_name: undefined,
      quartier_id: undefined,
      quartier_name: undefined,
      groupement_id: undefined,
      groupement_name: undefined,
      village_id: undefined,
      village_name: undefined,
      avenue_id: undefined,
      avenue_name: undefined,
      numero: sel.numero,
    };
    emit(next);
    if (!id) {
      setVilles([]);
      setDistricts([]);
      setCommunes([]);
      return;
    }
    const [vs, ds] = await Promise.all([
      fetchItems(`/geo/villes?province_id=${id}`),
      fetchItems(`/geo/districts?province_id=${id}`),
    ]);
    setVilles(vs);
    setDistricts(ds);
    if (kin && vs[0]) {
      const v0 = vs[0];
      const kinNext = {
        ...next,
        zoneKind: "ville" as const,
        ville_id: v0.id,
        ville_name: v0.name,
      };
      emit(kinNext);
      setCommunes(await fetchItems(`/geo/communes?ville_id=${v0.id}`));
    } else if (kin) {
      setCommunes(await fetchItems(`/geo/communes?province_id=${id}`));
    }
  }

  async function onZoneKind(kind: "ville" | "territoire") {
    const next: RdcGeoValue = {
      ...sel,
      zoneKind: kind,
      ville_id: undefined,
      ville_name: undefined,
      district_id: undefined,
      district_name: undefined,
      commune_id: undefined,
      commune_name: undefined,
      quartier_id: undefined,
      quartier_name: undefined,
      groupement_id: undefined,
      groupement_name: undefined,
      village_id: undefined,
      village_name: undefined,
      avenue_id: undefined,
      avenue_name: undefined,
    };
    emit(next);
    setCommunes([]);
    setQuartiers([]);
    setLocalites([]);
    setAvenues([]);
  }

  async function onVille(id: string) {
    const v = villes.find((x) => x.id === id);
    const next: RdcGeoValue = {
      ...sel,
      ville_id: id || undefined,
      ville_name: v?.name,
      commune_id: undefined,
      commune_name: undefined,
      quartier_id: undefined,
      quartier_name: undefined,
      avenue_id: undefined,
      avenue_name: undefined,
    };
    emit(next);
    setCommunes(id ? await fetchItems(`/geo/communes?ville_id=${id}`) : []);
    setQuartiers([]);
    setAvenues([]);
  }

  async function onDistrict(id: string) {
    const d = districts.find((x) => x.id === id);
    const next: RdcGeoValue = {
      ...sel,
      district_id: id || undefined,
      district_name: d?.name,
      commune_id: undefined,
      commune_name: undefined,
      groupement_id: undefined,
      groupement_name: undefined,
      village_id: undefined,
      village_name: undefined,
      avenue_id: undefined,
      avenue_name: undefined,
    };
    emit(next);
    setCommunes(id ? await fetchItems(`/geo/districts/${id}/communes`) : []);
    setLocalites([]);
    setAvenues([]);
  }

  async function onCommune(id: string) {
    const c = communes.find((x) => x.id === id);
    const next: RdcGeoValue = {
      ...sel,
      commune_id: id || undefined,
      commune_name: c?.name,
      commune_type: c?.voie_type,
      quartier_id: undefined,
      quartier_name: undefined,
      groupement_id: undefined,
      groupement_name: undefined,
      village_id: undefined,
      village_name: undefined,
      avenue_id: undefined,
      avenue_name: undefined,
    };
    emit(next);
    if (!id) {
      setQuartiers([]);
      setLocalites([]);
      setAvenues([]);
      return;
    }
    if (sel.zoneKind === "ville" || isKinshasa(sel.province_name)) {
      setQuartiers(await fetchItems(`/geo/communes/${id}/quartiers`));
      setLocalites([]);
    } else {
      setLocalites(await fetchItems(`/geo/communes/${id}/localites`));
      setQuartiers([]);
    }
    setAvenues([]);
  }

  async function onQuartier(id: string) {
    const q = quartiers.find((x) => x.id === id);
    const next: RdcGeoValue = {
      ...sel,
      quartier_id: id || undefined,
      quartier_name: q?.name,
      avenue_id: undefined,
      avenue_name: undefined,
    };
    emit(next);
    setAvenues(id ? await fetchItems(`/geo/quartiers/${id}/avenues`) : []);
  }

  function onVillage(id: string) {
    const v = localites.find((x) => x.id === id);
    emit({
      ...sel,
      village_id: id || undefined,
      village_name: v?.name,
      groupement_name: sel.groupement_name,
    });
  }

  function onAvenue(id: string) {
    const a = avenues.find((x) => x.id === id);
    emit({
      ...sel,
      avenue_id: id || undefined,
      avenue_name: a?.name,
    });
  }

  const kin = isKinshasa(sel.province_name);
  const showZoneStep = Boolean(sel.province_id) && !kin;
  const urban = sel.zoneKind === "ville" || kin;
  const rural = sel.zoneKind === "territoire";

  return (
    <fieldset className="id-fieldset" style={{ margin: 0 }}>
      <legend>{label}</legend>
      <div className="form-grid">
        <div className="full">
          <label className="form-label">1. Province *</label>
          <select
            className="form-control"
            value={sel.province_id || ""}
            onChange={(e) => void onProvince(e.target.value)}
          >
            <option value="">— Choisir la province —</option>
            {provinces.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          {kin ? (
            <p className="muted small" style={{ margin: "0.35rem 0 0" }}>
              Kinshasa détectée — passage direct aux communes (pas de territoire).
            </p>
          ) : null}
        </div>

        {showZoneStep ? (
          <div className="full">
            <label className="form-label">2. Type de zone *</label>
            <select
              className="form-control"
              value={sel.zoneKind || ""}
              onChange={(e) => void onZoneKind(e.target.value as "ville" | "territoire")}
            >
              <option value="">— Ville ou Territoire —</option>
              <option value="ville">Ville</option>
              <option value="territoire">Territoire</option>
            </select>
          </div>
        ) : null}

        {urban && sel.province_id ? (
          <>
            {!kin ? (
              <div>
                <label className="form-label">Ville *</label>
                <select
                  className="form-control"
                  value={sel.ville_id || ""}
                  onChange={(e) => void onVille(e.target.value)}
                >
                  <option value="">— Choisir —</option>
                  {villes.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            <div>
              <label className="form-label">3. Commune *</label>
              <select
                className="form-control"
                value={sel.commune_id || ""}
                onChange={(e) => void onCommune(e.target.value)}
                disabled={!kin && !sel.ville_id}
              >
                <option value="">— Choisir —</option>
                {communes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">Quartier *</label>
              <select
                className="form-control"
                value={sel.quartier_id || ""}
                onChange={(e) => void onQuartier(e.target.value)}
                disabled={!sel.commune_id}
              >
                <option value="">— Choisir —</option>
                {quartiers.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.name}
                  </option>
                ))}
              </select>
            </div>
          </>
        ) : null}

        {rural && sel.province_id ? (
          <>
            <div>
              <label className="form-label">Territoire *</label>
              <select
                className="form-control"
                value={sel.district_id || ""}
                onChange={(e) => void onDistrict(e.target.value)}
              >
                <option value="">— Choisir —</option>
                {districts.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">3. Commune rurale / Secteur / Chefferie *</label>
              <select
                className="form-control"
                value={sel.commune_id || ""}
                onChange={(e) => void onCommune(e.target.value)}
                disabled={!sel.district_id}
              >
                <option value="">— Choisir —</option>
                {communes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.voie_type ? ` (${c.voie_type})` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">Groupement</label>
              <input
                className="form-control"
                value={sel.groupement_name || ""}
                onChange={(e) => emit({ ...sel, groupement_name: e.target.value })}
                placeholder="Nom du groupement"
              />
            </div>
            <div>
              <label className="form-label">Village *</label>
              <select
                className="form-control"
                value={sel.village_id || ""}
                onChange={(e) => onVillage(e.target.value)}
                disabled={!sel.commune_id}
              >
                <option value="">— Choisir —</option>
                {localites.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </div>
          </>
        ) : null}

        {(urban || rural) && (sel.quartier_id || sel.village_id || sel.commune_id) ? (
          <>
            <div>
              <label className="form-label">4. Avenue / Rue</label>
              {avenues.length > 0 ? (
                <select
                  className="form-control"
                  value={sel.avenue_id || ""}
                  onChange={(e) => onAvenue(e.target.value)}
                >
                  <option value="">— Choisir ou saisir ci-dessous —</option>
                  {avenues.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  className="form-control"
                  value={sel.avenue_name || ""}
                  onChange={(e) => emit({ ...sel, avenue_name: e.target.value })}
                  placeholder="Avenue / rue"
                />
              )}
            </div>
            <div>
              <label className="form-label">N°</label>
              <input
                className="form-control"
                value={sel.numero || ""}
                onChange={(e) => emit({ ...sel, numero: e.target.value })}
                placeholder="Numéro"
              />
            </div>
          </>
        ) : null}

        {sel.label ? (
          <div className="full muted small">
            Adresse complète : <strong>{sel.label}</strong>
          </div>
        ) : null}
      </div>
    </fieldset>
  );
}
