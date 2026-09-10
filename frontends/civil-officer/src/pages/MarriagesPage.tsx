import { FormEvent, useState } from "react";
import ActPrintCard from "../components/ActPrintCard";
import GeoCascade, { GEO_PRESETS, type GeoSelection } from "../components/GeoCascade";
import GpsLocatePanel, { applyGpsToGeo } from "../components/GpsLocatePanel";
import PersonPicker from "../components/PersonPicker";
import {
  addAct,
  addMarriageLink,
  ageYears,
  displayName,
  updatePerson,
  type Act,
  type Person,
} from "../registry";

type Regime = "COMMUNAUTE" | "SEPARATION" | "DOT";

const ALLOWED_ETAT = new Set(["CELIBATAIRE", "DIVORCE", "VEUF"]);

export default function MarriagesPage() {
  const [conjoint, setConjoint] = useState<Person | null>(null);
  const [conjointe, setConjointe] = useState<Person | null>(null);
  const [regime, setRegime] = useState<Regime>("COMMUNAUTE");
  const [receveurDote, setReceveurDote] = useState<Person | null>(null);
  const [temoin1, setTemoin1] = useState<Person | null>(null);
  const [temoin2, setTemoin2] = useState<Person | null>(null);
  const [officier, setOfficier] = useState<Person | null>(null);
  const [geo, setGeo] = useState<GeoSelection>({});
  const [motif, setMotif] = useState("");
  const [dateMariage, setDateMariage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Act | null>(null);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!conjoint || !conjointe) {
      setError("Conjoint et conjointe sont obligatoires.");
      return;
    }
    if (ageYears(conjoint.date_naissance) < 18 || ageYears(conjointe.date_naissance) < 18) {
      setError("Les deux conjoints doivent avoir au moins 18 ans.");
      return;
    }
    if (conjoint.etat_civil === "MARIE" || conjointe.etat_civil === "MARIE") {
      setError("Un des conjoints est déjà marié — un divorce est requis avant un nouveau mariage.");
      return;
    }
    if (!ALLOWED_ETAT.has(conjoint.etat_civil) || !ALLOWED_ETAT.has(conjointe.etat_civil)) {
      setError("État civil invalide : célibataire, divorcé(e) ou veuf/veuve uniquement.");
      return;
    }

    const payload = {
      epoux_id: conjoint.id,
      epoux_name: displayName(conjoint),
      epouse_id: conjointe.id,
      epouse_name: displayName(conjointe),
      regime_matrimonial: regime,
      receveur_dote_id: receveurDote?.id ?? null,
      receveur_dote_name: receveurDote ? displayName(receveurDote) : null,
      temoin1_id: temoin1?.id ?? null,
      temoin1_name: temoin1 ? displayName(temoin1) : null,
      temoin2_id: temoin2?.id ?? null,
      temoin2_name: temoin2 ? displayName(temoin2) : null,
      officier_id: officier?.id ?? null,
      officier_name: officier ? displayName(officier) : null,
      lieu_etat_civil: geo.label || "",
      geo,
      commune_code: geo.commune_code ?? null,
      motif,
      date_mariage: dateMariage,
    };
    const act = await addAct("MARRIAGE", payload, conjoint.nic);
    addMarriageLink(act.act_number, conjoint.id, conjointe.id);
    updatePerson(conjoint.id, { etat_civil: "MARIE" });
    updatePerson(conjointe.id, { etat_civil: "MARIE" });
    setCreated(act);
  }

  return (
    <div>
      <h2 className="page-title">Mariages</h2>
      <p className="page-lead">Célébration et enregistrement d&apos;un mariage civil.</p>
      <GpsLocatePanel title="GPS — lieu d’état civil" onResolved={(g) => setGeo((prev) => applyGpsToGeo(prev, g))} />

      <div className="panel">
        <form className="form-grid" onSubmit={onSubmit}>
          {error ? <div className="login-error full">{error}</div> : null}
          <div className="full">
            <PersonPicker label="Conjoint (époux)" value={conjoint} onChange={setConjoint} required />
          </div>
          <div className="full">
            <PersonPicker label="Conjointe (épouse)" value={conjointe} onChange={setConjointe} required />
          </div>
          <div>
            <label className="form-label">Régime matrimonial</label>
            <select
              className="form-control"
              value={regime}
              onChange={(e) => setRegime(e.target.value as Regime)}
            >
              <option value="COMMUNAUTE">Communauté</option>
              <option value="SEPARATION">Séparation</option>
              <option value="DOT">Dot</option>
            </select>
          </div>
          <div>
            <label className="form-label">Date du mariage</label>
            <input
              className="form-control"
              type="date"
              value={dateMariage}
              onChange={(e) => setDateMariage(e.target.value)}
              required
            />
          </div>
          <div className="full">
            <PersonPicker label="Receveur de la dot" value={receveurDote} onChange={setReceveurDote} />
          </div>
          <div className="full">
            <PersonPicker label="Témoin 1" value={temoin1} onChange={setTemoin1} />
          </div>
          <div className="full">
            <PersonPicker label="Témoin 2" value={temoin2} onChange={setTemoin2} />
          </div>
          <div className="full">
            <PersonPicker label="Officier" value={officier} onChange={setOfficier} />
          </div>
          <div className="full">
            <GeoCascade
              embedded
              levels={GEO_PRESETS.place}
              value={geo}
              onChange={setGeo}
              label="Lieu état civil"
            />
          </div>
          <div>
            <label className="form-label">Motif</label>
            <input className="form-control" value={motif} onChange={(e) => setMotif(e.target.value)} />
          </div>
          <div className="full">
            <button className="btn-primary" style={{ width: "auto", minWidth: 180 }} type="submit">
              Enregistrer le mariage
            </button>
          </div>
        </form>
      </div>

      {created ? (
        <div className="panel" style={{ marginTop: "1rem" }}>
          <div className="success-banner">Acte de mariage créé — {created.act_number}</div>
          <ActPrintCard act={created} />
        </div>
      ) : null}
    </div>
  );
}
