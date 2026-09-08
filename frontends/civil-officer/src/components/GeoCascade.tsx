/** Cascading RDC address selector — API /api/v1/geo/* with inline add + anti-doublon. */

import { FormEvent, useEffect, useState } from "react";

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

type AddKind = "district" | "commune" | "localite" | "quartier" | "avenue" | "rue";

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

async function postJson(path: string, body: Record<string, unknown>): Promise<{ ok: true; data: Item } | { ok: false; error: string }> {
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let parsed: unknown = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = text;
    }
    if (!res.ok) {
      const detail =
        typeof parsed === "object" && parsed && "detail" in parsed
          ? String((parsed as { detail: unknown }).detail)
          : text || `HTTP ${res.status}`;
      return { ok: false, error: detail };
    }
    return { ok: true, data: parsed as Item };
  } catch {
    return { ok: false, error: "API indisponible" };
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
  const [addKind, setAddKind] = useState<AddKind | null>(null);
  const [addName, setAddName] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [addBusy, setAddBusy] = useState(false);
  const [addOk, setAddOk] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      await fetch(`${BASE}/geo/seed`, { method: "POST" }).catch(() => undefined);
      const rows = await fetchItems("/geo/provinces");
      if (rows.length === 0) {
        setHint("API géographie indisponible — démarrez l'API puis actualisez.");
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
    emit({ province_id: id, province_name: p?.name });
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
    emit({
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
    });
    setCommunes(await fetchItems(`/geo/communes?ville_id=${id}`));
    setQuartiers([]);
    setAvenues([]);
    setRues([]);
    setLocalites([]);
  }

  async function onDistrict(id: string) {
    const d = districts.find((x) => x.id === id);
    emit({ ...sel, district_id: id, district_name: d?.name });
    const byDist = await fetchItems(`/geo/communes?district_id=${id}`);
    if (byDist.length) setCommunes(byDist);
    setLocalites(await fetchItems(`/geo/localites?district_id=${id}`));
  }

  async function onCommune(id: string) {
    const c = communes.find((x) => x.id === id);
    emit({
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
    });
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

  function openAdd(kind: AddKind) {
    setAddKind(kind);
    setAddName("");
    setAddError(null);
    setAddOk(null);
  }

  function canAdd(kind: AddKind): boolean {
    switch (kind) {
      case "district":
        return Boolean(sel.province_id);
      case "commune":
        return Boolean(sel.ville_id);
      case "localite":
        return Boolean(sel.commune_id || sel.district_id);
      case "quartier":
        return Boolean(sel.commune_id);
      case "avenue":
      case "rue":
        return Boolean(sel.quartier_id);
      default:
        return false;
    }
  }

  async function submitAdd(e: FormEvent) {
    e.preventDefault();
    if (!addKind) return;
    setAddBusy(true);
    setAddError(null);
    setAddOk(null);
    const name = addName.trim();
    if (name.length < 2) {
      setAddError("Nom trop court.");
      setAddBusy(false);
      return;
    }

    let result: { ok: true; data: Item } | { ok: false; error: string };
    if (addKind === "district") {
      result = await postJson("/geo/districts", { province_id: sel.province_id, name });
    } else if (addKind === "commune") {
      result = await postJson("/geo/communes", {
        ville_id: sel.ville_id,
        district_id: sel.district_id || null,
        name,
      });
    } else if (addKind === "localite") {
      result = await postJson("/geo/localites", {
        name,
        commune_id: sel.commune_id || null,
        district_id: sel.district_id || null,
      });
    } else if (addKind === "quartier") {
      result = await postJson("/geo/quartiers", { commune_id: sel.commune_id, name });
    } else {
      result = await postJson("/geo/voies", {
        quartier_id: sel.quartier_id,
        name,
        voie_type: addKind === "avenue" ? "AVENUE" : "RUE",
      });
    }

    if (!result.ok) {
      setAddError(result.error);
      setAddBusy(false);
      return;
    }

    const created = result.data;
    setAddOk(`Ajouté : ${created.name}`);
    if (addKind === "district") {
      setDistricts((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name, "fr")));
      await onDistrict(created.id);
    } else if (addKind === "commune") {
      setCommunes((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name, "fr")));
      await onCommune(created.id);
    } else if (addKind === "localite") {
      setLocalites((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name, "fr")));
      await onLocalite(created.id);
    } else if (addKind === "quartier") {
      setQuartiers((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name, "fr")));
      await onQuartier(created.id);
    } else if (addKind === "avenue") {
      setAvenues((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name, "fr")));
      emit({ ...sel, avenue_id: created.id, avenue_name: created.name });
    } else if (addKind === "rue") {
      setRues((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name, "fr")));
      emit({ ...sel, rue_id: created.id, rue_name: created.name });
    }
    setAddBusy(false);
    setTimeout(() => setAddKind(null), 700);
  }

  const addTitles: Record<AddKind, string> = {
    district: "Ajouter un district",
    commune: "Ajouter une commune",
    localite: "Ajouter une localité",
    quartier: "Ajouter un quartier",
    avenue: "Ajouter une avenue",
    rue: "Ajouter une rue",
  };

  function Field({
    labelText,
    value,
    disabled,
    options,
    onPick,
    addKindBtn,
  }: {
    labelText: string;
    value: string;
    disabled?: boolean;
    options: Item[];
    onPick: (id: string) => void;
    addKindBtn?: AddKind;
  }) {
    return (
      <div>
        <div className="geo-field-head">
          <label className="form-label">{labelText}</label>
          {addKindBtn ? (
            <button
              type="button"
              className="btn-secondary btn-sm"
              disabled={!canAdd(addKindBtn)}
              onClick={() => openAdd(addKindBtn)}
              title={!canAdd(addKindBtn) ? "Sélectionnez d'abord le niveau parent" : "Ajouter si absent"}
            >
              + Ajouter
            </button>
          ) : null}
        </div>
        <select
          className="form-control"
          value={value}
          disabled={disabled}
          onChange={(e) => void onPick(e.target.value)}
        >
          <option value="">— Sélectionner —</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div className="panel" style={{ marginTop: 0 }}>
      <h3 className="panel-title" style={{ marginTop: 0 }}>
        {label}
      </h3>
      {hint ? <p className="muted">{hint}</p> : null}
      <p className="muted small">
        Si un district, une commune, une localité, un quartier, une avenue ou une rue manque, utilisez{" "}
        <strong>+ Ajouter</strong>. Un doublon (même nom, autre orthographe) est refusé.
      </p>
      <div className="form-grid">
        <Field
          labelText="Province"
          value={sel.province_id ?? ""}
          options={provinces}
          onPick={(id) => void onProvince(id)}
        />
        <Field
          labelText="Ville"
          value={sel.ville_id ?? ""}
          disabled={!sel.province_id}
          options={villes}
          onPick={(id) => void onVille(id)}
        />
        <Field
          labelText="District"
          value={sel.district_id ?? ""}
          disabled={!sel.province_id}
          options={districts}
          onPick={(id) => void onDistrict(id)}
          addKindBtn="district"
        />
        <Field
          labelText="Commune"
          value={sel.commune_id ?? ""}
          disabled={!sel.ville_id && !sel.district_id}
          options={communes}
          onPick={(id) => void onCommune(id)}
          addKindBtn="commune"
        />
        <Field
          labelText="Localité"
          value={sel.localite_id ?? ""}
          disabled={!sel.commune_id && !sel.district_id}
          options={localites}
          onPick={(id) => void onLocalite(id)}
          addKindBtn="localite"
        />
        <Field
          labelText="Quartier"
          value={sel.quartier_id ?? ""}
          disabled={!sel.commune_id}
          options={quartiers}
          onPick={(id) => void onQuartier(id)}
          addKindBtn="quartier"
        />
        <Field
          labelText="Avenue"
          value={sel.avenue_id ?? ""}
          disabled={!sel.quartier_id}
          options={avenues}
          onPick={(id) => {
            const a = avenues.find((x) => x.id === id);
            emit({ ...sel, avenue_id: id, avenue_name: a?.name });
          }}
          addKindBtn="avenue"
        />
        <Field
          labelText="Rue"
          value={sel.rue_id ?? ""}
          disabled={!sel.quartier_id}
          options={rues}
          onPick={(id) => {
            const r = rues.find((x) => x.id === id);
            emit({ ...sel, rue_id: id, rue_name: r?.name });
          }}
          addKindBtn="rue"
        />
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

      {addKind ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <form className="modal-panel" onSubmit={(e) => void submitAdd(e)}>
            <h3>{addTitles[addKind]}</h3>
            <p className="muted small">
              Le nom est enregistré en base. Une variante déjà présente (accents, majuscules, « Av. » / « Rue »)
              sera refusée.
            </p>
            {addError ? <div className="login-error">{addError}</div> : null}
            {addOk ? <div className="success-banner">{addOk}</div> : null}
            <label className="form-label">Nom</label>
            <input
              className="form-control"
              value={addName}
              onChange={(e) => setAddName(e.target.value)}
              placeholder="Ex. Nouveau quartier"
              autoFocus
              required
            />
            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={() => setAddKind(null)}>
                Annuler
              </button>
              <button type="submit" className="btn-primary" style={{ width: "auto", minWidth: 120 }} disabled={addBusy}>
                {addBusy ? "Enregistrement…" : "Enregistrer"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
