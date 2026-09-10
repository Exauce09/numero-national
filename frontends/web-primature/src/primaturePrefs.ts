/** Préférences & notifications — Primature (lecture institutionnelle). */

export type ThemeMode = "light" | "dark";

export type PrimaturePrefs = {
  photoDataUrl?: string;
  theme: ThemeMode;
  passwordOverride?: string;
};

const PREFS_KEY = "nn_primature_prefs";
const NOTIF_KEY = "nn_primature_notifs";

export type PrimatureNotification = {
  id: string;
  title: string;
  body: string;
  created_at: string;
  read: boolean;
  href?: string;
};

const DEFAULT_NOTIFS: PrimatureNotification[] = [
  {
    id: "pm1",
    title: "Briefing quotidien",
    body: "Le briefing consolidé des ministères est disponible en lecture.",
    created_at: new Date(Date.now() - 1800_000).toISOString(),
    read: false,
    href: "/briefing",
  },
  {
    id: "pm2",
    title: "Alerte transversale",
    body: "Des alertes de coordination nécessitent une attention de la Primature.",
    created_at: new Date(Date.now() - 5400_000).toISOString(),
    read: false,
    href: "/alertes",
  },
  {
    id: "pm3",
    title: "Suivi ministériel",
    body: "Consultez l'état de mise en œuvre par ministère (lecture seule).",
    created_at: new Date(Date.now() - 9000_000).toISOString(),
    read: false,
    href: "/ministeres",
  },
  {
    id: "pm4",
    title: "Tableau synoptique",
    body: "Synoptique de coordination Primature : domaines, dossiers et alertes en lecture seule.",
    created_at: new Date(Date.now() - 1500_000).toISOString(),
    read: false,
    href: "/synoptique/coordination",
  },
];
export function getPrimaturePrefs(): PrimaturePrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) {
      const p = JSON.parse(raw) as PrimaturePrefs;
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

export function savePrimaturePrefs(next: PrimaturePrefs): void {
  localStorage.setItem(PREFS_KEY, JSON.stringify(next));
  document.documentElement.setAttribute("data-theme", next.theme);
}

export function applyPrimatureTheme(theme: ThemeMode): void {
  document.documentElement.setAttribute("data-theme", theme);
}

export function listPrimatureNotifications(): PrimatureNotification[] {
  try {
    const raw = localStorage.getItem(NOTIF_KEY);
    if (raw) return JSON.parse(raw) as PrimatureNotification[];
  } catch {
    /* ignore */
  }
  localStorage.setItem(NOTIF_KEY, JSON.stringify(DEFAULT_NOTIFS));
  return DEFAULT_NOTIFS;
}

export function savePrimatureNotifications(rows: PrimatureNotification[]): void {
  localStorage.setItem(NOTIF_KEY, JSON.stringify(rows));
}

export function primatureUnreadCount(): number {
  return listPrimatureNotifications().filter((n) => !n.read).length;
}

export function markPrimatureNotificationRead(id: string): PrimatureNotification[] {
  const rows = listPrimatureNotifications().map((n) => (n.id === id ? { ...n, read: true } : n));
  savePrimatureNotifications(rows);
  return rows;
}

export function markAllPrimatureNotificationsRead(): PrimatureNotification[] {
  const rows = listPrimatureNotifications().map((n) => ({ ...n, read: true }));
  savePrimatureNotifications(rows);
  return rows;
}
