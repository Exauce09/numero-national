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

function pushOfficerNotif(title: string, body: string, href = "/declarations") {
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
    rows.unshift({
      id: crypto.randomUUID(),
      title,
      body,
      created_at: new Date().toISOString(),
      read: false,
      href,
    });
    localStorage.setItem(NOTIF_KEY, JSON.stringify(rows.slice(0, 50)));
  } catch {
    /* ignore */
  }
}

function saveLocal(decl: CivilDeclaration) {
  const store = loadDemo();
  store.declarations.unshift(decl);
  saveDemo(store);
}

export async function notifyEtatCivil(input: {
  type: "BIRTH" | "DEATH";
  payload: Record<string, unknown>;
  facilityName: string;
}): Promise<CivilDeclaration> {
  const payload = {
    ...input.payload,
    facility_name: input.facilityName,
    notified_at: new Date().toISOString(),
  };
  const kind = input.type === "BIRTH" ? "naissance" : "décès";
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
      payload: (remote.payload as Record<string, unknown>) || payload,
      status: (remote.status as CivilDeclaration["status"]) || "PENDING_OFFICER",
      created_at: remote.created_at,
    };
    saveLocal(decl);
    pushOfficerNotif(
      `Notification structure sanitaire — ${kind}`,
      `${input.facilityName} a déclaré un(e) ${kind}. Validation officier requise.`,
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
      `Notification structure sanitaire — ${kind}`,
      `${input.facilityName} a déclaré un(e) ${kind}. Validation officier requise.`,
      "/declarations",
    );
    return decl;
  }
}

export function listFacilityDeclarations(facilityId?: string): CivilDeclaration[] {
  const rows = loadDemo().declarations.filter((d) => d.source === "HOSPITAL");
  if (!facilityId) return rows;
  return rows.filter((d) => String(d.payload.facility_id ?? "") === facilityId);
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
