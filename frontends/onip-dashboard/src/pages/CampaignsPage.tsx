import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Assignment,
  Campaign,
  CampaignStats,
  CensusRecord,
  DirectoryUser,
  GeoItem,
  SyncBatch,
  Team,
  Zone,
  censusApi,
  geoApi,
  registryApi,
} from "../api";
import { getSession } from "../auth";

type Tab = "campagnes" | "controle" | "affectations" | "stats" | "sync";

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
      setSelectedId((cur) => {
        if (cur && rows.some((r) => r.id === cur)) return cur;
        const active = rows.find((r) => r.status === "ACTIVE");
        return active?.id ?? rows[0]?.id ?? "";
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossible de charger les campagnes");
    }
  }, []);

  useEffect(() => {
    if (hasToken) void reloadCampaigns();
  }, [hasToken, reloadCampaigns]);

  return (
    <div>
      <div className="hero-banner">
        <h1>Campagnes &amp; recensement</h1>
        <p>
          Module 4 — planification, zones, équipes, sync et stats. File dossiers :{" "}
          <Link to="/enrolement">Enrôlement</Link> · NIC après promote : <Link to="/nic">Numéros NIC</Link>.
          Sync terrain uniquement si campagne ACTIVE.
        </p>
      </div>

      {!hasToken ? (
        <div className="panel">
          <p className="muted">
            Connectez-vous avec un compte API (JWT) pour gérer campagnes, contrôle et affectations.
          </p>
        </div>
      ) : (
        <>
      <div className="panel tab-row">
        {(
          [
            ["campagnes", "Campagnes"],
            ["affectations", "Zones / équipes"],
            ["controle", "Contrôle fiches"],
            ["sync", "Synchronisation"],
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
      {tab === "sync" && selected ? (
        <SyncTab campaign={selected} setError={setError} />
      ) : null}
      {tab === "sync" && !selected ? (
        <div className="panel"><p className="muted">Sélectionnez une campagne pour voir les lots sync.</p></div>
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
  const [description, setDescription] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [transitions, setTransitions] = useState<Record<string, string[]>>({});
  const [labels, setLabels] = useState<Record<string, string>>({});

  useEffect(() => {
    void censusApi
      .campaignCatalog()
      .then((c) => {
        setTransitions(c.transitions || {});
        setLabels(c.labels || {});
      })
      .catch(() => undefined);
  }, []);

  async function create(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await censusApi.createCampaign({
        code: code.trim(),
        name: name.trim(),
        description: description.trim() || undefined,
        starts_at: startsAt ? new Date(startsAt).toISOString() : undefined,
        ends_at: endsAt ? new Date(endsAt).toISOString() : undefined,
      });
      setCode("");
      setName("");
      setDescription("");
      setStartsAt("");
      setEndsAt("");
      setMsg("Campagne créée (DRAFT)");
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

  function canGo(from: string, to: string) {
    return (transitions[from] || []).includes(to);
  }

  return (
    <div className="panel">
      <h2>Liste</h2>
      <p className="muted small">
        Transitions contrôlées côté serveur. Sync APK uniquement si ACTIVE.
      </p>
      <table className="data-table">
        <thead>
          <tr>
            <th>Code</th>
            <th>Nom</th>
            <th>Période</th>
            <th>Statut</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {campaigns.map((c) => (
            <tr key={c.id}>
              <td>{c.code}</td>
              <td>
                {c.name}
                {c.description ? <div className="muted small">{c.description}</div> : null}
              </td>
              <td className="muted small">
                {c.starts_at ? new Date(c.starts_at).toLocaleDateString() : "—"}
                {" → "}
                {c.ends_at ? new Date(c.ends_at).toLocaleDateString() : "—"}
              </td>
              <td>
                <span className="status-pill">{c.status}</span>
                {labels[c.status] ? (
                  <div className="muted small">{labels[c.status]}</div>
                ) : null}
              </td>
              <td style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {canGo(c.status, "ACTIVE") ? (
                  <button
                    type="button"
                    className="btn-secondary btn-sm"
                    disabled={busy}
                    onClick={() => void setStatus(c.id, "ACTIVE")}
                  >
                    Activer
                  </button>
                ) : null}
                {canGo(c.status, "PAUSED") ? (
                  <button
                    type="button"
                    className="btn-secondary btn-sm"
                    disabled={busy}
                    onClick={() => void setStatus(c.id, "PAUSED")}
                  >
                    Suspendre
                  </button>
                ) : null}
                {canGo(c.status, "CLOSED") ? (
                  <button
                    type="button"
                    className="btn-secondary btn-sm"
                    disabled={busy}
                    onClick={() => void setStatus(c.id, "CLOSED")}
                  >
                    Clôturer
                  </button>
                ) : null}
                {c.status === "CLOSED" ? <span className="muted small">Terminale</span> : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 style={{ marginTop: 24 }}>Nouvelle campagne</h2>
      <form onSubmit={create} style={{ display: "grid", gap: 8, maxWidth: 480 }}>
        <input placeholder="Code" value={code} onChange={(e) => setCode(e.target.value)} required />
        <input placeholder="Nom" value={name} onChange={(e) => setName(e.target.value)} required />
        <textarea
          placeholder="Objectif / description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
        />
        <label>
          Début planifié
          <input type="date" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
        </label>
        <label>
          Fin planifiée
          <input type="date" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
        </label>
        <button type="submit" className="btn-primary" disabled={busy}>
          Créer (brouillon)
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
  const [status, setStatus] = useState("PROMOTED");
  const [rows, setRows] = useState<CensusRecord[]>([]);
  const [nicByCitizen, setNicByCitizen] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const STATUS_MENU: Array<{ value: string; label: string; hint: string }> = [
    { value: "SYNCED", label: "1. À contrôler", hint: "Fiches sync, pas encore approuvées" },
    { value: "CONFLICT", label: "Conflits / doublons", hint: "Quarantaine qualité (Module 4)" },
    { value: "APPROVED", label: "2. Approuvées", hint: "Prêtes pour Promouvoir FGP" },
    { value: "PROMOTED", label: "3. Promues FGP", hint: "Déjà dans le registre" },
    { value: "REJECTED", label: "Rejetées", hint: "À corriger côté agent" },
  ];

  const load = useCallback(async () => {
    setError(null);
    try {
      const z = await censusApi.listZones(campaign.id);
      setZones(z);
      const recs = await censusApi.listRecords(campaign.id, status, zoneId || undefined);
      setRows(recs);
      if (status === "PROMOTED") {
        const map: Record<string, string> = {};
        await Promise.all(
          recs
            .filter((r) => r.citizen_id)
            .map(async (r) => {
              try {
                const c = await registryApi.getCitizen(r.citizen_id!);
                if (c.nic) map[r.citizen_id!] = c.nic;
              } catch {
                /* ignore */
              }
            }),
        );
        setNicByCitizen(map);
      } else {
        setNicByCitizen({});
      }
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
      setMsg("Fiche approuvée — passez au menu « 2. Approuvées » puis Promouvoir NIC");
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
        setMsg(`Promue — NIC attribué : ${result.nic} (voir aussi menu Numéros NIC)`);
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
      setStatus("PROMOTED");
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
      <p className="muted" style={{ marginTop: 0 }}>
        Chaque étape a son propre menu. Les fiches <strong>promues</strong> n’apparaissent plus dans
        « À contrôler ».
        <br />
        <strong>Note :</strong> seules les fiches synchronisées depuis la <em>tablette APK</em>{" "}
        apparaissent ici. Un recensement fait dans l’état civil (n° <code>CEN-…</code>) se cherche
        dans <strong>Population</strong> / <strong>Cartes</strong>, pas dans cet onglet.
      </p>
      <div className="status-menu" role="tablist" aria-label="Étape des fiches">
        {STATUS_MENU.map((s) => (
          <button
            key={s.value}
            type="button"
            role="tab"
            aria-selected={status === s.value}
            className={status === s.value ? "status-chip active" : "status-chip"}
            title={s.hint}
            onClick={() => setStatus(s.value)}
          >
            <strong>{s.label}</strong>
            <span>{s.hint}</span>
          </button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
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
        <Link className="btn-secondary" to="/nic" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center" }}>
          Voir tous les NIC →
        </Link>
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
            <th>NIC</th>
            <th>Note</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={6} className="muted">
                Aucune fiche dans cette étape. Si vous cherchez un recensement{" "}
                <code>CEN-…</code> fait dans l’état civil (navigateur), ouvrez Population / Cartes —
                pas « À contrôler » (réservé à la sync tablette APK).
              </td>
            </tr>
          ) : null}
          {rows.map((r) => (
            <tr key={r.id}>
              <td>
                {r.given_names} {r.family_name}
              </td>
              <td>{r.date_of_birth}</td>
              <td>{r.status}</td>
              <td>
                {r.citizen_id && nicByCitizen[r.citizen_id] ? (
                  <code className="nic-code">{nicByCitizen[r.citizen_id]}</code>
                ) : (
                  "—"
                )}
              </td>
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
                    className="btn-primary"
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
              <td colSpan={6} className="muted">
                Aucune fiche pour « {STATUS_MENU.find((s) => s.value === status)?.label} ». Changez
                d’étape dans le menu ci-dessus.
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
  const [provinces, setProvinces] = useState<GeoItem[]>([]);
  const [communes, setCommunes] = useState<GeoItem[]>([]);
  const [provinceId, setProvinceId] = useState("");
  const [communeId, setCommuneId] = useState("");
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
      try {
        setProvinces(await geoApi.provinces());
      } catch {
        setProvinces([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chargement affectations impossible");
    }
  }, [campaign.id, teamId, setError]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!provinceId) {
      setCommunes([]);
      setCommuneId("");
      return;
    }
    void geoApi
      .communesByProvince(provinceId)
      .then(setCommunes)
      .catch(() => setCommunes([]));
  }, [provinceId]);

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
    const prov = provinces.find((p) => p.id === provinceId);
    const com = communes.find((c) => c.id === communeId);
    if (!prov) {
      setError("Sélectionnez une province du référentiel géographique.");
      return;
    }
    try {
      await censusApi.createZone(campaign.id, {
        code: zoneCode.trim(),
        name: zoneName.trim(),
        province_code: (prov.code || prov.name).toString(),
        commune_code: com?.code || undefined,
      });
      setZoneCode("");
      setZoneName("");
      setCommuneId("");
      setMsg("Zone créée (liée province/commune)");
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
          <select value={provinceId} onChange={(e) => setProvinceId(e.target.value)} required>
            <option value="">Province…</option>
            {provinces.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code ? `${p.code} — ` : ""}
                {p.name}
              </option>
            ))}
          </select>
          <select value={communeId} onChange={(e) => setCommuneId(e.target.value)} disabled={!provinceId}>
            <option value="">Commune (recommandée)…</option>
            {communes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code ? `${c.code} — ` : ""}
                {c.name}
              </option>
            ))}
          </select>
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
          <li key={a.id} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <span>
              {a.agent_user_id} · {a.role_label} · {a.active ? "actif" : "inactif"}
            </span>
            {a.active ? (
              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={() => {
                  void (async () => {
                    try {
                      await censusApi.deactivateAssignment(a.id);
                      setMsg("Affectation désactivée");
                      setAssignments(await censusApi.listAssignments(teamId));
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "Retrait impossible");
                    }
                  })();
                }}
              >
                Retirer
              </button>
            ) : null}
          </li>
        ))}
        {!assignments.length ? <li className="muted">Aucune</li> : null}
      </ul>
    </div>
  );
}

function SyncTab({
  campaign,
  setError,
}: {
  campaign: Campaign;
  setError: (v: string | null) => void;
}) {
  const [rows, setRows] = useState<SyncBatch[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await censusApi.listSyncBatches(campaign.id, 50));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lots sync introuvables");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [campaign.id, setError]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="panel">
      <h2>Synchronisation — {campaign.code}</h2>
      <p className="muted small">
        Lots PUSH/PULL liés à cette campagne (payload_summary.campaign_id). Relance = même clé
        d&apos;idempotence côté APK.
      </p>
      {campaign.status !== "ACTIVE" ? (
        <div className="login-error" style={{ marginBottom: 12 }}>
          Campagne {campaign.status} — les nouveaux sync PUSH sont refusés tant qu&apos;elle n&apos;est
          pas ACTIVE.
        </div>
      ) : null}
      <button type="button" className="btn-secondary btn-sm" onClick={() => void load()} disabled={loading}>
        Actualiser
      </button>
      {loading ? <p className="muted">Chargement…</p> : null}
      <table className="data-table" style={{ marginTop: 12 }}>
        <thead>
          <tr>
            <th>Date</th>
            <th>Sens</th>
            <th>Statut</th>
            <th>Items</th>
            <th>Acceptés</th>
            <th>Conflits</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && !loading ? (
            <tr>
              <td colSpan={6} className="muted">
                Aucun lot récent pour cette campagne.
              </td>
            </tr>
          ) : (
            rows.map((b) => (
              <tr key={b.id}>
                <td>{new Date(b.created_at).toLocaleString()}</td>
                <td>{b.direction}</td>
                <td>
                  <span className="status-pill">{b.status}</span>
                </td>
                <td>{b.item_count}</td>
                <td>{b.accepted_count}</td>
                <td>{b.conflict_count}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
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
          <div className="stat-chip"><div className="muted">Zones</div><strong>{stats.zones_count ?? "—"}</strong></div>
          <div className="stat-chip"><div className="muted">Équipes</div><strong>{stats.teams_count ?? "—"}</strong></div>
          <div className="stat-chip">
            <div className="muted">Couverture zones</div>
            <strong>
              {stats.coverage_percent != null ? `${stats.coverage_percent}%` : "—"}
            </strong>
          </div>
          <div className="stat-chip"><div className="muted">Coupons</div><strong>{stats.coupons_count ?? "—"}</strong></div>
          <div className="stat-chip"><div className="muted">À contrôler</div><strong>{stats.pending_review}</strong></div>
          <div className="stat-chip"><div className="muted">Approuvées</div><strong>{stats.approved}</strong></div>
          <div className="stat-chip"><div className="muted">Rejetées</div><strong>{stats.rejected}</strong></div>
          <div className="stat-chip"><div className="muted">Promues</div><strong>{stats.promoted}</strong></div>
          <div className="stat-chip"><div className="muted">Conflits</div><strong>{stats.conflicts}</strong></div>
          <div className="stat-chip">
            <div className="muted">Lots sync / erreurs</div>
            <strong>
              {stats.sync_batches_recent ?? 0} / {stats.sync_errors_recent ?? 0}
            </strong>
          </div>
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
