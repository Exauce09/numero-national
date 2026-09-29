/** Cascading RDC address selector — API /api/v1/geo/* with inline add + anti-doublon. */

import { FormEvent, useEffect, useState } from "react";
import { fallbackForGeoPath } from "../geoFallback";

export type GeoSelection = {
  province_id?: string;
  /** Code officiel province (ex. COD-P01). */
  province_code?: string;
  province_name?: string;
  district_id?: string;
  /** Code officiel territoire (ex. COD-P02-T01). */
  district_code?: string;
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
  /** Numéro / parcelle (saisie libre). */
  numero?: string;
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
  /** Complet : Province → Ville/Territoire → … */
  full: ["province", "ville", "district", "commune", "localite", "quartier", "avenue", "rue"] as GeoLevel[],
  /** Adresse urbaine / résidence : Province → Ville/Territoire → Commune/Secteur → … */
  address: ["province", "ville", "district", "commune", "quartier", "avenue"] as GeoLevel[],
  /** Origine : Province → Ville/Territoire → Commune/Secteur → Village. */
  origin: ["province", "ville", "district", "commune", "localite"] as GeoLevel[],
  /**
   * Originaire EC RDC :
   * Province → Territoire → Secteur/Chefferie → Village.
   */
  originRural: ["province", "district", "commune", "localite"] as GeoLevel[],
  /** Lieu simple (naissance, décès, enregistrement…). */
  place: ["province", "ville", "district", "commune"] as GeoLevel[],
} as const;

const DEFAULT_FIELD_LABELS: Record<GeoLevel, string> = {
  province: "Province",
  ville: "Ville",
  district: "Territoire",
  commune: "Commune / Secteur",
  localite: "Village / Localité",
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

function geoOptionLabel(o: Item): string {
  if (o.code && /^COD-P\d/i.test(o.code)) return `${o.name} (${o.code})`;
  return o.name;
}

/** Anciens ids locaux (prov-COD-P01, dist-…) → identifiants officiels. */
function normalizeProvinceId(id: string | undefined): string | undefined {
  if (!id) return id;
  return id.startsWith("prov-") ? id.slice(5) : id;
}

type ZoneKind = "ville" | "territoire";

type AddKind = "district" | "commune" | "localite" | "quartier" | "avenue" | "rue";

const BASE = import.meta.env.VITE_API_BASE ?? "/api/v1";

async function fetchItems(
  path: string,
  onFallback?: () => void,
): Promise<Item[]> {
  const local = fallbackForGeoPath(path) as Item[];
  const preferLocal =
    path.startsWith("/geo/provinces") ||
    path.startsWith("/geo/villes") ||
    path.startsWith("/geo/districts") ||
    path.startsWith("/geo/communes");
  try {
    const res = await fetch(`${BASE}${path}`);
    if (res.ok) {
      const rows = (await res.json()) as Item[];
      if (Array.isArray(rows) && rows.length > 0) {
        // Référentiel local SIGPOP (COD-Pxx) prioritaire pour Province / Ville / Territoire.
        if (preferLocal && local.length > 0 && local.length >= rows.length) {
          onFallback?.();
          return local;
        }
        if (local.length > rows.length) {
          onFallback?.();
          return local;
        }
        return rows;
      }
    }
  } catch {
    /* API down or unreachable */
  }
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

const normGeo = (s?: string) =>
  (s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "");

/** Retrouve les identifiants province → ville → commune à partir des noms (ex. structure sanitaire). */
export async function resolveGeoByNames(input: {
  province?: string;
  ville?: string;
  commune_code?: string;
  commune_name?: string;
}): Promise<GeoSelection | null> {
  const provinces = await fetchItems("/geo/provinces");
  const p = provinces.find((x) => normGeo(x.name) === normGeo(input.province));
  if (!p) return null;
  const sel: GeoSelection = {
    province_id: p.id,
    province_code: p.code,
    province_name: p.name,
  };
  const villes = await fetchItems(`/geo/villes?province_id=${p.id}`);
  const v = villes.find((x) => normGeo(x.name) === normGeo(input.ville));
  if (v) {
    sel.ville_id = v.id;
    sel.ville_name = v.name;
    let communes = await fetchItems(`/geo/communes?ville_id=${v.id}`);
    if (communes.length === 0) communes = await fetchItems(`/geo/communes?province_id=${p.id}`);
    const byName = normGeo(input.commune_name);
    const code = normGeo(input.commune_code);
    const codeTail = normGeo((input.commune_code ?? "").split(/[-_/]/).slice(1).join(""));
    const c = communes.find(
      (x) =>
        (byName && normGeo(x.name) === byName) ||
        (code && normGeo(x.code) === code) ||
        (codeTail && normGeo(x.name) === codeTail),
    );
    if (c) {
      sel.commune_id = c.id;
      sel.commune_name = c.name;
      sel.commune_code = c.code;
    }
  }
  sel.label = [sel.province_name, sel.ville_name, sel.commune_name].filter(Boolean).join(" · ");
  return sel;
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
  /**
   * Après la province : une seule liste Ville / Territoire (défaut partout où la province est demandée).
   * La profondeur de chaque branche suit `levels` (commune, quartier, avenue… / secteur, village).
   */
  zoneChoice?: boolean;
};

/** Branche ville : Commune → Quartier → Avenue → Rue (commune toujours présente). */
function villeBranch(levels: readonly GeoLevel[]): GeoLevel[] {
  const out: GeoLevel[] = ["province", "ville", "commune"];
  for (const l of ["quartier", "avenue", "rue"] as const) {
    if (levels.includes(l)) out.push(l);
  }
  return out;
}

/** Branche territoire : Secteur/Chefferie → Village (secteur toujours présent). */
function territoireBranch(levels: readonly GeoLevel[]): GeoLevel[] {
  const out: GeoLevel[] = ["province", "district", "commune"];
  if (levels.includes("localite") || levels.includes("quartier")) out.push("localite");
  return out;
}

export default function GeoCascade({
  value,
  onChange,
  label = "Adresse territoriale RDC",
  levels = GEO_PRESETS.full,
  embedded = false,
  allowAdd = true,
  fieldLabels,
  zoneChoice: zoneChoiceProp = true,
}: Props) {
  const zoneChoice =
    zoneChoiceProp &&
    levels.includes("province") &&
    (levels.includes("ville") || levels.includes("district"));
  const [zoneKind, setZoneKind] = useState<ZoneKind | null>(() => {
    if (!zoneChoice) return null;
    if (value?.district_id || value?.district_name) return "territoire";
    if (value?.ville_id || value?.ville_name) return "ville";
    return null;
  });

  const levelsFor = (kind: ZoneKind | null): GeoLevel[] =>
    zoneChoice
      ? kind === "territoire"
        ? territoireBranch(levels)
        : kind === "ville"
          ? villeBranch(levels)
          : ["province"]
      : levels;

  const show = (level: GeoLevel, kind: ZoneKind | null = zoneKind) => levelsFor(kind).includes(level);
  const lbl = (level: GeoLevel) => {
    if (zoneChoice) {
      if (level === "commune") {
        return zoneKind === "territoire"
          ? "Secteur / Chefferie"
          : zoneKind === "ville"
            ? "Commune"
            : "Commune / Secteur";
      }
      if (level === "localite") return "Village";
      if (level === "district") return "Territoire";
    }
    return fieldLabels?.[level] ?? DEFAULT_FIELD_LABELS[level];
  };

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
  const [hydratedKey, setHydratedKey] = useState("");

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

  /** Restaure province → ville → commune quand value est déjà remplie (ex. édition). */
  useEffect(() => {
    const key = [
      value?.province_id,
      value?.ville_id,
      value?.commune_id,
      value?.district_id,
      value?.label,
    ].join("|");
    if (!key || key === "||||" || key === hydratedKey) return;
    if (!value?.province_id && !value?.label) return;

    let cancelled = false;
    void (async () => {
      const markLocal = () =>
        setHint("Mode local — référentiel géographie embarqué (API vide ou indisponible).");
      const provinceId = normalizeProvinceId(value.province_id);
      const next = {
        ...value,
        ...(provinceId && provinceId !== value.province_id ? { province_id: provinceId } : {}),
      };
      const kind: ZoneKind | null = zoneChoice
        ? value.district_id
          ? "territoire"
          : value.ville_id
            ? "ville"
            : zoneKind
        : null;
      if (zoneChoice) setZoneKind(kind);
      const pid = provinceId ?? value.province_id;
      if (pid) {
        if (show("ville") || zoneChoice) {
          const vrows = await fetchItems(`/geo/villes?province_id=${pid}`, markLocal);
          if (cancelled) return;
          setVilles(vrows);
        }
        if (show("district") || zoneChoice) {
          const drows = await fetchItems(`/geo/districts?province_id=${pid}`, markLocal);
          if (cancelled) return;
          setDistricts(drows);
        }
      }
      if (value.ville_id && show("commune", kind)) {
        let crows = await fetchItems(`/geo/communes?ville_id=${value.ville_id}`, markLocal);
        if (crows.length === 0 && pid) {
          crows = await fetchItems(`/geo/communes?province_id=${pid}`, markLocal);
        }
        if (cancelled) return;
        setCommunes(crows);
      } else if (value.district_id && show("commune", kind)) {
        const crows = await fetchItems(`/geo/communes?district_id=${value.district_id}`, markLocal);
        if (cancelled) return;
        setCommunes(crows);
      }
      if (value.commune_id && show("quartier", kind)) {
        const qrows = await fetchItems(`/geo/quartiers?commune_id=${value.commune_id}`, markLocal);
        if (cancelled) return;
        setQuartiers(qrows);
      }
      if (!cancelled) {
        setSel(next);
        setHydratedKey(key);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hydrate once per value identity
  }, [value?.province_id, value?.ville_id, value?.commune_id, value?.district_id, value?.label]);

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
      next.numero ? `n° ${next.numero}` : undefined,
    ].filter(Boolean);
    const full = { ...next, label: parts.join(" · ") };
    setSel(full);
    onChange(full);
  }

  async function onProvince(id: string) {
    const p = provinces.find((x) => x.id === id);
    if (zoneChoice) setZoneKind(null);
    emit({
      province_id: id,
      province_code: p?.code,
      province_name: p?.name,
    });
    const markLocal = () =>
      setHint("Mode local — référentiel géographie embarqué (API vide ou indisponible).");
    // Toujours charger TOUTES les villes + territoires de la province.
    const [drows, vrows] = await Promise.all([
      fetchItems(`/geo/districts?province_id=${id}`, markLocal),
      fetchItems(`/geo/villes?province_id=${id}`, markLocal),
    ]);
    setDistricts(drows);
    setVilles(vrows);
    setCommunes([]);
    setLocalites([]);
    setQuartiers([]);
    setAvenues([]);
    setRues([]);
    if (zoneChoice) {
      setHint(
        `${vrows.length} ville(s) · ${drows.length} territoire(s) pour ${p?.name ?? "cette province"}`,
      );
    }
  }

  /** Liste unique Ville / Territoire : `ville:<id>` ou `territoire:<id>`. */
  async function onZonePick(raw: string) {
    const sep = raw.indexOf(":");
    const kind = raw.slice(0, sep) as ZoneKind;
    const id = raw.slice(sep + 1);
    if (!id || (kind !== "ville" && kind !== "territoire")) {
      setZoneKind(null);
      emit({
        province_id: sel.province_id,
        province_code: sel.province_code,
        province_name: sel.province_name,
      });
      setCommunes([]);
      setLocalites([]);
      setQuartiers([]);
      setAvenues([]);
      setRues([]);
      return;
    }
    setZoneKind(kind);
    if (kind === "ville") await onVille(id, kind);
    else await onDistrict(id, kind);
  }

  async function onVille(id: string, _kind: ZoneKind | null = "ville") {
    const v = villes.find((x) => x.id === id);
    const base = { ...sel };
    emit({
      ...base,
      province_id: base.province_id,
      province_name: base.province_name,
      ville_id: id,
      ville_name: v?.name,
      ...(zoneChoice ? { district_id: undefined, district_name: undefined } : {}),
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
    // Toutes les communes de la ville (branche urbaine).
    let rows = await fetchItems(`/geo/communes?ville_id=${id}`, markLocal);
    if (rows.length === 0 && base.province_id) {
      rows = await fetchItems(`/geo/communes?province_id=${base.province_id}`, markLocal);
    }
    setCommunes(rows);
    setQuartiers([]);
    setAvenues([]);
    setRues([]);
    setLocalites([]);
    setHint(
      rows.length
        ? `${rows.length} commune(s) pour ${v?.name ?? "cette ville"}`
        : "Aucune commune — utilisez + Ajouter",
    );
  }

  async function onDistrict(id: string, kind: ZoneKind | null = "territoire", item?: Item) {
    const d = item ?? districts.find((x) => x.id === id);
    const base = { ...sel };
    emit({
      ...base,
      district_id: id,
      district_code: d?.code,
      district_name: d?.name,
      ...(zoneChoice
        ? {
            ville_id: undefined,
            ville_name: undefined,
            quartier_id: undefined,
            quartier_name: undefined,
            avenue_id: undefined,
            avenue_name: undefined,
            rue_id: undefined,
            rue_name: undefined,
          }
        : {}),
      commune_id: undefined,
      commune_name: undefined,
      commune_code: undefined,
      localite_id: undefined,
      localite_name: undefined,
    });
    const markLocal = () =>
      setHint("Mode local — référentiel géographie embarqué (API vide ou indisponible).");
    // Tous les secteurs / chefferies du territoire.
    let byDist = await fetchItems(`/geo/communes?district_id=${id}`, markLocal);
    if (!zoneChoice && byDist.length === 0 && base.ville_id) {
      byDist = await fetchItems(`/geo/communes?ville_id=${base.ville_id}`, markLocal);
    }
    if (byDist.length === 0 && base.province_id) {
      byDist = await fetchItems(`/geo/communes?province_id=${base.province_id}`, markLocal);
    }
    setCommunes(byDist);
    setQuartiers([]);
    setAvenues([]);
    setRues([]);
    setLocalites(
      show("localite", kind) ? await fetchItems(`/geo/localites?district_id=${id}`, markLocal) : [],
    );
    setHint(
      byDist.length
        ? `${byDist.length} secteur(s) / chefferie(s) pour ${d?.name ?? "ce territoire"}`
        : "Aucun secteur — utilisez + Ajouter",
    );
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
      const kind: ZoneKind | null = zoneChoice ? "territoire" : zoneKind;
      if (zoneChoice) setZoneKind(kind);
      await onDistrict(created.id, kind, created);
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
              {geoOptionLabel(o)}
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
        {zoneChoice ? (
          <div>
            <div className="geo-field-head">
              <label className="form-label">Ville / Territoire</label>
              {allowAdd ? (
                <button
                  type="button"
                  className="btn-add btn-sm"
                  disabled={!canAdd("district")}
                  onClick={() => openAdd("district")}
                  title={
                    !canAdd("district") ? "Sélectionnez d'abord la province" : "Ajouter un territoire absent"
                  }
                >
                  + Ajouter
                </button>
              ) : null}
            </div>
            <select
              className="form-control"
              value={
                zoneKind === "ville" && sel.ville_id
                  ? `ville:${sel.ville_id}`
                  : zoneKind === "territoire" && sel.district_id
                    ? `territoire:${sel.district_id}`
                    : ""
              }
              disabled={!sel.province_id}
              onChange={(e) => void onZonePick(e.target.value)}
            >
              <option value="">— Sélectionner —</option>
              {villes.length ? (
                <optgroup label={`Villes (${villes.length})`}>
                  {villes.map((o) => (
                    <option key={o.id} value={`ville:${o.id}`}>
                      {geoOptionLabel(o)}
                    </option>
                  ))}
                </optgroup>
              ) : null}
              {districts.length ? (
                <optgroup label={`Territoires (${districts.length})`}>
                  {districts.map((o) => (
                    <option key={o.id} value={`territoire:${o.id}`}>
                      {geoOptionLabel(o)}
                    </option>
                  ))}
                </optgroup>
              ) : null}
            </select>
            {sel.province_id ? (
              <p className="muted small" style={{ margin: "0.35rem 0 0" }}>
                {zoneKind === "ville"
                  ? "Branche ville : Commune → Quartier → Avenue (pas de district)."
                  : zoneKind === "territoire"
                    ? "Branche territoire : Secteur / Chefferie → Village (pas de district)."
                    : `${villes.length} ville(s) · ${districts.length} territoire(s) — choisissez une entrée.`}
              </p>
            ) : null}
          </div>
        ) : null}
        {show("ville") && !zoneChoice ? (
          <Field
            labelText={lbl("ville")}
            value={sel.ville_id ?? ""}
            disabled={!sel.province_id}
            options={villes}
            onPick={(id) => void onVille(id)}
          />
        ) : null}
        {show("district") && !zoneChoice ? (
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
        {show("avenue") ? (
          <div>
            <label className="form-label">N° / parcelle</label>
            <input
              className="form-control"
              value={sel.numero ?? ""}
              disabled={!sel.quartier_id && !sel.avenue_id}
              onChange={(e) => emit({ ...sel, numero: e.target.value })}
              placeholder="Numéro, parcelle…"
            />
          </div>
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
          <div
            className="modal-panel"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !addBusy) {
                e.preventDefault();
                void submitAdd(e as unknown as FormEvent);
              }
            }}
          >
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
            />
            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={() => setAddKind(null)}>
                Annuler
              </button>
              <button
                type="button"
                className="btn-primary"
                style={{ width: "auto", minWidth: 120 }}
                disabled={addBusy}
                onClick={(e) => void submitAdd(e as unknown as FormEvent)}
              >
                {addBusy ? "Enregistrement…" : "Enregistrer"}
              </button>
            </div>
          </div>
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
