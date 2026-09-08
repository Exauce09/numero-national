/** Préférences utilisateur locales (photo, thème, mot de passe démo). */

export type ThemeMode = "light" | "dark";

export type UserPrefs = {
  photoDataUrl?: string;
  theme: ThemeMode;
  passwordOverride?: string;
};

const PREFS_KEY = "nn_civil_officer_prefs";
const NOTIF_KEY = "nn_civil_officer_notifs";

export type AppNotification = {
  id: string;
  title: string;
  body: string;
  created_at: string;
  read: boolean;
  href?: string;
};

const DEFAULT_NOTIFS: AppNotification[] = [
  {
    id: "n1",
    title: "Déclaration en attente",
    body: "Une déclaration de naissance hôpital attend la validation de l'officier pour la commune.",
    created_at: new Date(Date.now() - 3600_000).toISOString(),
    read: false,
    href: "/births",
  },
  {
    id: "n2",
    title: "Acte à contrôler",
    body: "Un acte de décès récemment enregistré nécessite une vérification du lieu d'enregistrement.",
    created_at: new Date(Date.now() - 7200_000).toISOString(),
    read: false,
    href: "/deaths",
  },
  {
    id: "n3",
    title: "Recensement",
    body: "Pensez à finaliser les fiches de recensement en cours avant la clôture de la campagne.",
    created_at: new Date(Date.now() - 86_400_000).toISOString(),
    read: true,
    href: "/census",
  },
];

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
