/** Préférences & notifications — Présidence (portail institutionnel dédié). */

export type ThemeMode = "light" | "dark";

export type PresPrefs = {
  photoDataUrl?: string;
  theme: ThemeMode;
  passwordOverride?: string;
};

const PREFS_KEY = "nn_presidence_prefs";
const NOTIF_KEY = "nn_presidence_notifs";

export type PresNotification = {
  id: string;
  title: string;
  body: string;
  created_at: string;
  read: boolean;
  href?: string;
};

const DEFAULT_NOTIFS: PresNotification[] = [
  {
    id: "p1",
    title: "Vue nationale",
    body: "Le tableau de bord Présidence agrège population, état civil et structures sanitaires.",
    created_at: new Date(Date.now() - 3600_000).toISOString(),
    read: false,
    href: "/",
  },
  {
    id: "p2",
    title: "Synoptique national",
    body: "Consultez les tableaux synoptiques consolidés de la République.",
    created_at: new Date(Date.now() - 7200_000).toISOString(),
    read: false,
    href: "/synoptique/naissances",
  },
];

export function getPresPrefs(): PresPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) {
      const p = JSON.parse(raw) as PresPrefs;
      return {
        theme: p.theme === "dark" ? "dark" : "light",
        photoDataUrl: p.photoDataUrl,
        passwordOverride: p.passwordOverride,
      };
    }
  } catch {
    /* ignore */
  }
  return { theme: "light" };
}

export function savePresPrefs(next: PresPrefs): void {
  localStorage.setItem(PREFS_KEY, JSON.stringify(next));
  document.documentElement.setAttribute("data-theme", next.theme);
}

export function applyPresTheme(theme: ThemeMode): void {
  document.documentElement.setAttribute("data-theme", theme);
}

export function listPresNotifications(): PresNotification[] {
  try {
    const raw = localStorage.getItem(NOTIF_KEY);
    if (raw) return JSON.parse(raw) as PresNotification[];
  } catch {
    /* ignore */
  }
  localStorage.setItem(NOTIF_KEY, JSON.stringify(DEFAULT_NOTIFS));
  return DEFAULT_NOTIFS;
}

export function savePresNotifications(rows: PresNotification[]): void {
  localStorage.setItem(NOTIF_KEY, JSON.stringify(rows));
}

export function presUnreadCount(): number {
  return listPresNotifications().filter((n) => !n.read).length;
}

export function markPresNotificationRead(id: string): PresNotification[] {
  const rows = listPresNotifications().map((n) => (n.id === id ? { ...n, read: true } : n));
  savePresNotifications(rows);
  return rows;
}

export function markAllPresNotificationsRead(): PresNotification[] {
  const rows = listPresNotifications().map((n) => ({ ...n, read: true }));
  savePresNotifications(rows);
  return rows;
}
