import { FormEvent, useState } from "react";
import { getHealthSession } from "../healthAuth";
import { listFacilityDeclarations, notifyEtatCivil } from "../civilDeclarations";

export default function HealthBirthsPage() {
  const session = getHealthSession()!;
  const [nom, setNom] = useState("");
  const [postnom, setPostnom] = useState("");
  const [prenom, setPrenom] = useState("");
  const [sexe, setSexe] = useState<"M" | "F">("M");
  const [dateNaissance, setDateNaissance] = useState("");
  const [nomMere, setNomMere] = useState("");
  const [nomPere, setNomPere] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, bump] = useState(0);
  const rows = listFacilityDeclarations(session.facilityId).filter((d) => d.declaration_type === "BIRTH");

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    if (!nom.trim() || !prenom.trim() || !dateNaissance || !nomMere.trim()) {
      setError("Nom, prénom, date de naissance et nom de la mère sont requis.");
      return;
    }
    const decl = notifyEtatCivil({
      type: "BIRTH",
      facilityName: session.facilityName,
      payload: {
        facility_id: session.facilityId,
        facility_name: session.facilityName,
        commune_code: session.commune_code,
        commune_name: session.commune_name,
        child_nom: nom.trim(),
        child_postnom: postnom.trim(),
        child_prenom: prenom.trim(),
        sexe,
        date_naissance: dateNaissance,
        mother_name: nomMere.trim(),
        father_name: nomPere.trim() || null,
        lieu_naissance: session.facilityName,
      },
    });
    setMessage(`Notification envoyée à l'état civil (réf. ${decl.id.slice(0, 8)}).`);
    setNom("");
    setPostnom("");
    setPrenom("");
    setDateNaissance("");
    setNomMere("");
    setNomPere("");
    bump((n) => n + 1);
  }

  return (
    <div>
      <h2 className="page-title">Nouveaux-nés (structure sanitaire)</h2>
      <p className="page-lead">Enregistrement puis notification automatique de l&apos;officier d&apos;état civil.</p>
      <div className="panel">
        <form className="form-grid" onSubmit={onSubmit}>
          {error ? <div className="login-error full">{error}</div> : null}
          {message ? <div className="success-banner full">{message}</div> : null}
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
            <select className="form-control" value={sexe} onChange={(e) => setSexe(e.target.value as "M" | "F")}>
              <option value="M">Masculin</option>
              <option value="F">Féminin</option>
            </select>
          </div>
          <div>
            <label className="form-label">Date de naissance</label>
            <input className="form-control" type="date" value={dateNaissance} onChange={(e) => setDateNaissance(e.target.value)} required />
          </div>
          <div>
            <label className="form-label">Nom de la mère</label>
            <input className="form-control" value={nomMere} onChange={(e) => setNomMere(e.target.value)} required />
          </div>
          <div>
            <label className="form-label">Nom du père</label>
            <input className="form-control" value={nomPere} onChange={(e) => setNomPere(e.target.value)} />
          </div>
          <div className="full">
            <button className="btn-primary" type="submit" style={{ width: "auto", minWidth: 280 }}>
              Enregistrer et notifier l&apos;état civil
            </button>
          </div>
        </form>
      </div>
      <div className="panel" style={{ marginTop: "1rem" }}>
        <h3 className="panel-title">Déclarations envoyées</h3>
        <table className="data-table">
          <thead>
            <tr>
              <th>Enfant</th>
              <th>Naissance</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.id}>
                <td>
                  {String(d.payload.child_nom ?? "")} {String(d.payload.child_prenom ?? "")}
                </td>
                <td>{String(d.payload.date_naissance ?? "—")}</td>
                <td>{d.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
