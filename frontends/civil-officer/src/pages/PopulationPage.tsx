/** manage-population.php — liste détaillée + stats + graphiques. */

import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BarChart, PieChart } from "../components/Charts";
import DataToolbar from "../components/DataToolbar";
import { PopulationStatBlocks } from "../components/StatBlocks";
import {
  displayName,
  listPersons,
  personNationalite,
  populationBreakdown,
  type Person,
} from "../registry";

const PAGE_SIZE = 10;

export default function PopulationPage({ showAnalytics = false }: { showAnalytics?: boolean }) {
  const navigate = useNavigate();
  const persons = listPersons();
  const [q, setQ] = useState("");
  const [sexe, setSexe] = useState("");
  const [nat, setNat] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Person | null>(null);

  const stats = useMemo(() => populationBreakdown(persons), [persons]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return persons.filter((p) => {
      if (sexe && p.sexe !== sexe) return false;
      if (nat && personNationalite(p) !== nat) return false;
      if (!needle) return true;
      const blob = `${p.nom} ${p.postnom} ${p.prenom} ${p.nic} ${p.lieu_naissance}`.toLowerCase();
      return blob.includes(needle);
    });
  }, [persons, q, sexe, nat]);

  useEffect(() => {
    setPage(1);
  }, [q, sexe, nat]);

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
    etat_civil: p.etat_civil,
  }));

  const pieSexe = [
    { label: "Hommes", value: stats.hommes.total, color: "#5d87ff" },
    { label: "Femmes", value: stats.femmes.total, color: "#fa896b" },
  ];
  const pieNat = [
    { label: "Congolais(e)", value: stats.total.congolais, color: "#13deb9" },
    { label: "Étranger", value: stats.total.etranger, color: "#ffae1f" },
  ];
  const histo = [
    { label: "H Cong.", value: stats.hommes.congolais, color: "#5d87ff" },
    { label: "H Étr.", value: stats.hommes.etranger, color: "#539bff" },
    { label: "F Cong.", value: stats.femmes.congolais, color: "#fa896b" },
    { label: "F Étr.", value: stats.femmes.etranger, color: "#fdd835" },
  ];

  return (
    <div>
      <div className="eg-page-head">
        <div>
          <p className="eg-breadcrumb">
            <Link to="/">Accueil</Link> / Population
          </p>
          <h2 className="page-title">{showAnalytics ? "Liste de la population" : "Gérer la population"}</h2>
          <p className="page-lead">
            {showAnalytics ? (
              <>
                Vue statistique depuis le tableau de bord (style{" "}
                <a
                  href="https://www.justicia.website/egouv/COMMUNE/manage-population.php"
                  target="_blank"
                  rel="noreferrer"
                >
                  manage-population.php
                </a>
                ).
              </>
            ) : (
              <>Recherche, filtre, export et fiche détail — sans graphiques (menu opérationnel).</>
            )}
          </p>
        </div>
        <button type="button" className="btn-add" onClick={() => navigate("/census")}>
          + Ajouter
        </button>
      </div>

      {showAnalytics ? (
        <>
          <PopulationStatBlocks hommes={stats.hommes} femmes={stats.femmes} total={stats.total} />

          <div className="eg-charts-row">
            <PieChart title="Répartition par sexe (camembert)" data={pieSexe} />
            <PieChart title="Nationalité (camembert)" data={pieNat} />
            <BarChart title="Histogramme sexe × nationalité" data={histo} />
          </div>
        </>
      ) : null}

      <div className="panel">
        <div className="panel-head">
          <div className="eg-filter-bar">
            <label className="muted small" htmlFor="pop-search">
              Search:
            </label>
            <input
              id="pop-search"
              className="form-control"
              style={{ marginBottom: 0, minWidth: 200 }}
              placeholder="Rechercher…"
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
          </div>
          <DataToolbar filename="population" rows={exportRows} />
        </div>

        <div className="table-scroll">
          <table className="data-table eg-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Photo</th>
                <th>Num. national</th>
                <th>Nom complet</th>
                <th>Lieu &amp; date de naiss.</th>
                <th>Nationalité</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="muted">
                    Aucune personne trouvée.
                  </td>
                </tr>
              ) : (
                pageRows.map((p, i) => (
                  <tr key={p.id}>
                    <td>{(safePage - 1) * PAGE_SIZE + i + 1}</td>
                    <td>
                      {p.photo_data_url ? (
                        <img src={p.photo_data_url} alt="" className="eg-avatar-sm" />
                      ) : (
                        <span className="eg-avatar-sm eg-avatar-empty" aria-hidden>
                          {displayName(p).slice(0, 1)}
                        </span>
                      )}
                    </td>
                    <td>
                      <code>{p.nic}</code>
                    </td>
                    <td>{displayName(p)}</td>
                    <td>
                      {p.lieu_naissance || "—"}, {p.date_naissance || "—"}
                    </td>
                    <td>{personNationalite(p) === "ETRANGER" ? "Étranger" : "Congolais(e)"}</td>
                    <td className="table-actions">
                      <button type="button" className="btn-add btn-sm" onClick={() => setSelected(p)}>
                        Voir
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
            Showing {(rows.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1)} to{" "}
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

      {selected ? (
        <div className="modal-backdrop" onClick={() => setSelected(null)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <div className="panel-head">
              <h3 className="panel-title" style={{ margin: 0 }}>
                Fiche population
              </h3>
              <button type="button" className="btn-secondary btn-sm" onClick={() => setSelected(null)}>
                Fermer
              </button>
            </div>
            {selected.photo_data_url ? (
              <img src={selected.photo_data_url} alt="" className="eg-avatar-lg" />
            ) : null}
            <dl className="act-print-fields">
              <div>
                <dt>NIC</dt>
                <dd>{selected.nic}</dd>
              </div>
              <div>
                <dt>Nom</dt>
                <dd>{displayName(selected)}</dd>
              </div>
              <div>
                <dt>Sexe</dt>
                <dd>{selected.sexe === "M" ? "Homme" : "Femme"}</dd>
              </div>
              <div>
                <dt>Nationalité</dt>
                <dd>{personNationalite(selected) === "ETRANGER" ? "Étranger" : "Congolais(e)"}</dd>
              </div>
              <div>
                <dt>Naissance</dt>
                <dd>
                  {selected.lieu_naissance || "—"}, {selected.date_naissance || "—"}
                </dd>
              </div>
              <div>
                <dt>État civil</dt>
                <dd>{selected.etat_civil}</dd>
              </div>
            </dl>
          </div>
        </div>
      ) : null}
    </div>
  );
}
