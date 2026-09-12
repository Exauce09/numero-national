import { FormEvent, useEffect, useState } from "react";
import ActPrintCard from "../components/ActPrintCard";
import OfficerSessionField from "../components/OfficerSessionField";
import PersonPicker from "../components/PersonPicker";
import {
  addAct,
  displayName,
  getActiveMarriage,
  markMarriageDivorced,
  updatePerson,
  type Act,
  type Person,
} from "../registry";
import { getLoggedOfficer } from "../officerContext";

export default function DivorcesPage() {
  const [epoux, setEpoux] = useState<Person | null>(null);
  const [epouse, setEpouse] = useState<Person | null>(null);
  const [numeroMariage, setNumeroMariage] = useState("");
  const [cause, setCause] = useState("");
  const [temoin1, setTemoin1] = useState<Person | null>(null);
  const [temoin2, setTemoin2] = useState<Person | null>(null);
  const [dateDivorce, setDateDivorce] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Act | null>(null);

  useEffect(() => {
    const link =
      (epoux && getActiveMarriage(epoux.id)) || (epouse && getActiveMarriage(epouse.id)) || undefined;
    setNumeroMariage(link?.act_number ?? "");
  }, [epoux, epouse]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!epoux || !epouse) {
      setError("Époux et épouse sont obligatoires.");
      return;
    }
    if (!numeroMariage) {
      setError("Aucun mariage actif trouvé pour ces personnes.");
      return;
    }
    try {
      const officer = getLoggedOfficer();
      const payload = {
        epoux_id: epoux.id,
        epoux_name: displayName(epoux),
        epouse_id: epouse.id,
        epouse_name: displayName(epouse),
        numero_mariage: numeroMariage,
        cause,
        officier_id: officer?.userId ?? officer?.username ?? null,
        officier_name: officer?.displayName ?? null,
        officier_username: officer?.username ?? null,
        temoin1_id: temoin1?.id ?? null,
        temoin1_name: temoin1 ? displayName(temoin1) : null,
        temoin2_id: temoin2?.id ?? null,
        temoin2_name: temoin2 ? displayName(temoin2) : null,
        date_divorce: dateDivorce,
      };
      const act = await addAct("DIVORCE", payload, epoux.nic);
      markMarriageDivorced(numeroMariage);
      updatePerson(epoux.id, { etat_civil: "DIVORCE" });
      updatePerson(epouse.id, { etat_civil: "DIVORCE" });
      setCreated(act);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Enregistrement impossible.");
    }
  }

  return (
    <div>
      <h2 className="page-title">Divorce</h2>
      <p className="page-lead">Dissolution d&apos;un mariage actif enregistré.</p>

      <div className="panel">
        <form className="form-grid" onSubmit={onSubmit}>
          {error ? <div className="login-error full">{error}</div> : null}
          <div className="full">
            <PersonPicker label="Époux" value={epoux} onChange={setEpoux} required sexFilter="M" />
          </div>
          <div className="full">
            <PersonPicker label="Épouse" value={epouse} onChange={setEpouse} required sexFilter="F" />
          </div>
          <div>
            <label className="form-label">Numéro mariage</label>
            <input className="form-control" value={numeroMariage} readOnly />
          </div>
          <div>
            <label className="form-label">Date du divorce</label>
            <input
              className="form-control"
              type="date"
              value={dateDivorce}
              onChange={(e) => setDateDivorce(e.target.value)}
              required
            />
          </div>
          <div className="full">
            <label className="form-label">Cause</label>
            <input className="form-control" value={cause} onChange={(e) => setCause(e.target.value)} />
          </div>
          <div className="full">
            <OfficerSessionField />
          </div>
          <div className="full">
            <PersonPicker label="Témoin 1" value={temoin1} onChange={setTemoin1} />
          </div>
          <div className="full">
            <PersonPicker label="Témoin 2" value={temoin2} onChange={setTemoin2} />
          </div>
          <div className="full">
            <button className="btn-primary" style={{ width: "auto", minWidth: 180 }} type="submit">
              Enregistrer le divorce
            </button>
          </div>
        </form>
      </div>

      {created ? (
        <div className="panel" style={{ marginTop: "1rem" }}>
          <div className="success-banner">Acte de divorce créé</div>
          <ActPrintCard act={created} />
        </div>
      ) : null}
    </div>
  );
}
