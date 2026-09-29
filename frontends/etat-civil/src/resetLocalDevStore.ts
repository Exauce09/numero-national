/** Remise à zéro des données locales (actes, comptes créés, démo, sessions). */

export const FRESH_INSTALL_FLAG = "nn_fresh_install_v1";

export function isFreshInstallMode(): boolean {
  return localStorage.getItem(FRESH_INSTALL_FLAG) === "1";
}

export function markFreshInstallMode(): void {
  localStorage.setItem(FRESH_INSTALL_FLAG, "1");
}

export function clearFreshInstallMode(): void {
  localStorage.removeItem(FRESH_INSTALL_FLAG);
}

export async function hardResetBrowserStorage(): Promise<{
  localKeys: number;
  cacheStores: number;
}> {
  const localKeys = typeof localStorage !== "undefined" ? localStorage.length : 0;
  if (typeof localStorage !== "undefined") localStorage.clear();
  try {
    sessionStorage.clear();
  } catch {
    /* ignore */
  }
  markFreshInstallMode();

  let cacheStores = 0;
  if (typeof caches !== "undefined") {
    try {
      const names = await caches.keys();
      cacheStores = names.length;
      await Promise.all(names.map((n) => caches.delete(n)));
    } catch {
      /* ignore */
    }
  }
  if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    } catch {
      /* ignore */
    }
  }
  return { localKeys, cacheStores };
}

/** @deprecated Préférer hardResetBrowserStorage — conserve pour ?reset=1 */
export function resetLocalDevStore(): { removed: number } {
  const n = typeof localStorage !== "undefined" ? localStorage.length : 0;
  void hardResetBrowserStorage();
  return { removed: n };
}

/** Dev : `http://localhost:5180/?reset=1` */
export function applyDevResetFromUrl(): boolean {
  if (!import.meta.env.DEV) return false;
  const params = new URLSearchParams(window.location.search);
  if (params.get("reset") !== "1") return false;
  void hardResetBrowserStorage();
  params.delete("reset");
  const qs = params.toString();
  const next = `${window.location.pathname}${qs ? `?${qs}` : ""}${window.location.hash}`;
  window.history.replaceState({}, "", next);
  return true;
}
