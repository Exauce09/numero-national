import { FormEvent, useState } from "react";
import DataToolbar from "../components/DataToolbar";
import { displayName, searchPersons, type Person } from "../registry";

export default function SearchPage() {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Person[]>(() => searchPersons(""));

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setHits(searchPersons(q));
  }

  const rows = hits.map((p) => ({
    nic: p.nic,
    nom: displayName(p),
    sexe: p.sexe,
    date_naissance: p.date_naissance,
    etat_civil: p.etat_civil,
  }));

  return (
    <div>
      <h2 className="page-title">Recherche</h2>
      <p className="page-lead">Recherche dans le registre local (personnes).</p>
      <div className="panel">
        <form className="toolbar" onSubmit={onSubmit}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <label className="form-label">Recherche libre</label>
            <input
              className="form-control"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Nom, NIC, lieu…"
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
              <th>Sexe</th>
              <th>Naissance</th>
              <th>État civil</th>
            </tr>
          </thead>
          <tbody>
            {hits.map((p) => (
              <tr key={p.id}>
                <td>{p.nic}</td>
                <td>{displayName(p)}</td>
                <td>{p.sexe}</td>
                <td>{p.date_naissance}</td>
                <td>{p.etat_civil}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
