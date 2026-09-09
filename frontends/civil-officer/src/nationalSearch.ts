import { getSession } from "./auth";
import {
  addPerson,
  getPerson,
  searchPersons,
  type Person,
  type Sexe,
} from "./registry";

const API_BASE = import.meta.env.VITE_API_BASE ?? "/api/v1";

export type NationalCitizenHit = {
  id: string;
  nic: string | null;
  status: string;
  family_name: string;
  given_names: string;
  date_of_birth: string;
  sex?: string;
  place_of_birth?: string | null;
  province_code?: string | null;
  ville?: string | null;
  commune_code?: string | null;
};

function authHeaders(): HeadersInit {
  const session = getSession();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (session?.accessToken) headers.Authorization = `Bearer ${session.accessToken}`;
  return headers;
}

function splitGivenNames(given: string): { prenom: string; postnom: string } {
  const parts = given.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { prenom: given.trim(), postnom: "" };
  return { prenom: parts[0], postnom: parts.slice(1).join(" ") };
}

function mapSex(sex?: string): Sexe {
  const s = (sex || "").toUpperCase();
  if (s === "F" || s === "FEMALE" || s === "FEMININ") return "F";
  return "M";
}

/** Convertit un hit national en Person locale (pour autofill + liaison). */
export function nationalHitToPerson(hit: NationalCitizenHit): Person {
  const existing = getPerson(hit.id);
  if (existing) return existing;
  const { prenom, postnom } = splitGivenNames(hit.given_names || "");
  return addPerson({
    id: hit.id,
    nom: hit.family_name || "",
    postnom,
    prenom,
    sexe: mapSex(hit.sex),
    date_naissance: hit.date_of_birth?.slice(0, 10) || "",
    lieu_naissance: hit.place_of_birth || hit.ville || "",
    etat_civil: "UNKNOWN",
    nic: hit.nic || `REG-${hit.id.replace(/-/g, "").slice(0, 12)}`,
  });
}

/**
 * Recherche nationale (registre serveur) + fusion locale.
 * Utilisée par PersonPicker et tous les formulaires.
 */
export async function searchEveryone(query: string): Promise<Person[]> {
  const q = query.trim();
  const local = searchPersons(q).slice(0, 12);
  if (q.length < 1) return local;

  const session = getSession();
  if (!session?.accessToken) return local;

  try {
    const params = new URLSearchParams({ q, page: "1", page_size: "12" });
    const res = await fetch(`${API_BASE}/registry/citizens?${params}`, {
      headers: authHeaders(),
    });
    if (!res.ok) return local;
    const data = (await res.json()) as { items?: NationalCitizenHit[] };
    const national = (data.items ?? []).map(nationalHitToPerson);
    const seen = new Set(national.map((p) => p.id));
    for (const p of local) {
      if (!seen.has(p.id)) {
        national.push(p);
        seen.add(p.id);
      }
    }
    return national.slice(0, 12);
  } catch {
    return local;
  }
}
