import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { biometricApi } from "../api";
import { getSession, hasPermission } from "../auth";

type PendingMatch = {
  id: string;
  matched_citizen_id: string;
  source_citizen_id?: string | null;
  enrollment_id?: string | null;
  match_score: number;
  threshold_used: number;
  decision: string;
  finger_position?: string | null;
  matched_finger_label?: string | null;
  review_status: string;
  engine_version?: string | null;
  created_at: string;
};

type DedupRow = {
  id: string;
  probe_citizen_id?: string | null;
  modality: string;
  decision?: string | null;
  candidates?: unknown;
  scores?: unknown;
  created_at: string;
};

/** Module 6 — supervision biométrie + files revue (jamais de templates en clair). */
export default function BiometriePage() {
  const session = getSession();
  const hasToken = Boolean(session?.accessToken);
  const canReview =
    hasPermission("biometric:review", session) || hasPermission("biometric:match", session);
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);
  const [thresholds, setThresholds] = useState<Array<Record<string, unknown>>>([]);
  const [pending, setPending] = useState<PendingMatch[]>([]);
  const [dedup, setDedup] = useState<DedupRow[]>([]);
  const [catalogNote, setCatalogNote] = useState<string | null>(null);
  const [matcherNote, setMatcherNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [tab, setTab] = useState<"matches" | "dedup">("matches");

  async function refresh() {
    if (!hasToken) return;
    setError(null);
    try {
      const [s, t, p, d, cat] = await Promise.all([
        biometricApi.stats(),
        biometricApi.thresholds(),
        biometricApi.pendingMatches(40).catch(() => []),
        biometricApi.pendingDedup(40).catch(() => []),
        biometricApi.catalog().catch(() => null),
      ]);
      setStats(s as Record<string, unknown>);
      setThresholds(t as Array<Record<string, unknown>>);
      setPending(p);
      setDedup(d);
      if (cat) {
        setCatalogNote(cat.note);
        setMatcherNote(cat.matcher_note);
      }
    } catch (e) {
      setStats(null);
      setThresholds([]);
      setPending([]);
      setDedup([]);
      setError(
        e instanceof Error
          ? e.message
          : "Permission biométrie requise (biometric:match) ou service indisponible",
      );
    }
  }

  useEffect(() => {
    void refresh();
  }, [hasToken]);

  async function decide(id: string, approve: boolean) {
    setMsg(null);
    const reason = approve
      ? "Exception approuvée après revue humaine ONIP — reprise enrôlement autorisée (pas de fusion auto)."
      : "Match rejeté (faux positif / personnes distinctes) — reprise capture autorisée.";
    try {
      await biometricApi.reviewMatch(id, approve, reason);
      setMsg(
        approve
          ? "Exception enregistrée — enrôlement débloqué si applicable."
          : "Match rejeté — enrôlement débloqué si applicable.",
      );
      void refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Revue impossible");
    }
  }

  async function decideDedup(id: string, decision: "NO_MATCH" | "MATCH_CONFIRMED") {
    setMsg(null);
    const reason =
      decision === "NO_MATCH"
        ? "Revue humaine : personnes distinctes (NO_MATCH). Pas de fusion."
        : "Revue humaine : correspondance confirmée — fusion uniquement via procédure FGP merge.";
    try {
      await biometricApi.reviewDedup(id, decision, reason);
      setMsg(`Session dédup → ${decision}`);
      void refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Revue dédup impossible");
    }
  }

  return (
    <div>
      <div className="hero-banner">
        <h1>Biométrie &amp; déduplication</h1>
        <p>
          Module 6 — 1:N = candidats uniquement. Revue humaine obligatoire. Pas de fusion auto, pas de
          fraude auto, pas de NIN inventé. Templates jamais affichés. Dossiers FGP :{" "}
          <Link to="/population">Population</Link>.
        </p>
      </div>
      <div className="panel" style={{ borderLeft: "4px solid #0056b3" }}>
        <strong>Règles Module 6</strong>
        <p className="muted" style={{ marginBottom: 0 }}>
          {catalogNote ||
            "Correspondance biométrique ≠ preuve de fraude. Authentification exclusive ONIP."}
        </p>
        {matcherNote ? (
          <p className="muted small" style={{ marginTop: 8, marginBottom: 0 }}>
            Moteur : {matcherNote}
          </p>
        ) : null}
      </div>
      {msg ? <div className="success-banner">{msg}</div> : null}
      {!hasToken ? (
        <div className="panel muted">Connexion requise.</div>
      ) : error ? (
        <div className="panel">
          <div className="login-error">{error}</div>
        </div>
      ) : (
        <>
          <div className="tab-row">
            <button
              type="button"
              className={tab === "matches" ? "btn-primary" : "btn-secondary"}
              onClick={() => setTab("matches")}
            >
              Matches ({pending.length})
            </button>
            <button
              type="button"
              className={tab === "dedup" ? "btn-primary" : "btn-secondary"}
              onClick={() => setTab("dedup")}
            >
              Sessions dédup ({dedup.length})
            </button>
            <button type="button" className="btn-secondary" onClick={() => void refresh()}>
              Actualiser
            </button>
          </div>

          {tab === "matches" ? (
            <div className="panel">
              <h2 className="panel-title">File revue — matches</h2>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Score</th>
                    <th>Seuil</th>
                    <th>Doigt</th>
                    <th>Source</th>
                    <th>Candidat</th>
                    <th>Décision</th>
                    <th>Date</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pending.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="muted">
                        Aucun match en attente.
                      </td>
                    </tr>
                  ) : (
                    pending.map((m) => (
                      <tr key={m.id}>
                        <td>{m.match_score.toFixed(3)}</td>
                        <td>{m.threshold_used.toFixed(3)}</td>
                        <td>{m.matched_finger_label || m.finger_position || "—"}</td>
                        <td>
                          <code className="small">
                            {(m.source_citizen_id || "—").toString().slice(0, 8)}…
                          </code>
                        </td>
                        <td>
                          <code className="small">{m.matched_citizen_id.slice(0, 8)}…</code>
                        </td>
                        <td>
                          <span className="status-pill">{m.decision}</span>
                        </td>
                        <td>{m.created_at?.slice(0, 19)}</td>
                        <td style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {canReview ? (
                            <>
                              <button
                                type="button"
                                className="btn-secondary btn-sm"
                                onClick={() => void decide(m.id, false)}
                              >
                                Distinct / rejet
                              </button>
                              <button
                                type="button"
                                className="btn-primary btn-sm"
                                onClick={() => void decide(m.id, true)}
                              >
                                Exception
                              </button>
                            </>
                          ) : (
                            <span className="muted small">biometric:review</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="panel">
              <h2 className="panel-title">Sessions dédup (MANUAL_REVIEW)</h2>
              <p className="muted small">
                Décisions : NO_MATCH (personnes distinctes) ou MATCH_CONFIRMED (orienter vers merge FGP —
                jamais automatique).
              </p>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Probe</th>
                    <th>Modalité</th>
                    <th>Candidats</th>
                    <th>Date</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {dedup.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="muted">
                        Aucune session en revue.
                      </td>
                    </tr>
                  ) : (
                    dedup.map((d) => (
                      <tr key={d.id}>
                        <td>
                          <code className="small">
                            {(d.probe_citizen_id || "—").toString().slice(0, 8)}…
                          </code>
                        </td>
                        <td>{d.modality}</td>
                        <td>{Array.isArray(d.candidates) ? d.candidates.length : "—"}</td>
                        <td>{d.created_at?.slice(0, 19)}</td>
                        <td style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {canReview ? (
                            <>
                              <button
                                type="button"
                                className="btn-secondary btn-sm"
                                onClick={() => void decideDedup(d.id, "NO_MATCH")}
                              >
                                Distinct
                              </button>
                              <button
                                type="button"
                                className="btn-primary btn-sm"
                                onClick={() => void decideDedup(d.id, "MATCH_CONFIRMED")}
                              >
                                Confirmer (→ merge FGP)
                              </button>
                            </>
                          ) : (
                            <span className="muted small">biometric:review</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          <div className="panel">
            <h2 className="panel-title">Indicateurs</h2>
            {stats ? (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))",
                  gap: 10,
                }}
              >
                {Object.entries(stats)
                  .filter(([k]) => k !== "note")
                  .map(([k, v]) => (
                    <div key={k} className="stat-chip">
                      <div className="muted">{k}</div>
                      <strong>{String(v)}</strong>
                    </div>
                  ))}
              </div>
            ) : (
              <p className="muted">Chargement…</p>
            )}
            {stats?.note ? <p className="muted small">{String(stats.note)}</p> : null}
          </div>
          <div className="panel">
            <h2 className="panel-title">Seuils actifs (lecture)</h2>
            {thresholds.length === 0 ? (
              <p className="muted">Aucun seuil exposé.</p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Valeur</th>
                    <th>Actif</th>
                  </tr>
                </thead>
                <tbody>
                  {thresholds.map((t, i) => (
                    <tr key={i}>
                      <td>{String(t.code ?? t.name ?? "—")}</td>
                      <td>{String(t.value ?? t.threshold ?? "—")}</td>
                      <td>{String(t.active ?? true)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
