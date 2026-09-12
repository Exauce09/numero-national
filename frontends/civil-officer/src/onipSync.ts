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
  citizen_id?: string | null;
  registry_nic?: string | null;
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

function sexForRegistry(sexe: string): "MALE" | "FEMALE" | "UNKNOWN" {
  const s = sexe.toUpperCase();
  if (s === "M" || s === "MALE" || s.startsWith("H")) return "MALE";
  if (s === "F" || s === "FEMALE") return "FEMALE";
  return "UNKNOWN";
}

/**
 * Après recensement état civil : file d'attente + citoyen registre (+ NIC)
 * pour que ONIP puisse rechercher, générer et livrer la carte.
 */
export async function pushCensusToOnip(input: {
  person: Person;
  adresse?: string | null;
  communeCode?: string | null;
  censusActId?: string | null;
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
        "Recensement local OK — reconnectez-vous (officier / DemoCivil2026!) pour envoyer le dossier à ONIP.",
    };
  }

  try {
    const citizen = await api.createCitizen({
      sex: sexForRegistry(input.person.sexe),
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

    let registryNic: string | null = citizen.nic ?? null;
    try {
      const validated = await api.validateCitizen(citizen.id);
      registryNic = validated.nic || registryNic;
    } catch {
      /* validation NIC optionnelle si doublon / permission */
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
        ? `Dossier envoyé à ONIP — NIC ${registryNic}. Sur ONIP → Cartes, recherchez « ${input.person.nom} ${input.person.prenom} ».`
        : `Citoyen créé dans le registre (brouillon). Sur ONIP → Cartes, recherchez « ${input.person.nom} » puis validez/générez la carte.`,
    };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return {
      queueId: item.id,
      message: `File locale OK — sync ONIP échouée : ${detail.slice(0, 160)}`,
    };
  }
}
