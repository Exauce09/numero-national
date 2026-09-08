/** Cascading RDC address selector — API /api/v1/geo/* with offline fallback. */

import { useEffect, useState } from "react";

export type GeoSelection = {
  province_id?: string;
  province_name?: string;
  district_id?: string;
  district_name?: string;
  ville_id?: string;
  ville_name?: string;
  commune_id?: string;
  commune_code?: string;
  commune_name?: string;
  localite_id?: string;
  localite_name?: string;
  quartier_id?: string;
  quartier_name?: string;
  avenue_id?: string;
  avenue_name?: string;
  rue_id?: string;
  rue_name?: string;
  label?: string;
};

type Item = { id: string; code: string; name: string; voie_type?: string; chef_lieu?: string };

const BASE = import.meta.env.VITE_API_BASE ?? "/api/v1";

async function fetchItems(path: string): Promise<Item[]> {
  try {
    const res = await fetch(`${BASE}${path}`);
    if (!res.ok) throw new Error(String(res.status));
    return (await res.json()) as Item[];
  } catch {
    return [];
  }
}

type Props = {
  value?: GeoSelection;
  onChange: (v: GeoSelection) => void;
  label?: string;
};

export default function GeoCascade({ value, onChange, label = "Adresse territoriale RDC" }: Props) {
  const [provinces, setProvinces] = useState<Item[]>([]);
  const [districts, setDistricts] = useState<Item[]>([]);
  const [villes, setVilles] = useState<Item[]>([]);
  const [communes, setCommunes] = useState<Item[]>([]);
  const [localites, setLocalites] = useState<Item[]>([]);
  const [quartiers, setQuartiers] = useState<Item[]>([]);
  const [avenues, setAvenues] = useState<Item[]>([]);
  const [rues, setRues] = useState<Item[]>([]);
  const [sel, setSel] = useState<GeoSelection>(value ?? {});
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      await fetch(`${BASE}/geo/seed`, { method: "POST" }).catch(() => undefined);
      const rows = await fetchItems("/geo/provinces");
      if (rows.length === 0) {
        setHint("API géographie indisponible — démarrez l'API puis cliquez Actualiser.");
      } else {
        setHint(null);
      }
      setProvinces(rows);
    })();
  }, []);

  function emit(next: GeoSelection) {
    const parts = [
      next.province_name,
      next.ville_name,
      next.district_name,
      next.commune_name,
      next.localite_name,
      next.quartier_name,
      next.avenue_name ? `Av. ${next.avenue_name}` : undefined,
      next.rue_name ? `Rue ${next.rue_name}` : undefined,
    ].filter(Boolean);
    const full = { ...next, label: parts.join(" · ") };
    setSel(full);
    onChange(full);
  }

  async function onProvince(id: string) {
    const p = provinces.find((x) => x.id === id);
    const next: GeoSelection = {
      province_id: id,
      province_name: p?.name,
    };
    emit(next);
    setDistricts(await fetchItems(`/geo/districts?province_id=${id}`));
    setVilles(await fetchItems(`/geo/villes?province_id=${id}`));
    setCommunes([]);
    setLocalites([]);
    setQuartiers([]);
    setAvenues([]);
    setRues([]);
  }

  async function onVille(id: string) {
    const v = villes.find((x) => x.id === id);
    const next: GeoSelection = {
      ...sel,
      ville_id: id,
      ville_name: v?.name,
      commune_id: undefined,
      commune_name: undefined,
      commune_code: undefined,
      quartier_id: undefined,
      quartier_name: undefined,
      avenue_id: undefined,
      avenue_name: undefined,
      rue_id: undefined,
      rue_name: undefined,
      localite_id: undefined,
      localite_name: undefined,
    };
    emit(next);
    setCommunes(await fetchItems(`/geo/communes?ville_id=${id}`));
    setQuartiers([]);
    setAvenues([]);
    setRues([]);
    setLocalites([]);
  }

  async function onDistrict(id: string) {
    const d = districts.find((x) => x.id === id);
    const next: GeoSelection = {
      ...sel,
      district_id: id,
      district_name: d?.name,
    };
    emit(next);
    const byDist = await fetchItems(`/geo/communes?district_id=${id}`);
    if (byDist.length) setCommunes(byDist);
    setLocalites(await fetchItems(`/geo/localites?district_id=${id}`));
  }

  async function onCommune(id: string) {
    const c = communes.find((x) => x.id === id);
    const next: GeoSelection = {
      ...sel,
      commune_id: id,
      commune_name: c?.name,
      commune_code: c?.code,
      quartier_id: undefined,
      quartier_name: undefined,
      avenue_id: undefined,
      avenue_name: undefined,
      rue_id: undefined,
      rue_name: undefined,
    };
    emit(next);
    setQuartiers(await fetchItems(`/geo/quartiers?commune_id=${id}`));
    setLocalites(await fetchItems(`/geo/localites?commune_id=${id}`));
    setAvenues([]);
    setRues([]);
  }

  async function onLocalite(id: string) {
    const l = localites.find((x) => x.id === id);
    emit({ ...sel, localite_id: id, localite_name: l?.name });
  }

  async function onQuartier(id: string) {
    const q = quartiers.find((x) => x.id === id);
    emit({
      ...sel,
      quartier_id: id,
      quartier_name: q?.name,
      avenue_id: undefined,
      avenue_name: undefined,
      rue_id: undefined,
      rue_name: undefined,
    });
    const voies = await fetchItems(`/geo/voies?quartier_id=${id}`);
    setAvenues(voies.filter((v) => v.voie_type === "AVENUE"));
    setRues(voies.filter((v) => v.voie_type === "RUE"));
  }

  return (
    <div className="panel" style={{ marginTop: 0 }}>
      <h3 className="panel-title" style={{ marginTop: 0 }}>
        {label}
      </h3>
      {hint ? <p className="muted">{hint}</p> : null}
      <div className="form-grid">
        <div>
          <label className="form-label">Province</label>
          <select
            className="form-control"
            value={sel.province_id ?? ""}
            onChange={(e) => void onProvince(e.target.value)}
          >
            <option value="">— Sélectionner —</option>
            {provinces.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="form-label">Ville</label>
          <select
            className="form-control"
            value={sel.ville_id ?? ""}
            disabled={!sel.province_id}
            onChange={(e) => void onVille(e.target.value)}
          >
            <option value="">— Sélectionner —</option>
            {villes.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="form-label">District</label>
          <select
            className="form-control"
            value={sel.district_id ?? ""}
            disabled={!sel.province_id}
            onChange={(e) => void onDistrict(e.target.value)}
          >
            <option value="">— Sélectionner —</option>
            {districts.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="form-label">Commune</label>
          <select
            className="form-control"
            value={sel.commune_id ?? ""}
            disabled={!sel.ville_id && !sel.district_id}
            onChange={(e) => void onCommune(e.target.value)}
          >
            <option value="">— Sélectionner —</option>
            {communes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="form-label">Localité</label>
          <select
            className="form-control"
            value={sel.localite_id ?? ""}
            disabled={!localites.length}
            onChange={(e) => void onLocalite(e.target.value)}
          >
            <option value="">— Optionnel —</option>
            {localites.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="form-label">Quartier</label>
          <select
            className="form-control"
            value={sel.quartier_id ?? ""}
            disabled={!sel.commune_id}
            onChange={(e) => void onQuartier(e.target.value)}
          >
            <option value="">— Sélectionner —</option>
            {quartiers.map((q) => (
              <option key={q.id} value={q.id}>
                {q.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="form-label">Avenue</label>
          <select
            className="form-control"
            value={sel.avenue_id ?? ""}
            disabled={!sel.quartier_id}
            onChange={(e) => {
              const a = avenues.find((x) => x.id === e.target.value);
              emit({ ...sel, avenue_id: e.target.value, avenue_name: a?.name });
            }}
          >
            <option value="">— Optionnel —</option>
            {avenues.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="form-label">Rue</label>
          <select
            className="form-control"
            value={sel.rue_id ?? ""}
            disabled={!sel.quartier_id}
            onChange={(e) => {
              const r = rues.find((x) => x.id === e.target.value);
              emit({ ...sel, rue_id: e.target.value, rue_name: r?.name });
            }}
          >
            <option value="">— Optionnel —</option>
            {rues.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      {sel.label ? (
        <p className="muted" style={{ marginBottom: 0 }}>
          Adresse : <strong>{sel.label}</strong>
          {sel.commune_code ? (
            <>
              {" "}
              · code commune <code>{sel.commune_code}</code>
            </>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
