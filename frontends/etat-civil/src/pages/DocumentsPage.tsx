import { FormEvent, useState } from "react";
import ActFormShell from "../components/ActFormShell";
import ActPrintCard from "../components/ActPrintCard";
import PersonPicker from "../components/PersonPicker";
import { getActFormSchema } from "../ecActForms";
import { addAct, displayName, type Act, type Person } from "../registry";

type DelivranceType = "EXTRAIT" | "COPIE_INTEGRALE" | "BULLETIN";
type ActeSource =
  | "ACTE_NAISSANCE"
  | "ACTE_DECES"
  | "ACTE_MARIAGE"
  | "ACTE_ADOPTION"
  | "AUTRE";
type Paiement = "CASH" | "MOBILE_MONEY" | "VISA" | "EXONERE";

export default function DocumentsPage() {
  const [typeDelivrance, setTypeDelivrance] = useState<DelivranceType>("EXTRAIT");
  const [acteSource, setActeSource] = useState<ActeSource>("ACTE_NAISSANCE");
  const [refActe, setRefActe] = useState("");
  const [motif, setMotif] = useState("");
  const [typePaiement, setTypePaiement] = useState<Paiement>("CASH");
  const [beneficiaire, setBeneficiaire] = useState<Person | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Act | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!beneficiaire) {
      setError("L'ayant droit / bénéficiaire est obligatoire.");
      return;
    }
    if (!refActe.trim() || !motif.trim()) {
      setError("Référence de l'acte source et motif sont obligatoires.");
      return;
    }
    try {
      const nomDocument = `${typeDelivrance} — ${acteSource} — ${refActe.trim()}`;
      const payload = {
        type_delivrance: typeDelivrance,
        type_document: typeDelivrance,
        acte_source: acteSource,
        reference_acte: refActe.trim(),
        nom_document: nomDocument,
        motif_demande: motif.trim(),
        type_paiement: typePaiement,
        beneficiaire_id: beneficiaire.id,
        beneficiaire_name: displayName(beneficiaire),
        ayant_droit_id: beneficiaire.id,
        ayant_droit_name: displayName(beneficiaire),
      };
      const act = await addAct("DOCUMENT", payload, beneficiaire.nic);
      setCreated(act);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Enregistrement impossible.");
    }
  }

  return (
    <ActFormShell schema={getActFormSchema("copies")!}>
      <div className="panel">
        <form className="form-grid" onSubmit={(e) => void onSubmit(e)}>
          {error ? <div className="login-error full">{error}</div> : null}
          <div>
            <label className="form-label">Type de document *</label>
            <select
              className="form-control"
              value={typeDelivrance}
              onChange={(e) => setTypeDelivrance(e.target.value as DelivranceType)}
            >
              <option value="EXTRAIT">Extrait</option>
              <option value="COPIE_INTEGRALE">Copie intégrale</option>
              <option value="BULLETIN">Bulletin</option>
            </select>
          </div>
          <div>
            <label className="form-label">Acte source *</label>
            <select
              className="form-control"
              value={acteSource}
              onChange={(e) => setActeSource(e.target.value as ActeSource)}
            >
              <option value="ACTE_NAISSANCE">Acte de naissance</option>
              <option value="ACTE_MARIAGE">Acte de mariage</option>
              <option value="ACTE_DECES">Acte de décès</option>
              <option value="ACTE_ADOPTION">Acte d&apos;adoption</option>
              <option value="AUTRE">Autre</option>
            </select>
          </div>
          <div className="full">
            <label className="form-label">Référence de l&apos;acte *</label>
            <input
              className="form-control"
              value={refActe}
              onChange={(e) => setRefActe(e.target.value)}
              required
              placeholder="N° d'acte / ID naissance…"
            />
          </div>
          <div className="full">
            <PersonPicker
              label="Ayant droit / bénéficiaire *"
              value={beneficiaire}
              onChange={setBeneficiaire}
              required
            />
          </div>
          <div className="full">
            <label className="form-label">Motif de la demande *</label>
            <input
              className="form-control"
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              required
              placeholder="Usage administratif, scolarité, succession…"
            />
          </div>
          <div>
            <label className="form-label">Mode de paiement</label>
            <select
              className="form-control"
              value={typePaiement}
              onChange={(e) => setTypePaiement(e.target.value as Paiement)}
            >
              <option value="CASH">Espèces</option>
              <option value="MOBILE_MONEY">Mobile Money</option>
              <option value="VISA">Carte</option>
              <option value="EXONERE">Exonéré</option>
            </select>
          </div>
          <div className="full">
            <button className="btn-primary" style={{ width: "auto", minWidth: 200 }} type="submit">
              Enregistrer la délivrance
            </button>
          </div>
        </form>
      </div>

      {created ? (
        <div className="panel" style={{ marginTop: "1rem" }}>
          <div className="success-banner">Délivrance enregistrée</div>
          <ActPrintCard act={created} />
        </div>
      ) : null}
    </ActFormShell>
  );
}
