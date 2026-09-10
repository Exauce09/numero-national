import { FormEvent, useState } from "react";
import ActPrintCard from "../components/ActPrintCard";
import PersonPicker from "../components/PersonPicker";
import { addAct, displayName, type Act, type Person } from "../registry";

type DocType =
  | "ACTE_NAISSANCE"
  | "ACTE_DECES"
  | "ACTE_MARIAGE"
  | "ACTE_ADOPTION"
  | "FICHE_RECENSEMENT"
  | "ACTE_DEPLACEMENT"
  | "AUTRE";

type Paiement = "CASH" | "MOBILE_MONEY" | "VISA";

export default function DocumentsPage() {
  const [typeDocument, setTypeDocument] = useState<DocType>("ACTE_NAISSANCE");
  const [nomDocument, setNomDocument] = useState("");
  const [typePaiement, setTypePaiement] = useState<Paiement>("CASH");
  const [beneficiaire, setBeneficiaire] = useState<Person | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Act | null>(null);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!beneficiaire) {
      setError("Le bénéficiaire est obligatoire.");
      return;
    }
    const payload = {
      type_document: typeDocument,
      nom_document: nomDocument,
      type_paiement: typePaiement,
      beneficiaire_id: beneficiaire.id,
      beneficiaire_name: displayName(beneficiaire),
    };
    const act = await addAct("DOCUMENT", payload, beneficiaire.nic);
    setCreated(act);
  }

  return (
    <div>
      <h2 className="page-title">Documents</h2>
      <p className="page-lead">Délivrance de documents d&apos;état civil avec QR.</p>

      <div className="panel">
        <form className="form-grid" onSubmit={onSubmit}>
          {error ? <div className="login-error full">{error}</div> : null}
          <div>
            <label className="form-label">Type document</label>
            <select
              className="form-control"
              value={typeDocument}
              onChange={(e) => setTypeDocument(e.target.value as DocType)}
            >
              <option value="ACTE_NAISSANCE">Acte de naissance</option>
              <option value="ACTE_DECES">Acte de décès</option>
              <option value="ACTE_MARIAGE">Acte de mariage</option>
              <option value="ACTE_ADOPTION">Acte d&apos;adoption</option>
              <option value="FICHE_RECENSEMENT">Fiche recensement</option>
              <option value="ACTE_DEPLACEMENT">Acte de déplacement</option>
              <option value="AUTRE">Autre</option>
            </select>
          </div>
          <div>
            <label className="form-label">Nom document</label>
            <input
              className="form-control"
              value={nomDocument}
              onChange={(e) => setNomDocument(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="form-label">Type paiement</label>
            <select
              className="form-control"
              value={typePaiement}
              onChange={(e) => setTypePaiement(e.target.value as Paiement)}
            >
              <option value="CASH">Cash</option>
              <option value="MOBILE_MONEY">Mobile Money</option>
              <option value="VISA">Visa</option>
            </select>
          </div>
          <div className="full">
            <PersonPicker label="Bénéficiaire" value={beneficiaire} onChange={setBeneficiaire} required />
          </div>
          <div className="full">
            <button className="btn-primary" style={{ width: "auto", minWidth: 180 }} type="submit">
              Délivrer le document
            </button>
          </div>
        </form>
      </div>

      {created ? (
        <div className="panel" style={{ marginTop: "1rem" }}>
          <div className="success-banner">Document enregistré — QR généré</div>
          <ActPrintCard act={created} />
        </div>
      ) : null}
    </div>
  );
}
