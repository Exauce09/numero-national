/** Préférences & notifications — Ministère de la Santé. */

export type ThemeMode = "light" | "dark";

export type SantePrefs = {
  photoDataUrl?: string;
  theme: ThemeMode;
  passwordOverride?: string;
};

const PREFS_KEY = "nn_gov_sante_prefs";
const NOTIF_KEY = "nn_gov_sante_notifs";

export type SanteNotification = {
  id: string;
  title: string;
  body: string;
  created_at: string;
  read: boolean;
  href?: string;
};

function defaultNotifs(): SanteNotification[] {
  return [
    {
      id: "s1",
      title: "Surveillance nationale",
      body: "Consultez le tableau de bord et le synoptique pour les naissances et décès déclarés par les structures.",
      created_at: new Date(Date.now() - 3600_000).toISOString(),
      read: false,
      href: "/sante",
    },
    {
      id: "s2",
      title: "Structures sanitaires",
      body: "La liste des établissements se met à jour selon les comptes créés par l'état civil.",
      created_at: new Date(Date.now() - 7200_000).toISOString(),
      read: false,
      href: "/sante/structures",
    },
  ];
}

export function getSantePrefs(): SantePrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as SantePrefs;
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

export function saveSantePrefs(next: SantePrefs): void {
  localStorage.setItem(PREFS_KEY, JSON.stringify(next));
  applySanteTheme(next.theme);
}

export function applySanteTheme(theme: ThemeMode): void {
  document.documentElement.setAttribute("data-theme", theme);
}

export function listSanteNotifications(): SanteNotification[] {
  try {
    const raw = localStorage.getItem(NOTIF_KEY);
    if (raw) return JSON.parse(raw) as SanteNotification[];
  } catch {
    /* ignore */
  }
  const rows = defaultNotifs();
  localStorage.setItem(NOTIF_KEY, JSON.stringify(rows));
  return rows;
}

export function saveSanteNotifications(rows: SanteNotification[]): void {
  localStorage.setItem(NOTIF_KEY, JSON.stringify(rows));
}

export function santeUnreadCount(): number {
  return listSanteNotifications().filter((n) => !n.read).length;
}

export function markSanteNotificationRead(id: string): SanteNotification[] {
  const rows = listSanteNotifications().map((n) => (n.id === id ? { ...n, read: true } : n));
  saveSanteNotifications(rows);
  return rows;
}

export function markAllSanteNotificationsRead(): SanteNotification[] {
  const rows = listSanteNotifications().map((n) => ({ ...n, read: true }));
  saveSanteNotifications(rows);
  return rows;
}

export function pushSanteNotification(input: {
  title: string;
  body: string;
  href?: string;
}): SanteNotification {
  const row: SanteNotification = {
    id: crypto.randomUUID(),
    title: input.title,
    body: input.body,
    created_at: new Date().toISOString(),
    read: false,
    href: input.href,
  };
  saveSanteNotifications([row, ...listSanteNotifications()].slice(0, 50));
  return row;
}
