/** Pont local ZK9500 (EngX) — http://127.0.0.1:18765 */

export const ZK_BRIDGE = "http://127.0.0.1:18765";

export type ZkCapture = {
  template_b64: string;
  quality_score: number;
  device: string;
  note?: string;
};

export async function zkHealth(): Promise<{ sdk_loaded?: boolean; sensor_sn?: string } | null> {
  try {
    return (await fetch(`${ZK_BRIDGE}/health`).then((r) => r.json())) as {
      sdk_loaded?: boolean;
      sensor_sn?: string;
    };
  } catch {
    return null;
  }
}

export async function captureZkFingerprint(
  fingerPosition = "RIGHT_THUMB",
  timeoutMs = 30000,
): Promise<ZkCapture> {
  const health = await zkHealth();
  if (!health?.sdk_loaded) {
    throw new Error(
      "Pont ZK9500 indisponible. Lancez scripts/start-zkteco-bridge.ps1 (lecteur USB branché).",
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
  };
  if (!res.ok) throw new Error(body.detail || `Capture ZK ${res.status}`);
  if (body.demo) throw new Error("Mode DEMO refusé — utilisez le pont EngX réel (ZK9500).");
  if (!body.template_b64) throw new Error("Template vide — reposez le doigt sur le ZK9500.");
  return {
    template_b64: body.template_b64,
    quality_score: body.quality_score ?? 80,
    device: body.device || "ZK9500",
    note: body.note,
  };
}

/** Code compact affiché dans le formulaire après capture réelle. */
export function fingerprintDisplayCode(cap: ZkCapture, slot: 1 | 2 | 3): string {
  const short = cap.template_b64.replace(/[^a-zA-Z0-9]/g, "").slice(0, 10).toUpperCase();
  return `ZK${slot}-${short}-Q${cap.quality_score}`;
}
