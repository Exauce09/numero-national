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
  effectiveEtatCivil,
  getPerson,
  setCivilStatusOverride,
  updatePerson,
  upsertLocalPersonFromApi,
  type Act,
  type Person,
} from "../registry";
import { geoFromOfficer, getLoggedOfficer } from "../officerContext";

type Regime = "COMMUNAUTE" | "SEPARATION" | "DOT";

const ALLOWED_ETAT = new Set(["CELIBATAIRE", "DIVORCE", "VEUF"]);

/** Assure une fiche locale (les hits API n'écrivent pas toujours le registre). */
function ensureLocalSpouse(p: Person): Person {
  const existing = getPerson(p.id);
  if (existing) {
    const etat = effectiveEtatCivil(existing);
    if (existing.etat_civil !== etat) {
      return updatePerson(existing.id, { etat_civil: etat }) ?? { ...existing, etat_civil: etat };
    }
    return existing;
  }
  const etat = effectiveEtatCivil(p);
  return upsertLocalPersonFromApi({
    id: p.id,
    nom: p.nom,
    postnom: p.postnom,
    prenom: p.prenom,
    sexe: p.sexe,
    date_naissance: p.date_naissance,
    lieu_naissance: p.lieu_naissance,
    nic: p.nic || `LOC-${p.id.replace(/-/g, "").slice(0, 12)}`,
    etat_civil: etat,
  });
}

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
  const [motif, setMotif] = useState("");
  const [dateMariage, setDateMariage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Act | null>(null);
  const [busy, setBusy] = useState(false);

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
    if (!dateMariage) {
      setError("La date de célébration est obligatoire.");
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
    if (!conjoint.date_naissance || !conjointe.date_naissance) {
      setError("Date de naissance manquante pour un des époux — complétez la fiche avant le mariage.");
      return;
    }
    if (ageYears(conjoint.date_naissance) < 18 || ageYears(conjointe.date_naissance) < 18) {
      setError("Les deux époux doivent avoir au moins 18 ans.");
      return;
    }
    if (conjoint.id === conjointe.id) {
      setError("L'époux et l'épouse doivent être deux personnes distinctes.");
      return;
    }

    const etatH = effectiveEtatCivil(conjoint);
    const etatF = effectiveEtatCivil(conjointe);
    if (etatH === "MARIE" || etatF === "MARIE") {
      setError("Un des époux est déjà marié — un divorce est requis avant un nouveau mariage.");
      return;
    }
    if (!ALLOWED_ETAT.has(etatH) || !ALLOWED_ETAT.has(etatF)) {
      const bad = [conjoint, conjointe]
        .filter((p) => !ALLOWED_ETAT.has(effectiveEtatCivil(p)))
        .map((p) => `${displayName(p)} (${effectiveEtatCivil(p)})`)
        .join(", ");
      setError(
        `État civil incompatible. Requis : célibataire, divorcé(e) ou veuf/veuve. Problème : ${bad}.`,
      );
      return;
    }

    setBusy(true);
    try {
      const epoux = ensureLocalSpouse({ ...conjoint, etat_civil: etatH });
      const epouse = ensureLocalSpouse({ ...conjointe, etat_civil: etatF });
      const officer = getLoggedOfficer();
      const geo = geoFromOfficer();
      const payload = {
        epoux_id: epoux.id,
        epoux_name: displayName(epoux),
        epouse_id: epouse.id,
        epouse_name: displayName(epouse),
        regime_matrimonial: regime,
        publications_bans: true,
        date_publications: datePublications || null,
        consentement_epoux: true,
        consentement_epouse: true,
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
      const subjectNic = epoux.nic || epouse.nic || `MAR-${epoux.id.slice(0, 8)}`;
      const act = await addAct("MARRIAGE", payload, subjectNic);
      addMarriageLink(act.act_number, epoux.id, epouse.id);
      updatePerson(epoux.id, { etat_civil: "MARIE" });
      updatePerson(epouse.id, { etat_civil: "MARIE" });
      setCivilStatusOverride(epoux.id, "MARIE");
      setCivilStatusOverride(epouse.id, "MARIE");
      setCreated(act);
      setConjoint(null);
      setConjointe(null);
      setTemoin1(null);
      setTemoin2(null);
      setReceveurDote(null);
      setPublications(false);
      setConsentEpoux(false);
      setConsentEpouse(false);
      setDateMariage("");
      setDatePublications("");
      setMotif("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Enregistrement impossible.");
    } finally {
      setBusy(false);
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
            <PersonPicker label="Époux *" value={conjoint} onChange={setConjoint} required sexFilter="M" minAge={18} />
          </div>
          <div className="full">
            <PersonPicker label="Épouse *" value={conjointe} onChange={setConjointe} required sexFilter="F" minAge={18} />
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
            <h3 className="panel-title">Célébration</h3>
          </div>
          <div className="full">
            <PersonPicker label="Témoin 1 *" value={temoin1} onChange={setTemoin1} required minAge={18} />
          </div>
          <div className="full">
            <PersonPicker label="Témoin 2 *" value={temoin2} onChange={setTemoin2} required minAge={18} />
          </div>
          <div className="full">
            <PersonPicker label="Receveur de la dot (le cas échéant)" value={receveurDote} onChange={setReceveurDote} minAge={18} />
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
            <button
              className="btn-primary"
              style={{ width: "auto", minWidth: 220 }}
              type="submit"
              disabled={busy}
            >
              {busy ? "Enregistrement…" : "Établir l&apos;acte de mariage"}
            </button>
          </div>
        </form>
      </div>

      {created ? (
        <div className="panel" style={{ marginTop: "1rem" }}>
          <div className="success-banner">Acte de mariage créé — {created.act_number}</div>
          {typeof created.payload.sync_warning === "string" ? (
            <div className="login-error" style={{ marginTop: "0.75rem" }}>
              {created.payload.sync_warning}
            </div>
          ) : null}
          <ActPrintCard act={created} />
        </div>
      ) : null}
    </ActFormShell>
  );
}
