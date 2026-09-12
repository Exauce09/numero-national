import { api } from "./api";
import { ensureAccessToken } from "./auth";

export type CapturedFinger = {
  position: "POUCE_DROIT" | "INDEX_DROIT" | "INDEX_GAUCHE";
  template_b64: string;
  quality_score: number;
  device: string;
};

/** Envoie les templates ZK9500 dans le coffre biométrique (recherche 1:N). */
export async function enrollCapturedFingers(
  citizenId: string,
  fingers: CapturedFinger[],
): Promise<{ ok: boolean; message: string; count: number }> {
  if (!citizenId || fingers.length === 0) {
    return { ok: false, message: "Pas de citoyen ou d'empreintes à enrôler.", count: 0 };
  }
  await ensureAccessToken();
  try {
    const enrollment = await api.biometricStartEnrollment({
      citizen_id: citizenId,
      device_id: fingers[0]?.device || "ZK9500",
    });
    let count = 0;
    for (const f of fingers) {
      const res = await api.biometricCapture(enrollment.id, {
        finger_position: f.position,
        template_b64: f.template_b64,
        quality_score: f.quality_score,
        capture_device: f.device,
      });
      if (res.blocked) {
        return {
          ok: false,
          message: res.message || "Empreinte bloquée (possible doublon biométrique).",
          count,
        };
      }
      if (res.accepted) count = res.fingerprints_count;
    }
    return {
      ok: count >= 1,
      message:
        count >= 3
          ? `3 empreintes enrôlées — la recherche par doigt fonctionne pour ce citoyen.`
          : `${count} empreinte(s) enrôlée(s).`,
      count,
    };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return { ok: false, message: `Enrôlement biométrique : ${detail.slice(0, 160)}`, count: 0 };
  }
}
