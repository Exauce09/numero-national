/** Identification biométrique 1:N — capture ZK9500 réelle uniquement. */

import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { getSession } from "../auth";

const ZK_BRIDGE = "http://127.0.0.1:18765";

export default function BiometricIdentifyPage() {
  const hasApi = Boolean(getSession()?.accessToken);
  const [finger, setFinger] = useState("INDEX_DROIT");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bridgeNote, setBridgeNote] = useState<string | null>(null);
  const [result, setResult] = useState<{
    decision: string;
    candidates: Array<{
      citizen_id: string;
      score: number;
      finger_position?: string | null;
      finger_label?: string | null;
    }>;
  } | null>(null);

  async function runZkteco() {
    setBusy(true);
    setError(null);
    setResult(null);
    setBridgeNote(null);
    try {
      const health = await fetch(`${ZK_BRIDGE}/health`).then((r) => r.json()).catch(() => null);
      if (!health) {
        throw new Error(
          "Pont ZK9500 indisponible. Lancez scripts\\start-zkteco-bridge.ps1 (USB branché).",
        );
      }
      if (health.demo || !health.sdk_loaded) {
        throw new Error("Pont ZK non prêt (sdk_loaded=false). Relancez le bridge EngX.");
      }
      setBridgeNote(
        `ZK9500 SN ${health.sensor_sn || "?"} — posez le doigt maintenant…`,
      );
      const cap = await fetch(`${ZK_BRIDGE}/capture`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ finger_position: finger, timeout_ms: 30000 }),
      }).then(async (r) => {
        const body = (await r.json().catch(() => ({}))) as {
          template_b64?: string;
          note?: string;
          demo?: boolean;
          device?: string;
          detail?: string;
        };
        if (!r.ok) throw new Error(body.detail || `Capture ZK ${r.status}`);
        if (body.demo) throw new Error("Mode DEMO refusé");
        if (!body.template_b64) throw new Error("Template vide");
        return body as { template_b64: string; note?: string; device?: string };
      });
      setBridgeNote(`${cap.device || "ZK9500"} (RÉEL) — ${cap.note || "Capture OK"} — recherche 1:N…`);
      const res = await api.biometricIdentify({
        modality: "FINGERPRINT",
        template_b64: cap.template_b64,
        max_candidates: 5,
      });
      setResult({ decision: res.decision, candidates: res.candidates });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Capture / recherche impossible");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <p className="eg-breadcrumb">
        <Link to="/">Accueil</Link> / Biométrie / Identification
      </p>
      <h2 className="page-title">Identification biométrique 1:N</h2>
      <p className="page-lead">
        Recherche dans la population à partir d&apos;une empreinte capturée sur le ZK9500
        (même lecteur que pour l&apos;enrôlement).
      </p>
      <div className="dash-demo-banner">
        Lancez le pont EngX, posez le doigt, puis « Capturer ZK9500 + rechercher ».
      </div>

      {!hasApi ? (
        <p className="muted">Connexion API requise (permission biometric:match).</p>
      ) : (
        <div className="panel">
          <label className="form-label">Doigt (libellé)</label>
          <select className="form-control" value={finger} onChange={(e) => setFinger(e.target.value)}>
            <option value="INDEX_DROIT">Index droit</option>
            <option value="POUCE_DROIT">Pouce droit</option>
            <option value="INDEX_GAUCHE">Index gauche</option>
          </select>
          <div className="action-row" style={{ marginTop: "1rem" }}>
            <button type="button" className="btn-primary" disabled={busy} onClick={() => void runZkteco()}>
              {busy ? "Capture / recherche…" : "Capturer ZK9500 + rechercher"}
            </button>
          </div>
          {bridgeNote ? <p className="muted">{bridgeNote}</p> : null}
          {error ? (
            <div className="login-error" role="alert">
              {error}
            </div>
          ) : null}
          {result ? (
            <div style={{ marginTop: "1rem" }}>
              <p>
                Décision : <strong>{result.decision}</strong>
              </p>
              {result.candidates.length === 0 ? (
                <p className="muted">Aucun candidat.</p>
              ) : (
                <ul>
                  {result.candidates.map((c, idx) => (
                    <li key={`${c.citizen_id}-${idx}`}>
                      <Link to={`/population/${c.citizen_id}`}>{c.citizen_id}</Link>
                      {" — "}
                      {c.finger_label || c.finger_position || "doigt"} — score{" "}
                      {(c.score * 100).toFixed(1)} %
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
