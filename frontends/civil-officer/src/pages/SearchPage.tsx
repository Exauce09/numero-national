import { FormEvent, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import DataToolbar from "../components/DataToolbar";
import { personLocation, searchPersons, type Person } from "../registry";

export default function SearchPage() {
  const [params, setParams] = useSearchParams();
  const initial = params.get("q") ?? "";
  const [q, setQ] = useState(initial);
  const [hits, setHits] = useState<Person[]>(() => searchPersons(initial));

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
    const loc = personLocation(p.id, p.nic);
    return {
      nic: p.nic,
      nom: p.nom,
      postnom: p.postnom,
      prenom: p.prenom,
      date_naissance: p.date_naissance,
      province: loc.province,
      ville: loc.ville,
      sexe: p.sexe,
      etat_civil: p.etat_civil,
    };
  });

  return (
    <div>
      <h2 className="page-title">Recherche</h2>
      <p className="page-lead">
        Recherche intelligente par NIC, nom, postnom, prénom, date de naissance, province et ville.
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
              <th>Sexe</th>
            </tr>
          </thead>
          <tbody>
            {hits.map((p) => {
              const loc = personLocation(p.id, p.nic);
              return (
                <tr key={p.id}>
                  <td>{p.nic}</td>
                  <td>{p.nom}</td>
                  <td>{p.postnom || "—"}</td>
                  <td>{p.prenom}</td>
                  <td>{p.date_naissance || "—"}</td>
                  <td>{loc.province || "—"}</td>
                  <td>{loc.ville || "—"}</td>
                  <td>{p.sexe}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
