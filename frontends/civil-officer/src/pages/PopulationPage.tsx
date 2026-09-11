/** Liste population / personnes — registre national (API) + fallback local. */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BarChart, PieChart } from "../components/Charts";
import DataToolbar from "../components/DataToolbar";
import { PopulationStatBlocks } from "../components/StatBlocks";
import { api, type CitizenListItem } from "../api";
import { getSession } from "../auth";
import { nationalHitToPerson } from "../nationalSearch";
import {
  displayName,
  listPopulationPersons,
  personNationalite,
  populationBreakdown,
  type Person,
} from "../registry";

const PAGE_SIZE = 10;

type PopRow = Person & { registryStatus?: string };

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

export default function PopulationPage({ showAnalytics = false }: { showAnalytics?: boolean }) {
  const navigate = useNavigate();
  const hasApi = Boolean(getSession()?.accessToken);
  const [q, setQ] = useState("");
  const [sexe, setSexe] = useState("");
  const [nat, setNat] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [persons, setPersons] = useState<PopRow[]>(() =>
    hasApi ? [] : listPopulationPersons().map((p) => ({ ...p, registryStatus: "LOCAL" })),
  );
  const [total, setTotal] = useState(0);
  const [source, setSource] = useState<"api" | "local">(hasApi ? "api" : "local");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!hasApi) {
      const local = listPopulationPersons().map((p) => ({ ...p, registryStatus: "LOCAL" }));
      setPersons(local);
      setSource("local");
      setTotal(local.length);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: "1",
        page_size: "100",
      });
      if (q.trim()) params.set("q", q.trim());
      const data = await api.searchCitizens(params);
      const rows = (data.items ?? []).map(citizenToRow);
      setPersons(rows);
      setTotal(data.total ?? rows.length);
      setSource("api");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossible de charger le registre national.");
      const local = listPopulationPersons().map((p) => ({ ...p, registryStatus: "LOCAL" }));
      setPersons(local);
      setTotal(local.length);
      setSource("local");
    } finally {
      setBusy(false);
    }
  }, [hasApi, q]);

  useEffect(() => {
    const t = window.setTimeout(() => void load(), q ? 280 : 0);
    return () => window.clearTimeout(t);
  }, [load, q]);

  const stats = useMemo(() => populationBreakdown(persons), [persons]);

  const rows = useMemo(() => {
    return persons.filter((p) => {
      if (sexe && p.sexe !== sexe) return false;
      if (nat && personNationalite(p) !== nat) return false;
      if (status && (p.registryStatus || "").toUpperCase().indexOf(status.toUpperCase()) < 0) {
        return false;
      }
      return true;
    });
  }, [persons, sexe, nat, status]);

  useEffect(() => {
    setPage(1);
  }, [q, sexe, nat, status]);

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
    statut: p.registryStatus || p.etat_civil,
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

  return (
    <div>
      <div className="eg-page-head">
        <div>
          <p className="eg-breadcrumb">
            <Link to="/">Accueil</Link> / Population
          </p>
          <h2 className="page-title">{showAnalytics ? "Liste de la population" : "Population"}</h2>
          <p className="page-lead">
            {source === "api" ? (
              <>
                Registre national — {total} fiche(s) en base. Les fiches recensement non promues
                (SYNCED/DRAFT) n&apos;apparaissent pas tant qu&apos;elles ne sont pas dans{" "}
                <code>core_registry.citizens</code>.
              </>
            ) : (
              <>
                Mode local (navigateur). Connectez-vous avec un compte API pour voir PostgreSQL.
                Vivants uniquement ; nouveaux-nés (≤ 90 j) exclus en mode local.
              </>
            )}
          </p>
        </div>
        <button type="button" className="btn-add" onClick={() => navigate("/census")}>
          + Ajouter
        </button>
      </div>

      {error ? (
        <div className="login-error" role="alert" style={{ marginBottom: "1rem" }}>
          {error}
        </div>
      ) : null}
      {!hasApi ? (
        <p className="muted" style={{ marginBottom: "1rem" }}>
          Sans jeton API, la liste ne lit que le stockage local du navigateur — pas PostgreSQL.
        </p>
      ) : null}

      {showAnalytics ? (
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
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              aria-label="Statut"
            >
              <option value="">Tous statuts</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="PENDING">PENDING</option>
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
                <th>Statut</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="muted">
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
                      <span className="status-badge">{p.registryStatus || "—"}</span>
                    </td>
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
