/** Pont local ZK9500 (EngX) — http://127.0.0.1:18765
 *
 * Aligné sur le flux « examen biométrie / frontière » :
 * - 3 doigts distincts à l’enrôlement
 * - doigt à plat 1–2 s sur le capteur
 * - template réel (pas de mode démo)
 */

export const ZK_BRIDGE = "http://127.0.0.1:18765";

export type ZkCapture = {
  template_b64: string;
  quality_score: number;
  device: string;
  note?: string;
};

export async function zkHealth(): Promise<{
  sdk_loaded?: boolean;
  sensor_sn?: string;
  device_count?: number;
} | null> {
  try {
    return (await fetch(`${ZK_BRIDGE}/health`).then((r) => r.json())) as {
      sdk_loaded?: boolean;
      sensor_sn?: string;
      device_count?: number;
    };
  } catch {
    return null;
  }
}

export async function captureZkFingerprint(
  fingerPosition = "POUCE_DROIT",
  timeoutMs = 30000,
): Promise<ZkCapture> {
  const health = await zkHealth();
  if (!health?.sdk_loaded) {
    throw new Error(
      "Pont ZK9500 indisponible. Lancez scripts/start-zkteco-bridge.ps1 (USB branché). Posez le doigt à plat 1–2 secondes.",
    );
  }
  if (health.device_count === 0) {
    throw new Error(
      "Aucun lecteur ZK9500 détecté — branchez le capteur USB puis relancez le pont.",
    );
  }
  const res = await fetch(`${ZK_BRIDGE}/capture`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ finger_position: fingerPosition, timeout_ms: timeoutMs }),
  });
  const body = (await res.json().catch(() => ({}))) as {
    template_b64?: string;
    quality_score?: number;
    device?: string;
    note?: string;
    detail?: string;
    demo?: boolean;
    ok?: boolean;
  };
  if (!res.ok || body.ok === false) {
    const detail = body.detail || `Capture ZK ${res.status}`;
    if (/aucune empreinte|timeout|doigt/i.test(detail)) {
      throw new Error(
        "Aucun doigt détecté. Placez le doigt à plat 1–2 secondes sur le ZK9500 puis relancez.",
      );
    }
    throw new Error(detail);
  }
  if (body.demo) throw new Error("Mode DEMO refusé — utilisez le pont EngX réel (ZK9500).");
  if (!body.template_b64) {
    throw new Error("Template vide — reposez le même doigt fermement sur le ZK9500.");
  }
  const quality = body.quality_score ?? 80;
  if (quality > 0 && quality < 40) {
    throw new Error(
      `Qualité trop faible (${quality}). Nettoyez le capteur, posez le doigt à plat et recommencez.`,
    );
  }
  return {
    template_b64: body.template_b64,
    quality_score: quality,
    device: body.device || "ZK9500",
    note: body.note || "Empreinte capturée via ZKTeco ZK9500",
  };
}

/** Code compact affiché dans le formulaire après capture réelle. */
export function fingerprintDisplayCode(cap: ZkCapture, slot: 1 | 2 | 3): string {
  const short = cap.template_b64.replace(/[^a-zA-Z0-9]/g, "").slice(0, 10).toUpperCase();
  return `ZK${slot}-${short}-Q${cap.quality_score}`;
}

/** Détection grossière de doublon (même doigt scanné deux fois). */
export function templatesLookSame(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  const na = a.replace(/[^a-zA-Z0-9]/g, "").slice(0, 48);
  const nb = b.replace(/[^a-zA-Z0-9]/g, "").slice(0, 48);
  return na.length >= 16 && na === nb;
}
