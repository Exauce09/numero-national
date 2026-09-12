import { FormEvent, useState } from "react";
import ActPrintCard from "../components/ActPrintCard";
import GeoCascade, { GEO_PRESETS, type GeoSelection } from "../components/GeoCascade";
import GpsLocatePanel, { applyGpsToGeo } from "../components/GpsLocatePanel";
import PersonPicker from "../components/PersonPicker";
import { addAct, displayName, type Act, type Person } from "../registry";

export default function AdoptionsPage() {
  const [tuteur, setTuteur] = useState<Person | null>(null);
  const [enfant, setEnfant] = useState<Person | null>(null);
  const [officier, setOfficier] = useState<Person | null>(null);
  const [motif, setMotif] = useState("");
  const [geo, setGeo] = useState<GeoSelection>({});
  const [dateAdoption, setDateAdoption] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Act | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!tuteur || !enfant) {
      setError("Tuteur et enfant sont obligatoires.");
      return;
    }
    try {
      const payload = {
        tuteur_id: tuteur.id,
        tuteur_name: displayName(tuteur),
        enfant_id: enfant.id,
        enfant_name: displayName(enfant),
        motif,
        officier_id: officier?.id ?? null,
        officier_name: officier ? displayName(officier) : null,
        lieu_adoption: geo.label || "",
        geo,
        commune_code: geo.commune_code ?? null,
        date_adoption: dateAdoption,
      };
      const act = await addAct("ADOPTION", payload, enfant.nic);
      setCreated(act);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Enregistrement impossible.");
    }
  }

  return (
    <div>
      <h2 className="page-title">Adoption</h2>
      <p className="page-lead">Enregistrement d&apos;un acte d&apos;adoption.</p>
      <GpsLocatePanel title="GPS — lieu d’adoption" onResolved={(g) => setGeo((prev) => applyGpsToGeo(prev, g))} />

      <div className="panel">
        <form className="form-grid" onSubmit={onSubmit}>
          {error ? <div className="login-error full">{error}</div> : null}
          <div className="full">
            <PersonPicker label="Tuteur" value={tuteur} onChange={setTuteur} required />
          </div>
          <div className="full">
            <PersonPicker label="Enfant" value={enfant} onChange={setEnfant} required />
          </div>
          <div className="full">
            <label className="form-label">Motif</label>
            <input className="form-control" value={motif} onChange={(e) => setMotif(e.target.value)} />
          </div>
          <div className="full">
            <PersonPicker
              label="Officier (N° état civil)"
              value={officier}
              onChange={setOfficier}
              nicSearchHint
              hideAdd
            />
          </div>
          <div className="full">
            <GeoCascade
              embedded
              levels={GEO_PRESETS.place}
              value={geo}
              onChange={setGeo}
              label="Lieu d'adoption"
            />
          </div>
          <div>
            <label className="form-label">Date</label>
            <input
              className="form-control"
              type="date"
              value={dateAdoption}
              onChange={(e) => setDateAdoption(e.target.value)}
              required
            />
          </div>
          <div className="full">
            <button className="btn-primary" style={{ width: "auto", minWidth: 180 }} type="submit">
              Enregistrer l&apos;adoption
            </button>
          </div>
        </form>
      </div>

      {created ? (
        <div className="panel" style={{ marginTop: "1rem" }}>
          <div className="success-banner">Acte d&apos;adoption créé</div>
          <ActPrintCard act={created} />
        </div>
      ) : null}
    </div>
  );
}
