/** Préférences utilisateur locales (photo, thème, mot de passe démo). */

export type ThemeMode = "light" | "dark";

export type UserPrefs = {
  photoDataUrl?: string;
  theme: ThemeMode;
  passwordOverride?: string;
};

const PREFS_KEY = "nn_etat_civil_prefs";
const NOTIF_KEY = "nn_etat_civil_notifs";
const NOTIF_SCHEMA_KEY = "nn_civil_officer_notifs_schema";
const NOTIF_SCHEMA = "sigpop-decl-v1";

export type AppNotification = {
  id: string;
  title: string;
  body: string;
  created_at: string;
  read: boolean;
  href?: string;
};

const DEFAULT_NOTIFS: AppNotification[] = [];

export function getPrefs(): UserPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as UserPrefs;
      return { theme: parsed.theme === "dark" ? "dark" : "light", photoDataUrl: parsed.photoDataUrl, passwordOverride: parsed.passwordOverride };
    }
  } catch {
    /* ignore */
  }
  return { theme: "light" };
}

export function savePrefs(next: UserPrefs): void {
  localStorage.setItem(PREFS_KEY, JSON.stringify(next));
  applyTheme(next.theme);
}

export function applyTheme(theme: ThemeMode): void {
  document.documentElement.setAttribute("data-theme", theme);
}

export function listNotifications(): AppNotification[] {
  try {
    if (localStorage.getItem(NOTIF_SCHEMA_KEY) !== NOTIF_SCHEMA) {
      localStorage.setItem(NOTIF_SCHEMA_KEY, NOTIF_SCHEMA);
      localStorage.setItem(NOTIF_KEY, JSON.stringify(DEFAULT_NOTIFS));
      return DEFAULT_NOTIFS;
    }
    const raw = localStorage.getItem(NOTIF_KEY);
    if (raw) return JSON.parse(raw) as AppNotification[];
  } catch {
    /* ignore */
  }
  localStorage.setItem(NOTIF_KEY, JSON.stringify(DEFAULT_NOTIFS));
  return DEFAULT_NOTIFS;
}

export function saveNotifications(rows: AppNotification[]): void {
  localStorage.setItem(NOTIF_KEY, JSON.stringify(rows));
}

const DISMISSED_KEY = "nn_etat_civil_notifs_dismissed";

function listDismissedIds(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    if (raw) return new Set(JSON.parse(raw) as string[]);
  } catch {
    /* ignore */
  }
  return new Set();
}

function saveDismissedIds(ids: Set<string>): void {
  localStorage.setItem(DISMISSED_KEY, JSON.stringify([...ids].slice(-200)));
}

function rememberDismissed(id: string): void {
  const set = listDismissedIds();
  set.add(id);
  saveDismissedIds(set);
}

export function unreadCount(): number {
  return listNotifications().filter((n) => !n.read).length;
}

/** Lu / validé → suppression immédiate de la notification. */
export function markNotificationRead(id: string): AppNotification[] {
  rememberDismissed(id);
  const rows = listNotifications().filter((n) => n.id !== id);
  saveNotifications(rows);
  return rows;
}

/** Tout marquer lu / tout valider → vide la file. */
export function markAllNotificationsRead(): AppNotification[] {
  const existing = listNotifications();
  const dismissed = listDismissedIds();
  for (const n of existing) dismissed.add(n.id);
  saveDismissedIds(dismissed);
  saveNotifications([]);
  return [];
}

export function pushNotification(input: {
  title: string;
  body: string;
  href?: string;
}): AppNotification {
  const row: AppNotification = {
    id: crypto.randomUUID(),
    title: input.title,
    body: input.body,
    created_at: new Date().toISOString(),
    read: false,
    href: input.href,
  };
  const rows = [row, ...listNotifications()].slice(0, 50);
  saveNotifications(rows);
  return row;
}

/** Aligne les notifications avec les déclarations naissance/décès en attente. */
export function syncDeclarationNotifications(
  pending: Array<{
    id: string;
    declaration_type: string;
    created_at?: string;
    payload?: Record<string, unknown>;
  }>,
): AppNotification[] {
  const existing = listNotifications();
  const prevRead = new Map(
    existing.filter((n) => n.id.startsWith("decl-")).map((n) => [n.id, n.read] as const),
  );
  const dismissed = listDismissedIds();
  const pendingIds = new Set(pending.map((d) => `decl-${d.id}`));
  // Nettoie les dismissals des déclarations déjà traitées.
  let dismissedDirty = false;
  for (const id of [...dismissed]) {
    if (id.startsWith("decl-") && !pendingIds.has(id)) {
      dismissed.delete(id);
      dismissedDirty = true;
    }
  }
  if (dismissedDirty) saveDismissedIds(dismissed);

  const generated: AppNotification[] = pending
    .filter((d) => {
      const t = String(d.declaration_type).toUpperCase();
      return t === "BIRTH" || t === "DEATH";
    })
    .map((d) => {
      const isBirth = String(d.declaration_type).toUpperCase() === "BIRTH";
      const facility = String(
        d.payload?.facility_name ?? d.payload?.facility ?? "Structure sanitaire",
      );
      const child =
        [d.payload?.prenom, d.payload?.nom].filter(Boolean).join(" ") ||
        String(d.payload?.child_name ?? "");
      const id = `decl-${d.id}`;
      return {
        id,
        title: isBirth
          ? "Déclaration de naissance en attente de validation"
          : "Déclaration de décès en attente de validation",
        body: isBirth
          ? `${facility} a déclaré un nouveau-né${child ? ` (${child})` : ""}. Validation officier requise.`
          : `${facility} a déclaré un décès${
              d.payload?.deceased_name ? ` (${String(d.payload.deceased_name)})` : ""
            }. Validation officier requise.`,
        created_at: d.created_at || new Date().toISOString(),
        read: prevRead.get(id) === true,
        href: "/declarations",
      };
    })
    .filter((n) => !dismissed.has(n.id) && prevRead.get(n.id) !== true);
  // Conserve les notifs système hors déclarations (ex. validation effectuée).
  const others = existing.filter((n) => !n.id.startsWith("decl-") && !dismissed.has(n.id));
  const merged = [...generated, ...others].slice(0, 50);
  saveNotifications(merged);
  return merged;
}
