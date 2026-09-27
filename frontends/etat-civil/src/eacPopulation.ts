/** Population de référence pour taux démographiques EAC. */

import { ageYears, listPersons, type Sexe } from "./registry";

const KEY = "nn_eac_population_ref_v1";

export type PopAgeSex = {
  age_min: number;
  age_max: number;
  m: number;
  f: number;
};

export type PopulationRef = {
  year: number;
  province?: string;
  source: "REGISTRE" | "MANUEL" | "IMPORT";
  updated_at: string;
  /** Tranches quinquennales 0-4 … 80+. */
  bands: PopAgeSex[];
  total_m: number;
  total_f: number;
  total: number;
};

export const AGE_BANDS: Array<{ age_min: number; age_max: number; label: string }> = [
  { age_min: 0, age_max: 4, label: "0–4" },
  { age_min: 5, age_max: 9, label: "5–9" },
  { age_min: 10, age_max: 14, label: "10–14" },
  { age_min: 15, age_max: 19, label: "15–19" },
  { age_min: 20, age_max: 24, label: "20–24" },
  { age_min: 25, age_max: 29, label: "25–29" },
  { age_min: 30, age_max: 34, label: "30–34" },
  { age_min: 35, age_max: 39, label: "35–39" },
  { age_min: 40, age_max: 44, label: "40–44" },
  { age_min: 45, age_max: 49, label: "45–49" },
  { age_min: 50, age_max: 54, label: "50–54" },
  { age_min: 55, age_max: 59, label: "55–59" },
  { age_min: 60, age_max: 64, label: "60–64" },
  { age_min: 65, age_max: 69, label: "65–69" },
  { age_min: 70, age_max: 74, label: "70–74" },
  { age_min: 75, age_max: 79, label: "75–79" },
  { age_min: 80, age_max: 120, label: "80+" },
];

function emptyBands(): PopAgeSex[] {
  return AGE_BANDS.map((b) => ({ age_min: b.age_min, age_max: b.age_max, m: 0, f: 0 }));
}

function bandIndex(age: number): number {
  const i = AGE_BANDS.findIndex((b) => age >= b.age_min && age <= b.age_max);
  return i >= 0 ? i : AGE_BANDS.length - 1;
}

/** Construit une population à partir du registre local (approximation). */
export function buildPopulationFromRegistry(year: number, province?: string): PopulationRef {
  const bands = emptyBands();
  const prov = (province ?? "").trim().toLowerCase();
  for (const p of listPersons()) {
    if (prov && (p.province || "").trim().toLowerCase() !== prov) continue;
    const age = ageYears(p.date_naissance);
    if (age < 0) continue;
    const idx = bandIndex(age);
    if (p.sexe === "F") bands[idx].f += 1;
    else bands[idx].m += 1;
  }
  const total_m = bands.reduce((s, b) => s + b.m, 0);
  const total_f = bands.reduce((s, b) => s + b.f, 0);
  return {
    year,
    province: province || undefined,
    source: "REGISTRE",
    updated_at: new Date().toISOString(),
    bands,
    total_m,
    total_f,
    total: total_m + total_f,
  };
}

export function loadPopulationRef(year: number, province?: string): PopulationRef | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const all = JSON.parse(raw) as PopulationRef[];
    if (!Array.isArray(all)) return null;
    const prov = (province ?? "").trim().toLowerCase();
    return (
      all.find(
        (r) =>
          r.year === year &&
          (r.province || "").trim().toLowerCase() === prov,
      ) ?? null
    );
  } catch {
    return null;
  }
}

export function savePopulationRef(ref: PopulationRef): void {
  try {
    const raw = localStorage.getItem(KEY);
    const all = raw ? (JSON.parse(raw) as PopulationRef[]) : [];
    const list = Array.isArray(all) ? all : [];
    const prov = (ref.province || "").trim().toLowerCase();
    const next = list.filter(
      (r) => !(r.year === ref.year && (r.province || "").trim().toLowerCase() === prov),
    );
    next.unshift({
      ...ref,
      total_m: ref.bands.reduce((s, b) => s + b.m, 0),
      total_f: ref.bands.reduce((s, b) => s + b.f, 0),
      total: 0,
      updated_at: new Date().toISOString(),
    });
    next[0].total = next[0].total_m + next[0].total_f;
    localStorage.setItem(KEY, JSON.stringify(next.slice(0, 40)));
  } catch {
    /* ignore */
  }
}

/** Population effective : manuel/import, sinon registre. */
export function resolvePopulation(year: number, province?: string): PopulationRef {
  return loadPopulationRef(year, province) ?? buildPopulationFromRegistry(year, province);
}

export function womenAged(ref: PopulationRef, min: number, max: number): number {
  return ref.bands
    .filter((b) => b.age_max >= min && b.age_min <= max)
    .reduce((s, b) => {
      const lo = Math.max(b.age_min, min);
      const hi = Math.min(b.age_max, max);
      if (lo > hi) return s;
      const share = (hi - lo + 1) / (b.age_max - b.age_min + 1);
      return s + b.f * share;
    }, 0);
}

export function popAged(ref: PopulationRef, min: number, max: number, sexe?: Sexe): number {
  return ref.bands
    .filter((b) => b.age_max >= min && b.age_min <= max)
    .reduce((s, b) => {
      const lo = Math.max(b.age_min, min);
      const hi = Math.min(b.age_max, max);
      if (lo > hi) return s;
      const share = (hi - lo + 1) / (b.age_max - b.age_min + 1);
      const n = sexe === "F" ? b.f : sexe === "M" ? b.m : b.m + b.f;
      return s + n * share;
    }, 0);
}
