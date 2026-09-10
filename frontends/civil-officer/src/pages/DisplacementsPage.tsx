import { FormEvent, useState } from "react";
import ActPrintCard from "../components/ActPrintCard";
import GeoCascade, { ADDRESS_FIELD_LABELS, GEO_PRESETS, type GeoSelection } from "../components/GeoCascade";
import GpsLocatePanel, { applyGpsToGeo } from "../components/GpsLocatePanel";
import PersonPicker from "../components/PersonPicker";
import { addAct, displayName, type Act, type Person } from "../registry";

export default function DisplacementsPage() {
  const [personne, setPersonne] = useState<Person | null>(null);
  const [officier, setOfficier] = useState<Person | null>(null);
  const [geo, setGeo] = useState<GeoSelection>({});
  const [motif, setMotif] = useState("");
  const [dateDeplacement, setDateDeplacement] = useState("");
  const [dateRetour, setDateRetour] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Act | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!personne) {
      setError("La personne est obligatoire.");
      return;
    }
    try {
      const payload = {
        person_id: personne.id,
        person_name: displayName(personne),
        lieu_a_aller: geo.label || "",
        geo,
        commune_code: geo.commune_code ?? null,
        motif,
        date_deplacement: dateDeplacement,
        date_retour: dateRetour,
        officier_id: officier?.id ?? null,
        officier_name: officier ? displayName(officier) : null,
      };
      const act = await addAct("DISPLACEMENT", payload, personne.nic);
      setCreated(act);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Enregistrement impossible.");
    }
  }

  return (
    <div>
      <h2 className="page-title">Déplacement</h2>
      <p className="page-lead">Enregistrement d&apos;un déplacement de personne.</p>
      <GpsLocatePanel
        title="GPS — destination"
        onResolved={(g) => setGeo((prev) => applyGpsToGeo(prev, g))}
      />

      <div className="panel">
        <form className="form-grid" onSubmit={onSubmit}>
          {error ? <div className="login-error full">{error}</div> : null}
          <div className="full">
            <PersonPicker label="Personne" value={personne} onChange={setPersonne} required />
          </div>
          <div className="full">
            <GeoCascade
              embedded
              levels={GEO_PRESETS.address}
              fieldLabels={ADDRESS_FIELD_LABELS}
              value={geo}
              onChange={setGeo}
              label="Lieu de destination"
            />
          </div>
          <div>
            <label className="form-label">Motif</label>
            <input className="form-control" value={motif} onChange={(e) => setMotif(e.target.value)} />
          </div>
          <div>
            <label className="form-label">Date de déplacement</label>
            <input
              className="form-control"
              type="date"
              value={dateDeplacement}
              onChange={(e) => setDateDeplacement(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="form-label">Date de retour</label>
            <input
              className="form-control"
              type="date"
              value={dateRetour}
              onChange={(e) => setDateRetour(e.target.value)}
            />
          </div>
          <div className="full">
            <PersonPicker label="Officier" value={officier} onChange={setOfficier} />
          </div>
          <div className="full">
            <button className="btn-primary" style={{ width: "auto", minWidth: 180 }} type="submit">
              Enregistrer le déplacement
            </button>
          </div>
        </form>
      </div>

      {created ? (
        <div className="panel" style={{ marginTop: "1rem" }}>
          <div className="success-banner">Déplacement enregistré</div>
          <ActPrintCard act={created} />
        </div>
      ) : null}
    </div>
  );
}
