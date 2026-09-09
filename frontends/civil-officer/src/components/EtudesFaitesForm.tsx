import {
  DIPLOMES_UNIV,
  NIVEAUX_ETUDES,
  NIVEAUX_SCOLAIRES,
  emptyEtablissement,
  emptyFormationPro,
  emptyFormationUniv,
  type EtudesData,
} from "../etudesFaites";

type Props = {
  value: EtudesData;
  onChange: (next: EtudesData) => void;
};

export default function EtudesFaitesForm({ value, onChange }: Props) {
  return (
    <div className="situation-familiale">
      <fieldset className="id-fieldset">
        <legend>Niveau général</legend>
        <div className="form-grid">
          <div>
            <label className="form-label">Niveau d&apos;études atteint</label>
            <select
              className="form-control"
              value={value.niveau_atteint}
              onChange={(e) => onChange({ ...value, niveau_atteint: e.target.value })}
            >
              {NIVEAUX_ETUDES.map((n) => (
                <option key={n.value || "empty"} value={n.value}>
                  {n.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label">Année de fin d&apos;études</label>
            <input
              className="form-control"
              value={value.annee_fin_etudes}
              onChange={(e) => onChange({ ...value, annee_fin_etudes: e.target.value })}
              placeholder="Ex. 2018"
            />
          </div>
          <div>
            <label className="form-label">Sait lire</label>
            <select
              className="form-control"
              value={value.sait_lire}
              onChange={(e) =>
                onChange({ ...value, sait_lire: e.target.value as EtudesData["sait_lire"] })
              }
            >
              <option value="">—</option>
              <option value="oui">Oui</option>
              <option value="non">Non</option>
            </select>
          </div>
          <div>
            <label className="form-label">Sait écrire</label>
            <select
              className="form-control"
              value={value.sait_ecrire}
              onChange={(e) =>
                onChange({ ...value, sait_ecrire: e.target.value as EtudesData["sait_ecrire"] })
              }
            >
              <option value="">—</option>
              <option value="oui">Oui</option>
              <option value="non">Non</option>
            </select>
          </div>
        </div>
      </fieldset>

      <fieldset className="id-fieldset">
        <legend>Parcours scolaire</legend>
        {value.etablissements.length === 0 ? (
          <p className="muted small">Aucun établissement déclaré.</p>
        ) : null}
        {value.etablissements.map((row, index) => (
          <div key={`sco-${index}`} className="family-member-card">
            <div className="family-member-head">
              <strong>Établissement {index + 1}</strong>
              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={() =>
                  onChange({
                    ...value,
                    etablissements: value.etablissements.filter((_, i) => i !== index),
                  })
                }
              >
                Retirer
              </button>
            </div>
            <div className="form-grid family-member-grid">
              <div className="full">
                <label className="form-label">Nom de l&apos;établissement</label>
                <input
                  className="form-control"
                  value={row.etablissement}
                  onChange={(e) => {
                    const etablissements = [...value.etablissements];
                    etablissements[index] = { ...row, etablissement: e.target.value };
                    onChange({ ...value, etablissements });
                  }}
                />
              </div>
              <div>
                <label className="form-label">Niveau</label>
                <select
                  className="form-control"
                  value={row.niveau}
                  onChange={(e) => {
                    const etablissements = [...value.etablissements];
                    etablissements[index] = { ...row, niveau: e.target.value };
                    onChange({ ...value, etablissements });
                  }}
                >
                  {NIVEAUX_SCOLAIRES.map((n) => (
                    <option key={n || "empty"} value={n}>
                      {n || "—"}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">Ville / commune</label>
                <input
                  className="form-control"
                  value={row.ville}
                  onChange={(e) => {
                    const etablissements = [...value.etablissements];
                    etablissements[index] = { ...row, ville: e.target.value };
                    onChange({ ...value, etablissements });
                  }}
                />
              </div>
              <div>
                <label className="form-label">Année début</label>
                <input
                  className="form-control"
                  value={row.annee_debut}
                  onChange={(e) => {
                    const etablissements = [...value.etablissements];
                    etablissements[index] = { ...row, annee_debut: e.target.value };
                    onChange({ ...value, etablissements });
                  }}
                  placeholder="AAAA"
                />
              </div>
              <div>
                <label className="form-label">Année fin</label>
                <input
                  className="form-control"
                  value={row.annee_fin}
                  onChange={(e) => {
                    const etablissements = [...value.etablissements];
                    etablissements[index] = { ...row, annee_fin: e.target.value };
                    onChange({ ...value, etablissements });
                  }}
                  placeholder="AAAA"
                />
              </div>
              <div className="full">
                <label className="form-label">Diplôme / certificat obtenu</label>
                <input
                  className="form-control"
                  value={row.diplome}
                  onChange={(e) => {
                    const etablissements = [...value.etablissements];
                    etablissements[index] = { ...row, diplome: e.target.value };
                    onChange({ ...value, etablissements });
                  }}
                  placeholder="CEPE, Diplôme d'État…"
                />
              </div>
            </div>
          </div>
        ))}
        <button
          type="button"
          className="btn-secondary btn-sm"
          onClick={() =>
            onChange({ ...value, etablissements: [...value.etablissements, emptyEtablissement()] })
          }
        >
          + Ajouter un établissement scolaire
        </button>
      </fieldset>

      <fieldset className="id-fieldset">
        <legend>Parcours universitaire</legend>
        {value.formations_universitaires.length === 0 ? (
          <p className="muted small">Aucune formation universitaire déclarée.</p>
        ) : null}
        {value.formations_universitaires.map((row, index) => (
          <div key={`univ-${index}`} className="family-member-card">
            <div className="family-member-head">
              <strong>Formation {index + 1}</strong>
              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={() =>
                  onChange({
                    ...value,
                    formations_universitaires: value.formations_universitaires.filter(
                      (_, i) => i !== index
                    ),
                  })
                }
              >
                Retirer
              </button>
            </div>
            <div className="form-grid family-member-grid">
              <div className="full">
                <label className="form-label">Établissement / université</label>
                <input
                  className="form-control"
                  value={row.etablissement}
                  onChange={(e) => {
                    const formations_universitaires = [...value.formations_universitaires];
                    formations_universitaires[index] = { ...row, etablissement: e.target.value };
                    onChange({ ...value, formations_universitaires });
                  }}
                />
              </div>
              <div>
                <label className="form-label">Filière / domaine</label>
                <input
                  className="form-control"
                  value={row.filiere}
                  onChange={(e) => {
                    const formations_universitaires = [...value.formations_universitaires];
                    formations_universitaires[index] = { ...row, filiere: e.target.value };
                    onChange({ ...value, formations_universitaires });
                  }}
                />
              </div>
              <div>
                <label className="form-label">Diplôme</label>
                <select
                  className="form-control"
                  value={row.diplome}
                  onChange={(e) => {
                    const formations_universitaires = [...value.formations_universitaires];
                    formations_universitaires[index] = { ...row, diplome: e.target.value };
                    onChange({ ...value, formations_universitaires });
                  }}
                >
                  {DIPLOMES_UNIV.map((d) => (
                    <option key={d || "empty"} value={d}>
                      {d || "—"}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">Année d&apos;obtention</label>
                <input
                  className="form-control"
                  value={row.annee_obtention}
                  onChange={(e) => {
                    const formations_universitaires = [...value.formations_universitaires];
                    formations_universitaires[index] = { ...row, annee_obtention: e.target.value };
                    onChange({ ...value, formations_universitaires });
                  }}
                  placeholder="AAAA"
                />
              </div>
              <div>
                <label className="form-label">Statut</label>
                <select
                  className="form-control"
                  value={row.statut}
                  onChange={(e) => {
                    const formations_universitaires = [...value.formations_universitaires];
                    formations_universitaires[index] = {
                      ...row,
                      statut: e.target.value as typeof row.statut,
                    };
                    onChange({ ...value, formations_universitaires });
                  }}
                >
                  <option value="">—</option>
                  <option value="TERMINE">Terminé</option>
                  <option value="EN_COURS">En cours</option>
                  <option value="ABANDONNE">Abandonné</option>
                </select>
              </div>
            </div>
          </div>
        ))}
        <button
          type="button"
          className="btn-secondary btn-sm"
          onClick={() =>
            onChange({
              ...value,
              formations_universitaires: [...value.formations_universitaires, emptyFormationUniv()],
            })
          }
        >
          + Ajouter une formation universitaire
        </button>
      </fieldset>

      <fieldset className="id-fieldset">
        <legend>Formations professionnelles</legend>
        {value.formations_professionnelles.length === 0 ? (
          <p className="muted small">Aucune formation professionnelle déclarée.</p>
        ) : null}
        {value.formations_professionnelles.map((row, index) => (
          <div key={`pro-${index}`} className="family-member-card">
            <div className="family-member-head">
              <strong>Formation pro {index + 1}</strong>
              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={() =>
                  onChange({
                    ...value,
                    formations_professionnelles: value.formations_professionnelles.filter(
                      (_, i) => i !== index
                    ),
                  })
                }
              >
                Retirer
              </button>
            </div>
            <div className="form-grid family-member-grid">
              <div className="full">
                <label className="form-label">Centre / établissement</label>
                <input
                  className="form-control"
                  value={row.etablissement}
                  onChange={(e) => {
                    const formations_professionnelles = [...value.formations_professionnelles];
                    formations_professionnelles[index] = { ...row, etablissement: e.target.value };
                    onChange({ ...value, formations_professionnelles });
                  }}
                />
              </div>
              <div>
                <label className="form-label">Métier / spécialité</label>
                <input
                  className="form-control"
                  value={row.metier}
                  onChange={(e) => {
                    const formations_professionnelles = [...value.formations_professionnelles];
                    formations_professionnelles[index] = { ...row, metier: e.target.value };
                    onChange({ ...value, formations_professionnelles });
                  }}
                />
              </div>
              <div>
                <label className="form-label">Certificat / diplôme</label>
                <input
                  className="form-control"
                  value={row.certificat}
                  onChange={(e) => {
                    const formations_professionnelles = [...value.formations_professionnelles];
                    formations_professionnelles[index] = { ...row, certificat: e.target.value };
                    onChange({ ...value, formations_professionnelles });
                  }}
                />
              </div>
              <div>
                <label className="form-label">Durée</label>
                <input
                  className="form-control"
                  value={row.duree}
                  onChange={(e) => {
                    const formations_professionnelles = [...value.formations_professionnelles];
                    formations_professionnelles[index] = { ...row, duree: e.target.value };
                    onChange({ ...value, formations_professionnelles });
                  }}
                  placeholder="Ex. 6 mois, 2 ans"
                />
              </div>
              <div>
                <label className="form-label">Année d&apos;obtention</label>
                <input
                  className="form-control"
                  value={row.annee_obtention}
                  onChange={(e) => {
                    const formations_professionnelles = [...value.formations_professionnelles];
                    formations_professionnelles[index] = { ...row, annee_obtention: e.target.value };
                    onChange({ ...value, formations_professionnelles });
                  }}
                  placeholder="AAAA"
                />
              </div>
              <div>
                <label className="form-label">Statut</label>
                <select
                  className="form-control"
                  value={row.statut}
                  onChange={(e) => {
                    const formations_professionnelles = [...value.formations_professionnelles];
                    formations_professionnelles[index] = {
                      ...row,
                      statut: e.target.value as typeof row.statut,
                    };
                    onChange({ ...value, formations_professionnelles });
                  }}
                >
                  <option value="">—</option>
                  <option value="TERMINE">Terminé</option>
                  <option value="EN_COURS">En cours</option>
                  <option value="ABANDONNE">Abandonné</option>
                </select>
              </div>
            </div>
          </div>
        ))}
        <button
          type="button"
          className="btn-secondary btn-sm"
          onClick={() =>
            onChange({
              ...value,
              formations_professionnelles: [
                ...value.formations_professionnelles,
                emptyFormationPro(),
              ],
            })
          }
        >
          + Ajouter une formation professionnelle
        </button>
      </fieldset>

      <fieldset className="id-fieldset">
        <legend>Remarques</legend>
        <textarea
          className="form-control"
          rows={3}
          value={value.remarques}
          onChange={(e) => onChange({ ...value, remarques: e.target.value })}
          placeholder="Précisions sur le parcours scolaire, universitaire ou professionnel…"
        />
      </fieldset>
    </div>
  );
}
