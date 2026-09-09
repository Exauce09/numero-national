import PersonPicker from "./PersonPicker";
import { displayName, getPerson, type Person, type Sexe } from "../registry";
import {
  emptyMember,
  type FamilyMember,
  type SituationFamilialeData,
} from "../situationFamiliale";

type Props = {
  value: SituationFamilialeData;
  onChange: (next: SituationFamilialeData) => void;
};

function MemberFields({
  value,
  onChange,
  showLien,
  showTelephone,
  showPersonPicker,
}: {
  value: FamilyMember;
  onChange: (next: FamilyMember) => void;
  showLien?: boolean;
  showTelephone?: boolean;
  showPersonPicker?: boolean;
}) {
  function patch(p: Partial<FamilyMember>) {
    onChange({ ...value, ...p });
  }

  function fromPerson(p: Person | null) {
    if (!p) {
      patch({ person_id: null });
      return;
    }
    onChange({
      ...value,
      person_id: p.id,
      nom: p.nom,
      postnom: p.postnom,
      prenom: p.prenom,
      sexe: p.sexe,
      date_naissance: p.date_naissance,
    });
  }

  const linked = showPersonPicker && value.person_id ? getPerson(value.person_id) ?? null : null;

  return (
    <div className="form-grid family-member-grid">
      {showPersonPicker ? (
        <div className="full">
          <PersonPicker
            label="Lier une personne déjà enregistrée (optionnel)"
            value={linked}
            onChange={fromPerson}
          />
          {linked ? <p className="muted small">Sélection : {displayName(linked)}</p> : null}
        </div>
      ) : null}
      <div>
        <label className="form-label">Nom</label>
        <input className="form-control" value={value.nom} onChange={(e) => patch({ nom: e.target.value })} />
      </div>
      <div>
        <label className="form-label">Post-nom</label>
        <input
          className="form-control"
          value={value.postnom}
          onChange={(e) => patch({ postnom: e.target.value })}
        />
      </div>
      <div>
        <label className="form-label">Prénom</label>
        <input
          className="form-control"
          value={value.prenom}
          onChange={(e) => patch({ prenom: e.target.value })}
        />
      </div>
      <div>
        <label className="form-label">Sexe</label>
        <select
          className="form-control"
          value={value.sexe}
          onChange={(e) => patch({ sexe: e.target.value as Sexe | "" })}
        >
          <option value="">—</option>
          <option value="M">Masculin</option>
          <option value="F">Féminin</option>
        </select>
      </div>
      <div>
        <label className="form-label">Date de naissance</label>
        <input
          className="form-control"
          type="date"
          value={value.date_naissance}
          onChange={(e) => patch({ date_naissance: e.target.value })}
        />
      </div>
      {showTelephone ? (
        <div>
          <label className="form-label">Téléphone</label>
          <input
            className="form-control"
            value={value.telephone}
            onChange={(e) => patch({ telephone: e.target.value })}
          />
        </div>
      ) : null}
      {showLien ? (
        <div>
          <label className="form-label">Lien de parenté</label>
          <input
            className="form-control"
            value={value.lien}
            onChange={(e) => patch({ lien: e.target.value })}
            placeholder="Frère, oncle, neveu…"
          />
        </div>
      ) : null}
      <div className="full family-check">
        <label>
          <input
            type="checkbox"
            checked={value.vit_avec}
            onChange={(e) => patch({ vit_avec: e.target.checked })}
          />{" "}
          Vit dans le ménage / avec la personne
        </label>
      </div>
    </div>
  );
}

export default function SituationFamilialeForm({ value, onChange }: Props) {
  function setConjoint(conjoint: FamilyMember) {
    onChange({ ...value, conjoint });
  }

  function updateList(
    key: "enfants" | "personnes_a_charge",
    index: number,
    member: FamilyMember
  ) {
    const list = [...value[key]];
    list[index] = member;
    onChange({ ...value, [key]: list });
  }

  function removeFromList(key: "enfants" | "personnes_a_charge", index: number) {
    onChange({ ...value, [key]: value[key].filter((_, i) => i !== index) });
  }

  function addToList(key: "enfants" | "personnes_a_charge", lien: string) {
    onChange({ ...value, [key]: [...value[key], emptyMember(lien)] });
  }

  return (
    <div className="situation-familiale">
      <fieldset className="id-fieldset">
        <legend>Conjoint(e)</legend>
        <div className="form-grid">
          <div className="full">
            <label className="form-label">A un conjoint / vit en couple</label>
            <select
              className="form-control"
              value={value.a_conjoint ? "oui" : "non"}
              onChange={(e) =>
                onChange({
                  ...value,
                  a_conjoint: e.target.value === "oui",
                })
              }
            >
              <option value="non">Non</option>
              <option value="oui">Oui</option>
            </select>
          </div>
        </div>
        {value.a_conjoint ? (
          <MemberFields
            value={value.conjoint}
            onChange={setConjoint}
            showTelephone
            showPersonPicker
          />
        ) : null}
      </fieldset>

      <fieldset className="id-fieldset">
        <legend>Enfants</legend>
        {value.enfants.length === 0 ? (
          <p className="muted small">Aucun enfant déclaré.</p>
        ) : null}
        {value.enfants.map((enfant, index) => (
          <div key={`enfant-${index}`} className="family-member-card">
            <div className="family-member-head">
              <strong>Enfant {index + 1}</strong>
              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={() => removeFromList("enfants", index)}
              >
                Retirer
              </button>
            </div>
            <MemberFields value={enfant} onChange={(m) => updateList("enfants", index, m)} />
          </div>
        ))}
        <button
          type="button"
          className="btn-secondary btn-sm"
          onClick={() => addToList("enfants", "ENFANT")}
        >
          + Ajouter un enfant
        </button>
      </fieldset>

      <fieldset className="id-fieldset">
        <legend>Personnes à charge</legend>
        {value.personnes_a_charge.length === 0 ? (
          <p className="muted small">Aucune personne à charge déclarée.</p>
        ) : null}
        {value.personnes_a_charge.map((p, index) => (
          <div key={`charge-${index}`} className="family-member-card">
            <div className="family-member-head">
              <strong>Personne à charge {index + 1}</strong>
              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={() => removeFromList("personnes_a_charge", index)}
              >
                Retirer
              </button>
            </div>
            <MemberFields
              value={p}
              onChange={(m) => updateList("personnes_a_charge", index, m)}
              showLien
              showTelephone
            />
          </div>
        ))}
        <button
          type="button"
          className="btn-secondary btn-sm"
          onClick={() => addToList("personnes_a_charge", "")}
        >
          + Ajouter une personne à charge
        </button>
      </fieldset>

      <fieldset className="id-fieldset">
        <legend>Remarques</legend>
        <label className="form-label">Précisions complémentaires (optionnel)</label>
        <textarea
          className="form-control"
          rows={3}
          value={value.remarques}
          onChange={(e) => onChange({ ...value, remarques: e.target.value })}
          placeholder="Autres informations sur la situation familiale…"
        />
      </fieldset>
    </div>
  );
}
