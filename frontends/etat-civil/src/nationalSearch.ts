/** Recherche nationale (registre API) + fusion avec le registre local. */

import { api, type FormDraft } from "./api";
import { getSession } from "./auth";
import {
  getCivilStatusOverride,
  getPerson,
  searchPersons,
  updatePerson,
  type Person,
  type Sexe,
} from "./registry";

const API_BASE = import.meta.env.VITE_API_BASE ?? "/api/v1";

/** Limite haute pour la page Recherche ; le sélecteur peut demander moins. */
export const SEARCH_PAGE_SIZE = 100;

function authHeaders(): HeadersInit {
  const session = getSession();
  const headers: Record<string, string> = { Accept: "application/json" };
  if (session?.accessToken) headers.Authorization = `Bearer ${session.accessToken}`;
  return headers;
}

export type NationalCitizenHit = {
  id: string;
  nic?: string | null;
  status?: string;
  family_name?: string;
  given_names?: string;
  date_of_birth?: string;
  sex?: string;
  place_of_birth?: string | null;
  province_code?: string | null;
  ville?: string | null;
  commune_code?: string | null;
};

export type DraftSearchHit = FormDraft & { kind: "draft" };

/** Nom de famille « Nom Postnom » → { nom, postnom }. */
export function splitFamilyName(family: string): { nom: string; postnom: string } {
  const parts = family.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { nom: family.trim(), postnom: "" };
  return { nom: parts[0], postnom: parts.slice(1).join(" ") };
}

/** Prénoms « Prénom Autre » → { prenom, postnom }. */
export function splitGivenNames(given: string): { prenom: string; postnom: string } {
  const parts = given.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { prenom: given.trim(), postnom: "" };
  return { prenom: parts[0], postnom: parts.slice(1).join(" ") };
}

function mapSex(sex?: string): Sexe {
  const s = (sex || "").toUpperCase();
  if (s === "F" || s === "FEMALE" || s === "FEMININ") return "F";
  return "M";
}

/** Affichage NIC : jamais inventer un faux préfixe REG-. */
export function displayNic(nic?: string | null, status?: string | null): string {
  const n = (nic || "").trim();
  if (n && !n.toUpperCase().startsWith("REG-")) return n;
  const st = (status || "").toUpperCase();
  if (st === "DRAFT" || st === "PENDING_VALIDATION") return "Sans NIC (brouillon)";
  return "Sans NIC";
}

/** Hit API → Person sans écrire dans le registre local (évite plantages / doublons). */
export function hitToPersonView(hit: NationalCitizenHit): Person {
  const existing = getPerson(hit.id);
  const { nom, postnom: postFromFam } = splitFamilyName(hit.family_name || "");
  const { prenom, postnom: postFromGiven } = splitGivenNames(hit.given_names || "");
  const postnom = postFromFam || postFromGiven;
  const realNic = (hit.nic || "").trim();
  const nic = realNic && !realNic.toUpperCase().startsWith("REG-") ? realNic : "";
  const override = getCivilStatusOverride(hit.id);
  const etat =
    override ||
    (existing?.etat_civil && existing.etat_civil !== "UNKNOWN" ? existing.etat_civil : "UNKNOWN");

  if (existing) {
    return {
      ...existing,
      nom: existing.nom || nom,
      postnom: existing.postnom || postnom,
      prenom: existing.prenom || prenom,
      nic: nic || existing.nic,
      etat_civil: etat,
      date_naissance: existing.date_naissance || hit.date_of_birth?.slice(0, 10) || "",
      lieu_naissance: existing.lieu_naissance || hit.place_of_birth || hit.ville || "",
    };
  }

  return {
    id: hit.id,
    nom,
    postnom,
    prenom,
    sexe: mapSex(hit.sex),
    date_naissance: hit.date_of_birth?.slice(0, 10) || "",
    lieu_naissance: hit.place_of_birth || hit.ville || "",
    etat_civil: etat,
    nic: nic || "",
    handicap_type: "NORMAL",
    created_at: new Date().toISOString(),
  };
}

/**
 * Convertit un hit national en Person locale (liaison / autofill).
 * Pour la recherche seule, préférer hitToPersonView (sans side-effect).
 */
export function nationalHitToPerson(hit: NationalCitizenHit): Person {
  const view = hitToPersonView(hit);
  const existing = getPerson(hit.id);
  if (existing) {
    const patch: Partial<Person> = {};
    if (view.nic && (existing.nic?.startsWith("REG-") || !existing.nic)) patch.nic = view.nic;
    if (!existing.nom && view.nom) patch.nom = view.nom;
    if (!existing.postnom && view.postnom) patch.postnom = view.postnom;
    if (!existing.prenom && view.prenom) patch.prenom = view.prenom;
    if (Object.keys(patch).length) {
      return updatePerson(existing.id, patch) ?? { ...existing, ...patch };
    }
    return existing;
  }
  return view;
}

/**
 * Recherche nationale (registre serveur) + fusion locale.
 * @param limit max résultats (défaut 100 — anciennement plafonné à 12).
 */
export async function searchEveryone(query: string, limit = SEARCH_PAGE_SIZE): Promise<Person[]> {
  const q = query.trim();
  const cap = Math.min(Math.max(limit, 1), SEARCH_PAGE_SIZE);
  const local = searchPersons(q).slice(0, cap);
  if (q.length < 1) return local;

  const session = getSession();
  if (!session?.accessToken) return local;

  try {
    const all: NationalCitizenHit[] = [];
    let page = 1;
    let total = 0;
    const pageSize = Math.min(cap, 100);
    for (;;) {
      const params = new URLSearchParams({
        q,
        page: String(page),
        page_size: String(pageSize),
      });
      const res = await fetch(`${API_BASE}/registry/citizens?${params}`, {
        headers: authHeaders(),
      });
      if (!res.ok) break;
      const data = (await res.json()) as { items?: NationalCitizenHit[]; total?: number };
      total = data.total ?? 0;
      all.push(...(data.items ?? []));
      if (all.length >= cap || all.length >= total || !(data.items?.length)) break;
      page += 1;
      if (page > 5) break;
    }

    const national = all.slice(0, cap).map(hitToPersonView);
    const seen = new Set(national.map((p) => p.id));
    for (const p of local) {
      if (!seen.has(p.id)) {
        national.push(p);
        seen.add(p.id);
      }
    }
    return national.slice(0, cap);
  } catch {
    return local;
  }
}

/** Recherche les brouillons partagés (APK + commune) par nom / titre / local_id. */
export async function searchFormDrafts(query: string): Promise<DraftSearchHit[]> {
  const q = query.trim();
  if (!q || !getSession()?.accessToken) return [];
  try {
    const params = new URLSearchParams({
      status: "DRAFT",
      q,
      limit: "50",
    });
    const rows = await api.listFormDrafts(params);
    return rows.map((r) => ({ ...r, kind: "draft" as const }));
  } catch {
    return [];
  }
}
