/** Identification biométrique 1:N — capture ZK9500 réelle uniquement. */

import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { ensureAccessToken, getSession } from "../auth";
import { captureZkFingerprint, zkHealth } from "../zkBridge";

const FINGER_OPTIONS = [
  { code: "POUCE_DROIT", label: "Pouce droit" },
  { code: "INDEX_DROIT", label: "Index droit" },
  { code: "INDEX_GAUCHE", label: "Index gauche" },
  { code: "POUCE_GAUCHE", label: "Pouce gauche" },
] as const;

export default function BiometricIdentifyPage() {
  const hasApi = Boolean(getSession()?.accessToken);
  const [finger, setFinger] = useState<string>("INDEX_DROIT");
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
      await ensureAccessToken();
      if (!getSession()?.accessToken) {
        throw new Error("Session API requise — reconnectez-vous (officier / DemoCivil2026!).");
      }
      const health = await zkHealth();
      if (!health?.sdk_loaded) {
        throw new Error(
          "Pont ZK9500 indisponible. Lancez scripts\\start-zkteco-bridge.ps1 (USB branché).",
        );
      }
      setBridgeNote(`ZK9500 SN ${health.sensor_sn || "?"} — posez le doigt maintenant…`);
      const cap = await captureZkFingerprint(finger, 30000);
      setBridgeNote(`${cap.device} — qualité ${cap.quality_score} — recherche 1:N…`);
      const res = await api.biometricIdentify({
        modality: "FINGERPRINT",
        template_b64: cap.template_b64,
        max_candidates: 5,
      });
      setResult({ decision: res.decision, candidates: res.candidates });
      if (!res.candidates?.length) {
        setBridgeNote(
          "Aucune correspondance. La personne doit avoir été recensée avec capture ZK9500 (templates enrôlés).",
        );
      }
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
        Recherche dans la population à partir d&apos;une empreinte capturée sur le ZK9500.
        Fonctionne pour les personnes dont les empreintes ont été enrôlées (recensement ou
        Biométrie → Enrôlement).
      </p>
      <div className="panel">
        {!hasApi ? (
          <p className="login-error">Connectez-vous pour interroger le coffre biométrique.</p>
        ) : (
          <>
            <div className="form-grid">
              <div>
                <label className="form-label">Doigt à capturer</label>
                <select
                  className="form-control"
                  value={finger}
                  onChange={(e) => setFinger(e.target.value)}
                >
                  {FINGER_OPTIONS.map((f) => (
                    <option key={f.code} value={f.code}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <button
              type="button"
              className="btn-primary"
              style={{ width: "auto", minWidth: 220, marginTop: 12 }}
              disabled={busy}
              onClick={() => void runZkteco()}
            >
              {busy ? "Capture / recherche…" : "Capturer ZK9500 + rechercher"}
            </button>
            {bridgeNote ? <p className="muted">{bridgeNote}</p> : null}
            {error ? <div className="login-error">{error}</div> : null}
            {result ? (
              <div style={{ marginTop: 16 }}>
                <p>
                  Décision : <strong>{result.decision}</strong>
                </p>
                {result.candidates.length === 0 ? (
                  <p className="muted">Aucun candidat.</p>
                ) : (
                  <ul>
                    {result.candidates.map((c) => (
                      <li key={`${c.citizen_id}-${c.score}`}>
                        <Link to={`/person/${c.citizen_id}`}>Citoyen {c.citizen_id.slice(0, 8)}…</Link>{" "}
                        — score {(c.score * 100).toFixed(1)}%
                        {c.finger_label ? ` · ${c.finger_label}` : ""}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
