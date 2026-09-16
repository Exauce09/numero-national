import { FormEvent, useEffect, useState } from "react";
import ActFormShell from "../components/ActFormShell";
import ActPrintCard from "../components/ActPrintCard";
import OfficerSessionField from "../components/OfficerSessionField";
import PersonPicker from "../components/PersonPicker";
import { getActFormSchema } from "../ecActForms";
import {
  addAct,
  ageYears,
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
  const [tribunal, setTribunal] = useState("");
  const [greffe, setGreffe] = useState("");
  const [numeroJugement, setNumeroJugement] = useState("");
  const [dispositif, setDispositif] = useState("");
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
    if (ageYears(epoux.date_naissance) < 18 || ageYears(epouse.date_naissance) < 18) {
      setError("Les deux parties doivent avoir au moins 18 ans.");
      return;
    }
    if (!numeroMariage) {
      setError("Référence de l'acte de mariage obligatoire (mariage actif introuvable).");
      return;
    }
    if (!tribunal.trim() || !numeroJugement.trim() || !dispositif.trim()) {
      setError("Tribunal, N° du jugement et dispositif sont obligatoires.");
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
        acte_mariage_ref: numeroMariage,
        tribunal: tribunal.trim(),
        greffe: greffe.trim() || null,
        numero_jugement: numeroJugement.trim(),
        ref_jugement: `${numeroJugement.trim()} — ${tribunal.trim()}`,
        dispositif: dispositif.trim(),
        transcription_jugement: true,
        cause: dispositif.trim(),
        officier_id: officer?.userId ?? officer?.username ?? null,
        officier_name: officer?.displayName ?? null,
        officier_username: officer?.username ?? null,
        date_divorce: dateDivorce,
        date_jugement: dateDivorce,
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
    <ActFormShell schema={getActFormSchema("divorce")!}>
      <div className="panel">
        <form className="form-grid" onSubmit={(e) => void onSubmit(e)}>
          {error ? <div className="login-error full">{error}</div> : null}
          <div className="full">
            <h3 className="panel-title" style={{ marginTop: 0 }}>
              Jugement
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
            <label className="form-label">Greffe</label>
            <input className="form-control" value={greffe} onChange={(e) => setGreffe(e.target.value)} />
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
              value={dateDivorce}
              onChange={(e) => setDateDivorce(e.target.value)}
              required
            />
          </div>
          <div className="full">
            <label className="form-label">Dispositif (extrait) *</label>
            <textarea
              className="form-control"
              rows={3}
              value={dispositif}
              onChange={(e) => setDispositif(e.target.value)}
              required
              placeholder="Prononce le divorce entre… ; effets…"
            />
          </div>

          <div className="full">
            <h3 className="panel-title">Mariage concerné</h3>
          </div>
          <div className="full">
            <PersonPicker label="Époux *" value={epoux} onChange={setEpoux} required sexFilter="M" minAge={18} />
          </div>
          <div className="full">
            <PersonPicker label="Épouse *" value={epouse} onChange={setEpouse} required sexFilter="F" minAge={18} />
          </div>
          <div className="full">
            <label className="form-label">Référence de l&apos;acte de mariage *</label>
            <input className="form-control" value={numeroMariage} readOnly required />
          </div>
          <div className="full">
            <OfficerSessionField />
          </div>
          <div className="full">
            <button className="btn-primary" style={{ width: "auto", minWidth: 260 }} type="submit">
              Transcrire le jugement de divorce
            </button>
          </div>
        </form>
      </div>

      {created ? (
        <div className="panel" style={{ marginTop: "1rem" }}>
          <div className="success-banner">Transcription de divorce enregistrée</div>
          <ActPrintCard act={created} />
        </div>
      ) : null}
    </ActFormShell>
  );
}
