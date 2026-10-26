/** Capture d’empreintes ZK9500 sur fiche FGP (pont local EngX). */

import { useEffect, useMemo, useState } from "react";
import { biometricApi } from "../api";
import { captureZkFingerprint, zkHealth } from "../zkBridge";

export type PendingFinger = {
  finger_position: string;
  template_b64: string;
  quality_score: number;
  capture_device: string;
};

type Props = {
  /** Captures locales avant création du dossier. */
  pending: PendingFinger[];
  onPendingChange: (next: PendingFinger[]) => void;
  /** Si dossier déjà créé : enrôlement API direct. */
  citizenId?: string | null;
  onEnrolled?: () => void;
};

const REQUIRED = 3;

export default function FgpFingerprintPanel({
  pending,
  onPendingChange,
  citizenId,
  onEnrolled,
}: Props) {
  const [fingers, setFingers] = useState<Array<{ code: string; label: string }>>([]);
  const [finger, setFinger] = useState("");
  const [bridgeOk, setBridgeOk] = useState<boolean | null>(null);
  const [bridgeDetail, setBridgeDetail] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [enrollmentId, setEnrollmentId] = useState<string | null>(null);
  const [apiCount, setApiCount] = useState(0);

  useEffect(() => {
    void biometricApi.fingers().then((d) => setFingers(d.positions)).catch(() => {
      setFingers([
        { code: "RIGHT_THUMB", label: "Pouce droit" },
        { code: "LEFT_THUMB", label: "Pouce gauche" },
        { code: "RIGHT_INDEX", label: "Index droit" },
        { code: "LEFT_INDEX", label: "Index gauche" },
      ]);
    });
    void refreshBridge();
  }, []);

  async function refreshBridge() {
    const h = await zkHealth();
    if (!h) {
      setBridgeOk(false);
      setBridgeDetail("Pont ZK9500 injoignable (scripts/start-zkteco-bridge.ps1).");
      return;
    }
    if (!h.sdk_loaded) {
      setBridgeOk(false);
      setBridgeDetail("SDK non chargé — relancez le pont EngX.");
      return;
    }
    if ((h.device_count ?? 0) < 1) {
      setBridgeOk(false);
      setBridgeDetail("Aucun capteur USB détecté — branchez le ZK9500.");
      return;
    }
    setBridgeOk(true);
    setBridgeDetail(
      `Capteur prêt${h.sensor_sn ? ` · SN ${h.sensor_sn}` : ""} · ${h.device_count} lecteur(s)`,
    );
  }

  const used = useMemo(() => {
    if (citizenId && enrollmentId) {
      return pending.map((p) => p.finger_position);
    }
    return pending.map((p) => p.finger_position);
  }, [pending, citizenId, enrollmentId]);

  const available = fingers.filter((f) => !used.includes(f.code));
  const count = citizenId && enrollmentId ? apiCount : pending.length;

  async function ensureEnrollment(): Promise<string | null> {
    if (!citizenId) return null;
    if (enrollmentId) return enrollmentId;
    const enr = await biometricApi.startEnrollment({ citizen_id: citizenId });
    setEnrollmentId(enr.id);
    return enr.id;
  }

  async function capture() {
    if (!finger) {
      setError("Sélectionnez un doigt.");
      return;
    }
    setBusy(true);
    setError(null);
    setOkMsg(null);
    try {
      const zk = await captureZkFingerprint(finger, 30000);
      const entry: PendingFinger = {
        finger_position: finger,
        template_b64: zk.template_b64,
        quality_score: zk.quality_score,
        capture_device: zk.device,
      };

      if (citizenId) {
        const eid = await ensureEnrollment();
        if (!eid) throw new Error("Impossible d’ouvrir l’enrôlement.");
        const res = await biometricApi.capture(eid, entry);
        if (res.blocked) {
          setError(res.message || "Correspondance biométrique — revue humaine requise.");
          return;
        }
        setApiCount(res.fingerprints_count);
        onPendingChange([...pending, entry]);
        setFinger("");
        setOkMsg(res.message);
        if (res.fingerprints_count >= REQUIRED) {
          await biometricApi.finalize(eid);
          setOkMsg("Enrôlement finalisé — 3 empreintes enregistrées.");
          onEnrolled?.();
        }
      } else {
        onPendingChange([...pending, entry]);
        setFinger("");
        setOkMsg(
          `Empreinte ${pending.length + 1}/${REQUIRED} capturée (qualité ${zk.quality_score}). ` +
            "Elle sera enregistrée à la création du brouillon.",
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Capture impossible");
    } finally {
      setBusy(false);
    }
  }

  function clearPending() {
    onPendingChange([]);
    setOkMsg(null);
    setError(null);
  }

  return (
    <div className="fgp-bio-panel">
      <h3>6. Empreintes digitales (capteur)</h3>
      <p className="muted small">
        Lecteur ZK9500 branché via le pont local. Posez le doigt à plat 1–2 s.{" "}
        {REQUIRED} doigts distincts recommandés. Aucun NIN n’est attribué ici.
      </p>
      <div className="fgp-bio-status" data-ok={bridgeOk === true ? "1" : "0"}>
        <span>{bridgeOk === true ? "Capteur détecté" : bridgeOk === false ? "Capteur non prêt" : "Vérification…"}</span>
        <span className="muted small">{bridgeDetail}</span>
        <button type="button" className="btn-secondary btn-sm" onClick={() => void refreshBridge()}>
          Rafraîchir
        </button>
      </div>

      <div className="fgp-bio-progress" aria-label="Progression empreintes">
        {[1, 2, 3].map((n) => (
          <span key={n} className={count >= n ? "fgp-bio-dot done" : "fgp-bio-dot"}>
            Doigt {n}
          </span>
        ))}
      </div>

      {error ? <div className="login-error">{error}</div> : null}
      {okMsg ? <p className="muted">{okMsg}</p> : null}

      {count < REQUIRED ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12 }}>
          <label>
            Doigt
            <select className="form-control" value={finger} onChange={(e) => setFinger(e.target.value)}>
              <option value="">— Sélectionner —</option>
              {available.map((f) => (
                <option key={f.code} value={f.code}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
            <button
              type="button"
              className="btn-primary"
              disabled={busy || !finger || bridgeOk === false}
              onClick={() => void capture()}
            >
              {busy ? "Capture…" : "Capturer sur le capteur"}
            </button>
            {!citizenId && pending.length > 0 ? (
              <button type="button" className="btn-secondary" onClick={clearPending}>
                Effacer
              </button>
            ) : null}
          </div>
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
