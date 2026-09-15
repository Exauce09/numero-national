/** Reconnaissance volontaire d'enfant — mission d'état civil RDC. */

import { FormEvent, useState } from "react";
import ActPrintCard from "../components/ActPrintCard";
import OfficerSessionField from "../components/OfficerSessionField";
import OfficerTerritoryField from "../components/OfficerTerritoryField";
import PersonPicker from "../components/PersonPicker";
import { addAct, displayName, type Act, type Person } from "../registry";
import { geoFromOfficer, getLoggedOfficer } from "../officerContext";

export default function RecognitionsPage() {
  const [enfant, setEnfant] = useState<Person | null>(null);
  const [declarant, setDeclarant] = useState<Person | null>(null);
  const [qualite, setQualite] = useState<"PERE" | "MERE" | "AUTRE">("PERE");
  const [dateReconnaissance, setDateReconnaissance] = useState("");
  const [jugement, setJugement] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Act | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!enfant || !declarant) {
      setError("L'enfant et le déclarant sont obligatoires.");
      return;
    }
    if (!dateReconnaissance) {
      setError("La date de reconnaissance est obligatoire.");
      return;
    }
    try {
      const officer = getLoggedOfficer();
      const geo = geoFromOfficer();
      const payload = {
        enfant_id: enfant.id,
        enfant_name: displayName(enfant),
        declarant_id: declarant.id,
        declarant_name: displayName(declarant),
        qualite_declarant: qualite,
        date_reconnaissance: dateReconnaissance,
        reference_jugement: jugement.trim() || null,
        officier_id: officer?.userId ?? officer?.username ?? null,
        officier_name: officer?.displayName ?? null,
        lieu_enregistrement: geo.label || "",
        geo,
        commune_code: geo.commune_code ?? null,
        note: "Reconnaissance volontaire — état civil RDC",
      };
      const act = await addAct("RECOGNITION", payload, enfant.nic);
      setCreated(act);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Enregistrement impossible.");
    }
  }

  return (
    <div>
      <h2 className="page-title">Reconnaissance d&apos;enfant</h2>
      <p className="page-lead">
        Enregistrement d&apos;une reconnaissance volontaire et mention sur l&apos;acte de naissance.
      </p>

      <div className="panel">
        <form className="form-grid" onSubmit={(e) => void onSubmit(e)}>
          {error ? <div className="login-error full">{error}</div> : null}
          <div className="full">
            <PersonPicker label="Enfant reconnu" value={enfant} onChange={setEnfant} required />
          </div>
          <div className="full">
            <PersonPicker label="Déclarant" value={declarant} onChange={setDeclarant} required />
          </div>
          <div>
            <label className="form-label">Qualité du déclarant</label>
            <select
              className="form-control"
              value={qualite}
              onChange={(e) => setQualite(e.target.value as typeof qualite)}
            >
              <option value="PERE">Père</option>
              <option value="MERE">Mère</option>
              <option value="AUTRE">Autre (préciser au besoin)</option>
            </select>
          </div>
          <div>
            <label className="form-label">Date de reconnaissance</label>
            <input
              className="form-control"
              type="date"
              value={dateReconnaissance}
              onChange={(e) => setDateReconnaissance(e.target.value)}
              required
            />
          </div>
          <div className="full">
            <label className="form-label">Référence jugement / pièce (optionnel)</label>
            <input
              className="form-control"
              value={jugement}
              onChange={(e) => setJugement(e.target.value)}
              placeholder="Ex. jugement n°, acte notarié…"
            />
          </div>
          <div className="full">
            <OfficerSessionField />
          </div>
          <div className="full">
            <OfficerTerritoryField label="Bureau d'enregistrement" />
          </div>
          <div className="full">
            <button className="btn-primary" style={{ width: "auto", minWidth: 200 }} type="submit">
              Enregistrer la reconnaissance
            </button>
          </div>
        </form>
      </div>

      {created ? (
        <div className="panel" style={{ marginTop: "1rem" }}>
          <div className="success-banner">Acte de reconnaissance créé</div>
          <ActPrintCard act={created} />
        </div>
      ) : null}
    </div>
  );
}
