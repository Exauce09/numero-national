/** Préférences & notifications structure sanitaire (photo, thème, notifs locales). */

export type ThemeMode = "light" | "dark";

export type HealthPrefs = {
  photoDataUrl?: string;
  theme: ThemeMode;
};

const PREFS_KEY = "nn_health_facility_prefs";
const NOTIF_KEY = "nn_health_facility_notifs";

export type HealthNotification = {
  id: string;
  title: string;
  body: string;
  created_at: string;
  read: boolean;
  href?: string;
};

export function getHealthPrefs(): HealthPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as HealthPrefs;
      return {
        theme: parsed.theme === "dark" ? "dark" : "light",
        photoDataUrl: parsed.photoDataUrl,
      };
    }
  } catch {
    /* ignore */
  }
  return { theme: "light" };
}

export function saveHealthPrefs(next: HealthPrefs): void {
  localStorage.setItem(PREFS_KEY, JSON.stringify(next));
  applyHealthTheme(next.theme);
}

export function applyHealthTheme(theme: ThemeMode): void {
  document.documentElement.setAttribute("data-theme", theme);
}

export function listHealthNotifications(): HealthNotification[] {
  try {
    const raw = localStorage.getItem(NOTIF_KEY);
    if (raw) return JSON.parse(raw) as HealthNotification[];
  } catch {
    /* ignore */
  }
  return [];
}

export function saveHealthNotifications(rows: HealthNotification[]): void {
  localStorage.setItem(NOTIF_KEY, JSON.stringify(rows));
}

export function healthUnreadCount(): number {
  return listHealthNotifications().filter((n) => !n.read).length;
}

export function markHealthNotificationRead(id: string): HealthNotification[] {
  const rows = listHealthNotifications().map((n) => (n.id === id ? { ...n, read: true } : n));
  saveHealthNotifications(rows);
  return rows;
}

export function markAllHealthNotificationsRead(): HealthNotification[] {
  const rows = listHealthNotifications().map((n) => ({ ...n, read: true }));
  saveHealthNotifications(rows);
  return rows;
}

export function pushHealthNotification(input: {
  title: string;
  body: string;
  href?: string;
}): HealthNotification {
  const row: HealthNotification = {
    id: crypto.randomUUID(),
    title: input.title,
    body: input.body,
    created_at: new Date().toISOString(),
    read: false,
    href: input.href,
  };
  const rows = [row, ...listHealthNotifications()].slice(0, 50);
  saveHealthNotifications(rows);
  return row;
}
