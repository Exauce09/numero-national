/** Identification biométrique 1:N. */

import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { getSession } from "../auth";

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
  const [result, setResult] = useState<{
    decision: string;
    candidates: Array<{
      citizen_id: string;
      score: number;
      finger_position?: string | null;
      finger_label?: string | null;
    }>;
  } | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const template_b64 = b64FromText(`FINGERPRINT|${sampleKey}|${finger}|v1`);
      const res = await api.biometricIdentify({
        modality: "FINGERPRINT",
        template_b64,
        max_candidates: 5,
      });
      setResult({ decision: res.decision, candidates: res.candidates });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Recherche impossible");
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
        Capturez une empreinte pour rechercher dans la population. Une correspondance n&apos;est pas
        une preuve juridique automatique.
      </p>
      <div className="dash-demo-banner">Moteur DEMO (LocalHashProvider) — remplaable par ABIS/SDK.</div>

      {!hasApi ? (
        <p className="muted">Connexion API requise (permission biometric:match).</p>
      ) : (
        <div className="panel">
          <label className="form-label">Échantillon DEMO</label>
          <select className="form-control" value={sampleKey} onChange={(e) => setSampleKey(e.target.value)}>
            <option value="demo-print-A">Échantillon A</option>
            <option value="demo-print-B">Échantillon B</option>
            <option value="demo-print-C">Échantillon C</option>
          </select>
          <label className="form-label">Doigt simulé</label>
          <select className="form-control" value={finger} onChange={(e) => setFinger(e.target.value)}>
            <option value="INDEX_DROIT">Index droit</option>
            <option value="POUCE_DROIT">Pouce droit</option>
            <option value="INDEX_GAUCHE">Index gauche</option>
          </select>
          <button type="button" className="btn-primary" disabled={busy} onClick={() => void run()}>
            {busy ? "Recherche…" : "Capturer et rechercher"}
          </button>
        </div>
      )}

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
