/** Enrôlement biométrique — capture ZK9500 réelle (pont local EngX). */

import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { getSession } from "../auth";

import { captureZkFingerprint } from "../zkBridge";

async function captureZk(finger: string) {
  return captureZkFingerprint(finger, 30000);
}

export default function BiometricEnrollPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const citizenId = params.get("citizen") || "";
  const hasApi = Boolean(getSession()?.accessToken);

  const [fingers, setFingers] = useState<Array<{ code: string; label: string }>>([]);
  const [enrollmentId, setEnrollmentId] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [finger, setFinger] = useState("");
  const [usedFingers, setUsedFingers] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bridgeNote, setBridgeNote] = useState<string | null>(null);
  const [block, setBlock] = useState<{
    message: string;
    matchedCitizenId?: string;
    score?: number;
    fingerLabel?: string;
    matchId?: string;
  } | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [count, setCount] = useState(0);
  const required = 3;

  useEffect(() => {
    if (!hasApi) return;
    void api.biometricFingers().then((d) => setFingers(d.positions)).catch(() => null);
  }, [hasApi]);

  const available = useMemo(
    () => fingers.filter((f) => !usedFingers.includes(f.code)),
    [fingers, usedFingers],
  );

  async function start() {
    if (!citizenId) {
      setError("Identifiant population (citoyen) manquant. Ouvrez depuis la fiche population.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const enr = await api.biometricStartEnrollment({ citizen_id: citizenId });
      setEnrollmentId(enr.id);
      setStep(1);
      setOkMsg("Enrôlement ouvert — capturez 3 doigts sur le ZK9500.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossible de démarrer l'enrôlement");
    } finally {
      setBusy(false);
    }
  }

  async function capture() {
    if (!enrollmentId || !finger) {
      setError("Sélectionnez un doigt.");
      return;
    }
    setBusy(true);
    setError(null);
    setBlock(null);
    setOkMsg(null);
    setBridgeNote("Posez le doigt sur le ZK9500 maintenant…");
    try {
      const zk = await captureZk(finger);
      setBridgeNote(`${zk.device} — ${zk.note || "Capture OK"}`);
      const res = await api.biometricCapture(enrollmentId, {
        finger_position: finger,
        template_b64: zk.template_b64,
        quality_score: zk.quality_score,
        capture_device: zk.device,
      });
      setCount(res.fingerprints_count);
      if (res.blocked && res.match) {
        setBlock({
          message: res.message,
          matchedCitizenId: res.match.matched_citizen_id,
          score: res.match.match_score,
          fingerLabel: res.match.matched_finger_label || res.match.finger_position || undefined,
          matchId: res.match.id,
        });
        return;
      }
      setUsedFingers((u) => [...u, finger]);
      setFinger("");
      setOkMsg(res.message);
      if (res.fingerprints_count >= required) {
        await api.biometricFinalize(enrollmentId);
        setOkMsg("Enrôlement finalisé — 3 empreintes ZK9500 enregistrées.");
        setStep(4);
      } else {
        setStep(res.fingerprints_count + 1);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Capture impossible");
    } finally {
      setBusy(false);
    }
  }

  if (!hasApi) {
    return (
      <div className="panel">
        <h2 className="page-title">Enrôlement biométrique</h2>
        <p className="muted">Connexion API requise.</p>
      </div>
    );
  }

  return (
    <div>
      <p className="eg-breadcrumb">
        <Link to="/">Accueil</Link> / Biométrie / Enrôlement
      </p>
      <h2 className="page-title">Enrôlement biométrique</h2>
      <p className="page-lead">
        Dossier : <code>{citizenId || "—"}</code>
        {citizenId ? (
          <>
            {" "}
            · <Link to={`/population/${citizenId}`}>Ouvrir la fiche</Link>
          </>
        ) : null}
      </p>
      <div className="dash-demo-banner" role="note">
        Capture réelle ZK9500 (pont EngX). Posez le doigt quand demandé — pas de mode démo.
      </div>

      <div className="panel" style={{ marginBottom: "1rem" }}>
        <div className="dash-quick" aria-label="Progression">
          {[1, 2, 3].map((n) => (
            <span
              key={n}
              className="status-badge"
              style={{
                background: count >= n || step > n ? "#0aad8a" : step === n ? "#0b3d91" : "#e6ebf2",
                color: count >= n || step >= n ? "#fff" : "#5b6b7c",
              }}
            >
              Empreinte {n}
            </span>
          ))}
        </div>
      </div>

      {error ? (
        <div className="login-error" role="alert">
          {error}
        </div>
      ) : null}
      {okMsg ? <p className="muted">{okMsg}</p> : null}
      {bridgeNote ? <p className="muted">{bridgeNote}</p> : null}

      {block ? (
        <div className="panel" style={{ borderColor: "#ce1126" }} role="alert">
          <h3 className="panel-title">Correspondance biométrique détectée</h3>
          <p>{block.message}</p>
          <dl className="act-print-fields">
            <div>
              <dt>Population</dt>
              <dd>
                <code>{block.matchedCitizenId}</code>
              </dd>
            </div>
            <div>
              <dt>Empreinte correspondante</dt>
              <dd>{block.fingerLabel || "—"}</dd>
            </div>
            <div>
              <dt>Score</dt>
              <dd>{block.score != null ? `${(block.score * 100).toFixed(1)} %` : "—"}</dd>
            </div>
          </dl>
          <div className="action-row">
            {block.matchedCitizenId ? (
              <Link className="btn-primary" to={`/population/${block.matchedCitizenId}`}>
                Consulter le dossier
              </Link>
            ) : null}
            <button type="button" className="btn-secondary" onClick={() => navigate("/population")}>
              Annuler
            </button>
          </div>
        </div>
      ) : null}

      {!enrollmentId && !block ? (
        <div className="panel">
          <p>Démarrez l&apos;enrôlement pour capturer 3 doigts différents sur le ZK9500.</p>
          <button type="button" className="btn-primary" disabled={busy || !citizenId} onClick={() => void start()}>
            {busy ? "…" : "Démarrer l'enrôlement"}
          </button>
        </div>
      ) : null}

      {enrollmentId && !block && step <= 3 ? (
        <div className="panel">
          <h3 className="panel-title">
            Empreinte {Math.min(count + 1, 3)} / {required}
          </h3>
          <label className="form-label">Doigt</label>
          <select
            className="form-control"
            value={finger}
            onChange={(e) => setFinger(e.target.value)}
          >
            <option value="">Sélectionner…</option>
            {available.map((f) => (
              <option key={f.code} value={f.code}>
                {f.label}
              </option>
            ))}
          </select>
          <div className="action-row" style={{ marginTop: "1rem" }}>
            <button type="button" className="btn-primary" disabled={busy || !finger} onClick={() => void capture()}>
              {busy ? "Capture en cours — posez le doigt…" : "Capturer ZK9500"}
            </button>
          </div>
        </div>
      ) : null}

      {step >= 4 ? (
        <div className="panel">
          <p>Enrôlement terminé.</p>
          <Link className="btn-primary" to={`/population/${citizenId}`}>
            Retour fiche
          </Link>
        </div>
      ) : null}
    </div>
  );
}
