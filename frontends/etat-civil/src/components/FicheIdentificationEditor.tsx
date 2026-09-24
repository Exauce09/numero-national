/** Formulaire d'ajout personne — champs standards + origine / adresse séparées. */

import { useMemo, useState } from "react";
import { ETAT_CIVIL_OPTIONS, type EtatCivil, type Sexe } from "../registry";
import { listKnownProfessions, PROFESSIONS_KEY, rememberNamed } from "../namedLists";
import { emptyFichePerson, type FichePersonBlock } from "./FicheIdentificationForm";
import RdcGeoWizard, { type RdcGeoValue } from "./RdcGeoWizard";

export type FicheEditorConjoint = {
  nom: string;
  lieu_date_naissance: string;
  profession: string;
  adresse: string;
};

export type FicheEditorState = {
  serie: string;
  communeName: string;
  villeProvince: string;
  interesse: FichePersonBlock & {
    date_naissance: string;
    sexe_code: Sexe;
    etat_civil_code: EtatCivil;
  };
  conjoint: FicheEditorConjoint;
  pere: FichePersonBlock;
  mere: FichePersonBlock;
  dateLieu: string;
};

export function emptyFicheEditorState(opts?: {
  communeName?: string;
  villeProvince?: string;
  serie?: string;
  sexe?: Sexe;
}): FicheEditorState {
  const today = new Date().toLocaleDateString("fr-FR");
  return {
    serie: opts?.serie || "",
    communeName: opts?.communeName || "",
    villeProvince: opts?.villeProvince || "Kinshasa",
    interesse: {
      ...emptyFichePerson(),
      date_naissance: "",
      sexe_code: opts?.sexe ?? "M",
      etat_civil_code: "CELIBATAIRE",
      sexe: opts?.sexe === "F" ? "Féminin" : "Masculin",
      etat_civil: "Célibataire",
      nationalite: "Congolaise",
    },
    conjoint: { nom: "", lieu_date_naissance: "", profession: "", adresse: "" },
    pere: emptyFichePerson(),
    mere: emptyFichePerson(),
    dateLieu: `${opts?.villeProvince || "Kinshasa"}, le ${today}`,
  };
}

type Props = {
  value: FicheEditorState;
  onChange: (next: FicheEditorState) => void;
  sexeLocked?: Sexe;
  compact?: boolean;
};

function ParentSection({
  title,
  value,
  onChange,
  sexeFixed,
}: {
  title: string;
  value: FichePersonBlock;
  onChange: (next: FichePersonBlock) => void;
  sexeFixed: "M" | "F";
}) {
  const [originGeo, setOriginGeo] = useState<RdcGeoValue>({});
  const set = <K extends keyof FichePersonBlock>(key: K, v: FichePersonBlock[K]) =>
    onChange({ ...value, [key]: v, sexe: sexeFixed === "F" ? "Féminin" : "Masculin" });

  return (
    <>
      <div className="full">
        <h4 className="panel-title" style={{ fontSize: "1rem", marginBottom: 0 }}>
          {title}
        </h4>
        <p className="muted small" style={{ margin: "0.2rem 0 0" }}>
          Identité et origine — sexe {sexeFixed === "F" ? "féminin" : "masculin"} (verrouillé).
        </p>
      </div>
      <div>
        <label className="form-label">Nom</label>
        <input className="form-control" value={value.nom} onChange={(e) => set("nom", e.target.value)} />
      </div>
      <div>
        <label className="form-label">Post-nom</label>
        <input
          className="form-control"
          value={value.postnom}
          onChange={(e) => set("postnom", e.target.value)}
        />
      </div>
      <div>
        <label className="form-label">Prénom</label>
        <input
          className="form-control"
          value={value.prenom}
          onChange={(e) => set("prenom", e.target.value)}
        />
      </div>
      <div>
        <label className="form-label">Sexe</label>
        <input
          className="form-control"
          value={sexeFixed === "F" ? "Féminin" : "Masculin"}
          readOnly
        />
      </div>
      <div>
        <label className="form-label">Lieu de naissance</label>
        <input
          className="form-control"
          value={value.lieu_date_naissance}
          onChange={(e) => set("lieu_date_naissance", e.target.value)}
          placeholder="Lieu de naissance"
        />
      </div>
      <div>
        <label className="form-label">Nationalité</label>
        <input
          className="form-control"
          value={value.nationalite}
          onChange={(e) => set("nationalite", e.target.value)}
        />
      </div>
      <div className="full">
        <label className="form-label">Profession</label>
        <input
          className="form-control"
          value={value.profession}
          onChange={(e) => set("profession", e.target.value)}
          placeholder="Profession"
        />
      </div>
      <div className="full">
        <RdcGeoWizard
          purpose="origine"
          label={`Origine — ${sexeFixed === "F" ? "mère" : "père"} (Province / Territoire ou Ville / Secteur)`}
          value={originGeo}
          onChange={(geo) => {
            setOriginGeo(geo);
            onChange({
              ...value,
              sexe: sexeFixed === "F" ? "Féminin" : "Masculin",
              province: geo.province_name || "",
              ville: geo.ville_name || "",
              territoire: geo.district_name || geo.ville_name || "",
              secteur: geo.commune_name || geo.village_name || "",
            });
          }}
        />
        {(value.province || value.territoire || value.secteur) && (
          <p className="muted small" style={{ marginTop: 6 }}>
            Origine :{" "}
            <strong>
              {[value.secteur, value.territoire, value.ville, value.province]
                .filter(Boolean)
                .join(" · ")}
            </strong>
          </p>
        )}
      </div>
    </>
  );
}

export default function FicheIdentificationEditor({
  value,
  onChange,
  sexeLocked,
  compact = false,
}: Props) {
  const i = value.interesse;
  const professions = useMemo(() => listKnownProfessions([i.profession]), [i.profession]);
  const [originGeo, setOriginGeo] = useState<RdcGeoValue>({});
  const [addressGeo, setAddressGeo] = useState<RdcGeoValue>({});
  const [adresseComplement, setAdresseComplement] = useState("");

  function patchInteresse(patch: Partial<typeof i>) {
    const sexe_code = sexeLocked ?? patch.sexe_code ?? i.sexe_code;
    onChange({
      ...value,
      interesse: {
        ...i,
        ...patch,
        sexe_code,
        sexe: sexe_code === "F" ? "Féminin" : "Masculin",
      },
    });
  }

  function applyOrigin(geo: RdcGeoValue) {
    setOriginGeo(geo);
    patchInteresse({
      province: geo.province_name || "",
      ville: geo.ville_name || "",
      territoire: geo.district_name || geo.ville_name || "",
      secteur: geo.commune_name || geo.village_name || "",
    });
  }

  function applyAddress(geo: RdcGeoValue) {
    setAddressGeo(geo);
    const base = geo.label || "";
    const full = [base, adresseComplement.trim()].filter(Boolean).join(" — ");
    patchInteresse({ adresse: full });
  }

  function onComplement(v: string) {
    setAdresseComplement(v);
    const base = addressGeo.label || "";
    const full = [base, v.trim()].filter(Boolean).join(" — ");
    patchInteresse({ adresse: full });
  }

  return (
    <div className="fiche-ident-edit fiche-ident-form-normal">
      <div className="panel" style={{ margin: 0, boxShadow: "none" }}>
        <div className="panel-head" style={{ marginBottom: "0.75rem" }}>
          <div>
            <h3 className="panel-title" style={{ margin: 0 }}>
              Ajouter une personne
            </h3>
            <p className="muted small" style={{ margin: "0.25rem 0 0" }}>
              Bureau : Commune de {value.communeName || "—"} · {value.villeProvince || "RDC"}
            </p>
          </div>
        </div>

        <div className="form-grid">
          <div>
            <label className="form-label">Nom *</label>
            <input
              className="form-control"
              value={i.nom}
              onChange={(e) => patchInteresse({ nom: e.target.value })}
              required
              autoFocus
            />
          </div>
          <div>
            <label className="form-label">Post-nom</label>
            <input
              className="form-control"
              value={i.postnom}
              onChange={(e) => patchInteresse({ postnom: e.target.value })}
            />
          </div>
          <div>
            <label className="form-label">Prénom *</label>
            <input
              className="form-control"
              value={i.prenom}
              onChange={(e) => patchInteresse({ prenom: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="form-label">Sexe *</label>
            {sexeLocked ? (
              <input
                className="form-control"
                value={sexeLocked === "F" ? "Féminin" : "Masculin"}
                readOnly
              />
            ) : (
              <select
                className="form-control"
                value={i.sexe_code}
                onChange={(e) => patchInteresse({ sexe_code: e.target.value as Sexe })}
              >
                <option value="M">Masculin</option>
                <option value="F">Féminin</option>
              </select>
            )}
          </div>
          <div>
            <label className="form-label">État civil *</label>
            <select
              className="form-control"
              value={i.etat_civil_code}
              onChange={(e) => {
                const code = e.target.value as EtatCivil;
                const opt = ETAT_CIVIL_OPTIONS.find((o) => o.value === code);
                patchInteresse({ etat_civil_code: code, etat_civil: opt?.label || code });
              }}
            >
              {ETAT_CIVIL_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label">Nationalité</label>
            <input
              className="form-control"
              value={i.nationalite}
              onChange={(e) => patchInteresse({ nationalite: e.target.value })}
            />
          </div>

          <div>
            <label className="form-label">Lieu de naissance</label>
            <input
              className="form-control"
              value={i.lieu_date_naissance}
              onChange={(e) => patchInteresse({ lieu_date_naissance: e.target.value })}
              placeholder="Lieu (commune, ville, province…)"
            />
          </div>
          <div>
            <label className="form-label">Date de naissance *</label>
            <input
              className="form-control"
              type="date"
              value={i.date_naissance}
              onChange={(e) => patchInteresse({ date_naissance: e.target.value })}
              required
            />
          </div>

          <div className="full">
            <label className="form-label">Profession</label>
            <input
              className="form-control"
              list="fiche-professions"
              value={i.profession}
              onChange={(e) => {
                patchInteresse({ profession: e.target.value });
                if (e.target.value.trim().length > 2) rememberNamed(PROFESSIONS_KEY, e.target.value);
              }}
              placeholder="Choisir ou saisir…"
            />
            <datalist id="fiche-professions">
              {professions.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </div>

          <div className="full">
            <RdcGeoWizard
              purpose="origine"
              label="Origine — Province / Territoire ou Ville / Secteur"
              value={originGeo}
              onChange={applyOrigin}
            />
            {(i.province || i.territoire || i.secteur) && (
              <p className="muted small" style={{ marginTop: 6 }}>
                Origine enregistrée :{" "}
                <strong>
                  {[i.secteur, i.territoire, i.ville, i.province].filter(Boolean).join(" · ")}
                </strong>
              </p>
            )}
          </div>

          <div className="full">
            <RdcGeoWizard
              purpose="adresse"
              label="Adresse de résidence (actuelle)"
              value={addressGeo}
              onChange={applyAddress}
            />
            <label className="form-label" style={{ marginTop: "0.65rem" }}>
              Complément d&apos;adresse
            </label>
            <input
              className="form-control"
              value={adresseComplement}
              onChange={(e) => onComplement(e.target.value)}
              placeholder="Parcelle, référence, point de repère…"
            />
            {i.adresse ? (
              <p className="muted small" style={{ marginTop: 6 }}>
                Adresse enregistrée : <strong>{i.adresse}</strong>
              </p>
            ) : null}
          </div>

          {!compact ? (
            <>
              <ParentSection
                title="Père (optionnel)"
                value={value.pere}
                sexeFixed="M"
                onChange={(pere) => onChange({ ...value, pere })}
              />
              <ParentSection
                title="Mère (optionnel)"
                value={value.mere}
                sexeFixed="F"
                onChange={(mere) => onChange({ ...value, mere })}
              />
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
