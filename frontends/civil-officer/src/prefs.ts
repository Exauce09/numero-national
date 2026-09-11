/** Préférences utilisateur locales (photo, thème, mot de passe démo). */

export type ThemeMode = "light" | "dark";

export type UserPrefs = {
  photoDataUrl?: string;
  theme: ThemeMode;
  passwordOverride?: string;
};

const PREFS_KEY = "nn_civil_officer_prefs";
const NOTIF_KEY = "nn_civil_officer_notifs";
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

export function unreadCount(): number {
  return listNotifications().filter((n) => !n.read).length;
}

export function markNotificationRead(id: string): AppNotification[] {
  const rows = listNotifications().map((n) => (n.id === id ? { ...n, read: true } : n));
  saveNotifications(rows);
  return rows;
}

export function markAllNotificationsRead(): AppNotification[] {
  const rows = listNotifications().map((n) => ({ ...n, read: true }));
  saveNotifications(rows);
  return rows;
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
          : `${facility} a déclaré un décès. Validation officier requise.`,
        created_at: d.created_at || new Date().toISOString(),
        read: prevRead.get(id) === true,
        href: "/declarations",
      };
    });
  // Conserve les notifs système hors déclarations (ex. validation effectuée).
  const others = existing.filter((n) => !n.id.startsWith("decl-"));
  const merged = [...generated, ...others].slice(0, 50);
  saveNotifications(merged);
  return merged;
}
