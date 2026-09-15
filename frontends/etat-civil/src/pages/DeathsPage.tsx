import { FormEvent, useState } from "react";
import ActFormShell from "../components/ActFormShell";
import ActPrintCard from "../components/ActPrintCard";
import GeoCascade, { GEO_PRESETS, type GeoSelection } from "../components/GeoCascade";
import GpsLocatePanel, { applyGpsToGeo } from "../components/GpsLocatePanel";
import PersonPicker from "../components/PersonPicker";
import { getOfficerCommune } from "../commune";
import { getActFormSchema } from "../ecActForms";
import { addAct, displayName, type Act, type Person } from "../registry";

export default function DeathsPage() {
  const [deceased, setDeceased] = useState<Person | null>(null);
  const [declarant, setDeclarant] = useState<Person | null>(null);
  const [qualiteDeclarant, setQualiteDeclarant] = useState("PROCHE");
  const [etatMatrimonial, setEtatMatrimonial] = useState("");
  const [cause, setCause] = useState("");
  const [heureDeces, setHeureDeces] = useState("");
  const [medecin, setMedecin] = useState("");
  const [certificatRef, setCertificatRef] = useState("");
  const [geoDeces, setGeoDeces] = useState<GeoSelection>({});
  const [geoEnterrement, setGeoEnterrement] = useState<GeoSelection>({});
  const [cimetiere, setCimetiere] = useState("");
  const [geoEnregistrement, setGeoEnregistrement] = useState<GeoSelection>({});
  const [dateDeces, setDateDeces] = useState("");
  const [dateEnterrement, setDateEnterrement] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Act | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!deceased) {
      setError("L'identité du défunt est obligatoire.");
      return;
    }
    if (!declarant) {
      setError("Le déclarant est obligatoire.");
      return;
    }
    if (!cause.trim()) {
      setError("La cause du décès est obligatoire.");
      return;
    }
    if (!dateDeces) {
      setError("La date du décès est obligatoire.");
      return;
    }
    try {
      const commune = getOfficerCommune();
      const payload = {
        deceased_id: deceased.id,
        citizen_id: deceased.id,
        deceased_name: displayName(deceased),
        etat_matrimonial_defunt: etatMatrimonial || deceased.etat_civil || null,
        cause_deces: cause.trim(),
        heure_deces: heureDeces || null,
        medecin_constatant: medecin.trim() || null,
        certificat_deces_ref: certificatRef.trim() || null,
        lieu_deces: geoDeces.label || "",
        geo_deces: geoDeces,
        lieu_enterrement: geoEnterrement.label || "",
        lieu_inhumation: geoEnterrement.label || "",
        geo_enterrement: geoEnterrement,
        cimetiere: cimetiere.trim(),
        lieu_enregistrement: geoEnregistrement.label || "",
        geo_enregistrement: geoEnregistrement,
        commune_code: geoEnregistrement.commune_code || geoDeces.commune_code || commune.code,
        date_deces: dateDeces,
        date_enterrement: dateEnterrement,
        declarant_id: declarant.id,
        declarant_name: displayName(declarant),
        declarant_qualite: qualiteDeclarant,
        responsable_id: declarant.id,
        responsable_name: displayName(declarant),
      };
      const act = await addAct("DEATH", payload, deceased.nic);
      setCreated(act);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Enregistrement impossible.");
    }
  }

  return (
    <ActFormShell schema={getActFormSchema("deces")!}>
      <GpsLocatePanel
        title="GPS — lieu du décès"
        onResolved={(g) => setGeoDeces((prev) => applyGpsToGeo(prev, g))}
      />

      <div className="panel">
        <form className="form-grid" onSubmit={onSubmit}>
          {error ? <div className="login-error full">{error}</div> : null}

          <div className="full">
            <h3 className="panel-title" style={{ marginTop: 0 }}>
              Personne décédée
            </h3>
          </div>
          <div className="full">
            <PersonPicker label="Identité du défunt *" value={deceased} onChange={setDeceased} required />
          </div>
          <div>
            <label className="form-label">État matrimonial du défunt</label>
            <select
              className="form-control"
              value={etatMatrimonial}
              onChange={(e) => setEtatMatrimonial(e.target.value)}
            >
              <option value="">— (selon dossier)</option>
              <option value="CELIBATAIRE">Célibataire</option>
              <option value="MARIE">Marié(e)</option>
              <option value="DIVORCE">Divorcé(e)</option>
              <option value="VEUF">Veuf / veuve</option>
            </select>
          </div>
          <div>
            <label className="form-label">Date du décès *</label>
            <input
              className="form-control"
              type="date"
              value={dateDeces}
              onChange={(e) => setDateDeces(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="form-label">Heure du décès</label>
            <input
              className="form-control"
              type="time"
              value={heureDeces}
              onChange={(e) => setHeureDeces(e.target.value)}
            />
          </div>
          <div className="full">
            <label className="form-label">Cause du décès *</label>
            <input
              className="form-control"
              value={cause}
              onChange={(e) => setCause(e.target.value)}
              placeholder="Selon certificat / déclaration"
              required
            />
          </div>
          <div className="full">
            <label className="form-label">Lieu du décès *</label>
            <GeoCascade
              embedded
              levels={GEO_PRESETS.place}
              value={geoDeces}
              onChange={setGeoDeces}
              label="Lieu du décès"
            />
          </div>

          <div className="full">
            <h3 className="panel-title">Constat médical</h3>
          </div>
          <div>
            <label className="form-label">Médecin constatant</label>
            <input className="form-control" value={medecin} onChange={(e) => setMedecin(e.target.value)} />
          </div>
          <div>
            <label className="form-label">Référence du certificat de décès</label>
            <input
              className="form-control"
              value={certificatRef}
              onChange={(e) => setCertificatRef(e.target.value)}
            />
          </div>

          <div className="full">
            <h3 className="panel-title">Déclaration & inhumation</h3>
          </div>
          <div className="full">
            <PersonPicker label="Déclarant *" value={declarant} onChange={setDeclarant} required />
          </div>
          <div>
            <label className="form-label">Qualité du déclarant *</label>
            <select
              className="form-control"
              value={qualiteDeclarant}
              onChange={(e) => setQualiteDeclarant(e.target.value)}
            >
              <option value="CONJOINT">Conjoint(e)</option>
              <option value="PROCHE">Parent / proche</option>
              <option value="AUTORITE">Autorité / structure</option>
              <option value="AUTRE">Autre</option>
            </select>
          </div>
          <div className="full">
            <label className="form-label">Lieu d&apos;inhumation</label>
            <GeoCascade
              embedded
              levels={GEO_PRESETS.place}
              value={geoEnterrement}
              onChange={setGeoEnterrement}
              label="Lieu d'inhumation"
            />
          </div>
          <div>
            <label className="form-label">Cimetière</label>
            <input
              className="form-control"
              value={cimetiere}
              onChange={(e) => setCimetiere(e.target.value)}
            />
          </div>
          <div>
            <label className="form-label">Date d&apos;inhumation</label>
            <input
              className="form-control"
              type="date"
              value={dateEnterrement}
              onChange={(e) => setDateEnterrement(e.target.value)}
            />
          </div>
          <div className="full">
            <label className="form-label">Bureau d&apos;enregistrement</label>
            <GeoCascade
              embedded
              levels={GEO_PRESETS.place}
              value={geoEnregistrement}
              onChange={setGeoEnregistrement}
              label="Bureau d'enregistrement"
            />
          </div>

          <div className="full">
            <button className="btn-primary" style={{ width: "auto", minWidth: 200 }} type="submit">
              Établir l&apos;acte de décès
            </button>
          </div>
        </form>
      </div>

      {created ? (
        <div className="panel" style={{ marginTop: "1rem" }}>
          <div className="success-banner">Acte de décès créé</div>
          <ActPrintCard act={created} />
        </div>
      ) : null}
    </ActFormShell>
  );
}
