import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  Assignment,
  Campaign,
  CampaignStats,
  CensusRecord,
  DirectoryUser,
  Team,
  Zone,
  censusApi,
} from "../api";
import { getSession } from "../auth";

type Tab = "campagnes" | "controle" | "affectations" | "stats";

export default function CampaignsPage() {
  const hasToken = Boolean(getSession()?.accessToken);
  const [tab, setTab] = useState<Tab>("campagnes");
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const selected = useMemo(
    () => campaigns.find((c) => c.id === selectedId) ?? null,
    [campaigns, selectedId],
  );

  const reloadCampaigns = useCallback(async () => {
    setError(null);
    try {
      const rows = await censusApi.listCampaigns();
      setCampaigns(rows);
      if (!selectedId && rows.length) setSelectedId(rows[0].id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossible de charger les campagnes");
    }
  }, [selectedId]);

  useEffect(() => {
    if (hasToken) void reloadCampaigns();
  }, [hasToken, reloadCampaigns]);

  return (
    <div>
      <div className="hero-banner">
        <h1>Campagnes de recensement</h1>
        <p>
          Étapes 2–4 : créer / activer la campagne → Affectations (zones, équipes, agents) → Contrôle
          fiches → Stats. (Étape 1 = menu Comptes.)
        </p>
      </div>

      {!hasToken ? (
        <div className="panel">
          <p className="muted">
            Connectez-vous avec un compte API (ex.{" "}
            <code>admin.recensement@example.gov</code> / <code>CensusAdmin123!</code>) pour gérer
            campagnes, contrôle et affectations.
          </p>
        </div>
      ) : (
        <>
      <div className="panel tab-row">
        {(
          [
            ["campagnes", "2. Campagnes"],
            ["affectations", "3. Affectations"],
            ["controle", "4. Contrôle fiches"],
            ["stats", "Stats / CSV"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={tab === id ? "btn-primary" : "btn-secondary"}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {error ? <div className="login-error" style={{ marginBottom: 12 }}>{error}</div> : null}
      {msg ? <div className="success-banner" style={{ marginBottom: 12 }}>{msg}</div> : null}

      <div className="panel" style={{ marginBottom: 12 }}>
        <label className="form-label">Campagne active</label>
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          style={{ width: "100%", maxWidth: 480 }}
        >
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.code} — {c.name} ({c.status})
            </option>
          ))}
        </select>
      </div>

      {tab === "campagnes" ? (
        <CampaignsTab
          campaigns={campaigns}
          busy={busy}
          setBusy={setBusy}
          setError={setError}
          setMsg={setMsg}
          onReload={reloadCampaigns}
        />
      ) : null}
      {tab === "controle" && selected ? (
        <ReviewTab
          campaign={selected}
          setError={setError}
          setMsg={setMsg}
        />
      ) : null}
      {tab === "controle" && !selected ? (
        <div className="panel"><p className="muted">Créez ou sélectionnez une campagne pour contrôler les fiches.</p></div>
      ) : null}
      {tab === "affectations" && selected ? (
        <AssignmentsTab campaign={selected} setError={setError} setMsg={setMsg} />
      ) : null}
      {tab === "affectations" && !selected ? (
        <div className="panel"><p className="muted">Créez ou sélectionnez une campagne pour gérer les affectations.</p></div>
      ) : null}
      {tab === "stats" && selected ? (
        <StatsTab campaign={selected} setError={setError} setMsg={setMsg} />
      ) : null}
      {tab === "stats" && !selected ? (
        <div className="panel"><p className="muted">Créez ou sélectionnez une campagne pour voir les stats.</p></div>
      ) : null}
        </>
      )}
    </div>
  );
}

function CampaignsTab({
  campaigns,
  busy,
  setBusy,
  setError,
  setMsg,
  onReload,
}: {
  campaigns: Campaign[];
  busy: boolean;
  setBusy: (v: boolean) => void;
  setError: (v: string | null) => void;
  setMsg: (v: string | null) => void;
  onReload: () => Promise<void>;
}) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");

  async function create(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await censusApi.createCampaign({ code: code.trim(), name: name.trim() });
      setCode("");
      setName("");
      setMsg("Campagne créée");
      await onReload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Création impossible");
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(id: string, status: string) {
    setBusy(true);
    setError(null);
    try {
      await censusApi.patchCampaign(id, { status });
      setMsg(`Statut → ${status}`);
      await onReload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Mise à jour impossible");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel">
      <h2>Liste</h2>
      <table className="data-table">
        <thead>
          <tr>
            <th>Code</th>
            <th>Nom</th>
            <th>Statut</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {campaigns.map((c) => (
            <tr key={c.id}>
              <td>{c.code}</td>
              <td>{c.name}</td>
              <td>{c.status}</td>
              <td style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <button type="button" className="btn-secondary" disabled={busy} onClick={() => void setStatus(c.id, "ACTIVE")}>
                  Activer
                </button>
                <button type="button" className="btn-secondary" disabled={busy} onClick={() => void setStatus(c.id, "PAUSED")}>
                  Pause
                </button>
                <button type="button" className="btn-secondary" disabled={busy} onClick={() => void setStatus(c.id, "CLOSED")}>
                  Clôturer
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 style={{ marginTop: 24 }}>Nouvelle campagne</h2>
      <form onSubmit={create} style={{ display: "grid", gap: 8, maxWidth: 420 }}>
        <input placeholder="Code" value={code} onChange={(e) => setCode(e.target.value)} required />
        <input placeholder="Nom" value={name} onChange={(e) => setName(e.target.value)} required />
        <button type="submit" className="btn-primary" disabled={busy}>
          Créer
        </button>
      </form>
    </div>
  );
}

function ReviewTab({
  campaign,
  setError,
  setMsg,
}: {
  campaign: Campaign;
  setError: (v: string | null) => void;
  setMsg: (v: string | null) => void;
}) {
  const [zones, setZones] = useState<Zone[]>([]);
  const [zoneId, setZoneId] = useState("");
  const [status, setStatus] = useState("SYNCED");
  const [rows, setRows] = useState<CensusRecord[]>([]);
  const [note, setNote] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const z = await censusApi.listZones(campaign.id);
      setZones(z);
      const recs = await censusApi.listRecords(campaign.id, status, zoneId || undefined);
      setRows(recs);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chargement fiches impossible");
    }
  }, [campaign.id, status, zoneId, setError]);

  useEffect(() => {
    void load();
  }, [load]);

  async function approve(id: string) {
    setBusyId(id);
    try {
      await censusApi.approve(id, note || undefined);
      setMsg("Fiche approuvée");
      setNote("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Approbation échouée");
    } finally {
      setBusyId(null);
    }
  }

  async function reject(id: string) {
    if (note.trim().length < 3) {
      setError("Motif de rejet requis (min. 3 caractères)");
      return;
    }
    setBusyId(id);
    try {
      await censusApi.reject(id, note.trim());
      setMsg("Fiche rejetée");
      setNote("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Rejet échoué");
    } finally {
      setBusyId(null);
    }
  }

  async function promote(id: string) {
    setBusyId(id);
    try {
      const result = await censusApi.promote(id, true);
      if (result.already_promoted) {
        setMsg(`Déjà promue${result.nic ? ` — NIC ${result.nic}` : ""}`);
      } else if (result.nic_assigned && result.nic) {
        setMsg(`Promue — NIC attribué : ${result.nic}`);
      } else if (result.nic_error) {
        setError(`Citoyen créé mais NIC non attribué : ${result.nic_error}`);
        setMsg(result.citizen_id ? `Citoyen ${result.citizen_id}` : null);
      } else {
        setMsg(
          result.nic
            ? `Promue — NIC ${result.nic}`
            : "Promue vers le registre (sans NIC pour l’instant)",
        );
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Promotion échouée");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="panel">
      <h2>File de contrôle — {campaign.code}</h2>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="SYNCED">À contrôler (SYNCED)</option>
          <option value="APPROVED">Approuvées</option>
          <option value="REJECTED">Rejetées</option>
          <option value="PROMOTED">Promues</option>
        </select>
        <select value={zoneId} onChange={(e) => setZoneId(e.target.value)}>
          <option value="">Toutes zones</option>
          {zones.map((z) => (
            <option key={z.id} value={z.id}>
              {z.code} — {z.name}
            </option>
          ))}
        </select>
        <button type="button" className="btn-secondary" onClick={() => void load()}>
          Rafraîchir
        </button>
      </div>
      <label className="form-label">Motif (obligatoire pour rejet)</label>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        style={{ width: "100%", marginBottom: 12 }}
        placeholder="Ex. Date de naissance incohérente"
      />
      <table className="data-table">
        <thead>
          <tr>
            <th>Nom</th>
            <th>Naissance</th>
            <th>Statut</th>
            <th>Note</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>
                {r.given_names} {r.family_name}
              </td>
              <td>{r.date_of_birth}</td>
              <td>{r.status}</td>
              <td>{r.review_note || "—"}</td>
              <td style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {r.status === "SYNCED" || r.status === "REJECTED" ? (
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={busyId === r.id}
                    onClick={() => void approve(r.id)}
                  >
                    Approuver
                  </button>
                ) : null}
                {r.status === "SYNCED" || r.status === "APPROVED" ? (
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={busyId === r.id}
                    onClick={() => void reject(r.id)}
                  >
                    Rejeter
                  </button>
                ) : null}
                {r.status === "APPROVED" ? (
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={busyId === r.id}
                    onClick={() => void promote(r.id)}
                  >
                    Promouvoir NIC
                  </button>
                ) : null}
              </td>
            </tr>
          ))}
          {!rows.length ? (
            <tr>
              <td colSpan={5} className="muted">
                Aucune fiche pour ce filtre.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

function AssignmentsTab({
  campaign,
  setError,
  setMsg,
}: {
  campaign: Campaign;
  setError: (v: string | null) => void;
  setMsg: (v: string | null) => void;
}) {
  const [zones, setZones] = useState<Zone[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [teamId, setTeamId] = useState("");
  const [zoneCode, setZoneCode] = useState("");
  const [zoneName, setZoneName] = useState("");
  const [provinceCode, setProvinceCode] = useState("KIN");
  const [communeCode, setCommuneCode] = useState("");
  const [teamCode, setTeamCode] = useState("");
  const [teamName, setTeamName] = useState("");
  const [teamZoneId, setTeamZoneId] = useState("");
  const [agentUserId, setAgentUserId] = useState("");
  const [users, setUsers] = useState<DirectoryUser[]>([]);

  const load = useCallback(async () => {
    try {
      const [z, t] = await Promise.all([
        censusApi.listZones(campaign.id),
        censusApi.listTeams(campaign.id),
      ]);
      setZones(z);
      setTeams(t);
      if (!teamId && t.length) setTeamId(t[0].id);
      try {
        const u = await censusApi.listUsers();
        setUsers(u.filter((x) => x.is_active));
      } catch {
        setUsers([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chargement affectations impossible");
    }
  }, [campaign.id, teamId, setError]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!teamId) {
      setAssignments([]);
      return;
    }
    void censusApi
      .listAssignments(teamId)
      .then(setAssignments)
      .catch((e) => setError(e instanceof Error ? e.message : "Assignments KO"));
  }, [teamId, setError]);

  async function addZone(e: FormEvent) {
    e.preventDefault();
    try {
      await censusApi.createZone(campaign.id, {
        code: zoneCode.trim(),
        name: zoneName.trim(),
        province_code: provinceCode.trim() || "KIN",
        commune_code: communeCode.trim() || undefined,
      });
      setZoneCode("");
      setZoneName("");
      setCommuneCode("");
      setMsg("Zone créée");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Zone KO");
    }
  }

  async function addTeam(e: FormEvent) {
    e.preventDefault();
    try {
      await censusApi.createTeam(campaign.id, {
        code: teamCode.trim(),
        name: teamName.trim(),
        zone_id: teamZoneId || undefined,
      });
      setTeamCode("");
      setTeamName("");
      setMsg("Équipe créée");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Équipe KO");
    }
  }

  async function assign(e: FormEvent) {
    e.preventDefault();
    if (!teamId) return;
    try {
      await censusApi.assignAgent(teamId, {
        agent_user_id: agentUserId.trim(),
        role_label: "CENSUS_AGENT",
      });
      setAgentUserId("");
      setMsg("Agent affecté");
      const rows = await censusApi.listAssignments(teamId);
      setAssignments(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Affectation KO");
    }
  }

  return (
    <div className="panel">
      <h2>Affectations — {campaign.code}</h2>
      <p className="muted">
        Étape 3 : créez zone + équipe, puis affectez un agent (créé à l’étape 1 — Comptes). L’agent
        pourra ensuite se connecter sur le téléphone.
      </p>
      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))" }}>
        <form onSubmit={addZone}>
          <h3>Nouvelle zone</h3>
          <input placeholder="Code zone" value={zoneCode} onChange={(e) => setZoneCode(e.target.value)} required />
          <input placeholder="Nom zone" value={zoneName} onChange={(e) => setZoneName(e.target.value)} required />
          <input
            placeholder="Province (ex. KIN)"
            value={provinceCode}
            onChange={(e) => setProvinceCode(e.target.value)}
          />
          <input
            placeholder="Commune (optionnel)"
            value={communeCode}
            onChange={(e) => setCommuneCode(e.target.value)}
          />
          <button type="submit" className="btn-primary" style={{ marginTop: 8 }}>
            Créer zone
          </button>
        </form>
        <form onSubmit={addTeam}>
          <h3>Nouvelle équipe</h3>
          <input placeholder="Code équipe" value={teamCode} onChange={(e) => setTeamCode(e.target.value)} required />
          <input placeholder="Nom équipe" value={teamName} onChange={(e) => setTeamName(e.target.value)} required />
          <select value={teamZoneId} onChange={(e) => setTeamZoneId(e.target.value)}>
            <option value="">Sans zone</option>
            {zones.map((z) => (
              <option key={z.id} value={z.id}>
                {z.code}
              </option>
            ))}
          </select>
          <button type="submit" className="btn-primary" style={{ marginTop: 8 }}>
            Créer équipe
          </button>
        </form>
        <form onSubmit={assign}>
          <h3>Affecter un agent</h3>
          <select value={teamId} onChange={(e) => setTeamId(e.target.value)} required>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.code} — {t.name}
              </option>
            ))}
          </select>
          {users.length > 0 ? (
            <select
              value={agentUserId}
              onChange={(e) => setAgentUserId(e.target.value)}
              required
            >
              <option value="">Choisir un utilisateur…</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.email}
                  {u.full_name ? ` — ${u.full_name}` : ""}
                </option>
              ))}
            </select>
          ) : (
            <input
              placeholder="UUID agent (user id)"
              value={agentUserId}
              onChange={(e) => setAgentUserId(e.target.value)}
              required
            />
          )}
          <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>
            Seed : agent.recensement@example.gov (sélectionnez-le dans la liste si visible)
          </p>
          <button type="submit" className="btn-primary" style={{ marginTop: 8 }}>
            Affecter
          </button>
        </form>
      </div>

      <h3 style={{ marginTop: 20 }}>Zones</h3>
      <ul>
        {zones.map((z) => (
          <li key={z.id}>
            {z.code} — {z.name}
          </li>
        ))}
      </ul>
      <h3>Affectations équipe sélectionnée</h3>
      <ul>
        {assignments.map((a) => (
          <li key={a.id}>
            {a.agent_user_id} · {a.role_label} · {a.active ? "actif" : "inactif"}
          </li>
        ))}
        {!assignments.length ? <li className="muted">Aucune</li> : null}
      </ul>
    </div>
  );
}

function StatsTab({
  campaign,
  setError,
  setMsg,
}: {
  campaign: Campaign;
  setError: (v: string | null) => void;
  setMsg: (v: string | null) => void;
}) {
  const [stats, setStats] = useState<CampaignStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    void censusApi
      .stats(campaign.id)
      .then((s) => {
        if (!cancelled) {
          setStats(s);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setStats(null);
          setLoading(false);
          const msg = e instanceof Error ? e.message : "Stats KO";
          setLoadError(msg);
          setError(msg);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [campaign.id, setError]);

  async function exportCsv(status?: string) {
    try {
      await censusApi.downloadCsv(campaign.id, status);
      setMsg("Export CSV téléchargé");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export CSV échoué");
    }
  }

  return (
    <div className="panel">
      <h2>Statistiques — {campaign.code}</h2>
      {loading ? <p className="muted">Chargement…</p> : null}
      {loadError ? <div className="login-error">{loadError}</div> : null}
      {!loading && !loadError && stats ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 12 }}>
          <div className="stat-chip"><div className="muted">Ménages</div><strong>{stats.households}</strong></div>
          <div className="stat-chip"><div className="muted">Personnes</div><strong>{stats.records}</strong></div>
          <div className="stat-chip"><div className="muted">À contrôler</div><strong>{stats.pending_review}</strong></div>
          <div className="stat-chip"><div className="muted">Approuvées</div><strong>{stats.approved}</strong></div>
          <div className="stat-chip"><div className="muted">Rejetées</div><strong>{stats.rejected}</strong></div>
          <div className="stat-chip"><div className="muted">Promues</div><strong>{stats.promoted}</strong></div>
          <div className="stat-chip"><div className="muted">Conflits</div><strong>{stats.conflicts}</strong></div>
        </div>
      ) : null}
      {!loading && !loadError && !stats ? (
        <p className="muted">Aucune statistique.</p>
      ) : null}
      <div style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" className="btn-primary" onClick={() => void exportCsv()}>
          Export CSV (toutes)
        </button>
        <button type="button" className="btn-secondary" onClick={() => void exportCsv("APPROVED")}>
          CSV approuvées
        </button>
        <button type="button" className="btn-secondary" onClick={() => void exportCsv("SYNCED")}>
          CSV à contrôler
        </button>
      </div>
    </div>
  );
}
