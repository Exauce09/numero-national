/** Capture d’empreintes ZK9500 — un clic, posez le doigt (pas de choix de doigt). */

import { useEffect, useRef, useState } from "react";
import { biometricApi } from "../api";
import { captureZkFingerprint, zkHealth } from "../zkBridge";

export type PendingFinger = {
  finger_position: string;
  template_b64: string;
  quality_score: number;
  capture_device: string;
};

type Props = {
  pending: PendingFinger[];
  onPendingChange: (next: PendingFinger[]) => void;
  citizenId?: string | null;
  onEnrolled?: () => void;
};

const REQUIRED = 3;

/** Ordre automatique d’enrôlement (API / étiquettes FR). */
const DEFAULT_SEQUENCE = [
  { code: "POUCE_DROIT", label: "Pouce droit" },
  { code: "INDEX_DROIT", label: "Index droit" },
  { code: "MAJEUR_DROIT", label: "Majeur droit" },
  { code: "POUCE_GAUCHE", label: "Pouce gauche" },
  { code: "INDEX_GAUCHE", label: "Index gauche" },
];

export default function FgpFingerprintPanel({
  pending,
  onPendingChange,
  citizenId,
  onEnrolled,
}: Props) {
  const [sequence, setSequence] = useState(DEFAULT_SEQUENCE);
  const [bridgeOk, setBridgeOk] = useState<boolean | null>(null);
  const [bridgeDetail, setBridgeDetail] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [prompt, setPrompt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [enrollmentId, setEnrollmentId] = useState<string | null>(null);
  const [apiCount, setApiCount] = useState(0);
  const abortRef = useRef(false);

  const count = citizenId && enrollmentId ? apiCount : pending.length;
  const nextSlot = sequence[count] ?? sequence[sequence.length - 1];

  useEffect(() => {
    abortRef.current = false;
    void biometricApi
      .fingers()
      .then((d) => {
        if (d.positions?.length) {
          setSequence(
            d.positions.map((p) => ({ code: p.code, label: p.label })).slice(0, 10),
          );
        }
      })
      .catch(() => undefined);
    void refreshBridge();
    const t = window.setInterval(() => void refreshBridge(), 4000);
    return () => {
      abortRef.current = true;
      window.clearInterval(t);
    };
  }, []);

  async function refreshBridge() {
    const h = await zkHealth();
    if (!h) {
      setBridgeOk(false);
      setBridgeDetail("Pont ZK9500 injoignable — lancez scripts/start-zkteco-bridge.ps1");
      return;
    }
    if (!h.sdk_loaded) {
      setBridgeOk(false);
      setBridgeDetail("SDK non chargé — relancez le pont EngX.");
      return;
    }
    if ((h.device_count ?? 0) < 1) {
      setBridgeOk(false);
      setBridgeDetail("Aucun capteur USB — branchez le ZK9500.");
      return;
    }
    setBridgeOk(true);
    setBridgeDetail(
      `Capteur prêt${h.sensor_sn ? ` · SN ${h.sensor_sn}` : ""} · ${h.device_count} lecteur(s)`,
    );
  }

  async function ensureEnrollment(): Promise<string | null> {
    if (!citizenId) return null;
    if (enrollmentId) return enrollmentId;
    const enr = await biometricApi.startEnrollment({ citizen_id: citizenId });
    setEnrollmentId(enr.id);
    return enr.id;
  }

  async function captureOne(
    fingerCode: string,
    currentPending: PendingFinger[],
  ): Promise<{ nextPending: PendingFinger[]; fingerprintsCount: number; done: boolean }> {
    const zk = await captureZkFingerprint(fingerCode, 30000);
    const entry: PendingFinger = {
      finger_position: fingerCode,
      template_b64: zk.template_b64,
      quality_score: zk.quality_score,
      capture_device: zk.device,
    };

    if (citizenId) {
      const eid = await ensureEnrollment();
      if (!eid) throw new Error("Impossible d’ouvrir l’enrôlement.");
      const res = await biometricApi.capture(eid, entry);
      if (res.blocked) {
        throw new Error(res.message || "Correspondance biométrique — revue humaine requise.");
      }
      setApiCount(res.fingerprints_count);
      const nextPending = [...currentPending, entry];
      onPendingChange(nextPending);
      if (res.fingerprints_count >= REQUIRED) {
        await biometricApi.finalize(eid);
        return { nextPending, fingerprintsCount: res.fingerprints_count, done: true };
      }
      return { nextPending, fingerprintsCount: res.fingerprints_count, done: false };
    }

    const nextPending = [...currentPending, entry];
    onPendingChange(nextPending);
    return {
      nextPending,
      fingerprintsCount: nextPending.length,
      done: nextPending.length >= REQUIRED,
    };
  }

  /** Lance le capteur et enchaîne les 3 poses sans choisir le doigt. */
  async function startCapture() {
    setBusy(true);
    setError(null);
    setOkMsg(null);
    abortRef.current = false;

    await refreshBridge();
    const h = await zkHealth();
    if (!h?.sdk_loaded || (h.device_count ?? 0) < 1) {
      setError(
        "Capteur non prêt. Vérifiez le USB et que la fenêtre ZK9500 EngX Bridge est ouverte.",
      );
      setBusy(false);
      return;
    }

    let localPending = [...pending];
    let captured = citizenId && enrollmentId ? apiCount : localPending.length;

    try {
      while (captured < REQUIRED && !abortRef.current) {
        const slot =
          sequence[captured] ?? DEFAULT_SEQUENCE[captured % DEFAULT_SEQUENCE.length];
        setPrompt(
          `Posez le doigt à plat sur le ZK9500 maintenant… (${captured + 1}/${REQUIRED})`,
        );
        const result = await captureOne(slot.code, localPending);
        localPending = result.nextPending;
        captured = result.fingerprintsCount;
        setOkMsg(
          `Empreinte ${captured}/${REQUIRED} OK (qualité ${localPending[localPending.length - 1]?.quality_score ?? "—"}).`,
        );
        if (result.done) {
          setPrompt(null);
          setOkMsg(
            citizenId
              ? "Enrôlement finalisé — 3 empreintes enregistrées."
              : "3 empreintes prêtes — elles seront liées au brouillon à l’enregistrement.",
          );
          onEnrolled?.();
          break;
        }
        setPrompt(
          `Retirez le doigt, puis posez un autre doigt pour la capture ${captured + 1}…`,
        );
        await new Promise((r) => setTimeout(r, 900));
      }
    } catch (e) {
      setPrompt(null);
      setError(e instanceof Error ? e.message : "Capture impossible");
    } finally {
      setBusy(false);
    }
  }

  function clearPending() {
    abortRef.current = true;
    onPendingChange([]);
    setApiCount(0);
    setEnrollmentId(null);
    setOkMsg(null);
    setError(null);
    setPrompt(null);
  }

  return (
    <div className="fgp-bio-panel">
      <h3>6. Empreintes digitales (capteur)</h3>
      <p className="muted small">
        Cliquez sur <strong>Lancer le capteur</strong>, puis posez le doigt à plat 1–2 s.
        Les {REQUIRED} doigts s’enchaînent automatiquement. Aucun NIN n’est attribué ici.
      </p>
      <div className="fgp-bio-status" data-ok={bridgeOk === true ? "1" : "0"}>
        <span>
          {bridgeOk === true
            ? "Capteur détecté"
            : bridgeOk === false
              ? "Capteur non prêt"
              : "Vérification…"}
        </span>
        <span className="muted small">{bridgeDetail}</span>
        <button type="button" className="btn-secondary btn-sm" onClick={() => void refreshBridge()}>
          Rafraîchir
        </button>
      </div>

      <div className="fgp-bio-progress" aria-label="Progression empreintes">
        {[1, 2, 3].map((n) => (
          <span key={n} className={count >= n ? "fgp-bio-dot done" : "fgp-bio-dot"}>
            Doigt {n}
            {count === n - 1 && busy && nextSlot ? ` · ${nextSlot.label}` : ""}
          </span>
        ))}
      </div>

      {prompt ? (
        <p className="fgp-bio-prompt" role="status">
          {prompt}
        </p>
      ) : null}
      {error ? <div className="login-error">{error}</div> : null}
      {okMsg ? <p className="muted">{okMsg}</p> : null}

      {count < REQUIRED ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          <button
            type="button"
            className="btn-primary"
            disabled={busy}
            onClick={() => void startCapture()}
          >
            {busy ? "En cours — posez le doigt…" : "Lancer le capteur"}
          </button>
          {busy ? (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                abortRef.current = true;
                setBusy(false);
                setPrompt(null);
                setError("Capture interrompue.");
              }}
            >
              Arrêter
            </button>
          ) : null}
          {!citizenId && pending.length > 0 && !busy ? (
            <button type="button" className="btn-secondary" onClick={clearPending}>
              Effacer
            </button>
          ) : null}
        </div>
      ) : (
        <p className="success-banner" style={{ marginTop: 8 }}>
          {REQUIRED} empreintes prêtes
          {!citizenId ? " — elles seront liées au brouillon à l’enregistrement." : "."}
        </p>
      )}
    </div>
  );
}

/** Envoie les captures locales après création du citoyen. */
export async function enrollPendingFingers(
  citizenId: string,
  pending: PendingFinger[],
): Promise<string> {
  if (pending.length === 0) return "";
  const enr = await biometricApi.startEnrollment({ citizen_id: citizenId });
  let count = 0;
  for (const p of pending) {
    const res = await biometricApi.capture(enr.id, p);
    if (res.blocked) {
      throw new Error(res.message || "Correspondance biométrique — revue humaine requise.");
    }
    count = res.fingerprints_count;
  }
  if (count >= REQUIRED) {
    await biometricApi.finalize(enr.id);
    return `${count} empreinte(s) enrôlée(s) et finalisées.`;
  }
  return `${count} empreinte(s) enregistrée(s) (finalisation quand ${REQUIRED} doigts).`;
}
