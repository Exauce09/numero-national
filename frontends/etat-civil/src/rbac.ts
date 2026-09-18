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
  | "GREFFIER"
  | "JUGE"
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
  | "corrections"
  | "census"
  | "admin_personnel"
  | "admin_bureaux"
  | "admin_accounts"
  | "documents"
  | "cartes"
  | "search"
  | "biometrie"
  | "judiciaire"
  | "procedure"
  | "users_bureau"
  | "acts_register"
  | "transcriptions"
  | "mentions"
  | "create_acts";

const NATIONAL = new Set(["SUPER_ADMIN_NATIONAL", "ADMIN_NATIONAL", "CENTRAL_ADMIN"]);
const PROVINCIAL = new Set(["ADMIN_PROVINCIAL"]);
const BUREAU_LEAD = new Set(["RESPONSABLE_BUREAU"]);
const OFFICIER = new Set(["OFFICIER_ETAT_CIVIL", "CIVIL_OFFICER"]);
const AGENT = new Set(["AGENT_ETAT_CIVIL"]);
const JUDICIAL = new Set(["GREFFIER", "JUGE"]);

export function normalizeRoles(roles: string[] | undefined | null): string[] {
  return (roles ?? []).map((r) => r.toUpperCase());
}

/** Greffier / juge — module judiciaire, pas le bureau EC opérationnel. */
export function isJudicialRole(roles: string[] | undefined | null): boolean {
  const r = normalizeRoles(roles);
  return (
    r.some((x) => JUDICIAL.has(x)) &&
    !r.some((x) => NATIONAL.has(x) || BUREAU_LEAD.has(x) || OFFICIER.has(x) || AGENT.has(x))
  );
}

export function isAgentOnly(roles: string[] | undefined | null): boolean {
  return primaryRole(roles ?? []) === "AGENT_ETAT_CIVIL";
}

export function isAuditeurOnly(roles: string[] | undefined | null): boolean {
  return primaryRole(roles ?? []) === "AUDITEUR";
}

export function primaryRole(roles: string[]): AppRole {
  const r = normalizeRoles(roles);
  if (r.some((x) => NATIONAL.has(x))) return r.find((x) => NATIONAL.has(x))!;
  if (r.some((x) => PROVINCIAL.has(x))) return "ADMIN_PROVINCIAL";
  if (r.some((x) => BUREAU_LEAD.has(x))) return "RESPONSABLE_BUREAU";
  if (r.some((x) => OFFICIER.has(x))) return "OFFICIER_ETAT_CIVIL";
  if (r.some((x) => AGENT.has(x))) return "AGENT_ETAT_CIVIL";
  if (r.includes("GREFFIER")) return "GREFFIER";
  if (r.includes("JUGE")) return "JUGE";
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
      return "Directrice de l'État civil général de la RDC";
    case "RESPONSABLE_BUREAU":
      return "Responsable de bureau";
    case "OFFICIER_ETAT_CIVIL":
    case "CIVIL_OFFICER":
      return "Officier de l'état civil";
    case "AGENT_ETAT_CIVIL":
      return "Agent de l'état civil";
    case "GREFFIER":
      return "Greffier";
    case "JUGE":
      return "Juge";
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

/** Officier / lead : validation actes — la permission serveur prime sur le rôle UI. */
export function canValidateActs(
  roles: string[] | undefined | null,
  permissions?: string[] | null,
): boolean {
  const perms = permissions ?? [];
  if (perms.length > 0) {
    return can("civil:act:validate", perms) || can("*", perms);
  }
  const r = normalizeRoles(roles);
  return r.some((x) => OFFICIER.has(x) || BUREAU_LEAD.has(x) || NATIONAL.has(x));
}

/** Création / saisie d'actes (pas l'auditeur ni le juge seul). */
export function canCreateActs(roles: string[] | undefined | null): boolean {
  const role = primaryRole(roles ?? []);
  return (
    role === "SUPER_ADMIN_NATIONAL" ||
    role === "ADMIN_NATIONAL" ||
    role === "CENTRAL_ADMIN" ||
    role === "ADMIN_PROVINCIAL" ||
    role === "RESPONSABLE_BUREAU" ||
    role === "OFFICIER_ETAT_CIVIL" ||
    role === "CIVIL_OFFICER" ||
    role === "AGENT_ETAT_CIVIL" ||
    role === "GREFFIER"
  );
}

export function canAny(keys: string[], permissions: string[] | undefined | null): boolean {
  return keys.some((k) => can(k, permissions));
}

/** Sidebar visibility by role family (UI only). */
export function canSeeNav(key: NavKey, roles: string[], permissions?: string[] | null): boolean {
  const r = normalizeRoles(roles);
  const role = primaryRole(r);
  const isNational = r.some((x) => NATIONAL.has(x));
  const isProvincial = r.some((x) => PROVINCIAL.has(x));
  const isLead = r.some((x) => BUREAU_LEAD.has(x));
  const isOfficier = r.some((x) => OFFICIER.has(x));
  const isJudicial = isJudicialRole(r);
  const isAgent = role === "AGENT_ETAT_CIVIL";
  const isAuditeur = role === "AUDITEUR";
  const perms = permissions ?? [];
  const hasUserManage = can("users:manage", perms);
  const hasPersonnel = can("personnel:read", perms) || can("personnel:manage", perms);
  const hasAccountReq = can("account_request:manage", perms) || can("account_request:create", perms);

  if (isJudicial) {
    switch (key) {
      case "dashboard":
      case "search":
      case "judiciaire":
      case "divorces":
      case "documents":
      case "procedure":
      case "transcriptions":
      case "mentions":
        return true;
      case "create_acts":
        return role === "GREFFIER";
      default:
        return false;
    }
  }

  if (isAuditeur) {
    switch (key) {
      case "dashboard":
      case "search":
      case "synoptique":
      case "acts_register":
      case "naissances":
      case "mariages":
      case "deces":
      case "procedure":
        return true;
      default:
        return false;
    }
  }

  if (isAgent) {
    switch (key) {
      case "dashboard":
      case "search":
      case "procedure":
      case "naissances":
      case "mariages":
      case "deces":
      case "create_acts":
      case "documents":
      case "acts_register":
        return true;
      default:
        return false;
    }
  }

  switch (key) {
    case "dashboard":
    case "search":
    case "population":
    case "procedure":
      return true;
    case "synoptique":
      return isNational || isProvincial || isLead || isOfficier;
    case "naissances":
    case "deces":
    case "mariages":
    case "divorces":
    case "documents":
    case "acts_register":
    case "create_acts":
    case "mentions":
    case "transcriptions":
      return isOfficier || isLead || isProvincial || isNational;
    case "declarations":
    case "validation":
    case "corrections":
      return isOfficier || isLead || isProvincial || isNational;
    case "judiciaire":
      return isOfficier || isLead || isProvincial || isNational;
    case "census":
      return isLead || isProvincial || isNational || isOfficier;
    case "users_bureau":
      return isLead || isNational;
    case "admin_personnel":
      return isNational && (hasPersonnel || hasUserManage || perms.length === 0);
    case "admin_bureaux":
      return isNational;
    case "admin_accounts":
      return isNational && (hasAccountReq || hasUserManage || perms.length === 0);
    case "cartes":
      return isOfficier || isLead || isProvincial || isNational;
    case "biometrie":
      return (
        can("biometric:enroll", perms) ||
        can("biometric:match", perms) ||
        isOfficier ||
        isLead ||
        isProvincial ||
        isNational
      );
    default:
      return false;
  }
}

/** Garde de route : l'utilisateur peut-il ouvrir ce chemin ? */
export function canAccessPath(pathname: string, roles: string[] | undefined | null): boolean {
  const path = pathname.split("?")[0] || "/";
  const r = roles ?? [];

  if (path === "/" || path === "") return canSeeNav("dashboard", r);
  if (path.startsWith("/search")) return canSeeNav("search", r);
  if (path.startsWith("/procedure") || path.startsWith("/roles") || path.startsWith("/juge")) {
    return canSeeNav("procedure", r);
  }
  if (path.startsWith("/missions") || path.startsWith("/matrice")) {
    return canSeeNav("procedure", r) && !isAgentOnly(r) && !isJudicialRole(r);
  }
  if (path.startsWith("/population") || path.startsWith("/personnes")) {
    return canSeeNav("population", r);
  }
  if (path.startsWith("/manage/deplacement") || path.startsWith("/displacements")) {
    return canSeeNav("naissances", r) || canSeeNav("create_acts", r);
  }
  if (path.startsWith("/synoptique")) return canSeeNav("synoptique", r);
  if (path.startsWith("/declarations")) return canSeeNav("declarations", r);
  if (path.startsWith("/corrections")) return canSeeNav("corrections", r);
  if (path.startsWith("/births") || path.startsWith("/manage/naissance") || path.startsWith("/lists/naissance")) {
    return canSeeNav("naissances", r);
  }
  if (path.startsWith("/marriages") || path.startsWith("/manage/mariage") || path.startsWith("/lists/mariage")) {
    return canSeeNav("mariages", r);
  }
  if (path.startsWith("/deaths") || path.startsWith("/manage/deces") || path.startsWith("/lists/deces")) {
    return canSeeNav("deces", r);
  }
  if (path.startsWith("/divorces") || path.startsWith("/manage/divorce") || path.startsWith("/lists/divorce")) {
    return canSeeNav("divorces", r) || canSeeNav("judiciaire", r);
  }
  if (path.startsWith("/adoptions") || path.startsWith("/manage/adoption") || path.startsWith("/lists/adoption")) {
    return canSeeNav("judiciaire", r) || canSeeNav("create_acts", r);
  }
  if (path.startsWith("/recognitions")) {
    return canSeeNav("create_acts", r) && !isAgentOnly(r);
  }
  if (path.startsWith("/transcriptions")) return canSeeNav("transcriptions", r);
  if (path.startsWith("/mentions")) return canSeeNav("mentions", r);
  if (path.startsWith("/documents") || path.startsWith("/manage/document") || path.startsWith("/verify-document")) {
    return canSeeNav("documents", r);
  }
  if (path.startsWith("/acts")) return canSeeNav("acts_register", r);
  if (path.startsWith("/users") || path.startsWith("/register") || path.startsWith("/account-requests")) {
    return (
      canSeeNav("users_bureau", r) ||
      canSeeNav("admin_accounts", r) ||
      primaryRole(r) === "SUPER_ADMIN_NATIONAL"
    );
  }
  if (path.startsWith("/admin")) return primaryRole(r) === "SUPER_ADMIN_NATIONAL";
  return true;
}

export type DashboardVariant =
  | "national"
  | "provincial"
  | "bureau"
  | "officier"
  | "agent"
  | "judiciaire"
  | "auditeur";

export function dashboardVariant(roles: string[]): DashboardVariant {
  const role = primaryRole(roles);
  if (role === "SUPER_ADMIN_NATIONAL" || role === "ADMIN_NATIONAL" || role === "CENTRAL_ADMIN") {
    return "national";
  }
  if (role === "ADMIN_PROVINCIAL") return "provincial";
  if (role === "RESPONSABLE_BUREAU") return "bureau";
  if (role === "OFFICIER_ETAT_CIVIL" || role === "CIVIL_OFFICER") return "officier";
  if (role === "GREFFIER" || role === "JUGE") return "judiciaire";
  if (role === "AUDITEUR") return "auditeur";
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
