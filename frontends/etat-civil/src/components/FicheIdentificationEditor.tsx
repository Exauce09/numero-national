/** Formulaire d'ajout personne — champs fiche d'identification, UI formulaire standard. */

import { useMemo, useState } from "react";
import { ETAT_CIVIL_OPTIONS, type EtatCivil, type Sexe } from "../registry";
import { listKnownProfessions, PROFESSIONS_KEY, rememberNamed } from "../namedLists";
import { emptyFichePerson, type FichePersonBlock } from "./FicheIdentificationForm";
import RdcGeoWizard, { type RdcGeoValue } from "./RdcGeoWizard";
import GeoCascade, { GEO_PRESETS } from "./GeoCascade";

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

export default function FicheIdentificationEditor({
  value,
  onChange,
  sexeLocked,
  compact = false,
}: Props) {
  const i = value.interesse;
  const professions = useMemo(() => listKnownProfessions([i.profession]), [i.profession]);
  const [originGeo, setOriginGeo] = useState<RdcGeoValue>({});

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
      adresse: geo.label || i.adresse,
    });
  }

  return (
    <div className="fiche-ident-edit fiche-ident-form-normal">
      <div className="panel" style={{ margin: 0, boxShadow: "none" }}>
        <div className="panel-head" style={{ marginBottom: "0.75rem" }}>
          <div>
            <h3 className="panel-title" style={{ margin: 0 }}>
              Fiche d&apos;identification
            </h3>
            <p className="muted small" style={{ margin: "0.25rem 0 0" }}>
              Commune de {value.communeName || "—"} · {value.villeProvince || "RDC"}
              {value.serie ? ` · Série ${value.serie}` : ""}
            </p>
          </div>
        </div>

        <div className="form-grid">
          <div>
            <label className="form-label">Série</label>
            <input
              className="form-control"
              value={value.serie}
              onChange={(e) => onChange({ ...value, serie: e.target.value })}
              placeholder="Série…"
            />
          </div>
          <div>
            <label className="form-label">Date / lieu d&apos;établissement</label>
            <input
              className="form-control"
              value={value.dateLieu}
              onChange={(e) => onChange({ ...value, dateLieu: e.target.value })}
            />
          </div>

          <div className="full">
            <h4 className="panel-title" style={{ fontSize: "1rem", marginBottom: 0 }}>
              Identité de l&apos;intéressé
            </h4>
          </div>

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
            <label className="form-label">Date de naissance *</label>
            <input
              className="form-control"
              type="date"
              value={i.date_naissance}
              onChange={(e) => patchInteresse({ date_naissance: e.target.value })}
              required
            />
          </div>
          <div>
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
            <label className="form-label">Lieu de naissance</label>
            <GeoCascade
              embedded
              allowAdd={false}
              levels={[...GEO_PRESETS.place]}
              label="Lieu de naissance"
              onChange={(geo) => {
                const full =
                  geo.label ||
                  [geo.commune_name, geo.ville_name, geo.province_name].filter(Boolean).join(", ");
                patchInteresse({ lieu_date_naissance: full });
              }}
            />
            {i.lieu_date_naissance ? (
              <p className="muted small" style={{ marginTop: 4 }}>
                Lieu complet : <strong>{i.lieu_date_naissance}</strong>
              </p>
            ) : null}
          </div>

          <div className="full">
            <RdcGeoWizard
              label="Origine / adresse (cascade RDC)"
              value={originGeo}
              onChange={applyOrigin}
            />
          </div>

          <div className="full">
            <label className="form-label">Adresse (complément)</label>
            <input
              className="form-control"
              value={i.adresse}
              onChange={(e) => patchInteresse({ adresse: e.target.value })}
              placeholder="Parcelle, référence…"
            />
          </div>

          {!compact ? (
            <>
              <div className="full">
                <h4 className="panel-title" style={{ fontSize: "1rem", marginBottom: 0 }}>
                  Conjoint(e) (le cas échéant)
                </h4>
              </div>
              <div>
                <label className="form-label">Nom du conjoint(e)</label>
                <input
                  className="form-control"
                  value={value.conjoint.nom}
                  onChange={(e) =>
                    onChange({ ...value, conjoint: { ...value.conjoint, nom: e.target.value } })
                  }
                />
              </div>
              <div>
                <label className="form-label">Lieu et date de naissance</label>
                <input
                  className="form-control"
                  value={value.conjoint.lieu_date_naissance}
                  onChange={(e) =>
                    onChange({
                      ...value,
                      conjoint: { ...value.conjoint, lieu_date_naissance: e.target.value },
                    })
                  }
                />
              </div>
              <div>
                <label className="form-label">Profession</label>
                <input
                  className="form-control"
                  value={value.conjoint.profession}
                  onChange={(e) =>
                    onChange({
                      ...value,
                      conjoint: { ...value.conjoint, profession: e.target.value },
                    })
                  }
                />
              </div>
              <div>
                <label className="form-label">Adresse</label>
                <input
                  className="form-control"
                  value={value.conjoint.adresse}
                  onChange={(e) =>
                    onChange({ ...value, conjoint: { ...value.conjoint, adresse: e.target.value } })
                  }
                />
              </div>

              <div className="full">
                <h4 className="panel-title" style={{ fontSize: "1rem", marginBottom: 0 }}>
                  Père
                </h4>
              </div>
              <div>
                <label className="form-label">Nom</label>
                <input
                  className="form-control"
                  value={value.pere.nom}
                  onChange={(e) =>
                    onChange({ ...value, pere: { ...value.pere, nom: e.target.value } })
                  }
                />
              </div>
              <div>
                <label className="form-label">Post-nom</label>
                <input
                  className="form-control"
                  value={value.pere.postnom}
                  onChange={(e) =>
                    onChange({ ...value, pere: { ...value.pere, postnom: e.target.value } })
                  }
                />
              </div>
              <div>
                <label className="form-label">Prénom</label>
                <input
                  className="form-control"
                  value={value.pere.prenom}
                  onChange={(e) =>
                    onChange({ ...value, pere: { ...value.pere, prenom: e.target.value } })
                  }
                />
              </div>

              <div className="full">
                <h4 className="panel-title" style={{ fontSize: "1rem", marginBottom: 0 }}>
                  Mère
                </h4>
              </div>
              <div>
                <label className="form-label">Nom</label>
                <input
                  className="form-control"
                  value={value.mere.nom}
                  onChange={(e) =>
                    onChange({ ...value, mere: { ...value.mere, nom: e.target.value } })
                  }
                />
              </div>
              <div>
                <label className="form-label">Post-nom</label>
                <input
                  className="form-control"
                  value={value.mere.postnom}
                  onChange={(e) =>
                    onChange({ ...value, mere: { ...value.mere, postnom: e.target.value } })
                  }
                />
              </div>
              <div>
                <label className="form-label">Prénom</label>
                <input
                  className="form-control"
                  value={value.mere.prenom}
                  onChange={(e) =>
                    onChange({ ...value, mere: { ...value.mere, prenom: e.target.value } })
                  }
                />
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
