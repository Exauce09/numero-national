/** Liste population / personnes — registre national (API) + fallback local. */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { BarChart, PieChart } from "../components/Charts";
import DataToolbar from "../components/DataToolbar";
import { PopulationStatBlocks } from "../components/StatBlocks";
import { api, type CitizenListItem } from "../api";
import { getSession } from "../auth";
import { nationalHitToPerson } from "../nationalSearch";
import {
  ETAT_CIVIL_OPTIONS,
  displayName,
  listActs,
  listPopulationPersons,
  personNationalite,
  populationBreakdown,
  type EtatCivil,
  type Person,
} from "../registry";

const PAGE_SIZE = 10;

type PopView = "all" | "recenses" | "identification";

type PopRow = Person & {
  registryStatus?: string;
  hasCensus?: boolean;
  biometricNote?: string;
};

function citizenToRow(c: CitizenListItem): PopRow {
  const p = nationalHitToPerson({
    id: c.id,
    nic: c.nic,
    status: c.status,
    family_name: c.family_name,
    given_names: c.given_names,
    date_of_birth: c.date_of_birth,
    sex: c.sex,
    place_of_birth: c.place_of_birth,
    province_code: c.province_code,
    ville: c.ville,
    commune_code: c.commune_code,
  });
  return { ...p, registryStatus: c.status };
}

function civilStatusLabel(p: PopRow): string {
  if ((p.registryStatus || "").toUpperCase() === "DECEASED" || p.etat_civil === "UNKNOWN") {
    const rs = (p.registryStatus || "").toUpperCase();
    if (rs === "DECEASED") return "Décédé(e)";
  }
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
    if (!hasApi) {
      const local = listPopulationPersons().map((p) => ({
        ...p,
        registryStatus: "LOCAL",
        hasCensus: Boolean(p.id && censusIds.has(p.id)) || Boolean(p.nic && censusIds.has(p.nic)),
        biometricNote: [p.fingerprint_note, p.iris_note].filter(Boolean).join(" · ") || "Non enrôlé",
      }));
      setPersons(local);
      setSource("local");
      setTotal(local.length);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const qs = new URLSearchParams({
        page: "1",
        page_size: "100",
      });
      if (q.trim()) qs.set("q", q.trim());
      const data = await api.searchCitizens(qs);
      const rows = (data.items ?? []).map((c) => {
        const row = citizenToRow(c);
        return {
          ...row,
          hasCensus: Boolean(row.id && censusIds.has(row.id)) || Boolean(row.nic && censusIds.has(row.nic)),
          biometricNote: [row.fingerprint_note, row.iris_note].filter(Boolean).join(" · ") || "Non enrôlé",
        };
      });
      setPersons(rows);
      setTotal(data.total ?? rows.length);
      setSource("api");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossible de charger le registre national.");
      const local = listPopulationPersons().map((p) => ({
        ...p,
        registryStatus: "LOCAL",
        hasCensus: Boolean(p.id && censusIds.has(p.id)) || Boolean(p.nic && censusIds.has(p.nic)),
        biometricNote: [p.fingerprint_note, p.iris_note].filter(Boolean).join(" · ") || "Non enrôlé",
      }));
      setPersons(local);
      setTotal(local.length);
      setSource("local");
    } finally {
      setBusy(false);
    }
  }, [hasApi, q, censusIds]);

  useEffect(() => {
    const t = window.setTimeout(() => void load(), q ? 280 : 0);
    return () => window.clearTimeout(t);
  }, [load, q]);

  const stats = useMemo(() => populationBreakdown(persons), [persons]);

  const rows = useMemo(() => {
    return persons.filter((p) => {
      if (view === "recenses" && !p.hasCensus) return false;
      if (sexe && p.sexe !== sexe) return false;
      if (nat && personNationalite(p) !== nat) return false;
      if (civilStatus === "DECEDE") {
        if ((p.registryStatus || "").toUpperCase() !== "DECEASED") return false;
      } else if (civilStatus) {
        if (p.etat_civil !== (civilStatus as EtatCivil)) return false;
      }
      return true;
    });
  }, [persons, sexe, nat, civilStatus, view]);

  useEffect(() => {
    setPage(1);
  }, [q, sexe, nat, civilStatus, view]);

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
    { label: "Hommes", value: stats.hommes.total, color: "#5d87ff" },
    { label: "Femmes", value: stats.femmes.total, color: "#fa896b" },
  ];
  const pieNat = [
    { label: "Congolais(e)", value: stats.total.congolais, color: "#13deb9" },
    { label: "Étranger", value: stats.total.etranger, color: "#ffae1f" },
  ];
  const pieAge = [
    { label: "Mineurs", value: stats.total.mineurs.total, color: "#763ebd" },
    { label: "Majeurs", value: stats.total.majeurs.total, color: "#49beff" },
  ];
  const histo = [
    { label: "H min. C", value: stats.hommes.mineurs.congolais, color: "#5d87ff" },
    { label: "H min. É", value: stats.hommes.mineurs.etranger, color: "#539bff" },
    { label: "H maj. C", value: stats.hommes.majeurs.congolais, color: "#13deb9" },
    { label: "H maj. É", value: stats.hommes.majeurs.etranger, color: "#0aad8a" },
    { label: "F min. C", value: stats.femmes.mineurs.congolais, color: "#fa896b" },
    { label: "F min. É", value: stats.femmes.mineurs.etranger, color: "#fdd835" },
    { label: "F maj. C", value: stats.femmes.majeurs.congolais, color: "#ffae1f" },
    { label: "F maj. É", value: stats.femmes.majeurs.etranger, color: "#fc4b6c" },
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
              <>Personnes déjà recensées (acte de recensement lié).</>
            ) : source === "api" ? (
              <>
                Registre national — {total} fiche(s) en base. Les fiches recensement non promues
                (SYNCED/DRAFT) n&apos;apparaissent pas tant qu&apos;elles ne sont pas dans le registre.
              </>
            ) : (
              <>Mode local (navigateur). Connectez-vous avec un compte API pour le registre national.</>
            )}
          </p>
        </div>
        <button type="button" className="btn-add" onClick={() => navigate("/census")}>
          + Ajouter
        </button>
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
          <DataToolbar filename="population" rows={exportRows} />
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
                <th>Naissance</th>
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
                      <code>{p.nic || "—"}</code>
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
    </div>
  );
}
