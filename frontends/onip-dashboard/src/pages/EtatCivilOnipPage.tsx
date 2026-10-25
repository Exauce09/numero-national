import { FormEvent, useEffect, useState } from "react";
import {
  civilOnipApi,
  type CivilEventsCatalog,
  type CivilInboundEvent,
  type CivilMatchingCase,
} from "../api";
import { getSession } from "../auth";

/** Module 8 — interconnexion état civil → FGP (pas de NIN inventé). */
export default function EtatCivilOnipPage() {
  const hasToken = Boolean(getSession()?.accessToken);
  const [q, setQ] = useState("");
  const [catalog, setCatalog] = useState<CivilEventsCatalog | null>(null);
  const [inbound, setInbound] = useState<CivilInboundEvent[]>([]);
  const [matching, setMatching] = useState<CivilMatchingCase[]>([]);
  const [acts, setActs] = useState<
    Array<{ id: string; act_type?: string; act_number?: string; status?: string; created_at?: string }>
  >([]);
  const [declarations, setDeclarations] = useState<
    Array<{ id: string; declaration_type?: string; status?: string; created_at?: string; facility_name?: string }>
  >([]);
  const [corrections, setCorrections] = useState<
    Array<{ id: string; status?: string; created_at?: string; reason?: string }>
  >([]);
  const [conflicts, setConflicts] = useState<
    Array<{ id: string; status: string; reason?: string | null; created_at?: string | null; kind: string }>
  >([]);
  const [policy, setPolicy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function refresh(query?: string) {
    if (!hasToken) return;
    setLoading(true);
    setError(null);
    try {
      const [cat, ev, match, a, d, c, conf] = await Promise.all([
        civilOnipApi.catalog().catch(() => null),
        civilOnipApi.listInbound(40).catch(() => [] as CivilInboundEvent[]),
        civilOnipApi.matchingCases(40).catch(() => ({ items: [] as CivilMatchingCase[] })),
        civilOnipApi.searchActs(query, 40).catch(() => []),
        civilOnipApi.listDeclarations("PENDING_OFFICER").catch(() => civilOnipApi.listDeclarations()),
        civilOnipApi.listCorrections().catch(() => []),
        civilOnipApi.conflicts().catch(() => ({ items: [], policy: null, note: "" })),
      ]);
      setCatalog(cat);
      setInbound(ev);
      setMatching(match.items || []);
      setActs(a);
      setDeclarations(d);
      setCorrections(c);
      setConflicts(conf.items || []);
      setPolicy(conf.policy || null);
    } catch (e) {
      setActs([]);
      setDeclarations([]);
      setCorrections([]);
      setError(
        e instanceof Error
          ? e.message
          : "Accès civil refusé — permission onip:dashboard / civil requise",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, [hasToken]);

  async function quarantineCase(id: string) {
    try {
      const r = await civilOnipApi.decideMatching(
        id,
        "QUARANTINE",
        "Mise en quarantaine ONIP — pas d'écrasement",
      );
      setMsg(r.message);
      void refresh(q);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Décision refusée");
    }
  }

  return (
    <div>
      <div className="hero-banner">
        <h1>Module 8 — État civil → FGP</h1>
        <p>
          Interconnexion : réception idempotente, rapprochement, conflits. Accusé technique ≠
          APPLIED. Aucun NIN inventé ; pas de last-message-wins.
        </p>
      </div>
      {!hasToken ? (
        <div className="panel muted">Connexion requise.</div>
      ) : (
        <>
          {catalog ? (
            <div className="panel" style={{ borderLeft: "4px solid #8a1c1c" }}>
              <h2 className="panel-title" style={{ marginTop: 0 }}>
                Catalogue interconnexion
              </h2>
              <p className="muted small">{catalog.note}</p>
              <ul className="muted small" style={{ margin: 0, paddingLeft: 18 }}>
                <li>Inventer NIN : {catalog.invent_nin_forbidden ? "interdit" : "autorisé"}</li>
                <li>
                  Écrasement / last-message-wins :{" "}
                  {catalog.last_message_wins_forbidden ? "interdit" : "autorisé"}
                </li>
                <li>
                  Recensement → acte :{" "}
                  {catalog.census_to_act_forbidden ? "interdit" : "autorisé"}
                </li>
                <li>
                  Sources actives :{" "}
                  {catalog.authorized_sources.filter((s) => s.active).map((s) => s.source_id).join(", ") ||
                    "—"}
                </li>
              </ul>
            </div>
          ) : null}

          {msg ? (
            <div className="panel" style={{ borderLeft: "4px solid #0056b3" }}>
              {msg}
            </div>
          ) : null}

          <form
            className="panel"
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              void refresh(q);
            }}
            style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
          >
            <input
              className="form-control"
              style={{ flex: "1 1 220px" }}
              placeholder="Recherche actes…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? "…" : "Actualiser"}
            </button>
          </form>
          {error ? <div className="login-error">{error}</div> : null}

          <div className="panel">
            <h2 className="panel-title">Événements entrants</h2>
            <p className="muted small">
              Statuts distincts : RECEIVED / MATCH_REVIEW / READY_TO_APPLY / APPLIED / QUARANTINED…
            </p>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Type</th>
                  <th>Réf. source</th>
                  <th>Statut</th>
                  <th>Appliqué ?</th>
                </tr>
              </thead>
              <tbody>
                {inbound.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="muted">
                      Aucun événement interconnecté.
                    </td>
                  </tr>
                ) : (
                  inbound.map((e) => (
                    <tr key={e.id}>
                      <td>{e.source_id}</td>
                      <td>{e.event_type}</td>
                      <td>
                        <code className="small">{e.source_event_id}</code>
                      </td>
                      <td>{e.processing_status}</td>
                      <td>{e.business_applied ? "oui" : "non"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="panel">
            <h2 className="panel-title">Rapprochement (MATCH_REVIEW)</h2>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Cas</th>
                  <th>Événement</th>
                  <th>Statut</th>
                  <th>Motif</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {matching.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="muted">
                      Aucun cas ouvert.
                    </td>
                  </tr>
                ) : (
                  matching.map((m) => (
                    <tr key={m.id}>
                      <td>
                        <code className="small">{m.id.slice(0, 8)}…</code>
                      </td>
                      <td>
                        <code className="small">{m.event_id.slice(0, 8)}…</code>
                      </td>
                      <td>{m.status}</td>
                      <td className="small">{m.reason}</td>
                      <td>
                        {m.status === "OPEN" ? (
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => void quarantineCase(m.id)}
                          >
                            Quarantaine
                          </button>
                        ) : (
                          <span className="muted small">—</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="panel" style={{ borderLeft: "4px solid #b35c00" }}>
            <h2 className="panel-title">Conflits / file résolution</h2>
            <p className="muted small">
              Politique : {policy || "no_silent_overwrite"} — pas d&apos;écrasement silencieux.
            </p>
            {conflicts.length === 0 ? (
              <p className="muted">Aucun conflit ouvert listé.</p>
            ) : (
              <ul>
                {conflicts.map((x) => (
                  <li key={`${x.kind}-${x.id}`}>
                    [{x.kind}] {x.status} — {x.reason || x.id}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="panel">
            <h2 className="panel-title">Déclarations (file)</h2>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Statut</th>
                  <th>Structure</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {declarations.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="muted">
                      Aucune déclaration.
                    </td>
                  </tr>
                ) : (
                  declarations.slice(0, 30).map((d) => (
                    <tr key={d.id}>
                      <td>{d.declaration_type || "—"}</td>
                      <td>{d.status || "—"}</td>
                      <td>{d.facility_name || "—"}</td>
                      <td>{d.created_at ? new Date(d.created_at).toLocaleString("fr-CD") : "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="panel">
            <h2 className="panel-title">Actes récents</h2>
            <table className="data-table">
              <thead>
                <tr>
                  <th>N°</th>
                  <th>Type</th>
                  <th>Statut</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {acts.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="muted">
                      Aucun acte.
                    </td>
                  </tr>
                ) : (
                  acts.map((a) => (
                    <tr key={a.id}>
                      <td>
                        <code>{a.act_number || a.id.slice(0, 8)}</code>
                      </td>
                      <td>{a.act_type || "—"}</td>
                      <td>{a.status || "—"}</td>
                      <td>{a.created_at ? new Date(a.created_at).toLocaleString("fr-CD") : "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="panel">
            <h2 className="panel-title">Corrections</h2>
            {corrections.length === 0 ? (
              <p className="muted">Aucune demande.</p>
            ) : (
              <ul>
                {corrections.slice(0, 20).map((c) => (
                  <li key={c.id}>
                    {c.status} — {c.reason || c.id}{" "}
                    <span className="muted small">
                      {c.created_at ? new Date(c.created_at).toLocaleString("fr-CD") : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
