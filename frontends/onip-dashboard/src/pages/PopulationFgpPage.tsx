import { FormEvent, useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  registryApi,
  type CitizenDetail,
  type CitizenHistoryItem,
  type CitizenHit,
  type DuplicateCandidate,
} from "../api";
import { getSession } from "../auth";

type Tab = "identite" | "adresse" | "controles" | "historique";
type Mode = "liste" | "creer" | "detail";

const STATUS_OPTIONS = [
  "",
  "DRAFT",
  "PENDING_VALIDATION",
  "ACTIVE",
  "SUSPENDED",
  "DECEASED",
  "MERGED",
];

/** Module 2 — Gestion personnes / dossiers FGP (sans attribution NIN). */
export default function PopulationFgpPage() {
  const hasToken = Boolean(getSession()?.accessToken);
  const [mode, setMode] = useState<Mode>("liste");
  const [tab, setTab] = useState<Tab>("identite");

  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [province, setProvince] = useState("");
  const [commune, setCommune] = useState("");
  const [placeOfBirth, setPlaceOfBirth] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [rows, setRows] = useState<CitizenHit[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [selected, setSelected] = useState<CitizenDetail | null>(null);
  const [history, setHistory] = useState<CitizenHistoryItem[]>([]);
  const [duplicates, setDuplicates] = useState<DuplicateCandidate[]>([]);

  const [familyName, setFamilyName] = useState("");
  const [givenNames, setGivenNames] = useState("");
  const [dob, setDob] = useState("");
  const [sex, setSex] = useState("UNKNOWN");
  const [pob, setPob] = useState("");
  const [addrLine, setAddrLine] = useState("");
  const [addrCity, setAddrCity] = useState("");
  const [addrProv, setAddrProv] = useState("");
  const [addrCommune, setAddrCommune] = useState("");
  const [similar, setSimilar] = useState<CitizenHit[]>([]);
  const [statusReason, setStatusReason] = useState("");
  const [dupJustification, setDupJustification] = useState("");

  const load = useCallback(async () => {
    if (!hasToken) return;
    setLoading(true);
    setError(null);
    try {
      const res = await registryApi.searchCitizens({
        q: q.trim() || undefined,
        status: status || undefined,
        province_code: province.trim() || undefined,
        commune_code: commune.trim() || undefined,
        place_of_birth: placeOfBirth.trim() || undefined,
        page: 1,
        page_size: 50,
      });
      setRows(res.items);
      setTotal(res.total);
    } catch (e) {
      setRows([]);
      setTotal(0);
      setError(e instanceof Error ? e.message : "Recherche impossible");
    } finally {
      setLoading(false);
    }
  }, [hasToken, q, status, province, commune, placeOfBirth]);

  useEffect(() => {
    void load();
  }, [load]);

  async function openDetail(id: string) {
    setError(null);
    setInfo(null);
    setTab("identite");
    try {
      const [c, hist, dups] = await Promise.all([
        registryApi.getCitizen(id),
        registryApi.getHistory(id),
        registryApi.getDuplicates(id, false),
      ]);
      setSelected(c);
      setHistory(hist.items);
      setDuplicates(dups);
      setMode("detail");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Dossier inaccessible");
    }
  }

  async function checkSimilar() {
    setError(null);
    if (!familyName.trim() || !givenNames.trim() || !dob) {
      setError("Nom, prénom et date de naissance requis pour la recherche de similarité.");
      return;
    }
    try {
      const res = await registryApi.findSimilar({
        family_name: familyName.trim(),
        given_names: givenNames.trim(),
        date_of_birth: dob,
        sex,
        province_code: addrProv.trim() || undefined,
        commune_code: addrCommune.trim() || undefined,
      });
      setSimilar(res.items);
      setInfo(res.message);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Recherche similaires impossible");
    }
  }

  async function createDraft(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    try {
      const body = {
        family_name: familyName.trim(),
        given_names: givenNames.trim(),
        date_of_birth: dob,
        sex,
        place_of_birth: pob.trim() || undefined,
        nationality: "COD",
        addresses:
          addrLine.trim() && addrCity.trim()
            ? [
                {
                  address_type: "RESIDENTIAL",
                  line1: addrLine.trim(),
                  city: addrCity.trim(),
                  province_code: addrProv.trim() || undefined,
                  commune_code: addrCommune.trim() || undefined,
                  country_code: "COD",
                  is_primary: true,
                },
              ]
            : [],
      };
      const created = await registryApi.createCitizen(body);
      setInfo(
        `Brouillon créé — identifiant interne ${created.id}. Aucun NIN attribué (RB-02).`,
      );
      setFamilyName("");
      setGivenNames("");
      setDob("");
      setSimilar([]);
      await openDetail(created.id);
      void load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Création impossible");
    }
  }

  async function submitSelected() {
    if (!selected) return;
    setError(null);
    try {
      const c = await registryApi.submitCitizen(selected.id);
      setSelected(c);
      setInfo("Dossier soumis pour contrôle (PENDING_VALIDATION). Pas de NIN.");
      const hist = await registryApi.getHistory(selected.id);
      setHistory(hist.items);
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Soumission impossible");
    }
  }

  async function rejectSelected() {
    if (!selected || statusReason.trim().length < 5) {
      setError("Motif requis (min. 5 caractères) pour un rejet / suspension.");
      return;
    }
    try {
      const c = await registryApi.changeStatus(selected.id, "SUSPENDED", statusReason.trim());
      setSelected(c);
      setInfo("Statut → SUSPENDED.");
      setStatusReason("");
      const hist = await registryApi.getHistory(selected.id);
      setHistory(hist.items);
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Changement de statut impossible");
    }
  }

  async function requestComplement() {
    if (!selected || statusReason.trim().length < 5) {
      setError("Motif requis pour demander un complément.");
      return;
    }
    try {
      const c = await registryApi.changeStatus(selected.id, "DRAFT", statusReason.trim());
      setSelected(c);
      setInfo("Retour en brouillon (à compléter).");
      setStatusReason("");
      const hist = await registryApi.getHistory(selected.id);
      setHistory(hist.items);
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action impossible");
    }
  }

  async function resolveDup(id: string, decision: "FALSE_POSITIVE" | "CONFIRMED_DUPLICATE") {
    if (dupJustification.trim().length < 10) {
      setError("Justification min. 10 caractères pour résoudre un doublon.");
      return;
    }
    try {
      await registryApi.resolveDuplicate(id, decision, dupJustification.trim());
      setInfo(
        decision === "FALSE_POSITIVE"
          ? "Marqué comme faux positif — pas de fusion."
          : "Doublon confirmé — fusion uniquement via procédure merge (permission dédiée).",
      );
      setDupJustification("");
      if (selected) {
        const dups = await registryApi.getDuplicates(selected.id, false);
        setDuplicates(dups);
        const hist = await registryApi.getHistory(selected.id);
        setHistory(hist.items);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Résolution impossible");
    }
  }

  return (
    <div>
      <div className="hero-banner">
        <h1>Population / FGP</h1>
        <p>
          Module 2 — dossiers individuels (identifiant interne distinct du NIN). Attribution NIN :{" "}
          <Link to="/conformite">conformité</Link> · <Link to="/nic">NIN</Link>.
        </p>
      </div>

      {!hasToken ? (
        <div className="panel muted">Connexion requise.</div>
      ) : (
        <>
          <div className="tab-row">
            <button
              type="button"
              className={mode === "liste" ? "btn-primary" : "btn-secondary"}
              onClick={() => {
                setMode("liste");
                setSelected(null);
              }}
            >
              Liste / recherche
            </button>
            <button
              type="button"
              className={mode === "creer" ? "btn-primary" : "btn-secondary"}
              onClick={() => {
                setMode("creer");
                setSelected(null);
                setError(null);
                setInfo(null);
              }}
            >
              Nouveau dossier
            </button>
            {selected && mode === "detail" ? (
              <button type="button" className="btn-primary" disabled>
                Fiche ouverte
              </button>
            ) : null}
          </div>

          {error ? <div className="login-error">{error}</div> : null}
          {info ? <div className="success-banner">{info}</div> : null}

          {mode === "liste" ? (
            <>
              <form
                className="panel"
                onSubmit={(e: FormEvent) => {
                  e.preventDefault();
                  void load();
                }}
              >
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
                  <label style={{ flex: "1 1 220px" }}>
                    Recherche
                    <input
                      className="form-control"
                      placeholder="Nom, prénom, NIC…"
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                    />
                  </label>
                  <label style={{ flex: "0 1 160px" }}>
                    Statut
                    <select className="form-control" value={status} onChange={(e) => setStatus(e.target.value)}>
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s || "all"} value={s}>
                          {s || "Tous"}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button type="submit" className="btn-primary" disabled={loading}>
                    {loading ? "…" : "Rechercher"}
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setShowAdvanced((v) => !v)}
                  >
                    {showAdvanced ? "Masquer filtres" : "Recherche avancée"}
                  </button>
                </div>
                {showAdvanced ? (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                    <label style={{ flex: "1 1 120px" }}>
                      Province
                      <input className="form-control" value={province} onChange={(e) => setProvince(e.target.value)} />
                    </label>
                    <label style={{ flex: "1 1 120px" }}>
                      Commune
                      <input className="form-control" value={commune} onChange={(e) => setCommune(e.target.value)} />
                    </label>
                    <label style={{ flex: "1 1 160px" }}>
                      Lieu de naissance
                      <input
                        className="form-control"
                        value={placeOfBirth}
                        onChange={(e) => setPlaceOfBirth(e.target.value)}
                      />
                    </label>
                  </div>
                ) : null}
              </form>

              <div className="panel">
                <p className="muted small">{total} dossier(s)</p>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Nom</th>
                      <th>Sexe</th>
                      <th>Naissance</th>
                      <th>Statut</th>
                      <th>Province</th>
                      <th>NIC</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="muted">
                          Aucun résultat.
                        </td>
                      </tr>
                    ) : (
                      rows.map((r) => (
                        <tr key={r.id}>
                          <td>{[r.family_name, r.given_names].filter(Boolean).join(" ")}</td>
                          <td>{r.sex || "—"}</td>
                          <td>{r.date_of_birth || "—"}</td>
                          <td>
                            <span className="status-pill">{r.status || "—"}</span>
                          </td>
                          <td>{r.province_code || "—"}</td>
                          <td>
                            <code>{r.nic || "—"}</code>
                          </td>
                          <td>
                            <button
                              type="button"
                              className="btn-secondary btn-sm"
                              onClick={() => void openDetail(r.id)}
                            >
                              Ouvrir
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}

          {mode === "creer" ? (
            <form className="panel" onSubmit={(e) => void createDraft(e)}>
              <h2 className="panel-title">Nouveau dossier (brouillon)</h2>
              <p className="muted small">
                Identifiant interne UUID attribué à la création. Ce formulaire n&apos;attribue jamais de NIN.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12 }}>
                <label>
                  Nom de famille *
                  <input className="form-control" required value={familyName} onChange={(e) => setFamilyName(e.target.value)} />
                </label>
                <label>
                  Prénoms *
                  <input className="form-control" required value={givenNames} onChange={(e) => setGivenNames(e.target.value)} />
                </label>
                <label>
                  Date de naissance *
                  <input className="form-control" type="date" required value={dob} onChange={(e) => setDob(e.target.value)} />
                </label>
                <label>
                  Sexe
                  <select className="form-control" value={sex} onChange={(e) => setSex(e.target.value)}>
                    <option value="UNKNOWN">Inconnu</option>
                    <option value="MALE">Masculin</option>
                    <option value="FEMALE">Féminin</option>
                    <option value="OTHER">Autre</option>
                  </select>
                </label>
                <label>
                  Lieu de naissance
                  <input className="form-control" value={pob} onChange={(e) => setPob(e.target.value)} />
                </label>
              </div>
              <h3>Adresse (optionnelle)</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12 }}>
                <label>
                  Ligne 1
                  <input className="form-control" value={addrLine} onChange={(e) => setAddrLine(e.target.value)} />
                </label>
                <label>
                  Ville
                  <input className="form-control" value={addrCity} onChange={(e) => setAddrCity(e.target.value)} />
                </label>
                <label>
                  Province
                  <input className="form-control" value={addrProv} onChange={(e) => setAddrProv(e.target.value)} />
                </label>
                <label>
                  Commune
                  <input className="form-control" value={addrCommune} onChange={(e) => setAddrCommune(e.target.value)} />
                </label>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                <button type="button" className="btn-secondary" onClick={() => void checkSimilar()}>
                  Chercher dossiers similaires
                </button>
                <button type="submit" className="btn-primary">
                  Enregistrer brouillon
                </button>
              </div>
              {similar.length > 0 ? (
                <div style={{ marginTop: 16 }}>
                  <p className="muted">
                    {similar.length} candidat(s) — revue humaine requise, pas de fusion automatique (RB-05).
                  </p>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Nom</th>
                        <th>Naissance</th>
                        <th>Statut</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {similar.map((s) => (
                        <tr key={s.id}>
                          <td>
                            {s.family_name} {s.given_names}
                          </td>
                          <td>{s.date_of_birth}</td>
                          <td>{s.status}</td>
                          <td>
                            <button type="button" className="btn-secondary btn-sm" onClick={() => void openDetail(s.id)}>
                              Ouvrir
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </form>
          ) : null}

          {mode === "detail" && selected ? (
            <div className="panel">
              <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                <div>
                  <h2 className="panel-title" style={{ marginBottom: 4 }}>
                    {[selected.family_name, selected.given_names].filter(Boolean).join(" ")}
                  </h2>
                  <p className="muted small">
                    Statut <span className="status-pill">{selected.status}</span>
                    {" · "}
                    NIC {selected.nic ? <code>{selected.nic}</code> : <em>non attribué</em>}
                    {" · "}
                    MAJ {selected.updated_at ? new Date(selected.updated_at).toLocaleString() : "—"}
                  </p>
                  <p className="muted small">
                    ID interne (technique) : <code>{selected.id}</code> — distinct du NIN
                  </p>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-start" }}>
                  {selected.status === "DRAFT" ? (
                    <button type="button" className="btn-primary" onClick={() => void submitSelected()}>
                      Soumettre
                    </button>
                  ) : null}
                  {selected.status === "PENDING_VALIDATION" ? (
                    <>
                      <button type="button" className="btn-secondary" onClick={() => void requestComplement()}>
                        À compléter
                      </button>
                      <button type="button" className="btn-secondary" onClick={() => void rejectSelected()}>
                        Rejeter
                      </button>
                    </>
                  ) : null}
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      setMode("liste");
                      setSelected(null);
                    }}
                  >
                    Fermer
                  </button>
                </div>
              </div>

              {(selected.status === "PENDING_VALIDATION" || selected.status === "DRAFT") && (
                <label style={{ display: "block", maxWidth: 480, marginTop: 8 }}>
                  Motif (rejet / complément)
                  <input
                    className="form-control"
                    value={statusReason}
                    onChange={(e) => setStatusReason(e.target.value)}
                    placeholder="Motif obligatoire pour rejet ou complément"
                  />
                </label>
              )}

              <div className="tab-row" style={{ marginTop: 16 }}>
                {(
                  [
                    ["identite", "Identité"],
                    ["adresse", "Adresse"],
                    ["controles", "Contrôles / doublons"],
                    ["historique", "Historique"],
                  ] as const
                ).map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    className={tab === k ? "btn-primary" : "btn-secondary"}
                    onClick={() => setTab(k)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {tab === "identite" ? (
                <ul className="muted">
                  <li>Sexe : {selected.sex}</li>
                  <li>Naissance : {selected.date_of_birth}</li>
                  <li>Lieu : {selected.place_of_birth || "—"}</li>
                  <li>Nationalité : {selected.nationality || "—"}</li>
                  <li>
                    NIN / NIC :{" "}
                    {selected.nic || (
                      <>
                        non attribué — voir <Link to="/nic">module NIN</Link>
                      </>
                    )}
                  </li>
                </ul>
              ) : null}

              {tab === "adresse" ? (
                selected.addresses && selected.addresses.length > 0 ? (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Type</th>
                        <th>Adresse</th>
                        <th>Ville</th>
                        <th>Province</th>
                        <th>Commune</th>
                        <th>Primaire</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selected.addresses.map((a, i) => (
                        <tr key={a.id || i}>
                          <td>{a.address_type}</td>
                          <td>
                            {a.line1}
                            {a.line2 ? `, ${a.line2}` : ""}
                          </td>
                          <td>{a.city}</td>
                          <td>{a.province_code || "—"}</td>
                          <td>{a.commune_code || "—"}</td>
                          <td>{a.is_primary ? "oui" : ""}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="muted">Aucune adresse enregistrée.</p>
                )
              ) : null}

              {tab === "controles" ? (
                <div>
                  <p className="muted small">
                    Les correspondances sont des candidats à examiner. Aucune fusion automatique (RB-05).
                  </p>
                  <label style={{ display: "block", maxWidth: 480 }}>
                    Justification résolution
                    <input
                      className="form-control"
                      value={dupJustification}
                      onChange={(e) => setDupJustification(e.target.value)}
                      placeholder="Min. 10 caractères"
                    />
                  </label>
                  {duplicates.length === 0 ? (
                    <p className="muted">Aucun doublon enregistré.</p>
                  ) : (
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Autre dossier</th>
                          <th>Naissance</th>
                          <th>Score</th>
                          <th>Statut</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {duplicates.map((d) => (
                          <tr key={d.id}>
                            <td>
                              {[d.other_family_name, d.other_given_names].filter(Boolean).join(" ") ||
                                d.other_citizen_id}
                            </td>
                            <td>{d.other_date_of_birth || "—"}</td>
                            <td>{d.score}</td>
                            <td>{d.status}</td>
                            <td style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                              {d.other_citizen_id ? (
                                <button
                                  type="button"
                                  className="btn-secondary btn-sm"
                                  onClick={() => void openDetail(d.other_citizen_id!)}
                                >
                                  Ouvrir
                                </button>
                              ) : null}
                              {d.status === "OPEN" ? (
                                <>
                                  <button
                                    type="button"
                                    className="btn-secondary btn-sm"
                                    onClick={() => void resolveDup(d.id, "FALSE_POSITIVE")}
                                  >
                                    Faux positif
                                  </button>
                                  <button
                                    type="button"
                                    className="btn-secondary btn-sm"
                                    onClick={() => void resolveDup(d.id, "CONFIRMED_DUPLICATE")}
                                  >
                                    Confirmer doublon
                                  </button>
                                </>
                              ) : null}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              ) : null}

              {tab === "historique" ? (
                history.length === 0 ? (
                  <p className="muted">Aucun événement.</p>
                ) : (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Événement</th>
                        <th>Détail</th>
                        <th>Acteur</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((h) => (
                        <tr key={h.id}>
                          <td>{new Date(h.created_at).toLocaleString()}</td>
                          <td>{h.event_type}</td>
                          <td>
                            <code style={{ fontSize: "0.75rem", whiteSpace: "pre-wrap" }}>
                              {JSON.stringify(h.payload)}
                            </code>
                          </td>
                          <td className="muted small">{h.actor_id || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              ) : null}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
