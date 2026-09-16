/** Liste population / personnes — registre national (API) + fallback local. */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { BarChart, PieChart } from "../components/Charts";
import DataToolbar from "../components/DataToolbar";
import { PopulationStatBlocks } from "../components/StatBlocks";
import { api, type CitizenListItem } from "../api";
import { ensureAccessToken, getSession } from "../auth";
import { displayNic, splitFamilyName, splitGivenNames } from "../nationalSearch";
import { RDC, rdcColor } from "../rdcColors";
import {
  ETAT_CIVIL_OPTIONS,
  deletePerson,
  displayName,
  getCivilStatusOverride,
  getPerson,
  listActs,
  listPopulationPersons,
  isDeceased,
  personNationalite,
  populationBreakdown,
  upsertLocalPersonFromApi,
  type EtatCivil,
  type Person,
  type Sexe,
} from "../registry";

const PAGE_SIZE = 25;

type PopView = "all" | "recenses" | "identification";

type PopRow = Person & {
  registryStatus?: string;
  hasCensus?: boolean;
  biometricNote?: string;
};

function mapSex(sex?: string | null): Sexe {
  const s = (sex || "").toUpperCase();
  if (s === "F" || s === "FEMALE" || s === "FEMININ") return "F";
  return "M";
}

/** Mapping liste : API + situation civile locale (sinon toujours « Non renseigné »). */
function citizenToRow(c: CitizenListItem): PopRow {
  const { nom, postnom: postFromFam } = splitFamilyName(c.family_name || "");
  const { prenom, postnom: postFromGiven } = splitGivenNames(c.given_names || "");
  const realNic = (c.nic || "").trim();
  const nic = realNic && !realNic.toUpperCase().startsWith("REG-") ? realNic : "";
  const local = getPerson(c.id);
  const override = getCivilStatusOverride(c.id);
  const etat =
    override ||
    (local?.etat_civil && local.etat_civil !== "UNKNOWN" ? local.etat_civil : "UNKNOWN");
  return {
    id: c.id,
    nom: local?.nom || nom,
    postnom: local?.postnom || postFromFam || postFromGiven,
    prenom: local?.prenom || prenom,
    sexe: local?.sexe || mapSex(c.sex),
    date_naissance: local?.date_naissance || (c.date_of_birth || "").slice(0, 10),
    lieu_naissance: local?.lieu_naissance || c.place_of_birth || c.ville || "",
    etat_civil: etat,
    nic: nic || local?.nic || "",
    registryStatus: c.status,
  };
}

function civilStatusLabel(p: PopRow): string {
  if ((p.registryStatus || "").toUpperCase() === "DECEASED" || p.etat_civil === "UNKNOWN") {
    const rs = (p.registryStatus || "").toUpperCase();
    if (rs === "DECEASED") return "Décédé(e)";
  }
  if (p.etat_civil === "UNKNOWN") return "Non renseigné";
  const hit = ETAT_CIVIL_OPTIONS.find((o) => o.value === p.etat_civil);
  return hit?.label || p.etat_civil || "—";
}

export default function PopulationPage({ showAnalytics = false }: { showAnalytics?: boolean }) {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const view = (params.get("view") as PopView) || "all";
  const hasApi = Boolean(getSession()?.accessToken);
  const [q, setQ] = useState("");
  const [sexe, setSexe] = useState("");
  const [nat, setNat] = useState("");
  const [civilStatus, setCivilStatus] = useState("");
  const [page, setPage] = useState(1);
  const [persons, setPersons] = useState<PopRow[]>(() =>
    hasApi ? [] : listPopulationPersons().map((p) => ({ ...p, registryStatus: "LOCAL" })),
  );
  const [total, setTotal] = useState(0);
  const [source, setSource] = useState<"api" | "local">(hasApi ? "api" : "local");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editRow, setEditRow] = useState<PopRow | null>(null);
  const [editForm, setEditForm] = useState({
    nom: "",
    postnom: "",
    prenom: "",
    sexe: "M" as Sexe,
    date_naissance: "",
    lieu_naissance: "",
    etat_civil: "CELIBATAIRE" as EtatCivil,
  });
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const censusIds = useMemo(() => {
    const ids = new Set<string>();
    for (const a of listActs().filter((x) => x.type === "CENSUS")) {
      const pid = String(a.payload.person_id ?? a.payload.citizen_id ?? "");
      if (pid) ids.add(pid);
      if (a.national_id) ids.add(a.national_id);
    }
    return ids;
  }, [persons.length]);

  const load = useCallback(async () => {
    const token = hasApi ? await ensureAccessToken() : null;
    if (!token) {
      const local = listPopulationPersons().map((p) => ({
        ...p,
        registryStatus: "LOCAL",
        hasCensus: Boolean(p.id && censusIds.has(p.id)) || Boolean(p.nic && censusIds.has(p.nic)),
        biometricNote: [p.fingerprint_note, p.iris_note].filter(Boolean).join(" · ") || "Non enrôlé",
      }));
      setPersons(local);
      setSource("local");
      setTotal(local.length);
      setError(
        "Session API absente — affichage du cache navigateur uniquement (chiffre local, pas le registre national).",
      );
      return;
    }
    setBusy(true);
    setError(null);
    try {
      // API: page_size max = 100 (sinon 422 "Input should be less than or equal to 100")
      const pageSize = 100;
      const allItems: Awaited<ReturnType<typeof api.searchCitizens>>["items"] = [];
      let page = 1;
      let total = 0;
      for (;;) {
        const qs = new URLSearchParams({
          page: String(page),
          page_size: String(pageSize),
        });
        if (q.trim()) qs.set("q", q.trim());
        const data = await api.searchCitizens(qs);
        total = data.total ?? 0;
        allItems.push(...(data.items ?? []));
        if (allItems.length >= total || !(data.items?.length)) break;
        page += 1;
        if (page > 50) break;
      }
      const rows = allItems.map((c) => {
        const row = citizenToRow(c);
        const status = (c.status || "").toUpperCase();
        const linkedLocal =
          Boolean(row.id && censusIds.has(row.id)) || Boolean(row.nic && censusIds.has(row.nic));
        // Recensé national = fiche ACTIVE avec NIC (promue) ou acte local CENSUS
        const hasCensus = linkedLocal || (status === "ACTIVE" && Boolean(row.nic));
        return {
          ...row,
          hasCensus,
          biometricNote: [row.fingerprint_note, row.iris_note].filter(Boolean).join(" · ") || "Non enrôlé",
        };
      });
      setPersons(rows);
      setTotal(total || rows.length);
      setSource("api");
    } catch (e) {
      setError(
        `${e instanceof Error ? e.message : "Erreur API"} — le registre national n’a pas pu être chargé (ne pas confondre avec le cache local).`,
      );
      // Ne plus masquer l’échec API avec un faux total local : liste vide + message clair.
      setPersons([]);
      setTotal(0);
      setSource("api");
    } finally {
      setBusy(false);
    }
  }, [hasApi, q, censusIds]);

  useEffect(() => {
    const t = window.setTimeout(() => void load(), q ? 280 : 0);
    return () => window.clearTimeout(t);
  }, [load, q]);

  function personIsDead(p: PopRow): boolean {
    const st = (p.registryStatus || "").toUpperCase();
    return st === "DECEASED" || isDeceased(p.id, p.nic);
  }

  const livingPersons = useMemo(() => persons.filter((p) => !personIsDead(p)), [persons]);

  const stats = useMemo(() => populationBreakdown(livingPersons), [livingPersons]);

  const rows = useMemo(() => {
    return persons.filter((p) => {
      const dead = personIsDead(p);
      if (civilStatus === "DECEDE") {
        if (!dead) return false;
      } else {
        // Population courante = vivants uniquement
        if (dead) return false;
        if (civilStatus && p.etat_civil !== (civilStatus as EtatCivil)) return false;
      }
      if (view === "recenses" && !p.hasCensus) return false;
      if (sexe && p.sexe !== sexe) return false;
      if (nat && personNationalite(p) !== nat) return false;
      return true;
    });
  }, [persons, sexe, nat, civilStatus, view]);

  useEffect(() => {
    setPage(1);
  }, [q, sexe, nat, civilStatus, view]);

  useEffect(() => {
    const editId = params.get("edit");
    if (!editId || persons.length === 0) return;
    const row = persons.find((p) => p.id === editId);
    if (!row) return;
    const local = getPerson(row.id) ?? row;
    setEditRow(row);
    setEditForm({
      nom: local.nom || "",
      postnom: local.postnom || "",
      prenom: local.prenom || "",
      sexe: (local.sexe as Sexe) || "M",
      date_naissance: (local.date_naissance || "").slice(0, 10),
      lieu_naissance: local.lieu_naissance || "",
      etat_civil: local.etat_civil || "CELIBATAIRE",
    });
    const next = new URLSearchParams(params);
    next.delete("edit");
    setParams(next, { replace: true });
  }, [params, persons, setParams]);

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageRows = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const exportRows = rows.map((p) => ({
    nic: p.nic,
    nom_complet: displayName(p),
    sexe: p.sexe,
    nationalite: personNationalite(p),
    date_naissance: p.date_naissance,
    lieu_naissance: p.lieu_naissance,
    statut_civil: civilStatusLabel(p),
    biometrie: p.biometricNote || "",
  }));

  const pieSexe = [
    { label: "Hommes", value: stats.hommes.total, color: RDC.blue },
    { label: "Femmes", value: stats.femmes.total, color: RDC.red },
  ];
  const pieNat = [
    { label: "Congolais(e)", value: stats.total.congolais, color: RDC.yellow },
    { label: "Étranger", value: stats.total.etranger, color: RDC.blueDeep },
  ];
  const pieAge = [
    { label: "Mineurs", value: stats.total.mineurs.total, color: RDC.yellowDeep },
    { label: "Majeurs", value: stats.total.majeurs.total, color: RDC.blue },
  ];
  const histo = [
    { label: "H min. C", value: stats.hommes.mineurs.congolais, color: rdcColor(0) },
    { label: "H min. É", value: stats.hommes.mineurs.etranger, color: rdcColor(1) },
    { label: "H maj. C", value: stats.hommes.majeurs.congolais, color: rdcColor(2) },
    { label: "H maj. É", value: stats.hommes.majeurs.etranger, color: rdcColor(3) },
    { label: "F min. C", value: stats.femmes.mineurs.congolais, color: rdcColor(4) },
    { label: "F min. É", value: stats.femmes.mineurs.etranger, color: rdcColor(5) },
    { label: "F maj. C", value: stats.femmes.majeurs.congolais, color: rdcColor(6) },
    { label: "F maj. É", value: stats.femmes.majeurs.etranger, color: rdcColor(7) },
  ];

  function setView(next: PopView) {
    const p = new URLSearchParams(params);
    if (next === "all") p.delete("view");
    else p.set("view", next);
    setParams(p, { replace: true });
  }

  const title =
    view === "recenses"
      ? "Personnes recensées"
      : view === "identification"
        ? "Identification biométrique"
        : showAnalytics
          ? "Liste de la population"
          : "Population";

  return (
    <div>
      <div className="eg-page-head">
        <div>
          <p className="eg-breadcrumb">
            <Link to="/">Accueil</Link> / <Link to="/population">Population</Link>
          </p>
          <h2 className="page-title">{title}</h2>
          <p className="page-lead">
            {view === "identification" ? (
              <>Données biométriques et statut civil de chaque personne du registre.</>
            ) : view === "recenses" ? (
              <>
                Personnes recensées (NIC actif national ou acte local). Total registre : {total}.
              </>
            ) : source === "api" ? (
              <>
                Registre national — <strong>{total}</strong> fiche(s) au total. Affichage {PAGE_SIZE}{" "}
                par page ({rows.length} après filtres) — pagination en bas. Les NIC officiels ont 14
                chiffres.
              </>
            ) : (
              <>
                Mode local navigateur — <strong>{total}</strong> fiche(s) en cache seulement (ce n’est
                pas le registre national à 110). Reconnectez-vous : officier / DemoCivil2026!
              </>
            )}
          </p>
        </div>
        <div className="toolbar" style={{ margin: 0, gap: "0.4rem", display: "flex", flexWrap: "wrap" }}>
          <button type="button" className="btn-add" onClick={() => navigate("/census")}>
            + Ajouter
          </button>
        </div>
      </div>

      <div className="dash-quick pop-action-bar" style={{ marginBottom: "1rem", flexWrap: "wrap" }}>
        <button
          type="button"
          className={`btn-secondary btn-sm${view === "all" ? " active" : ""}`}
          onClick={() => setView("all")}
        >
          Tous
        </button>
        <button
          type="button"
          className={`btn-secondary btn-sm${view === "recenses" ? " active" : ""}`}
          onClick={() => setView("recenses")}
        >
          Recensement
        </button>
        <button
          type="button"
          className={`btn-secondary btn-sm${view === "identification" ? " active" : ""}`}
          onClick={() => setView("identification")}
        >
          Identification
        </button>
        <Link className="btn-secondary btn-sm" to="/biometrie">
          Biométrie
        </Link>
        <Link className="btn-secondary btn-sm" to="/census/scan-coupon">
          Scanner QR code
        </Link>
        <Link className="btn-secondary btn-sm" to="/cartes-livraison">
          Impression carte
        </Link>
        {view === "identification" ? (
          <Link className="btn-primary btn-sm" to="/biometrie/identification">
            Recherche 1:N
          </Link>
        ) : null}
      </div>

      {error ? (
        <div className="login-error" role="alert" style={{ marginBottom: "1rem" }}>
          {error}
        </div>
      ) : null}

      {actionMsg ? (
        <div className="success-banner" role="status" style={{ marginBottom: "1rem" }}>
          {actionMsg}
        </div>
      ) : null}

      {showAnalytics && view === "all" ? (
        <>
          <PopulationStatBlocks hommes={stats.hommes} femmes={stats.femmes} total={stats.total} />
          <div className="eg-charts-row">
            <PieChart title="Répartition par sexe (camembert)" data={pieSexe} />
            <PieChart title="Nationalité (camembert)" data={pieNat} />
            <PieChart title="Mineurs / majeurs (camembert)" data={pieAge} />
            <BarChart title="Histogramme sexe × âge × nationalité" data={histo} height={180} />
          </div>
        </>
      ) : null}

      <div className="panel">
        <div className="panel-head">
          <div className="eg-filter-bar">
            <label className="muted small" htmlFor="pop-search">
              Recherche :
            </label>
            <input
              id="pop-search"
              className="form-control"
              style={{ marginBottom: 0, minWidth: 200 }}
              placeholder="NIC, nom, prénom…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <select
              className="form-control"
              style={{ marginBottom: 0, width: "auto" }}
              value={sexe}
              onChange={(e) => setSexe(e.target.value)}
            >
              <option value="">Tous sexes</option>
              <option value="M">Hommes</option>
              <option value="F">Femmes</option>
            </select>
            <select
              className="form-control"
              style={{ marginBottom: 0, width: "auto" }}
              value={nat}
              onChange={(e) => setNat(e.target.value)}
            >
              <option value="">Toutes nationalités</option>
              <option value="CONGOLAIS">Congolais(e)</option>
              <option value="ETRANGER">Étranger</option>
            </select>
            <select
              className="form-control"
              style={{ marginBottom: 0, width: "auto" }}
              value={civilStatus}
              onChange={(e) => setCivilStatus(e.target.value)}
              aria-label="Situation"
              title="Situation de la personne (marié, célibataire, décédé…)"
            >
              <option value="">Toutes situations</option>
              {ETAT_CIVIL_OPTIONS.filter((o) => o.value !== "UNKNOWN").map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
              <option value="DECEDE">Décédé(e)</option>
            </select>
            <button type="button" className="btn-secondary btn-sm" onClick={() => void load()} disabled={busy}>
              {busy ? "…" : "Actualiser"}
            </button>
          </div>
          <div className="toolbar" style={{ margin: 0, display: "flex", flexWrap: "wrap", gap: "0.4rem", alignItems: "center" }}>
            <button type="button" className="btn-primary btn-sm" onClick={() => navigate("/census")}>
              Ajouter
            </button>
            <DataToolbar filename="population" rows={exportRows} />
          </div>
        </div>

        <div className="table-scroll">
          <table className="data-table eg-table">
            <thead>
              <tr>
                <th>#</th>
                <th>N°</th>
                <th>Nom</th>
                <th>Postnom</th>
                <th>Prénom</th>
                <th>Date</th>
                <th>Situation</th>
                {view === "identification" ? <th>Biométrie</th> : null}
                {view === "recenses" ? <th>Recensement</th> : null}
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={view === "identification" || view === "recenses" ? 9 : 8} className="muted">
                    {busy ? "Chargement…" : "Aucune personne trouvée."}
                  </td>
                </tr>
              ) : (
                pageRows.map((p, i) => (
                  <tr key={p.id}>
                    <td>{(safePage - 1) * PAGE_SIZE + i + 1}</td>
                    <td>
                      <code title={p.registryStatus || ""}>
                        {displayNic(p.nic, p.registryStatus)}
                      </code>
                      {(p.registryStatus || "").toUpperCase() === "DRAFT" ? (
                        <div className="muted small">Brouillon</div>
                      ) : null}
                    </td>
                    <td>{p.nom}</td>
                    <td>{p.postnom || "—"}</td>
                    <td>{p.prenom}</td>
                    <td>
                      {(p.date_naissance || "—").toString().slice(0, 10)}
                      {p.lieu_naissance ? ` · ${p.lieu_naissance}` : ""}
                    </td>
                    <td>
                      <span className="status-badge">{civilStatusLabel(p)}</span>
                    </td>
                    {view === "identification" ? (
                      <td>
                        <span className="muted small">{p.biometricNote || "Non enrôlé"}</span>
                      </td>
                    ) : null}
                    {view === "recenses" ? (
                      <td>
                        <span className="status-badge">Recensé</span>
                      </td>
                    ) : null}
                    <td className="table-actions">
                      <Link className="btn-add btn-sm" to={`/population/${p.id}`}>
                        Voir
                      </Link>
                      <button
                        type="button"
                        className="btn-secondary btn-sm"
                        onClick={() => {
                          const local = getPerson(p.id) ?? p;
                          setEditRow(p);
                          setEditForm({
                            nom: local.nom || "",
                            postnom: local.postnom || "",
                            prenom: local.prenom || "",
                            sexe: (local.sexe as Sexe) || "M",
                            date_naissance: (local.date_naissance || "").slice(0, 10),
                            lieu_naissance: local.lieu_naissance || "",
                            etat_civil: local.etat_civil || "CELIBATAIRE",
                          });
                          setActionMsg(null);
                        }}
                      >
                        Modifier
                      </button>
                      <button
                        type="button"
                        className="btn-secondary btn-sm"
                        onClick={() => {
                          if (
                            !window.confirm(
                              `Supprimer la fiche de ${displayName(p)} ?\n(Action locale — le registre national n’est pas effacé.)`,
                            )
                          ) {
                            return;
                          }
                          const ok = deletePerson(p.id);
                          if (ok) {
                            setActionMsg(`Fiche locale supprimée : ${displayName(p)}`);
                            void load();
                          } else {
                            setActionMsg(
                              "Suppression locale impossible (fiche API uniquement). Utilisez Corrections pour une demande officielle.",
                            );
                          }
                        }}
                      >
                        Supprimer
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="eg-pager">
          <span className="muted small">
            Showing {rows.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1} to{" "}
            {Math.min(safePage * PAGE_SIZE, rows.length)} of {rows.length} entries
            {source === "api" && total > rows.length
              ? ` (registre: ${total})`
              : source === "api"
                ? ` (registre: ${total})`
                : ""}
          </span>
          <div className="eg-pager-btns">
            <button type="button" className="btn-secondary btn-sm" disabled={safePage <= 1} onClick={() => setPage(1)}>
              «
            </button>
            <button
              type="button"
              className="btn-secondary btn-sm"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              ‹
            </button>
            <span className="eg-pager-num">
              {safePage} / {pageCount}
            </span>
            <button
              type="button"
              className="btn-secondary btn-sm"
              disabled={safePage >= pageCount}
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
            >
              ›
            </button>
            <button
              type="button"
              className="btn-secondary btn-sm"
              disabled={safePage >= pageCount}
              onClick={() => setPage(pageCount)}
            >
              »
            </button>
          </div>
        </div>
      </div>

      {editRow ? (
        <div className="modal-backdrop" onClick={() => setEditRow(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <h3 style={{ marginTop: 0 }}>Modifier — {displayName(editRow)}</h3>
            <p className="muted small">
              La situation (célibataire, marié…) est enregistrée sur ce poste et reste visible après
              Actualiser. Les autres champs du registre national se rectifient via{" "}
              <Link to="/corrections">Corrections</Link>.
            </p>
            <form
              className="form-grid"
              onSubmit={(e) => {
                e.preventDefault();
                upsertLocalPersonFromApi({
                  id: editRow.id,
                  nom: editForm.nom.trim(),
                  postnom: editForm.postnom.trim(),
                  prenom: editForm.prenom.trim(),
                  sexe: editForm.sexe,
                  date_naissance: editForm.date_naissance,
                  lieu_naissance: editForm.lieu_naissance.trim(),
                  etat_civil: editForm.etat_civil,
                  nic: editRow.nic || "",
                });
                setPersons((prev) =>
                  prev.map((p) =>
                    p.id === editRow.id
                      ? {
                          ...p,
                          nom: editForm.nom.trim(),
                          postnom: editForm.postnom.trim(),
                          prenom: editForm.prenom.trim(),
                          sexe: editForm.sexe,
                          date_naissance: editForm.date_naissance,
                          lieu_naissance: editForm.lieu_naissance.trim(),
                          etat_civil: editForm.etat_civil,
                        }
                      : p,
                  ),
                );
                setActionMsg(
                  `Situation mise à jour : ${editForm.nom} ${editForm.prenom} → ${
                    ETAT_CIVIL_OPTIONS.find((o) => o.value === editForm.etat_civil)?.label ||
                    editForm.etat_civil
                  }`,
                );
                setEditRow(null);
              }}
            >
              <div>
                <label className="form-label">Nom</label>
                <input
                  className="form-control"
                  value={editForm.nom}
                  onChange={(e) => setEditForm((f) => ({ ...f, nom: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="form-label">Postnom</label>
                <input
                  className="form-control"
                  value={editForm.postnom}
                  onChange={(e) => setEditForm((f) => ({ ...f, postnom: e.target.value }))}
                />
              </div>
              <div>
                <label className="form-label">Prénom</label>
                <input
                  className="form-control"
                  value={editForm.prenom}
                  onChange={(e) => setEditForm((f) => ({ ...f, prenom: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="form-label">Sexe</label>
                <select
                  className="form-control"
                  value={editForm.sexe}
                  onChange={(e) => setEditForm((f) => ({ ...f, sexe: e.target.value as Sexe }))}
                >
                  <option value="M">Masculin</option>
                  <option value="F">Féminin</option>
                </select>
              </div>
              <div>
                <label className="form-label">Date de naissance</label>
                <input
                  className="form-control"
                  type="date"
                  value={editForm.date_naissance}
                  onChange={(e) => setEditForm((f) => ({ ...f, date_naissance: e.target.value }))}
                />
              </div>
              <div>
                <label className="form-label">Situation</label>
                <select
                  className="form-control"
                  value={editForm.etat_civil}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, etat_civil: e.target.value as EtatCivil }))
                  }
                >
                  {ETAT_CIVIL_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="full">
                <label className="form-label">Lieu de naissance</label>
                <input
                  className="form-control"
                  value={editForm.lieu_naissance}
                  onChange={(e) => setEditForm((f) => ({ ...f, lieu_naissance: e.target.value }))}
                />
              </div>
              <div className="full" style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                <button type="submit" className="btn-primary">
                  Enregistrer
                </button>
                <button type="button" className="btn-secondary" onClick={() => setEditRow(null)}>
                  Annuler
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
