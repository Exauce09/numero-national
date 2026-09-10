import { FormEvent, useState } from "react";
import ActPrintCard from "../components/ActPrintCard";
import GeoCascade, { GEO_PRESETS, type GeoSelection } from "../components/GeoCascade";
import GpsLocatePanel, { applyGpsToGeo } from "../components/GpsLocatePanel";
import PersonPicker from "../components/PersonPicker";
import { getOfficerCommune } from "../commune";
import { addAct, displayName, type Act, type Person } from "../registry";

export default function DeathsPage() {
  const [deceased, setDeceased] = useState<Person | null>(null);
  const [responsable, setResponsable] = useState<Person | null>(null);
  const [cause, setCause] = useState("");
  const [geoDeces, setGeoDeces] = useState<GeoSelection>({});
  const [geoEnterrement, setGeoEnterrement] = useState<GeoSelection>({});
  const [cimetiere, setCimetiere] = useState("");
  const [geoEnregistrement, setGeoEnregistrement] = useState<GeoSelection>({});
  const [dateDeces, setDateDeces] = useState("");
  const [dateEnterrement, setDateEnterrement] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Act | null>(null);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!deceased) {
      setError("La personne décédée est obligatoire.");
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
    const commune = getOfficerCommune();
    const payload = {
      deceased_id: deceased.id,
      deceased_name: displayName(deceased),
      cause_deces: cause.trim(),
      lieu_deces: geoDeces.label || "",
      geo_deces: geoDeces,
      lieu_enterrement: geoEnterrement.label || "",
      geo_enterrement: geoEnterrement,
      cimetiere: cimetiere.trim(),
      lieu_enregistrement: geoEnregistrement.label || "",
      geo_enregistrement: geoEnregistrement,
      commune_code: geoEnregistrement.commune_code || geoDeces.commune_code || commune.code,
      date_deces: dateDeces,
      date_enterrement: dateEnterrement,
      responsable_id: responsable?.id ?? null,
      responsable_name: responsable ? displayName(responsable) : null,
    };
    const act = addAct("DEATH", payload, deceased.nic);
    setCreated(act);
  }

  return (
    <div>
      <h2 className="page-title">Décès</h2>
      <p className="page-lead">Enregistrement d&apos;un acte de décès (cause, lieux, dates, responsable).</p>
      <GpsLocatePanel
        title="GPS — lieu du décès"
        onResolved={(g) => setGeoDeces((prev) => applyGpsToGeo(prev, g))}
      />

      <div className="panel">
        <form className="form-grid" onSubmit={onSubmit}>
          {error ? <div className="login-error full">{error}</div> : null}

          <div className="full">
            <PersonPicker label="Personne décédée" value={deceased} onChange={setDeceased} required />
          </div>

          <div className="full">
            <label className="form-label">Cause du Décès</label>
            <input
              className="form-control"
              value={cause}
              onChange={(e) => setCause(e.target.value)}
              placeholder="Ex. Cause naturelle, accident…"
              required
            />
          </div>

          <div className="full">
            <label className="form-label">Lieu du Décès</label>
            <GeoCascade
              embedded
              levels={GEO_PRESETS.place}
              value={geoDeces}
              onChange={setGeoDeces}
              label="Lieu du décès"
            />
          </div>

          <div className="full">
            <label className="form-label">Lieu d&apos;enterrement</label>
            <GeoCascade
              embedded
              levels={GEO_PRESETS.place}
              value={geoEnterrement}
              onChange={setGeoEnterrement}
              label="Lieu d'enterrement"
            />
          </div>
          <div>
            <label className="form-label">Cimetière</label>
            <input
              className="form-control"
              value={cimetiere}
              onChange={(e) => setCimetiere(e.target.value)}
              placeholder="Nom du cimetière"
            />
          </div>

          <div className="full">
            <label className="form-label">Lieu d&apos;enregistrement</label>
            <GeoCascade
              embedded
              levels={GEO_PRESETS.place}
              value={geoEnregistrement}
              onChange={setGeoEnregistrement}
              label="Lieu d'enregistrement"
            />
          </div>

          <div>
            <label className="form-label">Date du Décès</label>
            <input
              className="form-control"
              type="date"
              value={dateDeces}
              onChange={(e) => setDateDeces(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="form-label">Date d&apos;enterrement</label>
            <input
              className="form-control"
              type="date"
              value={dateEnterrement}
              onChange={(e) => setDateEnterrement(e.target.value)}
            />
          </div>

          <div className="full">
            <PersonPicker label="Responsable" value={responsable} onChange={setResponsable} />
          </div>

          <div className="full">
            <button className="btn-primary" style={{ width: "auto", minWidth: 180 }} type="submit">
              Enregistrer le décès
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
    </div>
  );
}
