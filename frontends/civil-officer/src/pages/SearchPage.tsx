import { FormEvent, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import DataToolbar from "../components/DataToolbar";
import {
  displayName,
  getPerson,
  personOrigin,
  searchPersons,
  type Person,
} from "../registry";

export default function SearchPage() {
  const [params, setParams] = useSearchParams();
  const initial = params.get("q") ?? "";
  const [q, setQ] = useState(initial);
  const [hits, setHits] = useState<Person[]>(() => searchPersons(initial));
  const [selected, setSelected] = useState<Person | null>(null);

  useEffect(() => {
    const next = params.get("q") ?? "";
    setQ(next);
    setHits(searchPersons(next));
  }, [params]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const value = q.trim();
    setParams(value ? { q: value } : {});
    setHits(searchPersons(value));
  }

  const rows = hits.map((p) => {
    const origin = personOrigin(p);
    return {
      nic: p.nic,
      nom: p.nom,
      postnom: p.postnom,
      prenom: p.prenom,
      date_naissance: p.date_naissance,
      province: origin.province,
      ville: origin.ville,
      origine_source:
        origin.source === "father" ? "Père" : origin.source === "mother" ? "Mère" : origin.source === "self" ? "Propre" : "",
      sexe: p.sexe,
      etat_civil: p.etat_civil,
    };
  });

  return (
    <div>
      <h2 className="page-title">Recherche</h2>
      <p className="page-lead">
        Recherche intelligente par NIC, nom, postnom, prénom, date de naissance, province et ville. Pour un
        enfant / nouveau-né, l&apos;origine affichée vient du père, sinon de la mère.
      </p>
      <div className="panel">
        <form className="toolbar" onSubmit={onSubmit}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <label className="form-label">Critères</label>
            <input
              className="form-control"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Ex. Kabila 1990 Kinshasa — ou un NIC"
            />
          </div>
          <button className="btn-primary" style={{ width: "auto", minWidth: 140 }} type="submit">
            Rechercher
          </button>
        </form>
        <div className="panel-head" style={{ marginTop: "1rem" }}>
          <h3 className="panel-title">{hits.length} résultat(s)</h3>
          <DataToolbar filename="recherche_personnes" rows={rows} />
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>NIC</th>
              <th>Nom</th>
              <th>Postnom</th>
              <th>Prénom</th>
              <th>Naissance</th>
              <th>Province</th>
              <th>Ville</th>
              <th>Origine</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {hits.map((p) => {
              const origin = personOrigin(p);
              const src =
                origin.source === "father"
                  ? "Père"
                  : origin.source === "mother"
                    ? "Mère"
                    : origin.source === "self"
                      ? "Propre"
                      : "—";
              return (
                <tr key={p.id}>
                  <td>{p.nic}</td>
                  <td>{p.nom}</td>
                  <td>{p.postnom || "—"}</td>
                  <td>{p.prenom}</td>
                  <td>{p.date_naissance || "—"}</td>
                  <td>{origin.province || "—"}</td>
                  <td>{origin.ville || "—"}</td>
                  <td>{src}</td>
                  <td>
                    <button type="button" className="btn-secondary btn-sm" onClick={() => setSelected(p)}>
                      Détail
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selected ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={() => setSelected(null)}>
          <div className="modal-panel" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
            <h3>{displayName(selected)}</h3>
            <dl className="act-print-fields">
              <div>
                <dt>NIC</dt>
                <dd>{selected.nic}</dd>
              </div>
              <div>
                <dt>Naissance</dt>
                <dd>
                  {selected.date_naissance || "—"} · {selected.lieu_naissance || "—"}
                </dd>
              </div>
              {(() => {
                const origin = personOrigin(selected);
                const father = selected.father_id ? getPerson(selected.father_id) : undefined;
                const mother = selected.mother_id ? getPerson(selected.mother_id) : undefined;
                return (
                  <>
                    <div>
                      <dt>Père</dt>
                      <dd>{father ? `${displayName(father)} (${father.nic})` : "—"}</dd>
                    </div>
                    <div>
                      <dt>Mère</dt>
                      <dd>{mother ? `${displayName(mother)} (${mother.nic})` : "—"}</dd>
                    </div>
                    <div>
                      <dt>Origine (province / ville…)</dt>
                      <dd>
                        {origin.label || "—"}
                        {origin.source === "father"
                          ? ` — via père ${origin.source_name}`
                          : origin.source === "mother"
                            ? ` — via mère ${origin.source_name}`
                            : origin.source === "self"
                              ? " — infos propres"
                              : ""}
                      </dd>
                    </div>
                    {origin.territoire ? (
                      <div>
                        <dt>Territoire</dt>
                        <dd>{origin.territoire}</dd>
                      </div>
                    ) : null}
                    {origin.secteur ? (
                      <div>
                        <dt>Secteur / Commune</dt>
                        <dd>{origin.secteur}</dd>
                      </div>
                    ) : null}
                    {origin.village ? (
                      <div>
                        <dt>Village</dt>
                        <dd>{origin.village}</dd>
                      </div>
                    ) : null}
                  </>
                );
              })()}
            </dl>
            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={() => setSelected(null)}>
                Fermer
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
