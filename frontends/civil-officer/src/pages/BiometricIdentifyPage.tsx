/** Identification biométrique 1:N — DEMO local ou capture ZK9500 (pont local). */

import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { getSession } from "../auth";

const ZK_BRIDGE = "http://127.0.0.1:18765";

function b64FromText(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary);
}

export default function BiometricIdentifyPage() {
  const hasApi = Boolean(getSession()?.accessToken);
  const [sampleKey, setSampleKey] = useState("demo-print-A");
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

  async function identifyWithTemplate(template_b64: string) {
    const res = await api.biometricIdentify({
      modality: "FINGERPRINT",
      template_b64,
      max_candidates: 5,
    });
    setResult({ decision: res.decision, candidates: res.candidates });
  }

  async function runDemo() {
    setBusy(true);
    setError(null);
    setResult(null);
    setBridgeNote(null);
    try {
      const template_b64 = b64FromText(`FINGERPRINT|${sampleKey}|${finger}|v1`);
      await identifyWithTemplate(template_b64);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Recherche impossible");
    } finally {
      setBusy(false);
    }
  }

  async function runZkteco() {
    setBusy(true);
    setError(null);
    setResult(null);
    setBridgeNote(null);
    try {
      const health = await fetch(`${ZK_BRIDGE}/health`).then((r) => r.json()).catch(() => null);
      if (!health) {
        throw new Error(
          "Pont ZK9500 indisponible. Sur ce PC : py -3 scripts/zkteco_bridge.py (USB branché).",
        );
      }
      const cap = await fetch(`${ZK_BRIDGE}/capture`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ finger_position: finger }),
      }).then(async (r) => {
        if (!r.ok) throw new Error(`Capture ZK ${r.status}`);
        return r.json() as Promise<{
          template_b64: string;
          note?: string;
          demo?: boolean;
          device?: string;
        }>;
      });
      setBridgeNote(
        `${cap.device || "ZK9500"}${cap.demo ? " (DEMO)" : ""} — ${cap.note || "Capture OK"}`,
      );
      await identifyWithTemplate(cap.template_b64);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Capture ZK impossible");
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
        Recherche population. Morpho (tablette) et ZKTeco (USB) exigent un ABIS pour le
        cross-matching constructeur. Une correspondance n&apos;est pas une preuve juridique.
      </p>
      <div className="dash-demo-banner">
        ZK9500 détecté côté PC → lancez le pont local, puis « Capturer ZK9500 ».
      </div>

      {!hasApi ? (
        <p className="muted">Connexion API requise (permission biometric:match).</p>
      ) : (
        <div className="panel">
          <label className="form-label">Doigt</label>
          <select className="form-control" value={finger} onChange={(e) => setFinger(e.target.value)}>
            <option value="INDEX_DROIT">Index droit</option>
            <option value="POUCE_DROIT">Pouce droit</option>
            <option value="INDEX_GAUCHE">Index gauche</option>
          </select>
          <div className="action-row" style={{ marginTop: "1rem" }}>
            <button type="button" className="btn-primary" disabled={busy} onClick={() => void runZkteco()}>
              {busy ? "…" : "Capturer ZK9500 + rechercher"}
            </button>
          </div>
          <hr style={{ margin: "1.25rem 0", borderColor: "#e6ebf2" }} />
          <label className="form-label">Fallback échantillon DEMO (sans lecteur)</label>
          <select className="form-control" value={sampleKey} onChange={(e) => setSampleKey(e.target.value)}>
            <option value="demo-print-A">Échantillon A</option>
            <option value="demo-print-B">Échantillon B</option>
            <option value="demo-print-C">Échantillon C</option>
          </select>
          <button
            type="button"
            className="btn-secondary"
            style={{ marginTop: "0.75rem" }}
            disabled={busy}
            onClick={() => void runDemo()}
          >
            Recherche DEMO
          </button>
        </div>
      )}

      {bridgeNote ? <p className="muted">{bridgeNote}</p> : null}
      {error ? (
        <div className="login-error" role="alert">
          {error}
        </div>
      ) : null}

      {result ? (
        <div className="panel" style={{ marginTop: "1rem" }}>
          <h3 className="panel-title">Décision : {result.decision}</h3>
          {result.candidates.length === 0 ? (
            <p className="muted">Aucune correspondance exploitable.</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Population</th>
                  <th>Doigt</th>
                  <th>Score</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {result.candidates.map((c) => (
                  <tr key={c.citizen_id + String(c.score)}>
                    <td>
                      <code>{c.citizen_id}</code>
                    </td>
                    <td>{c.finger_label || c.finger_position || "—"}</td>
                    <td>{(c.score * 100).toFixed(1)} %</td>
                    <td>
                      <Link className="btn-secondary btn-sm" to={`/population/${c.citizen_id}`}>
                        Ouvrir
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : null}
    </div>
  );
}
