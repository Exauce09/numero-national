import { FormEvent, useState } from "react";
import ActPrintCard from "../components/ActPrintCard";
import DataToolbar from "../components/DataToolbar";
import PersonPicker from "../components/PersonPicker";
import {
  addAct,
  addPerson,
  getAct,
  listActs,
  updateAct,
  type Act,
  type Person,
  type Sexe,
} from "../registry";
import { getOfficerCommune } from "../commune";

export default function BirthsPage() {
  const [nom, setNom] = useState("");
  const [postnom, setPostnom] = useState("");
  const [prenom, setPrenom] = useState("");
  const [sexe, setSexe] = useState<Sexe>("M");
  const [dateNaissance, setDateNaissance] = useState("");
  const [lieuNaissance, setLieuNaissance] = useState("");
  const [mother, setMother] = useState<Person | null>(null);
  const [father, setFather] = useState<Person | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Act | null>(null);
  const [viewAct, setViewAct] = useState<Act | null>(null);
  const [editAct, setEditAct] = useState<Act | null>(null);
  const [editJson, setEditJson] = useState("");
  const [, bump] = useState(0);

  const acts = listActs("BIRTH");

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!mother) {
      setError("La mère est obligatoire.");
      return;
    }
    if (!nom.trim() || !prenom.trim() || !dateNaissance) {
      setError("Nom, prénom et date de naissance de l'enfant sont requis.");
      return;
    }
    try {
      const child = addPerson({
        nom: nom.trim(),
        postnom: postnom.trim(),
        prenom: prenom.trim(),
        sexe,
        date_naissance: dateNaissance,
        lieu_naissance: lieuNaissance.trim(),
        etat_civil: "CELIBATAIRE",
        mother_id: mother.id,
        father_id: father?.id,
      });
      const commune = getOfficerCommune();
      const payload = {
        child_id: child.id,
        nom: child.nom,
        postnom: child.postnom,
        prenom: child.prenom,
        sexe: child.sexe,
        date_naissance: child.date_naissance,
        lieu_naissance: child.lieu_naissance,
        commune_code: commune.code,
        mother_id: mother.id,
        mother_name: `${mother.nom} ${mother.prenom}`,
        father_id: father?.id ?? null,
        father_name: father ? `${father.nom} ${father.prenom}` : null,
        note: "Nouveau-né non enregistré en structure sanitaire",
      };
      const act = addAct("BIRTH", payload, child.nic);
      setCreated(act);
      setNom("");
      setPostnom("");
      setPrenom("");
      setDateNaissance("");
      setLieuNaissance("");
      setMother(null);
      setFather(null);
      bump((n) => n + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Enregistrement impossible.");
    }
  }

  function saveEdit() {
    if (!editAct) return;
    try {
      const payload = JSON.parse(editJson) as Record<string, unknown>;
      updateAct(editAct.id, { payload });
      setEditAct(null);
      bump((n) => n + 1);
    } catch {
      setError("JSON invalide.");
    }
  }

  const rows = acts.map((a) => ({
    act_number: a.act_number,
    national_id: a.national_id,
    nom: String(a.payload.nom ?? ""),
    sexe: String(a.payload.sexe ?? ""),
    date_naissance: String(a.payload.date_naissance ?? ""),
  }));

  return (
    <div>
      <h2 className="page-title">Naissances</h2>
      <p className="page-lead">
        Enregistrement des nouveau-nés non enregistrés en structure sanitaire.
      </p>

      <div className="panel">
        <form className="form-grid" onSubmit={onSubmit}>
          {error ? <div className="login-error full">{error}</div> : null}
          <div>
            <label className="form-label">Nom</label>
            <input className="form-control" value={nom} onChange={(e) => setNom(e.target.value)} required />
          </div>
          <div>
            <label className="form-label">Postnom</label>
            <input className="form-control" value={postnom} onChange={(e) => setPostnom(e.target.value)} />
          </div>
          <div>
            <label className="form-label">Prénom</label>
            <input className="form-control" value={prenom} onChange={(e) => setPrenom(e.target.value)} required />
          </div>
          <div>
            <label className="form-label">Sexe</label>
            <select className="form-control" value={sexe} onChange={(e) => setSexe(e.target.value as Sexe)}>
              <option value="M">Masculin</option>
              <option value="F">Féminin</option>
            </select>
          </div>
          <div>
            <label className="form-label">Date de naissance</label>
            <input
              className="form-control"
              type="date"
              value={dateNaissance}
              onChange={(e) => setDateNaissance(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="form-label">Lieu de naissance</label>
            <input
              className="form-control"
              value={lieuNaissance}
              onChange={(e) => setLieuNaissance(e.target.value)}
              placeholder="Ex. Kinshasa, Gombe"
            />
          </div>
          <div className="full">
            <PersonPicker label="Mère" value={mother} onChange={setMother} required />
          </div>
          <div className="full">
            <PersonPicker label="Père (optionnel)" value={father} onChange={setFather} />
          </div>
          <div className="full">
            <button className="btn-primary" style={{ width: "auto", minWidth: 200 }} type="submit">
              Enregistrer la naissance
            </button>
          </div>
        </form>
      </div>

      {created ? (
        <div className="panel" style={{ marginTop: "1rem" }}>
          <div className="success-banner">Acte de naissance créé — NIC {created.national_id}</div>
          <ActPrintCard act={created} />
        </div>
      ) : null}

      <div className="panel" style={{ marginTop: "1rem" }}>
        <div className="panel-head">
          <h3 className="panel-title">Actes de naissance</h3>
          <DataToolbar filename="naissances" rows={rows} />
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>N°</th>
              <th>NIC</th>
              <th>Nom</th>
              <th>Sexe</th>
              <th>Naissance</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {acts.map((a) => (
              <tr key={a.id}>
                <td>{a.act_number}</td>
                <td>{a.national_id}</td>
                <td>
                  {[a.payload.nom, a.payload.postnom, a.payload.prenom].filter(Boolean).join(" ")}
                </td>
                <td>{String(a.payload.sexe ?? "")}</td>
                <td>{String(a.payload.date_naissance ?? "")}</td>
                <td className="table-actions">
                  <button
                    type="button"
                    className="btn-secondary btn-sm"
                    onClick={() => setViewAct(getAct(a.id) ?? a)}
                  >
                    Voir
                  </button>
                  <button
                    type="button"
                    className="btn-secondary btn-sm"
                    onClick={() => {
                      setEditAct(a);
                      setEditJson(JSON.stringify(a.payload, null, 2));
                    }}
                  >
                    Modifier
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {viewAct ? (
        <div className="modal-backdrop" onClick={() => setViewAct(null)}>
          <div className="modal-panel modal-wide" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="btn-secondary" onClick={() => setViewAct(null)}>
              Fermer
            </button>
            <ActPrintCard act={viewAct} />
          </div>
        </div>
      ) : null}

      {editAct ? (
        <div className="modal-backdrop" onClick={() => setEditAct(null)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <h3>Modifier l&apos;acte {editAct.act_number}</h3>
            <textarea className="form-control code-area" value={editJson} onChange={(e) => setEditJson(e.target.value)} />
            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={() => setEditAct(null)}>
                Annuler
              </button>
              <button type="button" className="btn-primary" style={{ width: "auto" }} onClick={saveEdit}>
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
