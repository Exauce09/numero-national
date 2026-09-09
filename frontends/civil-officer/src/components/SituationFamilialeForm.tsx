import PersonPicker from "./PersonPicker";
import { displayName, getPerson, type Person, type Sexe } from "../registry";
import {
  COTES_FAMILLE,
  LIENS_PARENTE,
  emptyMember,
  resizeEnfants,
  type CoteFamille,
  type FamilyMember,
  type SituationFamilialeData,
} from "../situationFamiliale";

type Props = {
  value: SituationFamilialeData;
  onChange: (next: SituationFamilialeData) => void;
  /** Si MARIE, force la section conjoint. */
  etatCivil?: string;
};

function MemberFields({
  value,
  onChange,
  showLien,
  showCote,
  showTelephone,
  showPersonPicker,
  personRequired,
  identityLocked,
}: {
  value: FamilyMember;
  onChange: (next: FamilyMember) => void;
  showLien?: boolean;
  showCote?: boolean;
  showTelephone?: boolean;
  showPersonPicker?: boolean;
  personRequired?: boolean;
  /** Quand lié : identité en lecture seule (remplie depuis le registre). */
  identityLocked?: boolean;
}) {
  function patch(p: Partial<FamilyMember>) {
    onChange({ ...value, ...p });
  }

  function fromPerson(p: Person | null) {
    if (!p) {
      onChange({
        ...emptyMember(value.lien, value.cote),
        vit_avec: value.vit_avec,
        telephone: "",
      });
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
      telephone: value.telephone,
    });
  }

  const linked = showPersonPicker && value.person_id ? getPerson(value.person_id) ?? null : null;
  const locked = Boolean(identityLocked && linked);

  return (
    <div className="form-grid family-member-grid">
      {showPersonPicker ? (
        <div className="full">
          <PersonPicker
            label="Lier une personne déjà enregistrée (obligatoire)"
            value={linked}
            onChange={fromPerson}
            required={personRequired}
            allowClear={!personRequired}
          />
          {linked ? (
            <p className="muted small success-inline">
              Sélection : {displayName(linked)} — identité remplie automatiquement.
            </p>
          ) : personRequired ? (
            <p className="muted small warn-inline">
              Recherchez le conjoint(e) par nom : des propositions apparaissent au fur et à mesure.
              Une fois trouvé, les champs identité se remplissent seuls.
            </p>
          ) : null}
        </div>
      ) : null}

      {showCote ? (
        <div>
          <label className="form-label">Côté famille</label>
          <select
            className="form-control"
            value={value.cote}
            onChange={(e) => patch({ cote: e.target.value as CoteFamille })}
          >
            {COTES_FAMILLE.map((c) => (
              <option key={c.value || "empty"} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {showLien ? (
        <div>
          <label className="form-label">Lien de parenté</label>
          <select
            className="form-control"
            value={value.lien}
            onChange={(e) => patch({ lien: e.target.value })}
          >
            {LIENS_PARENTE.map((l) => (
              <option key={l || "empty"} value={l}>
                {l || "—"}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div>
        <label className="form-label">Nom</label>
        <input
          className="form-control"
          value={value.nom}
          readOnly={locked}
          onChange={(e) => patch({ nom: e.target.value })}
        />
      </div>
      <div>
        <label className="form-label">Post-nom</label>
        <input
          className="form-control"
          value={value.postnom}
          readOnly={locked}
          onChange={(e) => patch({ postnom: e.target.value })}
        />
      </div>
      <div>
        <label className="form-label">Prénom</label>
        <input
          className="form-control"
          value={value.prenom}
          readOnly={locked}
          onChange={(e) => patch({ prenom: e.target.value })}
        />
      </div>
      <div>
        <label className="form-label">Sexe</label>
        <select
          className="form-control"
          value={value.sexe}
          disabled={locked}
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
          readOnly={locked}
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

export default function SituationFamilialeForm({ value, onChange, etatCivil }: Props) {
  const marie = etatCivil === "MARIE";

  function setNombreEnfants(n: number) {
    const nombre_enfants = Math.max(0, n);
    onChange({
      ...value,
      nombre_enfants,
      enfants: resizeEnfants(value.enfants, nombre_enfants),
    });
  }

  function updateList(key: "enfants" | "personnes_a_charge", index: number, member: FamilyMember) {
    const list = [...value[key]];
    list[index] = member;
    onChange({ ...value, [key]: list });
  }

  function removeCharge(index: number) {
    onChange({
      ...value,
      personnes_a_charge: value.personnes_a_charge.filter((_, i) => i !== index),
    });
  }

  return (
    <div className="situation-familiale">
      <fieldset className="id-fieldset">
        <legend>Conjoint(e)</legend>
        <div className="form-grid">
          <div className="full">
            <label className="form-label">A un conjoint / vit en couple / marié(e)</label>
            <select
              className="form-control"
              value={value.a_conjoint || marie ? "oui" : "non"}
              disabled={marie}
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
            {marie ? (
              <p className="muted small">État civil = Marié(e) : conjoint(e) obligatoire.</p>
            ) : null}
          </div>
        </div>
        {value.a_conjoint || marie ? (
          <MemberFields
            value={value.conjoint}
            onChange={(conjoint) => onChange({ ...value, a_conjoint: true, conjoint })}
            showTelephone
            showPersonPicker
            personRequired
            identityLocked
          />
        ) : null}
      </fieldset>

      <fieldset className="id-fieldset">
        <legend>Enfants</legend>
        <div className="form-grid">
          <div className="full">
            <label className="form-label">Nombre d&apos;enfants (0 à 5 — clic)</label>
            <div className="child-count-pills">
              {[0, 1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`child-count-pill${value.nombre_enfants === n ? " active" : ""}`}
                  onClick={() => setNombreEnfants(n)}
                >
                  {n}
                </button>
              ))}
            </div>
            <p className="muted small" style={{ marginTop: "0.45rem" }}>
              Plus de 5 : utilisez « Ajouter un enfant » ci-dessous.
            </p>
          </div>
        </div>

        {value.enfants.length === 0 ? (
          <p className="muted small">Aucun enfant déclaré.</p>
        ) : null}
        {value.enfants.map((enfant, index) => (
          <div key={`enfant-${index}`} className="family-member-card">
            <div className="family-member-head">
              <strong>Enfant {index + 1}</strong>
              {value.nombre_enfants > 5 || index >= 5 ? (
                <button
                  type="button"
                  className="btn-secondary btn-sm"
                  onClick={() => setNombreEnfants(value.enfants.length - 1)}
                >
                  Retirer
                </button>
              ) : null}
            </div>
            <MemberFields
              value={enfant}
              onChange={(m) => updateList("enfants", index, m)}
              showCote
              showLien
              showTelephone
            />
          </div>
        ))}
        {value.nombre_enfants >= 5 ? (
          <button
            type="button"
            className="btn-secondary btn-sm"
            onClick={() => setNombreEnfants(value.enfants.length + 1)}
          >
            + Ajouter un enfant (au-delà de 5)
          </button>
        ) : null}
      </fieldset>

      <fieldset className="id-fieldset">
        <legend>Personnes à charge</legend>
        <p className="muted small">
          Frères, sœurs, neveux, travailleur / employé(e) du ménage, etc. Indiquez le côté (homme /
          femme) et le lien.
        </p>
        {value.personnes_a_charge.length === 0 ? (
          <p className="muted small">Aucune personne à charge déclarée.</p>
        ) : null}
        {value.personnes_a_charge.map((p, index) => (
          <div key={`charge-${index}`} className="family-member-card">
            <div className="family-member-head">
              <strong>Personne à charge {index + 1}</strong>
              <button type="button" className="btn-secondary btn-sm" onClick={() => removeCharge(index)}>
                Retirer
              </button>
            </div>
            <MemberFields
              value={p}
              onChange={(m) => updateList("personnes_a_charge", index, m)}
              showCote
              showLien
              showTelephone
            />
          </div>
        ))}
        <button
          type="button"
          className="btn-secondary btn-sm"
          onClick={() =>
            onChange({
              ...value,
              personnes_a_charge: [...value.personnes_a_charge, emptyMember("", "")],
            })
          }
        >
          + Ajouter une personne à charge
        </button>
      </fieldset>

      <fieldset className="id-fieldset">
        <legend>Remarques</legend>
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
