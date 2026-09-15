import { FormEvent, useState } from "react";
import ActFormShell from "../components/ActFormShell";
import ActPrintCard from "../components/ActPrintCard";
import OfficerSessionField from "../components/OfficerSessionField";
import OfficerTerritoryField from "../components/OfficerTerritoryField";
import PersonPicker from "../components/PersonPicker";
import { getActFormSchema } from "../ecActForms";
import { addAct, displayName, type Act, type Person } from "../registry";
import { geoFromOfficer, getLoggedOfficer } from "../officerContext";

export default function AdoptionsPage() {
  const [adoptant1, setAdoptant1] = useState<Person | null>(null);
  const [adoptant2, setAdoptant2] = useState<Person | null>(null);
  const [enfant, setEnfant] = useState<Person | null>(null);
  const [typeAdoption, setTypeAdoption] = useState<"PLENIERE" | "SIMPLE">("PLENIERE");
  const [tribunal, setTribunal] = useState("");
  const [numeroJugement, setNumeroJugement] = useState("");
  const [dateJugement, setDateJugement] = useState("");
  const [effetNom, setEffetNom] = useState("");
  const [dateAdoption, setDateAdoption] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Act | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!adoptant1 || !enfant) {
      setError("L'adoptant et l'enfant adopté sont obligatoires.");
      return;
    }
    if (!tribunal.trim() || !numeroJugement.trim() || !dateJugement) {
      setError("Tribunal, N° et date du jugement sont obligatoires.");
      return;
    }
    try {
      const officer = getLoggedOfficer();
      const geo = geoFromOfficer();
      const payload = {
        adoptant_id: adoptant1.id,
        adoptant_name: displayName(adoptant1),
        tuteur_id: adoptant1.id,
        tuteur_name: displayName(adoptant1),
        co_adoptant_id: adoptant2?.id ?? null,
        co_adoptant_name: adoptant2 ? displayName(adoptant2) : null,
        enfant_id: enfant.id,
        enfant_name: displayName(enfant),
        type_adoption: typeAdoption,
        tribunal: tribunal.trim(),
        numero_jugement: numeroJugement.trim(),
        date_jugement: dateJugement,
        ref_jugement: `${numeroJugement.trim()} — ${tribunal.trim()}`,
        effet_nom: effetNom.trim() || null,
        apres_jugement: true,
        officier_id: officer?.userId ?? officer?.username ?? null,
        officier_name: officer?.displayName ?? null,
        officier_username: officer?.username ?? null,
        lieu_adoption: geo.label || "",
        geo,
        commune_code: geo.commune_code ?? null,
        date_adoption: dateAdoption || dateJugement,
      };
      const act = await addAct("ADOPTION", payload, enfant.nic);
      setCreated(act);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Enregistrement impossible.");
    }
  }

  return (
    <ActFormShell schema={getActFormSchema("adoption")!}>
      <div className="panel">
        <form className="form-grid" onSubmit={(e) => void onSubmit(e)}>
          {error ? <div className="login-error full">{error}</div> : null}
          <div className="full">
            <h3 className="panel-title" style={{ marginTop: 0 }}>
              Décision judiciaire
            </h3>
          </div>
          <div>
            <label className="form-label">Tribunal *</label>
            <input
              className="form-control"
              value={tribunal}
              onChange={(e) => setTribunal(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="form-label">N° du jugement *</label>
            <input
              className="form-control"
              value={numeroJugement}
              onChange={(e) => setNumeroJugement(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="form-label">Date du jugement *</label>
            <input
              className="form-control"
              type="date"
              value={dateJugement}
              onChange={(e) => setDateJugement(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="form-label">Type d&apos;adoption *</label>
            <select
              className="form-control"
              value={typeAdoption}
              onChange={(e) => setTypeAdoption(e.target.value as typeof typeAdoption)}
            >
              <option value="PLENIERE">Adoption plénière</option>
              <option value="SIMPLE">Adoption simple</option>
            </select>
          </div>

          <div className="full">
            <h3 className="panel-title">Parties</h3>
          </div>
          <div className="full">
            <PersonPicker label="Enfant adopté *" value={enfant} onChange={setEnfant} required />
          </div>
          <div className="full">
            <PersonPicker label="Adoptant *" value={adoptant1} onChange={setAdoptant1} required />
          </div>
          <div className="full">
            <PersonPicker label="Co-adoptant (le cas échéant)" value={adoptant2} onChange={setAdoptant2} />
          </div>
          <div className="full">
            <label className="form-label">Effet sur le nom</label>
            <input
              className="form-control"
              value={effetNom}
              onChange={(e) => setEffetNom(e.target.value)}
              placeholder="Nom après adoption…"
            />
          </div>
          <div>
            <label className="form-label">Date d&apos;inscription au registre</label>
            <input
              className="form-control"
              type="date"
              value={dateAdoption}
              onChange={(e) => setDateAdoption(e.target.value)}
            />
          </div>
          <div className="full">
            <OfficerSessionField />
          </div>
          <div className="full">
            <OfficerTerritoryField label="Bureau d'enregistrement" />
          </div>
          <div className="full">
            <button className="btn-primary" style={{ width: "auto", minWidth: 240 }} type="submit">
              Enregistrer l&apos;adoption (après jugement)
            </button>
          </div>
        </form>
      </div>

      {created ? (
        <div className="panel" style={{ marginTop: "1rem" }}>
          <div className="success-banner">Adoption enregistrée au registre</div>
          <ActPrintCard act={created} />
        </div>
      ) : null}
    </ActFormShell>
  );
}
