import { api } from "./api";
import { getSession } from "./auth";
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
  citizen_id?: string | null;
  census_act_id?: string | null;
  status: "PENDING_ONIP" | "CITIZEN_CREATED" | "CARD_QUEUED";
  created_at: string;
  source: "civil_census";
};

const QUEUE_KEY = "nn_onip_card_queue";

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

/**
 * Après recensement état civil : file d'attente locale + création citoyen API
 * pour que ONIP puisse générer / imprimer / renvoyer la carte à la commune.
 */
export async function pushCensusToOnip(input: {
  person: Person;
  adresse?: string | null;
  communeCode?: string | null;
  censusActId?: string | null;
}): Promise<{ queueId: string; citizenId?: string; message: string }> {
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
    citizen_id: null,
    census_act_id: input.censusActId ?? null,
    status: "PENDING_ONIP",
    created_at: new Date().toISOString(),
    source: "civil_census",
  };

  const queue = loadQueue();
  queue.unshift(item);
  saveQueue(queue);

  const session = getSession();
  if (!session?.accessToken) {
    return {
      queueId: item.id,
      message:
        "Recensement local OK — reconnectez-vous pour envoyer le dossier à ONIP (registre + carte).",
    };
  }

  try {
    const sex =
      input.person.sexe === "F" ? "F" : input.person.sexe === "M" ? "M" : "UNKNOWN";
    const citizen = await api.createCitizen({
      sex,
      date_of_birth: input.person.date_naissance,
      place_of_birth: input.person.lieu_naissance || null,
      nationality: "COD",
      given_names: [input.person.prenom, input.person.postnom].filter(Boolean).join(" "),
      family_name: input.person.nom,
      addresses: input.adresse
        ? [
            {
              address_type: "RESIDENTIAL",
              line1: input.adresse,
              city: "Kinshasa",
              commune_code: input.communeCode || undefined,
              province_code: "KIN",
              country_code: "COD",
              is_primary: true,
            },
          ]
        : [],
    });

    const next = loadQueue().map((row) =>
      row.id === item.id
        ? {
            ...row,
            citizen_id: citizen.id,
            status: "CITIZEN_CREATED" as const,
            // NIC local conservé pour rapprochement ONIP / commune
          }
        : row,
    );
    saveQueue(next);

    return {
      queueId: item.id,
      citizenId: citizen.id,
      message:
        "Dossier transmis au registre national — ONIP peut générer la carte, l'imprimer et la renvoyer à la commune pour livraison.",
    };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return {
      queueId: item.id,
      message: `File ONIP locale créée — sync API partielle (${detail.slice(0, 120)}).`,
    };
  }
}
