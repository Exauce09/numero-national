import {
  SECTEURS_PRO,
  STATUTS_PRO,
  emptyEmploi,
  type ExperienceData,
} from "../experienceProfessionnelle";

type Props = {
  value: ExperienceData;
  onChange: (next: ExperienceData) => void;
};

export default function ExperienceProfessionnelleForm({ value, onChange }: Props) {
  return (
    <div className="situation-familiale">
      <fieldset className="id-fieldset">
        <legend>Situation professionnelle actuelle</legend>
        <div className="form-grid">
          <div>
            <label className="form-label">Statut</label>
            <select
              className="form-control"
              value={value.statut_actuel}
              onChange={(e) => onChange({ ...value, statut_actuel: e.target.value })}
            >
              {STATUTS_PRO.map((s) => (
                <option key={s.value || "empty"} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label">Années d&apos;expérience (approx.)</label>
            <input
              className="form-control"
              value={value.annees_experience}
              onChange={(e) => onChange({ ...value, annees_experience: e.target.value })}
              placeholder="Ex. 5"
            />
          </div>
          <div>
            <label className="form-label">Poste / fonction actuelle</label>
            <input
              className="form-control"
              value={value.poste_actuel}
              onChange={(e) => onChange({ ...value, poste_actuel: e.target.value })}
            />
          </div>
          <div>
            <label className="form-label">Employeur / structure actuelle</label>
            <input
              className="form-control"
              value={value.employeur_actuel}
              onChange={(e) => onChange({ ...value, employeur_actuel: e.target.value })}
            />
          </div>
          <div className="full">
            <label className="form-label">Secteur d&apos;activité</label>
            <select
              className="form-control"
              value={value.secteur_actuel}
              onChange={(e) => onChange({ ...value, secteur_actuel: e.target.value })}
            >
              {SECTEURS_PRO.map((s) => (
                <option key={s || "empty"} value={s}>
                  {s || "—"}
                </option>
              ))}
            </select>
          </div>
        </div>
      </fieldset>

      <fieldset className="id-fieldset">
        <legend>Parcours / emplois précédents</legend>
        {value.emplois.length === 0 ? (
          <p className="muted small">Aucun emploi précédent déclaré.</p>
        ) : null}
        {value.emplois.map((row, index) => (
          <div key={`emp-${index}`} className="family-member-card">
            <div className="family-member-head">
              <strong>Emploi {index + 1}</strong>
              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={() =>
                  onChange({
                    ...value,
                    emplois: value.emplois.filter((_, i) => i !== index),
                  })
                }
              >
                Retirer
              </button>
            </div>
            <div className="form-grid family-member-grid">
              <div>
                <label className="form-label">Poste</label>
                <input
                  className="form-control"
                  value={row.poste}
                  onChange={(e) => {
                    const emplois = [...value.emplois];
                    emplois[index] = { ...row, poste: e.target.value };
                    onChange({ ...value, emplois });
                  }}
                />
              </div>
              <div>
                <label className="form-label">Employeur</label>
                <input
                  className="form-control"
                  value={row.employeur}
                  onChange={(e) => {
                    const emplois = [...value.emplois];
                    emplois[index] = { ...row, employeur: e.target.value };
                    onChange({ ...value, emplois });
                  }}
                />
              </div>
              <div>
                <label className="form-label">Secteur</label>
                <select
                  className="form-control"
                  value={row.secteur}
                  onChange={(e) => {
                    const emplois = [...value.emplois];
                    emplois[index] = { ...row, secteur: e.target.value };
                    onChange({ ...value, emplois });
                  }}
                >
                  {SECTEURS_PRO.map((s) => (
                    <option key={s || "empty"} value={s}>
                      {s || "—"}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">Ville</label>
                <input
                  className="form-control"
                  value={row.ville}
                  onChange={(e) => {
                    const emplois = [...value.emplois];
                    emplois[index] = { ...row, ville: e.target.value };
                    onChange({ ...value, emplois });
                  }}
                />
              </div>
              <div>
                <label className="form-label">Année début</label>
                <input
                  className="form-control"
                  value={row.annee_debut}
                  onChange={(e) => {
                    const emplois = [...value.emplois];
                    emplois[index] = { ...row, annee_debut: e.target.value };
                    onChange({ ...value, emplois });
                  }}
                  placeholder="AAAA"
                />
              </div>
              <div>
                <label className="form-label">Année fin</label>
                <input
                  className="form-control"
                  value={row.annee_fin}
                  disabled={row.en_cours}
                  onChange={(e) => {
                    const emplois = [...value.emplois];
                    emplois[index] = { ...row, annee_fin: e.target.value };
                    onChange({ ...value, emplois });
                  }}
                  placeholder="AAAA"
                />
              </div>
              <div className="full family-check">
                <label>
                  <input
                    type="checkbox"
                    checked={row.en_cours}
                    onChange={(e) => {
                      const emplois = [...value.emplois];
                      emplois[index] = {
                        ...row,
                        en_cours: e.target.checked,
                        annee_fin: e.target.checked ? "" : row.annee_fin,
                      };
                      onChange({ ...value, emplois });
                    }}
                  />{" "}
                  Emploi encore en cours
                </label>
              </div>
              <div className="full">
                <label className="form-label">Description / tâches</label>
                <textarea
                  className="form-control"
                  rows={2}
                  value={row.description}
                  onChange={(e) => {
                    const emplois = [...value.emplois];
                    emplois[index] = { ...row, description: e.target.value };
                    onChange({ ...value, emplois });
                  }}
                />
              </div>
            </div>
          </div>
        ))}
        <button
          type="button"
          className="btn-secondary btn-sm"
          onClick={() => onChange({ ...value, emplois: [...value.emplois, emptyEmploi()] })}
        >
          + Ajouter un emploi
        </button>
      </fieldset>

      <fieldset className="id-fieldset">
        <legend>Remarques</legend>
        <textarea
          className="form-control"
          rows={3}
          value={value.remarques}
          onChange={(e) => onChange({ ...value, remarques: e.target.value })}
          placeholder="Autres précisions sur l'expérience professionnelle…"
        />
      </fieldset>
    </div>
  );
}
