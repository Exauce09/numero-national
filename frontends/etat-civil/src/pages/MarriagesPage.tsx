import { FormEvent, useState } from "react";
import ActFormShell from "../components/ActFormShell";
import ActPrintCard from "../components/ActPrintCard";
import OfficerSessionField from "../components/OfficerSessionField";
import OfficerTerritoryField from "../components/OfficerTerritoryField";
import PersonPicker from "../components/PersonPicker";
import { getActFormSchema } from "../ecActForms";
import {
  addAct,
  addMarriageLink,
  ageYears,
  displayName,
  updatePerson,
  type Act,
  type Person,
} from "../registry";
import { geoFromOfficer, getLoggedOfficer } from "../officerContext";

type Regime = "COMMUNAUTE" | "SEPARATION" | "DOT";

const ALLOWED_ETAT = new Set(["CELIBATAIRE", "DIVORCE", "VEUF"]);

export default function MarriagesPage() {
  const [conjoint, setConjoint] = useState<Person | null>(null);
  const [conjointe, setConjointe] = useState<Person | null>(null);
  const [regime, setRegime] = useState<Regime>("COMMUNAUTE");
  const [receveurDote, setReceveurDote] = useState<Person | null>(null);
  const [temoin1, setTemoin1] = useState<Person | null>(null);
  const [temoin2, setTemoin2] = useState<Person | null>(null);
  const [publications, setPublications] = useState(false);
  const [datePublications, setDatePublications] = useState("");
  const [consentEpoux, setConsentEpoux] = useState(false);
  const [consentEpouse, setConsentEpouse] = useState(false);
  const [pieces, setPieces] = useState("");
  const [motif, setMotif] = useState("");
  const [dateMariage, setDateMariage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Act | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!conjoint || !conjointe) {
      setError("Époux et épouse sont obligatoires.");
      return;
    }
    if (!temoin1 || !temoin2) {
      setError("Deux témoins sont obligatoires.");
      return;
    }
    if (!publications) {
      setError("Confirmez que les publications des bans ont été effectuées.");
      return;
    }
    if (!consentEpoux || !consentEpouse) {
      setError("Le consentement des deux époux est obligatoire.");
      return;
    }
    if (ageYears(conjoint.date_naissance) < 18 || ageYears(conjointe.date_naissance) < 18) {
      setError("Les deux époux doivent avoir au moins 18 ans.");
      return;
    }
    if (conjoint.etat_civil === "MARIE" || conjointe.etat_civil === "MARIE") {
      setError("Un des époux est déjà marié — un divorce est requis avant un nouveau mariage.");
      return;
    }
    if (!ALLOWED_ETAT.has(conjoint.etat_civil) || !ALLOWED_ETAT.has(conjointe.etat_civil)) {
      const bad = [conjoint, conjointe]
        .filter((p) => !ALLOWED_ETAT.has(p.etat_civil))
        .map((p) => `${displayName(p)} (${p.etat_civil})`)
        .join(", ");
      setError(
        `État civil incompatible. Requis : célibataire, divorcé(e) ou veuf/veuve. Problème : ${bad}.`,
      );
      return;
    }

    try {
      const officer = getLoggedOfficer();
      const geo = geoFromOfficer();
      const payload = {
        epoux_id: conjoint.id,
        epoux_name: displayName(conjoint),
        epouse_id: conjointe.id,
        epouse_name: displayName(conjointe),
        regime_matrimonial: regime,
        publications_bans: true,
        date_publications: datePublications || null,
        consentement_epoux: true,
        consentement_epouse: true,
        pieces_produites: pieces.trim() || null,
        receveur_dote_id: receveurDote?.id ?? null,
        receveur_dote_name: receveurDote ? displayName(receveurDote) : null,
        temoin1_id: temoin1.id,
        temoin1_name: displayName(temoin1),
        temoin2_id: temoin2.id,
        temoin2_name: displayName(temoin2),
        officier_celebrant_id: officer?.userId ?? officer?.username ?? null,
        officier_celebrant_name: officer?.displayName ?? null,
        officier_id: officer?.userId ?? officer?.username ?? null,
        officier_name: officer?.displayName ?? null,
        officier_username: officer?.username ?? null,
        lieu_etat_civil: geo.label || "",
        geo,
        commune_code: geo.commune_code ?? null,
        motif: motif.trim() || null,
        remarque: motif.trim() || null,
        date_mariage: dateMariage,
      };
      const act = await addAct("MARRIAGE", payload, conjoint.nic);
      addMarriageLink(act.act_number, conjoint.id, conjointe.id);
      updatePerson(conjoint.id, { etat_civil: "MARIE" });
      updatePerson(conjointe.id, { etat_civil: "MARIE" });
      setCreated(act);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Enregistrement impossible.");
    }
  }

  return (
    <ActFormShell schema={getActFormSchema("mariage")!}>
      <div className="panel">
        <form className="form-grid" onSubmit={(e) => void onSubmit(e)}>
          {error ? <div className="login-error full">{error}</div> : null}
          <div className="full">
            <h3 className="panel-title" style={{ marginTop: 0 }}>
              Époux et épouse
            </h3>
          </div>
          <div className="full">
            <PersonPicker label="Époux *" value={conjoint} onChange={setConjoint} required sexFilter="M" />
          </div>
          <div className="full">
            <PersonPicker label="Épouse *" value={conjointe} onChange={setConjointe} required sexFilter="F" />
          </div>
          <div>
            <label className="form-label">Régime matrimonial *</label>
            <select
              className="form-control"
              value={regime}
              onChange={(e) => setRegime(e.target.value as Regime)}
            >
              <option value="COMMUNAUTE">Communauté de biens</option>
              <option value="SEPARATION">Séparation de biens</option>
              <option value="DOT">Dot</option>
            </select>
          </div>
          <div>
            <label className="form-label">Date de la célébration *</label>
            <input
              className="form-control"
              type="date"
              value={dateMariage}
              onChange={(e) => setDateMariage(e.target.value)}
              required
            />
          </div>

          <div className="full">
            <h3 className="panel-title">Formalités préalables</h3>
          </div>
          <div>
            <label className="form-label">Publications des bans *</label>
            <select
              className="form-control"
              value={publications ? "oui" : "non"}
              onChange={(e) => setPublications(e.target.value === "oui")}
            >
              <option value="non">Non effectuées</option>
              <option value="oui">Effectuées</option>
            </select>
          </div>
          <div>
            <label className="form-label">Date des publications</label>
            <input
              className="form-control"
              type="date"
              value={datePublications}
              onChange={(e) => setDatePublications(e.target.value)}
            />
          </div>
          <div>
            <label className="form-label">Consentement de l&apos;époux *</label>
            <select
              className="form-control"
              value={consentEpoux ? "oui" : "non"}
              onChange={(e) => setConsentEpoux(e.target.value === "oui")}
            >
              <option value="non">Non</option>
              <option value="oui">Oui</option>
            </select>
          </div>
          <div>
            <label className="form-label">Consentement de l&apos;épouse *</label>
            <select
              className="form-control"
              value={consentEpouse ? "oui" : "non"}
              onChange={(e) => setConsentEpouse(e.target.value === "oui")}
            >
              <option value="non">Non</option>
              <option value="oui">Oui</option>
            </select>
          </div>
          <div className="full">
            <label className="form-label">Pièces produites</label>
            <input
              className="form-control"
              value={pieces}
              onChange={(e) => setPieces(e.target.value)}
              placeholder="Actes de naissance, pièces d'identité…"
            />
          </div>

          <div className="full">
            <h3 className="panel-title">Célébration</h3>
          </div>
          <div className="full">
            <PersonPicker label="Témoin 1 *" value={temoin1} onChange={setTemoin1} required />
          </div>
          <div className="full">
            <PersonPicker label="Témoin 2 *" value={temoin2} onChange={setTemoin2} required />
          </div>
          <div className="full">
            <PersonPicker label="Receveur de la dot (le cas échéant)" value={receveurDote} onChange={setReceveurDote} />
          </div>
          <div className="full">
            <OfficerSessionField />
          </div>
          <div className="full">
            <OfficerTerritoryField label="Bureau d'état civil (lieu de célébration)" />
          </div>
          <div className="full">
            <label className="form-label">Mention libre (optionnel)</label>
            <input
              className="form-control"
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              placeholder="Dispense, précision…"
            />
          </div>
          <div className="full">
            <button className="btn-primary" style={{ width: "auto", minWidth: 220 }} type="submit">
              Établir l&apos;acte de mariage
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
    </ActFormShell>
  );
}
