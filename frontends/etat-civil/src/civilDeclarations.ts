/** Déclarations hôpital → état civil (API prioritaire, localStorage secours). */

import { api } from "./api";

export type CivilDeclaration = {
  id: string;
  source: "HOSPITAL" | "COMMUNE" | "CITIZEN";
  declaration_type: "BIRTH" | "DEATH";
  payload: Record<string, unknown>;
  status: "PENDING_OFFICER" | "VALIDATED" | "REJECTED";
  created_at: string;
};

const DEMO_KEY = "nn_civil_demo_store";
const NOTIF_KEY = "nn_civil_officer_notifs";

type DemoStore = {
  acts: unknown[];
  declarations: CivilDeclaration[];
  residences: unknown[];
};

function loadDemo(): DemoStore {
  try {
    const raw = localStorage.getItem(DEMO_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DemoStore;
      return {
        acts: parsed.acts ?? [],
        declarations: parsed.declarations ?? [],
        residences: parsed.residences ?? [],
      };
    }
  } catch {
    /* ignore */
  }
  return { acts: [], declarations: [], residences: [] };
}

function saveDemo(store: DemoStore) {
  localStorage.setItem(DEMO_KEY, JSON.stringify(store));
}

function pushOfficerNotif(
  declarationId: string,
  title: string,
  body: string,
  href = "/declarations",
) {
  try {
    const raw = localStorage.getItem(NOTIF_KEY);
    const rows = raw
      ? (JSON.parse(raw) as {
          id: string;
          title: string;
          body: string;
          created_at: string;
          read: boolean;
          href?: string;
        }[])
      : [];
    const id = `decl-${declarationId}`;
    const without = rows.filter((r) => r.id !== id);
    without.unshift({
      id,
      title,
      body,
      created_at: new Date().toISOString(),
      read: false,
      href,
    });
    localStorage.setItem(NOTIF_KEY, JSON.stringify(without.slice(0, 50)));
  } catch {
    /* ignore */
  }
}

function saveLocal(decl: CivilDeclaration) {
  const store = loadDemo();
  store.declarations.unshift(decl);
  saveDemo(store);
}

const REF_SEQ_KEY = "nn_civil_notif_ref_seq_v1";

/** Référence numérique affichée (ex. 20260927000042) — pas un extrait d'UUID. */
export function nextNotificationRef(): string {
  const now = new Date();
  const ymd = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("");
  let seq = 0;
  try {
    seq = Number(localStorage.getItem(REF_SEQ_KEY) || "0") || 0;
  } catch {
    seq = 0;
  }
  seq += 1;
  try {
    localStorage.setItem(REF_SEQ_KEY, String(seq));
  } catch {
    /* ignore */
  }
  return `${ymd}${String(seq).padStart(6, "0")}`;
}

/** Libellé réf. pour l'UI (payload.ref_notification, sinon chiffres dérivés de l'id). */
export function declarationRef(d: { id: string; payload?: Record<string, unknown> }): string {
  const fromPayload = String(d.payload?.ref_notification ?? "").trim();
  if (/^\d+$/.test(fromPayload)) return fromPayload;
  const digits = d.id.replace(/\D/g, "");
  if (digits.length >= 8) return digits.slice(0, 12);
  let n = 0;
  for (let i = 0; i < d.id.length; i++) n = (n * 31 + d.id.charCodeAt(i)) >>> 0;
  return String(n).padStart(10, "0").slice(0, 10);
}

export async function notifyEtatCivil(input: {
  type: "BIRTH" | "DEATH";
  payload: Record<string, unknown>;
  facilityName: string;
}): Promise<CivilDeclaration> {
  const ref = String(input.payload.ref_notification ?? "").trim() || nextNotificationRef();
  const payload = {
    ...input.payload,
    facility_name: input.facilityName,
    ref_notification: ref,
    notified_at: new Date().toISOString(),
  };
  try {
    const remote = await api.createDeclaration({
      source: "HOSPITAL",
      declaration_type: input.type,
      payload,
    });
    const decl: CivilDeclaration = {
      id: remote.id,
      source: (remote.source as CivilDeclaration["source"]) || "HOSPITAL",
      declaration_type: remote.declaration_type as "BIRTH" | "DEATH",
      payload: {
        ...payload,
        ...((remote.payload as Record<string, unknown>) || {}),
        ref_notification:
          String((remote.payload as Record<string, unknown>)?.ref_notification ?? "") || ref,
      },
      status: (remote.status as CivilDeclaration["status"]) || "PENDING_OFFICER",
      created_at: remote.created_at,
    };
    saveLocal(decl);
    pushOfficerNotif(
      decl.id,
      input.type === "BIRTH"
        ? "Déclaration de naissance en attente de validation"
        : "Déclaration de décès en attente de validation",
      input.type === "BIRTH"
        ? `${input.facilityName} a déclaré un nouveau-né (réf. ${ref}). Validation officier requise.`
        : `${input.facilityName} a déclaré un décès (réf. ${ref}). Validation officier requise.`,
      "/declarations",
    );
    return decl;
  } catch {
    const decl: CivilDeclaration = {
      id: crypto.randomUUID(),
      source: "HOSPITAL",
      declaration_type: input.type,
      payload,
      status: "PENDING_OFFICER",
      created_at: new Date().toISOString(),
    };
    saveLocal(decl);
    pushOfficerNotif(
      decl.id,
      input.type === "BIRTH"
        ? "Déclaration de naissance en attente de validation"
        : "Déclaration de décès en attente de validation",
      input.type === "BIRTH"
        ? `${input.facilityName} a déclaré un nouveau-né (réf. ${ref}). Validation officier requise.`
        : `${input.facilityName} a déclaré un décès (réf. ${ref}). Validation officier requise.`,
      "/declarations",
    );
    return decl;
  }
}

export function listFacilityDeclarations(
  facilityId?: string,
  facilityName?: string,
): CivilDeclaration[] {
  const rows = loadDemo().declarations.filter((d) => d.source === "HOSPITAL");
  if (!facilityId && !facilityName) return rows;
  const name = (facilityName ?? "").trim().toLowerCase();
  return rows.filter((d) => {
    const id = String(d.payload.facility_id ?? "");
    const fname = String(d.payload.facility_name ?? "").trim().toLowerCase();
    if (facilityId && id === facilityId) return true;
    if (name && fname === name) return true;
    return false;
  });
}

/** Toutes les déclarations locales (officier) — fusion avec l'API. */
export function listLocalPendingDeclarations(): CivilDeclaration[] {
  return loadDemo().declarations.filter((d) => d.status === "PENDING_OFFICER");
}

/** Déclarations naissance/décès en attente (stockage local / démo). */
export function listPendingOfficerDeclarations(): CivilDeclaration[] {
  return loadDemo().declarations.filter((d) => d.status === "PENDING_OFFICER");
}

export function setDeclarationStatus(
  id: string,
  status: "VALIDATED" | "REJECTED",
): CivilDeclaration | null {
  const store = loadDemo();
  const d = store.declarations.find((x) => x.id === id);
  if (!d) return null;
  d.status = status;
  saveDemo(store);
  return d;
}
