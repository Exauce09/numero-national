/** Enrôlement biométrique — 3 doigts distincts + dédup 1:N. */

import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { getSession } from "../auth";

const DEMO_NOTE =
  "Capture DEMO (LocalHashProvider) — pas un moteur ABIS certifié. Les seuils sont techniques (environment=demo).";

function b64FromText(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary);
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
  const [quality, setQuality] = useState(92);
  const [sampleKey, setSampleKey] = useState("demo-print-A");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
      setOkMsg("Enrôlement ouvert — capturez 3 doigts distincts.");
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
    try {
      // Same sampleKey → same template → dédup démontrable
      const template_b64 = b64FromText(`FINGERPRINT|${sampleKey}|${finger}|v1`);
      const res = await api.biometricCapture(enrollmentId, {
        finger_position: finger,
        template_b64,
        quality_score: quality,
        capture_device: "DEMO-LOCAL",
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
        setOkMsg("Enrôlement finalisé — 3 empreintes enregistrées.");
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
        {DEMO_NOTE}
      </div>

      <div className="panel" style={{ marginBottom: "1rem" }}>
        <div className="dash-quick" aria-label="Progression">
          {[1, 2, 3].map((n) => (
            <span
              key={n}
              className={`status-badge${step >= n || count >= n ? "" : ""}`}
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

      {block ? (
        <div className="panel" style={{ borderColor: "#ce1126" }} role="alert">
          <h3 className="panel-title">⚠ Correspondance biométrique détectée</h3>
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
            <div>
              <dt>Statut</dt>
              <dd>Correspondance forte — enrôlement bloqué</dd>
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
          <p className="muted small" style={{ marginTop: "0.75rem" }}>
            Aucun nouveau dossier n&apos;a été créé. Une exception nécessite une revue autorisée
            (audit obligatoire).
          </p>
        </div>
      ) : null}

      {!enrollmentId && !block ? (
        <div className="panel">
          <p>Démarrez l&apos;enrôlement pour capturer 3 doigts différents.</p>
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
          <label className="form-label">Échantillon DEMO (même clé = même empreinte)</label>
          <select
            className="form-control"
            value={sampleKey}
            onChange={(e) => setSampleKey(e.target.value)}
          >
            <option value="demo-print-A">Échantillon A</option>
            <option value="demo-print-B">Échantillon B</option>
            <option value="demo-print-C">Échantillon C</option>
          </select>
          <label className="form-label">Qualité estimée : {quality} %</label>
          <input
            type="range"
            min={40}
            max={100}
            value={quality}
            onChange={(e) => setQuality(Number(e.target.value))}
          />
          <div
            className="panel"
            style={{
              marginTop: "1rem",
              textAlign: "center",
              padding: "2rem",
              background: "#f7f9fc",
            }}
          >
            PLACEZ LE DOIGT (simulation)
            <div style={{ marginTop: "0.5rem" }}>
              Qualité :{" "}
              <strong style={{ color: quality >= 60 ? "#0aad8a" : "#ce1126" }}>{quality} %</strong>
            </div>
          </div>
          <div className="action-row" style={{ marginTop: "1rem" }}>
            <button type="button" className="btn-primary" disabled={busy || !finger} onClick={() => void capture()}>
              {busy ? "Vérification 1:N…" : "Capturer"}
            </button>
          </div>
        </div>
      ) : null}

      {step >= 4 && !block ? (
        <div className="panel">
          <p>✓ Enrôlement terminé ({required} empreintes).</p>
          <Link className="btn-secondary" to={`/population/${citizenId}`}>
            Retour à la fiche population
          </Link>
        </div>
      ) : null}
    </div>
  );
}
