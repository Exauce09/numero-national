import { FormEvent, useState } from "react";
import PersonPicker from "../components/PersonPicker";
import { displayName, type Person } from "../registry";
import { getHealthSession } from "../healthAuth";
import { listFacilityDeclarations, notifyEtatCivil } from "../civilDeclarations";
import { pushHealthNotification } from "../healthPrefs";

export default function HealthBirthsPage() {
  const session = getHealthSession()!;
  const [nom, setNom] = useState("");
  const [postnom, setPostnom] = useState("");
  const [prenom, setPrenom] = useState("");
  const [sexe, setSexe] = useState<"M" | "F">("M");
  const [dateNaissance, setDateNaissance] = useState("");
  const [mother, setMother] = useState<Person | null>(null);
  const [father, setFather] = useState<Person | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, bump] = useState(0);
  const rows = listFacilityDeclarations(session.facilityId).filter((d) => d.declaration_type === "BIRTH");

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    if (!nom.trim() || !prenom.trim() || !dateNaissance) {
      setError("Nom, prénom et date de naissance de l'enfant sont requis.");
      return;
    }
    if (!mother) {
      setError("La mère est obligatoire (recherche ou ajout).");
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
        child_postnom: postnom.trim() || mother.postnom || father?.postnom || "",
        child_prenom: prenom.trim(),
        sexe,
        date_naissance: dateNaissance,
        mother_id: mother.id,
        mother_nic: mother.nic,
        mother_name: displayName(mother),
        father_id: father?.id ?? null,
        father_nic: father?.nic ?? null,
        father_name: father ? displayName(father) : null,
        lieu_naissance: session.facilityName,
      },
    });
    pushHealthNotification({
      title: "Nouveau-né notifié à l'état civil",
      body: `${prenom.trim()} ${nom.trim()} — en attente de validation officier (réf. ${decl.id.slice(0, 8)}).`,
      href: "/sante/births",
    });
    setMessage(
      `Enregistrement transmis à l'état civil pour validation (réf. ${decl.id.slice(0, 8)}). L'officier a été notifié.`,
    );
    setNom("");
    setPostnom("");
    setPrenom("");
    setDateNaissance("");
    setMother(null);
    setFather(null);
    bump((n) => n + 1);
  }

  return (
    <div>
      <h2 className="page-title">Nouveau-né</h2>
      <p className="page-lead">
        Enregistrement à la structure sanitaire — transmission et notification automatiques vers l&apos;état civil.
      </p>
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
            <input
              className="form-control"
              type="date"
              value={dateNaissance}
              onChange={(e) => setDateNaissance(e.target.value)}
              required
            />
          </div>
          <div className="full">
            <PersonPicker label="Nom de la mère" value={mother} onChange={setMother} required />
          </div>
          <div className="full">
            <PersonPicker label="Nom du père" value={father} onChange={setFather} />
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
              <th>Mère</th>
              <th>Père</th>
              <th>Naissance</th>
              <th>Statut état civil</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.id}>
                <td>
                  {String(d.payload.child_nom ?? "")} {String(d.payload.child_prenom ?? "")}
                </td>
                <td>{String(d.payload.mother_name ?? "—")}</td>
                <td>{String(d.payload.father_name ?? "—")}</td>
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
