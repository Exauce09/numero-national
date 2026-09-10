import { FormEvent, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import PersonPicker from "../components/PersonPicker";
import { displayName, generateNic, type Person } from "../registry";
import { getHealthSession } from "../healthAuth";
import { listFacilityDeclarations, notifyEtatCivil } from "../civilDeclarations";
import { pushHealthNotification } from "../healthPrefs";

type BirthCoupon = {
  nic: string;
  nom: string;
  postnom: string;
  prenom: string;
  sexe: "M" | "F";
  date_naissance: string;
  mother_name: string;
  facility_name: string;
  declaration_id: string;
};

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
  const [coupon, setCoupon] = useState<BirthCoupon | null>(null);
  const [, bump] = useState(0);
  const rows = listFacilityDeclarations(session.facilityId).filter((d) => d.declaration_type === "BIRTH");

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setCoupon(null);
    if (!nom.trim() || !prenom.trim() || !dateNaissance) {
      setError("Nom, prénom et date de naissance de l'enfant sont requis.");
      return;
    }
    if (!mother) {
      setError("La mère est obligatoire (recherche ou ajout).");
      return;
    }
    const childNic = generateNic();
    const childNom = nom.trim();
    const childPostnom = postnom.trim() || mother.postnom || father?.postnom || "";
    const childPrenom = prenom.trim();
    const decl = notifyEtatCivil({
      type: "BIRTH",
      facilityName: session.facilityName,
      payload: {
        facility_id: session.facilityId,
        facility_name: session.facilityName,
        commune_code: session.commune_code,
        commune_name: session.commune_name,
        child_nic: childNic,
        child_nom: childNom,
        child_postnom: childPostnom,
        child_prenom: childPrenom,
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
    const birthCoupon: BirthCoupon = {
      nic: childNic,
      nom: childNom,
      postnom: childPostnom,
      prenom: childPrenom,
      sexe,
      date_naissance: dateNaissance,
      mother_name: displayName(mother),
      facility_name: session.facilityName,
      declaration_id: decl.id,
    };
    setCoupon(birthCoupon);
    pushHealthNotification({
      title: "Nouveau-né — NIC attribué",
      body: `${childPrenom} ${childNom} — NIC ${childNic} (réf. ${decl.id.slice(0, 8)}).`,
      href: "/sante/births",
    });
    setMessage(
      `NIC ${childNic} attribué. Déclaration transmise à l'état civil (réf. ${decl.id.slice(0, 8)}).`,
    );
    setNom("");
    setPostnom("");
    setPrenom("");
    setDateNaissance("");
    setMother(null);
    setFather(null);
    bump((n) => n + 1);
  }

  const qrValue = coupon
    ? JSON.stringify({
        type: "nn_birth_coupon",
        v: 1,
        nic: coupon.nic,
        national_id: coupon.nic,
        family_name: coupon.nom,
        given_names: coupon.prenom,
        sex: coupon.sexe,
        dob: coupon.date_naissance,
        declaration_id: coupon.declaration_id,
        facility: coupon.facility_name,
      })
    : "";

  return (
    <div>
      <h2 className="page-title">Nouveau-né</h2>
      <p className="page-lead">
        Enregistrement à la structure sanitaire — numéro national immédiat, coupon QR, puis
        notification automatique vers l&apos;état civil.
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
              Enregistrer, attribuer le NIC et notifier
            </button>
          </div>
        </form>
      </div>

      {coupon ? (
        <div className="panel print-area" style={{ marginTop: "1rem" }}>
          <div className="success-banner">Coupon naissance — NIC {coupon.nic}</div>
          <div className="act-print-card" style={{ marginTop: "0.75rem" }}>
            <div className="act-print-header">
              <img src="/logo-rdc.jpg" alt="RDC" />
              <div>
                <strong>République Démocratique du Congo</strong>
                <div>E-GOUV · Structure sanitaire</div>
                <div>Coupon provisoire nouveau-né</div>
              </div>
            </div>
            <div className="act-print-body">
              <div className="act-print-meta">
                <div>
                  <span className="muted">NIC</span>
                  <strong>{coupon.nic}</strong>
                </div>
                <div>
                  <span className="muted">Enfant</span>
                  <strong>
                    {coupon.prenom} {coupon.postnom} {coupon.nom}
                  </strong>
                </div>
                <div>
                  <span className="muted">Naissance</span>
                  <strong>{coupon.date_naissance}</strong>
                </div>
                <div>
                  <span className="muted">Mère</span>
                  <strong>{coupon.mother_name}</strong>
                </div>
              </div>
              <div className="act-print-qr">
                <QRCodeSVG value={qrValue} size={128} includeMargin />
                <span className="muted small">Contrôle QR</span>
              </div>
            </div>
          </div>
          <button className="btn-primary" type="button" style={{ marginTop: "0.75rem", width: "auto" }} onClick={() => window.print()}>
            Imprimer le coupon
          </button>
        </div>
      ) : null}

      <div className="panel" style={{ marginTop: "1rem" }}>
        <h3 className="panel-title">Déclarations envoyées</h3>
        <table className="data-table">
          <thead>
            <tr>
              <th>NIC</th>
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
                  <code>{String(d.payload.child_nic ?? "—")}</code>
                </td>
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
