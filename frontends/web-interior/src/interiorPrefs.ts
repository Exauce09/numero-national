/** Préférences & notifications — Ministère de l'Intérieur. */

export type ThemeMode = "light" | "dark";

export type InteriorPrefs = {
  photoDataUrl?: string;
  theme: ThemeMode;
  passwordOverride?: string;
};

const PREFS_KEY = "nn_interior_prefs";
const NOTIF_KEY = "nn_interior_notifs";

export type InteriorNotification = {
  id: string;
  title: string;
  body: string;
  created_at: string;
  read: boolean;
  href?: string;
};

const DEFAULT_NOTIFS: InteriorNotification[] = [
  {
    id: "i1",
    title: "Mouvements signalés",
    body: "De nouveaux mouvements de population ont été consolidés au niveau provincial.",
    created_at: new Date(Date.now() - 2400_000).toISOString(),
    read: false,
    href: "/mouvements",
  },
  {
    id: "i2",
    title: "Documents manquants",
    body: "Des dossiers citoyens présentent des pièces manquantes à régulariser.",
    created_at: new Date(Date.now() - 5400_000).toISOString(),
    read: false,
    href: "/documents-manquants",
  },
  {
    id: "i3",
    title: "Parcours citoyen",
    body: "Consultez le parcours d'un citoyen (mouvements, déplacements, documents).",
    created_at: new Date(Date.now() - 9000_000).toISOString(),
    read: false,
    href: "/parcours",
  },
];

export function getInteriorPrefs(): InteriorPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) {
      const p = JSON.parse(raw) as InteriorPrefs;
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

export function saveInteriorPrefs(next: InteriorPrefs): void {
  localStorage.setItem(PREFS_KEY, JSON.stringify(next));
  document.documentElement.setAttribute("data-theme", next.theme);
}

export function applyInteriorTheme(theme: ThemeMode): void {
  document.documentElement.setAttribute("data-theme", theme);
}

export function listInteriorNotifications(): InteriorNotification[] {
  try {
    const raw = localStorage.getItem(NOTIF_KEY);
    if (raw) return JSON.parse(raw) as InteriorNotification[];
  } catch {
    /* ignore */
  }
  localStorage.setItem(NOTIF_KEY, JSON.stringify(DEFAULT_NOTIFS));
  return DEFAULT_NOTIFS;
}

export function saveInteriorNotifications(rows: InteriorNotification[]): void {
  localStorage.setItem(NOTIF_KEY, JSON.stringify(rows));
}

export function interiorUnreadCount(): number {
  return listInteriorNotifications().filter((n) => !n.read).length;
}

export function markInteriorNotificationRead(id: string): InteriorNotification[] {
  const rows = listInteriorNotifications().map((n) => (n.id === id ? { ...n, read: true } : n));
  saveInteriorNotifications(rows);
  return rows;
}

export function markAllInteriorNotificationsRead(): InteriorNotification[] {
  const rows = listInteriorNotifications().map((n) => ({ ...n, read: true }));
  saveInteriorNotifications(rows);
  return rows;
}
