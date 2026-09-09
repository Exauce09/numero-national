/** Cascading RDC address selector — API /api/v1/geo/* with inline add + anti-doublon. */

import { FormEvent, useEffect, useState } from "react";
import { fallbackForGeoPath } from "../geoFallback";

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

export type GeoLevel =
  | "province"
  | "ville"
  | "district"
  | "commune"
  | "localite"
  | "quartier"
  | "avenue"
  | "rue";

/** Profils courants pour réutiliser la base géo partout. */
export const GEO_PRESETS = {
  full: ["province", "ville", "district", "commune", "localite", "quartier", "avenue", "rue"] as GeoLevel[],
  /** Adresse urbaine / résidence : Province → Ville → Commune → Quartier → Avenue. */
  address: ["province", "ville", "commune", "quartier", "avenue"] as GeoLevel[],
  /** Origine / territoire rural. */
  origin: ["province", "ville", "district", "commune", "localite"] as GeoLevel[],
  /** Lieu simple (naissance, décès, enregistrement…). */
  place: ["province", "ville", "commune"] as GeoLevel[],
} as const;

const DEFAULT_FIELD_LABELS: Record<GeoLevel, string> = {
  province: "Province",
  ville: "Ville",
  district: "District",
  commune: "Commune",
  localite: "Village",
  quartier: "Quartier",
  avenue: "Avenue",
  rue: "Rue",
};

/** Labels pour l’adresse de résidence (explicites). */
export const ADDRESS_FIELD_LABELS: Partial<Record<GeoLevel, string>> = {
  commune: "Commune",
  quartier: "Quartier (de la commune)",
  avenue: "Avenue / rue (du quartier)",
};

export const ORIGIN_FIELD_LABELS: Partial<Record<GeoLevel, string>> = {
  district: "Territoire",
  commune: "Secteur / Chefferie / Commune",
  localite: "Village",
};

type Item = { id: string; code: string; name: string; voie_type?: string; chef_lieu?: string };

type AddKind = "district" | "commune" | "localite" | "quartier" | "avenue" | "rue";

const BASE = import.meta.env.VITE_API_BASE ?? "/api/v1";

async function fetchItems(
  path: string,
  onFallback?: () => void,
): Promise<Item[]> {
  try {
    const res = await fetch(`${BASE}${path}`);
    if (res.ok) {
      const rows = (await res.json()) as Item[];
      if (Array.isArray(rows) && rows.length > 0) return rows;
    }
  } catch {
    /* API down or unreachable */
  }
  const local = fallbackForGeoPath(path) as Item[];
  if (local.length > 0) onFallback?.();
  return local;
}

async function postJson(
  path: string,
  body: Record<string, unknown>,
): Promise<{ ok: true; data: Item } | { ok: false; error: string }> {
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
  /** Niveaux affichés (défaut : cascade complète). */
  levels?: GeoLevel[];
  /** Intégré dans un fieldset (sans encadré panel). */
  embedded?: boolean;
  /** Afficher les boutons + Ajouter (défaut true). */
  allowAdd?: boolean;
  fieldLabels?: Partial<Record<GeoLevel, string>>;
};

export default function GeoCascade({
  value,
  onChange,
  label = "Adresse territoriale RDC",
  levels = GEO_PRESETS.full,
  embedded = false,
  allowAdd = true,
  fieldLabels,
}: Props) {
  const show = (level: GeoLevel) => levels.includes(level);
  const lbl = (level: GeoLevel) => fieldLabels?.[level] ?? DEFAULT_FIELD_LABELS[level];

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
      let usedFallback = false;
      const rows = await fetchItems("/geo/provinces", () => {
        usedFallback = true;
      });
      if (rows.length === 0) {
        setHint("API géographie indisponible — démarrez l'API puis actualisez.");
      } else if (usedFallback) {
        setHint("Mode local — référentiel géographie embarqué (API vide ou indisponible).");
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
    const markLocal = () =>
      setHint("Mode local — référentiel géographie embarqué (API vide ou indisponible).");
    setDistricts(show("district") ? await fetchItems(`/geo/districts?province_id=${id}`, markLocal) : []);
    setVilles(show("ville") ? await fetchItems(`/geo/villes?province_id=${id}`, markLocal) : []);
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
    const markLocal = () =>
      setHint("Mode local — référentiel géographie embarqué (API vide ou indisponible).");
    setCommunes(show("commune") ? await fetchItems(`/geo/communes?ville_id=${id}`, markLocal) : []);
    setQuartiers([]);
    setAvenues([]);
    setRues([]);
    setLocalites([]);
  }

  async function onDistrict(id: string) {
    const d = districts.find((x) => x.id === id);
    emit({
      ...sel,
      district_id: id,
      district_name: d?.name,
      commune_id: undefined,
      commune_name: undefined,
      commune_code: undefined,
      localite_id: undefined,
      localite_name: undefined,
    });
    const markLocal = () =>
      setHint("Mode local — référentiel géographie embarqué (API vide ou indisponible).");
    const byDist = show("commune") ? await fetchItems(`/geo/communes?district_id=${id}`, markLocal) : [];
    if (byDist.length) setCommunes(byDist);
    setLocalites(show("localite") ? await fetchItems(`/geo/localites?district_id=${id}`, markLocal) : []);
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
      localite_id: undefined,
      localite_name: undefined,
    });
    const markLocal = () =>
      setHint("Mode local — référentiel géographie embarqué (API vide ou indisponible).");
    const qs = show("quartier") ? await fetchItems(`/geo/quartiers?commune_id=${id}`, markLocal) : [];
    setQuartiers(qs);
    setLocalites(show("localite") ? await fetchItems(`/geo/localites?commune_id=${id}`, markLocal) : []);
    setAvenues([]);
    setRues([]);
    if (show("quartier")) {
      setHint(
        qs.length
          ? `${qs.length} quartier(s) liés à cette commune`
          : "Aucun quartier — utilisez + pour en ajouter",
      );
    }
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
    if (!show("avenue") && !show("rue")) return;
    const markLocal = () =>
      setHint("Mode local — référentiel géographie embarqué (API vide ou indisponible).");
    const voies = await fetchItems(`/geo/voies?quartier_id=${id}`, markLocal);
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
        return Boolean(sel.ville_id || sel.district_id);
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
        ville_id: sel.ville_id || null,
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
    district: `Ajouter — ${lbl("district")}`,
    commune: `Ajouter — ${lbl("commune")}`,
    localite: `Ajouter — ${lbl("localite")}`,
    quartier: `Ajouter — ${lbl("quartier")}`,
    avenue: `Ajouter — ${lbl("avenue")}`,
    rue: `Ajouter — ${lbl("rue")}`,
  };

  function Field({
    labelText,
    value: fieldValue,
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
          {allowAdd && addKindBtn ? (
            <button
              type="button"
              className="btn-add btn-sm"
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
          value={fieldValue}
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

  const body = (
    <>
      {hint ? <p className="muted">{hint}</p> : null}
      {!embedded ? (
        <p className="muted small">
          Données chargées depuis la base géographie. Si une entrée manque, utilisez <strong>+ Ajouter</strong>.
        </p>
      ) : null}
      <div className="form-grid">
        {show("province") ? (
          <Field
            labelText={lbl("province")}
            value={sel.province_id ?? ""}
            options={provinces}
            onPick={(id) => void onProvince(id)}
          />
        ) : null}
        {show("ville") ? (
          <Field
            labelText={lbl("ville")}
            value={sel.ville_id ?? ""}
            disabled={!sel.province_id}
            options={villes}
            onPick={(id) => void onVille(id)}
          />
        ) : null}
        {show("district") ? (
          <Field
            labelText={lbl("district")}
            value={sel.district_id ?? ""}
            disabled={!sel.province_id}
            options={districts}
            onPick={(id) => void onDistrict(id)}
            addKindBtn="district"
          />
        ) : null}
        {show("commune") ? (
          <Field
            labelText={lbl("commune")}
            value={sel.commune_id ?? ""}
            disabled={!sel.ville_id && !sel.district_id}
            options={communes}
            onPick={(id) => void onCommune(id)}
            addKindBtn="commune"
          />
        ) : null}
        {show("localite") ? (
          <Field
            labelText={lbl("localite")}
            value={sel.localite_id ?? ""}
            disabled={!sel.commune_id && !sel.district_id}
            options={localites}
            onPick={(id) => void onLocalite(id)}
            addKindBtn="localite"
          />
        ) : null}
        {show("quartier") ? (
          <Field
            labelText={lbl("quartier")}
            value={sel.quartier_id ?? ""}
            disabled={!sel.commune_id}
            options={quartiers}
            onPick={(id) => void onQuartier(id)}
            addKindBtn="quartier"
          />
        ) : null}
        {show("avenue") ? (
          <Field
            labelText={lbl("avenue")}
            value={sel.avenue_id ?? ""}
            disabled={!sel.quartier_id}
            options={avenues}
            onPick={(id) => {
              const a = avenues.find((x) => x.id === id);
              emit({ ...sel, avenue_id: id, avenue_name: a?.name });
            }}
            addKindBtn="avenue"
          />
        ) : null}
        {show("rue") ? (
          <Field
            labelText={lbl("rue")}
            value={sel.rue_id ?? ""}
            disabled={!sel.quartier_id}
            options={rues}
            onPick={(id) => {
              const r = rues.find((x) => x.id === id);
              emit({ ...sel, rue_id: id, rue_name: r?.name });
            }}
            addKindBtn="rue"
          />
        ) : null}
      </div>
      {sel.label ? (
        <p className="muted" style={{ marginBottom: 0, marginTop: "0.65rem" }}>
          Sélection : <strong>{sel.label}</strong>
          {sel.commune_code ? (
            <>
              {" "}
              · code <code>{sel.commune_code}</code>
            </>
          ) : null}
        </p>
      ) : null}

      {addKind ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <form className="modal-panel" onSubmit={(e) => void submitAdd(e)}>
            <h3>{addTitles[addKind]}</h3>
            <p className="muted small">
              Enregistrement en base. Un doublon (même nom, autre orthographe) est refusé.
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
    </>
  );

  if (embedded) {
    return <div className="geo-embedded">{body}</div>;
  }

  return (
    <div className="panel" style={{ marginTop: 0 }}>
      <h3 className="panel-title" style={{ marginTop: 0 }}>
        {label}
      </h3>
      {body}
    </div>
  );
}
