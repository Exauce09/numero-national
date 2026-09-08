import { FormEvent, useState } from "react";
import ActPrintCard from "../components/ActPrintCard";
import GeoCascade, { type GeoSelection } from "../components/GeoCascade";
import PersonPicker from "../components/PersonPicker";
import { addAct, displayName, type Act, type Person } from "../registry";

export default function DeathsPage() {
  const [deceased, setDeceased] = useState<Person | null>(null);
  const [responsable, setResponsable] = useState<Person | null>(null);
  const [cause, setCause] = useState("");
  const [lieuDeces, setLieuDeces] = useState("");
  const [lieuEnterrement, setLieuEnterrement] = useState("");
  const [cimetiere, setCimetiere] = useState("");
  const [lieuEnregistrement, setLieuEnregistrement] = useState("");
  const [geoDeces, setGeoDeces] = useState<GeoSelection>({});
  const [geoEnreg, setGeoEnreg] = useState<GeoSelection>({});
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
    const payload = {
      deceased_id: deceased.id,
      deceased_name: displayName(deceased),
      cause_deces: cause,
      lieu_deces: (geoDeces.label || lieuDeces).trim(),
      lieu_enterrement: lieuEnterrement,
      cimetiere,
      lieu_enregistrement: (geoEnreg.label || lieuEnregistrement).trim(),
      commune_code: geoEnreg.commune_code ?? geoDeces.commune_code ?? null,
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
      <p className="page-lead">Enregistrement d&apos;un acte de décès avec QR et NIC du défunt.</p>

      <div className="panel">
        <form className="form-grid" onSubmit={onSubmit}>
          {error ? <div className="login-error full">{error}</div> : null}
          <div className="full">
            <PersonPicker label="Personne décédée" value={deceased} onChange={setDeceased} required />
          </div>
          <div className="full">
            <label className="form-label">Cause du Décès</label>
            <input className="form-control" value={cause} onChange={(e) => setCause(e.target.value)} required />
          </div>
          <div className="full">
            <GeoCascade
              value={geoDeces}
              onChange={(g) => {
                setGeoDeces(g);
                if (g.label) setLieuDeces(g.label);
              }}
              label="Lieu du décès — territoire RDC"
            />
          </div>
          <div>
            <label className="form-label">Lieu d&apos;enterrement</label>
            <input
              className="form-control"
              value={lieuEnterrement}
              onChange={(e) => setLieuEnterrement(e.target.value)}
            />
          </div>
          <div>
            <label className="form-label">Cimetière</label>
            <input className="form-control" value={cimetiere} onChange={(e) => setCimetiere(e.target.value)} />
          </div>
          <div className="full">
            <GeoCascade
              value={geoEnreg}
              onChange={(g) => {
                setGeoEnreg(g);
                if (g.label) setLieuEnregistrement(g.label);
              }}
              label="Lieu d'enregistrement — territoire RDC"
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
