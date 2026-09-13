import { api } from "./api";
import { ensureAccessToken, getSession } from "./auth";
import type { Person } from "./registry";

export type OnipCardQueueItem = {
  id: string;
  person_id: string;
  nic: string;
  nom: string;
  postnom: string;
  prenom: string;
  sexe: string;
  date_naissance: string;
  lieu_naissance?: string;
  commune_code?: string | null;
  adresse?: string | null;
  province_name?: string | null;
  province_code?: string | null;
  ville_name?: string | null;
  citizen_id?: string | null;
  registry_nic?: string | null;
  census_act_id?: string | null;
  status: "PENDING_ONIP" | "CITIZEN_CREATED" | "CARD_QUEUED";
  created_at: string;
  source: "civil_census";
};

const QUEUE_KEY = "nn_onip_card_queue";

/** Centroids approx. des provinces (WGS84) pour cartographie adresse manuelle. */
const PROVINCE_COORDS: Record<string, [number, number]> = {
  "01": [-4.3276, 15.3136],
  kinshasa: [-4.3276, 15.3136],
  "03": [-5.041, 18.816],
  kwango: [-5.041, 18.816],
  "04": [-5.816, 13.45],
  "kongo-central": [-5.816, 13.45],
  "kongo central": [-5.816, 13.45],
  "06": [-5.9, 22.4],
  kasai: [-5.9, 22.4],
  "kasaï": [-5.9, 22.4],
  "08": [-5.896, 22.417],
  "kasai-central": [-5.896, 22.417],
  "09": [-6.1333, 24.4833],
  lomami: [-6.1333, 24.4833],
  "10": [-11.6647, 27.4794],
  "haut-katanga": [-11.6647, 27.4794],
  "11": [-10.7167, 25.4667],
  lualaba: [-10.7167, 25.4667],
  "12": [-8.7333, 24.9833],
  "haut-lomami": [-8.7333, 24.9833],
  "13": [-2.5, 28.8667],
  "sud-kivu": [-2.5, 28.8667],
  "14": [-2.95, 25.95],
  maniema: [-2.95, 25.95],
  "15": [-1.678, 29.222],
  "nord-kivu": [-1.678, 29.222],
  "16": [0.5, 25.2],
  tshopo: [0.5, 25.2],
  "17": [2.15, 21.5],
  mongala: [2.15, 21.5],
  "18": [3.25, 19.75],
  "bas-uele": [3.25, 19.75],
  "19": [2.8, 27.6],
  "haut-uele": [2.8, 27.6],
  "20": [4.35, 18.6],
  "nord-ubangi": [4.35, 18.6],
  "21": [3.25, 19.75],
  "sud-ubangi": [3.25, 19.75],
  "22": [0.05, 18.2667],
  equateur: [0.05, 18.2667],
  "équateur": [0.05, 18.2667],
  "23": [-4.3, 15.3],
  "02": [-5.041, 18.816],
  kwilu: [-5.041, 18.816],
  "05": [-2.15, 16.2333],
  "mai-ndombe": [-2.15, 16.2333],
};

function coordsForProvince(codeOrName?: string | null): [number, number] {
  const key = (codeOrName || "").trim().toLowerCase();
  if (!key) return [-4.3276, 15.3136];
  if (PROVINCE_COORDS[key]) return PROVINCE_COORDS[key];
  for (const [k, v] of Object.entries(PROVINCE_COORDS)) {
    if (key.includes(k) || k.includes(key)) return v;
  }
  return [-4.3276, 15.3136];
}

function jitter(lat: number, lng: number, salt: string): [number, number] {
  let h = 0;
  for (let i = 0; i < salt.length; i++) h = (h * 31 + salt.charCodeAt(i)) >>> 0;
  const dLat = ((h % 200) - 100) * 0.00012;
  const dLng = (((h >> 8) % 200) - 100) * 0.00012;
  return [lat + dLat, lng + dLng];
}

function loadQueue(): OnipCardQueueItem[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as OnipCardQueueItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveQueue(rows: OnipCardQueueItem[]) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(rows.slice(0, 500)));
}

export function listOnipCardQueue(): OnipCardQueueItem[] {
  return loadQueue();
}

function sexForRegistry(sexe: string): "MALE" | "FEMALE" | "UNKNOWN" {
  const s = sexe.toUpperCase();
  if (s === "M" || s === "MALE" || s.startsWith("H")) return "MALE";
  if (s === "F" || s === "FEMALE") return "FEMALE";
  return "UNKNOWN";
}

/**
 * Après recensement état civil : file d'attente + citoyen registre (+ NIC)
 * + ménage cartographie (adresse manuelle → province sélectionnée).
 */
export async function pushCensusToOnip(input: {
  person: Person;
  adresse?: string | null;
  communeCode?: string | null;
  censusActId?: string | null;
  provinceName?: string | null;
  provinceCode?: string | null;
  villeName?: string | null;
}): Promise<{ queueId: string; citizenId?: string; nic?: string; message: string }> {
  const item: OnipCardQueueItem = {
    id: crypto.randomUUID(),
    person_id: input.person.id,
    nic: input.person.nic,
    nom: input.person.nom,
    postnom: input.person.postnom,
    prenom: input.person.prenom,
    sexe: input.person.sexe,
    date_naissance: input.person.date_naissance,
    lieu_naissance: input.person.lieu_naissance,
    commune_code: input.communeCode ?? null,
    adresse: input.adresse ?? null,
    province_name: input.provinceName ?? null,
    province_code: input.provinceCode ?? null,
    ville_name: input.villeName ?? null,
    citizen_id: null,
    registry_nic: null,
    census_act_id: input.censusActId ?? null,
    status: "PENDING_ONIP",
    created_at: new Date().toISOString(),
    source: "civil_census",
  };

  const queue = loadQueue();
  queue.unshift(item);
  saveQueue(queue);

  await ensureAccessToken();
  const session = getSession();
  if (!session?.accessToken) {
    return {
      queueId: item.id,
      message:
        "Recensement local OK — reconnectez-vous (officier / DemoCivil2026!) pour envoyer le dossier à SIGPOP-RDC.",
    };
  }

  const provinceLabel = (input.provinceName || "").trim() || "Kinshasa";
  const provinceCode = (input.provinceCode || "").trim() || "01";
  const city = (input.villeName || provinceLabel).trim() || provinceLabel;
  const base = coordsForProvince(provinceCode || provinceLabel);
  const [lat, lng] = jitter(base[0], base[1], item.id);

  try {
    const familyName = [input.person.nom, input.person.postnom].filter(Boolean).join(" ").trim();
    const citizen = await api.createCitizen({
      sex: sexForRegistry(input.person.sexe),
      date_of_birth: input.person.date_naissance,
      place_of_birth: input.person.lieu_naissance || null,
      nationality: "COD",
      given_names: input.person.prenom.trim(),
      family_name: familyName || input.person.nom,
      addresses: input.adresse
        ? [
            {
              address_type: "RESIDENTIAL",
              line1: input.adresse,
              city,
              commune_code: input.communeCode || undefined,
              province_code: provinceCode,
              country_code: "COD",
              is_primary: true,
            },
          ]
        : [],
    });

    let registryNic: string | null = citizen.nic ?? null;
    try {
      const validated = await api.validateCitizen(citizen.id);
      registryNic = validated.nic || registryNic;
    } catch {
      /* validation NIC bloquée si doublon ouvert — pas de forçage */
    }

    // Cartographie : ménage + fiche campagne avec coords province (adresse manuelle).
    try {
      const camps = await api.listCensusCampaigns();
      const camp =
        camps.find((c) => c.code === "RGPH-2026") ||
        camps.find((c) => (c.status || "").toUpperCase() === "ACTIVE") ||
        camps[0];
      if (camp) {
        const hhLocal = `civil-hh-${item.id.slice(0, 8)}`;
        const recLocal = `civil-rec-${item.id.slice(0, 8)}`;
        await api.syncCensusPush({
          device_uid: `civil-browser-${session.userId?.slice(0, 8) || "anon"}`,
          campaign_id: camp.id,
          items: [
            {
              entity_type: "household",
              local_id: hhLocal,
              version: 1,
              data: {
                address_line: input.adresse || `${provinceLabel} — recensement état civil`,
                member_count: 1,
                address_source: "manual",
                province: provinceLabel,
                province_code: provinceCode,
                province_origine: provinceLabel,
                latitude: lat,
                longitude: lng,
              },
            },
            {
              entity_type: "census_record",
              local_id: recLocal,
              version: 1,
              data: {
                household_local_id: hhLocal,
                status: "SYNCED",
                sex: input.person.sexe,
                date_of_birth: input.person.date_naissance,
                family_name: familyName || input.person.nom,
                given_names: input.person.prenom,
                nom: input.person.nom,
                postnom: input.person.postnom,
                prenom: input.person.prenom,
                province_origine: provinceLabel,
                province_code: provinceCode,
                citizen_id: citizen.id,
                payload: {
                  nom: input.person.nom,
                  postnom: input.person.postnom,
                  prenom: input.person.prenom,
                  province_origine: provinceLabel,
                  province_code: provinceCode,
                  province_actuelle: provinceLabel,
                  adresse_actuelle: input.adresse,
                  source: "civil_browser",
                },
              },
            },
          ],
        });
      }
    } catch {
      /* cartographie optionnelle si permission census absente */
    }

    const next = loadQueue().map((row) =>
      row.id === item.id
        ? {
            ...row,
            citizen_id: citizen.id,
            registry_nic: registryNic,
            status: "CITIZEN_CREATED" as const,
          }
        : row,
    );
    saveQueue(next);

    return {
      queueId: item.id,
      citizenId: citizen.id,
      nic: registryNic ?? undefined,
      message: registryNic
        ? `Dossier envoyé à SIGPOP-RDC — NIC ${registryNic}. Sur SIGPOP-RDC → Cartes, recherchez « ${input.person.nom} ${input.person.prenom} ».`
        : `Citoyen créé dans le registre (brouillon). Sur SIGPOP-RDC → Cartes, recherchez « ${input.person.nom} » puis validez/générez la carte.`,
    };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return {
      queueId: item.id,
      message: `File locale OK — sync SIGPOP-RDC échouée : ${detail.slice(0, 160)}`,
    };
  }
}
