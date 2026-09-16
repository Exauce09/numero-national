/** Saisie + impression Fiche d'identification (Justicia) — géo RDC sans District. */

import { FormEvent, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import FicheIdentificationForm, {
  emptyFichePerson,
  type FicheIdentificationData,
  type FichePersonBlock,
} from "../components/FicheIdentificationForm";
import { getOfficerCommune } from "../commune";
import { getSession } from "../auth";
import { provinceDigitsFromName } from "../registry";

function PersonFields({
  title,
  value,
  onChange,
}: {
  title: string;
  value: FichePersonBlock;
  onChange: (next: FichePersonBlock) => void;
}) {
  const set = (key: keyof FichePersonBlock, v: string) => onChange({ ...value, [key]: v });
  return (
    <div className="panel" style={{ marginBottom: "1rem" }}>
      <h3 className="panel-title">{title}</h3>
      <div className="form-grid">
        {(
          [
            ["nom", "Nom de l'intéressé"],
            ["postnom", "Post-nom"],
            ["prenom", "Prénom"],
            ["sexe", "Sexe"],
            ["etat_civil", "Etat-Civil"],
            ["lieu_date_naissance", "Lieu et date de naissance"],
            ["nationalite", "Nationalité"],
            ["profession", "Profession"],
            ["secteur", "Secteur"],
            ["territoire", "Territoire"],
            ["ville", "Ville"],
            ["province", "Province"],
            ["adresse", "Adresse"],
          ] as const
        ).map(([key, label]) => (
          <div key={key} className={key === "adresse" || key === "lieu_date_naissance" ? "full" : undefined}>
            <label className="form-label">{label}</label>
            <input
              className="form-control"
              value={value[key]}
              onChange={(e) => set(key, e.target.value)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function FicheIdentificationPage() {
  const officer = getOfficerCommune();
  const session = getSession();
  const [serieSuffix, setSerieSuffix] = useState("");
  const [interesse, setInteresse] = useState<FichePersonBlock>(() => ({
    ...emptyFichePerson(),
    province: officer.province,
    ville: officer.ville,
  }));
  const [conjoint, setConjoint] = useState({
    nom: "",
    lieu_date_naissance: "",
    profession: "",
    adresse: "",
  });
  const [pere, setPere] = useState(emptyFichePerson);
  const [mere, setMere] = useState(emptyFichePerson);
  const [ready, setReady] = useState(false);

  const serie = useMemo(() => {
    const pp = provinceDigitsFromName(officer.province || "Kinshasa");
    const tail = serieSuffix.trim() || "………";
    return `${pp}/INF001-TSL/${tail}`;
  }, [officer.province, serieSuffix]);

  const data: FicheIdentificationData = {
    communeName: officer.name,
    villeProvince: officer.ville || officer.province || "Kinshasa",
    serie,
    interesse,
    conjoint,
    pere,
    mere,
    dateLieu: `${officer.ville || "Kinshasa"}, le ${new Date().toLocaleDateString("fr-FR")}`,
  };

  function onPreview(e: FormEvent) {
    e.preventDefault();
    setReady(true);
  }

  return (
    <div>
      <div className="eg-page-head no-print">
        <div>
          <p className="eg-breadcrumb">
            <Link to="/">Accueil</Link> / Fiche d&apos;identification
          </p>
          <h2 className="page-title">Fiche d&apos;identification</h2>
          <p className="page-lead">
            Attestation de naissance, célibataire, résidence, bonne vie et mœurs, nom fonctionnaire,
            veuvage — modèle état civil (sans District : Ville / Territoire / Secteur).
            {session?.displayName ? ` Officier : ${session.displayName}.` : ""}
          </p>
        </div>
      </div>

      <form className="no-print" onSubmit={onPreview}>
        <div className="panel" style={{ marginBottom: "1rem" }}>
          <div className="form-grid">
            <div>
              <label className="form-label">Suffixe série</label>
              <input
                className="form-control"
                value={serieSuffix}
                onChange={(e) => setSerieSuffix(e.target.value)}
                placeholder="N° séquentiel"
              />
            </div>
            <div className="full muted small">Série complète : {serie}</div>
          </div>
        </div>

        <PersonFields title="Intéressé(e)" value={interesse} onChange={setInteresse} />

        <div className="panel" style={{ marginBottom: "1rem" }}>
          <h3 className="panel-title">Conjoint(e)</h3>
          <div className="form-grid">
            <div>
              <label className="form-label">Nom du conjoint(e)</label>
              <input
                className="form-control"
                value={conjoint.nom}
                onChange={(e) => setConjoint({ ...conjoint, nom: e.target.value })}
              />
            </div>
            <div>
              <label className="form-label">Lieu et date de naissance</label>
              <input
                className="form-control"
                value={conjoint.lieu_date_naissance}
                onChange={(e) => setConjoint({ ...conjoint, lieu_date_naissance: e.target.value })}
              />
            </div>
            <div>
              <label className="form-label">Profession</label>
              <input
                className="form-control"
                value={conjoint.profession}
                onChange={(e) => setConjoint({ ...conjoint, profession: e.target.value })}
              />
            </div>
            <div className="full">
              <label className="form-label">Adresse</label>
              <input
                className="form-control"
                value={conjoint.adresse}
                onChange={(e) => setConjoint({ ...conjoint, adresse: e.target.value })}
              />
            </div>
          </div>
        </div>

        <PersonFields title="Père" value={pere} onChange={setPere} />
        <PersonFields title="Mère" value={mere} onChange={setMere} />

        <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.5rem" }}>
          <button type="submit" className="btn-primary" style={{ width: "auto" }}>
            Prévisualiser la fiche
          </button>
          {ready ? (
            <button type="button" className="btn-secondary" style={{ width: "auto" }} onClick={() => window.print()}>
              Imprimer
            </button>
          ) : null}
        </div>
      </form>

      {ready ? (
        <div className="panel fiche-ident-wrap">
          <div className="syn-toolbar no-print" style={{ justifyContent: "flex-end" }}>
            <button type="button" className="btn-primary" style={{ width: "auto" }} onClick={() => window.print()}>
              Imprimer / PDF
            </button>
          </div>
          <FicheIdentificationForm data={data} />
        </div>
      ) : null}
    </div>
  );
}
