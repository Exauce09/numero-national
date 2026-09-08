/** manage-population.php — liste population communale style e-gov. */

import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import DataToolbar from "../components/DataToolbar";
import { displayName, listPersons, type Person } from "../registry";

export default function PopulationPage() {
  const navigate = useNavigate();
  const persons = listPersons();
  const [q, setQ] = useState("");
  const [sexe, setSexe] = useState("");
  const [selected, setSelected] = useState<Person | null>(null);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return persons.filter((p) => {
      if (sexe && p.sexe !== sexe) return false;
      if (!needle) return true;
      const blob = `${p.nom} ${p.postnom} ${p.prenom} ${p.nic} ${p.lieu_naissance}`.toLowerCase();
      return blob.includes(needle);
    });
  }, [persons, q, sexe]);

  const exportRows = rows.map((p) => ({
    nic: p.nic,
    nom: p.nom,
    postnom: p.postnom,
    prenom: p.prenom,
    sexe: p.sexe,
    date_naissance: p.date_naissance,
    lieu_naissance: p.lieu_naissance,
    etat_civil: p.etat_civil,
  }));

  return (
    <div>
      <div className="eg-page-head">
        <div>
          <p className="eg-breadcrumb">
            <Link to="/">Accueil</Link> / Population
          </p>
          <h2 className="page-title">Gérer la population</h2>
          <p className="page-lead">
            Même logique que{" "}
            <a
              href="https://www.justicia.website/egouv/COMMUNE/manage-population.php"
              target="_blank"
              rel="noreferrer"
            >
              manage-population.php
            </a>{" "}
            — recherche, filtre, export et fiche détail.
          </p>
        </div>
        <button type="button" className="btn-add" onClick={() => navigate("/census")}>
          + Ajouter
        </button>
      </div>

      <div className="panel">
        <div className="panel-head">
          <div className="eg-filter-bar">
            <input
              className="form-control"
              style={{ marginBottom: 0, minWidth: 200 }}
              placeholder="Rechercher (nom, NIC, lieu)…"
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
              <option value="M">Masculin</option>
              <option value="F">Féminin</option>
            </select>
            <span className="muted small">{rows.length} enregistrement(s)</span>
          </div>
          <DataToolbar filename="population" rows={exportRows} />
        </div>

        <div className="table-scroll">
          <table className="data-table eg-table">
            <thead>
              <tr>
                <th>NIC</th>
                <th>Nom complet</th>
                <th>Sexe</th>
                <th>Naissance</th>
                <th>Lieu</th>
                <th>État civil</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="muted">
                    Aucune personne trouvée.
                  </td>
                </tr>
              ) : (
                rows.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <code>{p.nic}</code>
                    </td>
                    <td>{displayName(p)}</td>
                    <td>{p.sexe}</td>
                    <td>{p.date_naissance}</td>
                    <td>{p.lieu_naissance || "—"}</td>
                    <td>{p.etat_civil}</td>
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
                <dd>{selected.sexe}</dd>
              </div>
              <div>
                <dt>Naissance</dt>
                <dd>
                  {selected.date_naissance} · {selected.lieu_naissance || "—"}
                </dd>
              </div>
              <div>
                <dt>État civil</dt>
                <dd>{selected.etat_civil}</dd>
              </div>
              <div>
                <dt>Handicap</dt>
                <dd>{selected.handicap_type}</dd>
              </div>
            </dl>
          </div>
        </div>
      ) : null}
    </div>
  );
}
