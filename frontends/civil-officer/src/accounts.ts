/** Comptes officier → commune attribuée à la création. */

import {
  DEFAULT_OFFICER_COMMUNE,
  saveOfficerCommune,
  type OfficerCommune,
} from "./commune";

export type OfficerAccount = {
  username: string;
  displayName: string;
  commune: OfficerCommune;
  created_at: string;
};

const KEY = "nn_civil_officer_accounts";

function loadAccounts(): OfficerAccount[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as OfficerAccount[];
  } catch {
    /* ignore */
  }
  return [];
}

function saveAccounts(list: OfficerAccount[]): void {
  localStorage.setItem(KEY, JSON.stringify(list));
}

/** Crée / met à jour un compte officier avec sa commune (attribution automatique). */
export function assignOfficerAccount(input: {
  username: string;
  displayName?: string;
  commune: OfficerCommune;
}): OfficerAccount {
  const username = input.username.trim().toLowerCase();
  const list = loadAccounts().filter((a) => a.username !== username);
  const account: OfficerAccount = {
    username,
    displayName: input.displayName?.trim() || username,
    commune: { ...input.commune },
    created_at: new Date().toISOString(),
  };
  list.unshift(account);
  saveAccounts(list);
  return account;
}

/** Commune liée au compte ; démo « officier » → Gombe si non encore attribué. */
export function resolveCommuneForUsername(username: string): OfficerCommune {
  const user = username.trim().toLowerCase();
  const hit = loadAccounts().find((a) => a.username === user);
  if (hit) return { ...hit.commune };

  const demoAliases = new Set([
    "officier",
    "agent",
    "responsable",
    "auditeur",
    "admin",
  ]);
  if (demoAliases.has(user)) {
    const demo = assignOfficerAccount({
      username: user,
      displayName:
        user === "officier"
          ? "Hervé Kinkete"
          : user === "agent"
            ? "Agent de l'état civil"
            : user === "responsable"
              ? "Responsable de bureau"
              : user === "auditeur"
                ? "Auditeur"
                : "Directrice de l'État civil général de la RDC",
      commune: DEFAULT_OFFICER_COMMUNE,
    });
    return { ...demo.commune };
  }

  return { ...DEFAULT_OFFICER_COMMUNE };
}

/** Applique la commune du compte au stockage courant (session synoptique). */
export function applyAccountCommune(username: string): OfficerCommune {
  const commune = resolveCommuneForUsername(username);
  saveOfficerCommune(commune);
  return commune;
}
