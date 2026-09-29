/** Remise à zéro des données locales (actes, comptes créés, démo, sessions). */

const PREFIXES = ["nn_", "civil-officer:"] as const;

export function resetLocalDevStore(): { removed: number } {
  if (typeof localStorage === "undefined") return { removed: 0 };
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k) continue;
    if (PREFIXES.some((p) => k.startsWith(p))) keys.push(k);
  }
  for (const k of keys) localStorage.removeItem(k);
  try {
    sessionStorage.clear();
  } catch {
    /* ignore */
  }
  return { removed: keys.length };
}

/** Dev : `http://localhost:5180/?reset=1` */
export function applyDevResetFromUrl(): boolean {
  if (!import.meta.env.DEV) return false;
  const params = new URLSearchParams(window.location.search);
  if (params.get("reset") !== "1") return false;
  resetLocalDevStore();
  params.delete("reset");
  const qs = params.toString();
  const next = `${window.location.pathname}${qs ? `?${qs}` : ""}${window.location.hash}`;
  window.history.replaceState({}, "", next);
  return true;
}
