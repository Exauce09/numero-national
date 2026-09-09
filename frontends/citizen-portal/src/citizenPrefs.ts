/** Préférences & notifications portail citoyen. */

export type ThemeMode = "light" | "dark";

export type CitizenPrefs = {
  photoDataUrl?: string;
  theme: ThemeMode;
  passwordOverride?: string;
};

const PREFS_KEY = "nn_citizen_portal_prefs";
const NOTIF_KEY = "nn_citizen_portal_notifs";

export type CitizenNotification = {
  id: string;
  title: string;
  body: string;
  created_at: string;
  read: boolean;
  href?: string;
};

const DEFAULT_NOTIFS: CitizenNotification[] = [
  {
    id: "c1",
    title: "Bienvenue sur le portail citoyen",
    body: "Consultez votre situation, votre carte et complétez vos documents manquants.",
    created_at: new Date(Date.now() - 3600_000).toISOString(),
    read: false,
    href: "/",
  },
  {
    id: "c2",
    title: "Document manquant",
    body: "Votre dossier d'état civil est incomplet : attestation de résidence requise.",
    created_at: new Date(Date.now() - 7200_000).toISOString(),
    read: false,
    href: "/documents",
  },
];

export function getCitizenPrefs(): CitizenPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as CitizenPrefs;
      return {
        theme: parsed.theme === "dark" ? "dark" : "light",
        photoDataUrl: parsed.photoDataUrl,
        passwordOverride: parsed.passwordOverride,
      };
    }
  } catch {
    /* ignore */
  }
  return { theme: "light" };
}

export function saveCitizenPrefs(next: CitizenPrefs): void {
  localStorage.setItem(PREFS_KEY, JSON.stringify(next));
  applyCitizenTheme(next.theme);
}

export function applyCitizenTheme(theme: ThemeMode): void {
  document.documentElement.setAttribute("data-theme", theme);
}

export function listCitizenNotifications(): CitizenNotification[] {
  try {
    const raw = localStorage.getItem(NOTIF_KEY);
    if (raw) return JSON.parse(raw) as CitizenNotification[];
  } catch {
    /* ignore */
  }
  localStorage.setItem(NOTIF_KEY, JSON.stringify(DEFAULT_NOTIFS));
  return DEFAULT_NOTIFS;
}

export function saveCitizenNotifications(rows: CitizenNotification[]): void {
  localStorage.setItem(NOTIF_KEY, JSON.stringify(rows));
}

export function citizenUnreadCount(): number {
  return listCitizenNotifications().filter((n) => !n.read).length;
}

export function markCitizenNotificationRead(id: string): CitizenNotification[] {
  const rows = listCitizenNotifications().map((n) => (n.id === id ? { ...n, read: true } : n));
  saveCitizenNotifications(rows);
  return rows;
}

export function markAllCitizenNotificationsRead(): CitizenNotification[] {
  const rows = listCitizenNotifications().map((n) => ({ ...n, read: true }));
  saveCitizenNotifications(rows);
  return rows;
}

export function pushCitizenNotification(input: {
  title: string;
  body: string;
  href?: string;
}): CitizenNotification {
  const row: CitizenNotification = {
    id: crypto.randomUUID(),
    title: input.title,
    body: input.body,
    created_at: new Date().toISOString(),
    read: false,
    href: input.href,
  };
  const rows = [row, ...listCitizenNotifications()].slice(0, 50);
  saveCitizenNotifications(rows);
  return row;
}
