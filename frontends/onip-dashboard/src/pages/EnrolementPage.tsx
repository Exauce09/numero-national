import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Campaign,
  CampaignStats,
  CensusRecord,
  censusApi,
  registryApi,
} from "../api";
import { getSession } from "../auth";

type FileFilter = "SYNCED" | "CONFLICT" | "APPROVED" | "REJECTED" | "PROMOTED" | "QUEUED";

/**
 * Module 3 — Accueil enrôlement (cahier ONIP).
 * Réutilise /census (pas de domaine enrollment séparé) ; aucun NIN inventé ici.
 */
export default function EnrolementPage() {
  const hasToken = Boolean(getSession()?.accessToken);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignId, setCampaignId] = useState("");
  const [stats, setStats] = useState<CampaignStats | null>(null);
  const [catalog, setCatalog] = useState<{
    labels: Record<string, string>;
    offline_nin_forbidden: boolean;
    note?: string;
    transitions?: Record<string, string[]>;
  } | null>(null);
  const [filter, setFilter] = useState<FileFilter>("SYNCED");
  const [records, setRecords] = useState<CensusRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [assignNic, setAssignNic] = useState(false);

  const loadCampaigns = useCallback(async () => {
    const rows = await censusApi.listCampaigns();
    setCampaigns(rows);
    setCampaignId((cur) => {
      if (cur && rows.some((r) => r.id === cur)) return cur;
      const active = rows.find((r) => r.status === "ACTIVE");
      return active?.id ?? rows[0]?.id ?? "";
    });
  }, []);

  useEffect(() => {
    if (!hasToken) return;
    void (async () => {
      setError(null);
      try {
        const [cat] = await Promise.all([censusApi.enrollmentCatalog(), loadCampaigns()]);
        setCatalog(cat);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Chargement impossible");
      }
    })();
  }, [hasToken, loadCampaigns]);

  const reloadStatsAndRecords = useCallback(async () => {
    if (!campaignId) {
      setStats(null);
      setRecords([]);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const [s, rows] = await Promise.all([
        censusApi.stats(campaignId),
        censusApi.listRecords(campaignId, filter),
      ]);
      setStats(s);
      setRecords(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossible de charger la file");
    } finally {
      setBusy(false);
    }
  }, [campaignId, filter]);

  useEffect(() => {
    if (hasToken && campaignId) void reloadStatsAndRecords();
  }, [hasToken, campaignId, reloadStatsAndRecords]);

  async function onApprove(id: string) {
    setBusy(true);
    setError(null);
    try {
      await censusApi.approve(id, note.trim() || undefined);
      setInfo("Fiche validée (APPROVED) — promote FGP séparé.");
      setNote("");
      await reloadStatsAndRecords();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Approbation impossible");
    } finally {
      setBusy(false);
    }
  }

  async function onReject(id: string) {
    if (note.trim().length < 3) {
      setError("Motif requis (min. 3 caractères) pour un rejet.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await censusApi.reject(id, note.trim());
      setInfo("Fiche rejetée.");
      setNote("");
      await reloadStatsAndRecords();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Rejet impossible");
    } finally {
      setBusy(false);
    }
  }

  async function onPromote(id: string) {
    setBusy(true);
    setError(null);
    try {
      const r = await censusApi.promote(id, assignNic);
      setInfo(
        r.already_promoted
          ? `Déjà promu — citoyen ${r.citizen_id}`
          : `Promu FGP — citoyen ${r.citizen_id}${r.nic ? ` · NIC ${r.nic}` : " · sans NIC"}`,
      );
      if (r.citizen_id) {
        try {
          await registryApi.getCitizen(r.citizen_id);
        } catch {
          /* ignore */
        }
      }
      await reloadStatsAndRecords();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Promotion impossible");
    } finally {
      setBusy(false);
    }
  }

  async function onBatchPromote() {
    if (!campaignId) return;
    setBusy(true);
    setError(null);
    try {
      const r = await censusApi.batchPromote(campaignId, assignNic, 50);
      setInfo(
        `Lot promote : ${r.promoted} promu(s), ${r.skipped} ignoré(s), ${r.failed} échec(s). NIN hors-ligne interdit.`,
      );
      await reloadStatsAndRecords();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Promotion lot impossible");
    } finally {
      setBusy(false);
    }
  }

  const chip = (label: string, value: number | undefined, status?: FileFilter) => (
    <button
      type="button"
      className="stat-chip"
      style={{
        cursor: status ? "pointer" : "default",
        borderColor: status && filter === status ? "var(--nn-blue)" : undefined,
      }}
      onClick={() => status && setFilter(status)}
      disabled={!status}
    >
      <div className="muted">{label}</div>
      <strong>{value ?? "—"}</strong>
    </button>
  );

  return (
    <div>
      <div className="hero-banner">
        <h1>Enrôlement</h1>
        <p>
          Module 3 — file de collecte, contrôle et transmission FGP. Configuration campagnes :{" "}
          <Link to="/campaigns">Campagnes &amp; contrôle</Link> · dossiers FGP :{" "}
          <Link to="/population">Population</Link>.
        </p>
      </div>

      {!hasToken ? (
        <div className="panel muted">Connexion requise.</div>
      ) : (
        <>
          {catalog?.offline_nin_forbidden ? (
            <div className="panel" style={{ borderColor: "#f0c36d", background: "#fffbeb" }}>
              <strong>Règle Module 3 :</strong> aucun NIN définitif offline ; pas de fusion automatique.
              {catalog.note ? <p className="muted small">{catalog.note}</p> : null}
            </div>
          ) : null}

          {error ? <div className="login-error">{error}</div> : null}
          {info ? <div className="success-banner">{info}</div> : null}

          <div className="panel">
            <label>
              Campagne
              <select
                className="form-control"
                value={campaignId}
                onChange={(e) => setCampaignId(e.target.value)}
              >
                {campaigns.length === 0 ? <option value="">Aucune campagne</option> : null}
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} — {c.name} ({c.status})
                  </option>
                ))}
              </select>
            </label>
          </div>

          {stats ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))",
                gap: 10,
                marginBottom: 12,
              }}
            >
              {chip("Total fiches", stats.records)}
              {chip("File sync", stats.by_status?.QUEUED, "QUEUED")}
              {chip("À contrôler", stats.pending_review ?? stats.synced, "SYNCED")}
              {chip("Conflits", stats.conflicts, "CONFLICT")}
              {chip("Validés", stats.approved, "APPROVED")}
              {chip("Rejetés", stats.rejected, "REJECTED")}
              {chip("Promus FGP", stats.promoted, "PROMOTED")}
            </div>
          ) : null}

          <div className="panel">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "flex-end" }}>
              <label style={{ flex: "1 1 240px" }}>
                Motif (rejet / note validation)
                <input
                  className="form-control"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Obligatoire pour rejet"
                />
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input
                  type="checkbox"
                  checked={assignNic}
                  onChange={(e) => setAssignNic(e.target.checked)}
                />
                Attribuer NIC à la promotion (service central, jamais inventé ici)
              </label>
              <button
                type="button"
                className="btn-primary"
                disabled={busy || !campaignId || filter !== "APPROVED"}
                onClick={() => void onBatchPromote()}
              >
                Promouvoir lot (APPROVED)
              </button>
              <button
                type="button"
                className="btn-secondary"
                disabled={busy}
                onClick={() => void reloadStatsAndRecords()}
              >
                Actualiser
              </button>
            </div>
            <p className="muted small" style={{ marginTop: 8 }}>
              File : <span className="status-pill">{filter}</span>
              {catalog?.labels?.[filter] ? ` — ${catalog.labels[filter]}` : null}
              {busy ? " · chargement…" : null}
            </p>

            <table className="data-table">
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Naissance</th>
                  <th>Statut</th>
                  <th>Local</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {records.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="muted">
                      Aucune fiche dans cette file.
                    </td>
                  </tr>
                ) : (
                  records.map((r) => (
                    <tr key={r.id}>
                      <td>
                        {[r.family_name, r.given_names].filter(Boolean).join(" ") || "—"}
                      </td>
                      <td>{r.date_of_birth || "—"}</td>
                      <td>
                        <span className="status-pill">{r.status}</span>
                      </td>
                      <td>
                        <code className="muted small">{r.local_id || r.id.slice(0, 8)}</code>
                      </td>
                      <td style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                        {(r.status === "SYNCED" || r.status === "CONFLICT" || r.status === "REJECTED") && (
                          <button
                            type="button"
                            className="btn-primary btn-sm"
                            disabled={busy}
                            onClick={() => void onApprove(r.id)}
                          >
                            Valider
                          </button>
                        )}
                        {(r.status === "SYNCED" ||
                          r.status === "CONFLICT" ||
                          r.status === "APPROVED" ||
                          r.status === "QUEUED") && (
                          <button
                            type="button"
                            className="btn-secondary btn-sm"
                            disabled={busy}
                            onClick={() => void onReject(r.id)}
                          >
                            Rejeter
                          </button>
                        )}
                        {r.status === "APPROVED" && (
                          <button
                            type="button"
                            className="btn-primary btn-sm"
                            disabled={busy}
                            onClick={() => void onPromote(r.id)}
                          >
                            Promouvoir FGP
                          </button>
                        )}
                        {r.citizen_id ? (
                          <Link className="btn-secondary btn-sm" to="/population">
                            FGP
                          </Link>
                        ) : null}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

        </>
      )}
    </div>
  );
}
