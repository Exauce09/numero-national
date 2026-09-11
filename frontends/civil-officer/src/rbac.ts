/** RBAC UI helpers — mirror backend roles; never sole security layer. */

export type AppRole =
  | "SUPER_ADMIN_NATIONAL"
  | "ADMIN_NATIONAL"
  | "CENTRAL_ADMIN"
  | "ADMIN_PROVINCIAL"
  | "RESPONSABLE_BUREAU"
  | "OFFICIER_ETAT_CIVIL"
  | "CIVIL_OFFICER"
  | "AGENT_ETAT_CIVIL"
  | "AUDITEUR"
  | "CITIZEN"
  | string;

export type NavKey =
  | "dashboard"
  | "synoptique"
  | "population"
  | "naissances"
  | "deces"
  | "mariages"
  | "divorces"
  | "declarations"
  | "validation"
  | "census"
  | "admin_personnel"
  | "admin_bureaux"
  | "admin_accounts"
  | "documents"
  | "cartes"
  | "search";

const NATIONAL = new Set(["SUPER_ADMIN_NATIONAL", "ADMIN_NATIONAL", "CENTRAL_ADMIN"]);
const PROVINCIAL = new Set(["ADMIN_PROVINCIAL"]);
const BUREAU_LEAD = new Set(["RESPONSABLE_BUREAU"]);
const OFFICIER = new Set(["OFFICIER_ETAT_CIVIL", "CIVIL_OFFICER"]);
const AGENT = new Set(["AGENT_ETAT_CIVIL"]);

export function normalizeRoles(roles: string[] | undefined | null): string[] {
  return (roles ?? []).map((r) => r.toUpperCase());
}

export function primaryRole(roles: string[]): AppRole {
  const r = normalizeRoles(roles);
  if (r.some((x) => NATIONAL.has(x))) return r.find((x) => NATIONAL.has(x))!;
  if (r.some((x) => PROVINCIAL.has(x))) return "ADMIN_PROVINCIAL";
  if (r.some((x) => BUREAU_LEAD.has(x))) return "RESPONSABLE_BUREAU";
  if (r.some((x) => OFFICIER.has(x))) return "OFFICIER_ETAT_CIVIL";
  if (r.some((x) => AGENT.has(x))) return "AGENT_ETAT_CIVIL";
  if (r.includes("AUDITEUR")) return "AUDITEUR";
  return r[0] ?? "AGENT_ETAT_CIVIL";
}

export function roleTitleFor(roles: string[]): string {
  switch (primaryRole(roles)) {
    case "SUPER_ADMIN_NATIONAL":
      return "Super administrateur national";
    case "ADMIN_NATIONAL":
    case "CENTRAL_ADMIN":
      return "Administrateur national";
    case "ADMIN_PROVINCIAL":
      return "Administrateur provincial";
    case "RESPONSABLE_BUREAU":
      return "Responsable de bureau";
    case "OFFICIER_ETAT_CIVIL":
    case "CIVIL_OFFICER":
      return "Officier d'état civil";
    case "AGENT_ETAT_CIVIL":
      return "Agent d'état civil";
    case "AUDITEUR":
      return "Auditeur";
    default:
      return "Agent opérationnel";
  }
}

export function can(permission: string, permissions: string[] | undefined | null): boolean {
  const set = new Set(permissions ?? []);
  if (set.has("*") || set.has("admin:*")) return true;
  return set.has(permission);
}

export function canAny(keys: string[], permissions: string[] | undefined | null): boolean {
  return keys.some((k) => can(k, permissions));
}

/** Sidebar visibility by role family (UI only). */
export function canSeeNav(key: NavKey, roles: string[], permissions?: string[] | null): boolean {
  const r = normalizeRoles(roles);
  const isNational = r.some((x) => NATIONAL.has(x));
  const isProvincial = r.some((x) => PROVINCIAL.has(x));
  const isLead = r.some((x) => BUREAU_LEAD.has(x));
  const isOfficier = r.some((x) => OFFICIER.has(x));
  const isAgent = r.some((x) => AGENT.has(x)) || (!isNational && !isProvincial && !isLead && !isOfficier);
  const perms = permissions ?? [];
  const hasUserManage = can("users:manage", perms);
  const hasPersonnel = can("personnel:read", perms) || can("personnel:manage", perms);
  const hasAccountReq = can("account_request:manage", perms) || can("account_request:create", perms);

  switch (key) {
    case "dashboard":
    case "search":
    case "population":
      return true;
    case "synoptique":
      return isNational || isProvincial || isLead || isOfficier;
    case "naissances":
    case "deces":
    case "mariages":
    case "divorces":
    case "declarations":
    case "documents":
      return isAgent || isOfficier || isLead || isProvincial || isNational;
    case "validation":
      return isOfficier || isLead || isProvincial || isNational;
    case "census":
      return isLead || isProvincial || isNational || isOfficier;
    case "admin_personnel":
      return (isLead || isProvincial || isNational) && (hasPersonnel || hasUserManage || perms.length === 0);
    case "admin_bureaux":
      return isLead || isProvincial || isNational;
    case "admin_accounts":
      return (isLead || isProvincial || isNational) && (hasAccountReq || hasUserManage || perms.length === 0);
    case "cartes":
      return isOfficier || isLead || isProvincial || isNational;
    default:
      return false;
  }
}

export type DashboardVariant = "national" | "provincial" | "bureau" | "officier" | "agent";

export function dashboardVariant(roles: string[]): DashboardVariant {
  const role = primaryRole(roles);
  if (role === "SUPER_ADMIN_NATIONAL" || role === "ADMIN_NATIONAL" || role === "CENTRAL_ADMIN") {
    return "national";
  }
  if (role === "ADMIN_PROVINCIAL") return "provincial";
  if (role === "RESPONSABLE_BUREAU") return "bureau";
  if (role === "OFFICIER_ETAT_CIVIL" || role === "CIVIL_OFFICER") return "officier";
  return "agent";
}

export function mapLoginError(status: number, bodyText: string): string {
  const lower = bodyText.toLowerCase();
  if (status === 429) return "Trop de tentatives. Réessayez plus tard.";
  if (lower.includes("suspended") || lower.includes("suspendu")) {
    return "Compte suspendu. Contactez votre administrateur.";
  }
  if (lower.includes("disabled") || lower.includes("désactiv") || lower.includes("desactiv")) {
    return "Compte désactivé. Connexion refusée.";
  }
  if (lower.includes("locked") || lower.includes("verrouill")) {
    return "Compte verrouillé temporairement.";
  }
  if (lower.includes("pending") || lower.includes("attente")) {
    return "Compte en attente d'activation. Utilisez votre invitation.";
  }
  if (status === 401 || status === 403) return "Identifiants incorrects ou accès refusé.";
  return bodyText || `Erreur de connexion (${status}).`;
}
