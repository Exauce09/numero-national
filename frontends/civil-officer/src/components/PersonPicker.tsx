import { FormEvent, useMemo, useState } from "react";
import GeoCascade, { GEO_PRESETS, type GeoSelection } from "./GeoCascade";
import {
  ETAT_CIVIL_OPTIONS,
  addPerson,
  displayName,
  searchPersons,
  type EtatCivil,
  type Person,
  type Sexe,
} from "../registry";

type Props = {
  label: string;
  value: Person | null;
  onChange: (person: Person | null) => void;
  required?: boolean;
  allowClear?: boolean;
};

const emptyForm = {
  nom: "",
  postnom: "",
  prenom: "",
  sexe: "M" as Sexe,
  date_naissance: "",
  etat_civil: "CELIBATAIRE" as EtatCivil,
};

export default function PersonPicker({
  label,
  value,
  onChange,
  required,
  allowClear = true,
}: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [geoNaissance, setGeoNaissance] = useState<GeoSelection>({});
  const [error, setError] = useState<string | null>(null);

  const results = useMemo(() => searchPersons(query).slice(0, 12), [query, open, modal, value]);

  function select(person: Person) {
    onChange(person);
    setOpen(false);
    setQuery("");
  }

  function onAdd(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.nom.trim() || !form.prenom.trim() || !form.date_naissance) {
      setError("Nom, prénom et date de naissance sont requis.");
      return;
    }
    try {
      const person = addPerson({
        nom: form.nom.trim(),
        postnom: form.postnom.trim(),
        prenom: form.prenom.trim(),
        sexe: form.sexe,
        date_naissance: form.date_naissance,
        lieu_naissance: geoNaissance.label || "",
        etat_civil: form.etat_civil,
      });
      onChange(person);
      setForm(emptyForm);
      setGeoNaissance({});
      setModal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ajout impossible.");
    }
  }

  return (
    <div className="person-picker">
      <label className="form-label">
        {label}
        {required ? " *" : ""}
      </label>
      {value ? (
        <div className="person-picker-selected">
          <div>
            <strong>{displayName(value)}</strong>
            <div className="muted small">{value.nic}</div>
          </div>
          {allowClear ? (
            <button type="button" className="btn-secondary btn-sm" onClick={() => onChange(null)}>
              Retirer
            </button>
          ) : null}
        </div>
      ) : (
        <div className="person-picker-controls">
          <input
            className="form-control"
            placeholder="Rechercher une personne…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
          />
          <button type="button" className="btn-add" onClick={() => setModal(true)}>
            Ajouter
          </button>
        </div>
      )}
      {open && !value ? (
        <ul className="person-picker-list">
          {results.length === 0 ? (
            <li className="muted">Aucun résultat</li>
          ) : (
            results.map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => select(p)}>
                  <strong>{displayName(p)}</strong>
                  <span className="muted">{p.nic}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}

      {modal ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setModal(false)}>
          <div
            className="modal-panel"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>Ajouter une personne</h3>
            <form className="form-grid" onSubmit={onAdd}>
              {error ? <div className="login-error full">{error}</div> : null}
              <div>
                <label className="form-label">Nom</label>
                <input
                  className="form-control"
                  value={form.nom}
                  onChange={(e) => setForm({ ...form, nom: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="form-label">Postnom</label>
                <input
                  className="form-control"
                  value={form.postnom}
                  onChange={(e) => setForm({ ...form, postnom: e.target.value })}
                />
              </div>
              <div>
                <label className="form-label">Prénom</label>
                <input
                  className="form-control"
                  value={form.prenom}
                  onChange={(e) => setForm({ ...form, prenom: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="form-label">Sexe</label>
                <select
                  className="form-control"
                  value={form.sexe}
                  onChange={(e) => setForm({ ...form, sexe: e.target.value as Sexe })}
                >
                  <option value="M">Masculin</option>
                  <option value="F">Féminin</option>
                </select>
              </div>
              <div>
                <label className="form-label">Date de naissance</label>
                <input
                  className="form-control"
                  type="date"
                  value={form.date_naissance}
                  onChange={(e) => setForm({ ...form, date_naissance: e.target.value })}
                  required
                />
              </div>
              <div className="full">
                <label className="form-label">Lieu de naissance</label>
                <GeoCascade
                  embedded
                  levels={GEO_PRESETS.place}
                  value={geoNaissance}
                  onChange={setGeoNaissance}
                  label="Lieu de naissance"
                />
              </div>
              <div>
                <label className="form-label">État civil</label>
                <select
                  className="form-control"
                  value={form.etat_civil}
                  onChange={(e) => setForm({ ...form, etat_civil: e.target.value as EtatCivil })}
                >
                  {ETAT_CIVIL_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="full modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setModal(false)}>
                  Annuler
                </button>
                <button type="submit" className="btn-primary" style={{ width: "auto", minWidth: 140 }}>
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
