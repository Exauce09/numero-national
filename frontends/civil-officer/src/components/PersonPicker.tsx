import { FormEvent, useEffect, useState } from "react";
import GeoCascade, { GEO_PRESETS, type GeoSelection } from "./GeoCascade";
import {
  ETAT_CIVIL_OPTIONS,
  addPerson,
  displayName,
  type EtatCivil,
  type Person,
  type Sexe,
} from "../registry";
import { searchEveryone } from "../nationalSearch";

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
  const [results, setResults] = useState<Person[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!open || value) return;
    const q = query.trim();
    if (q.length < 1) {
      setResults([]);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setSearching(true);
      void searchEveryone(q)
        .then((hits) => {
          if (!cancelled) setResults(hits);
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 220);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, open, value]);

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
            placeholder="Recherche nationale (nom, post-nom, prénom, NIC)…"
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
          {query.trim().length < 1 ? (
            <li className="muted">Tapez pour chercher dans le registre national…</li>
          ) : searching ? (
            <li className="muted">Recherche nationale…</li>
          ) : results.length === 0 ? (
            <li className="muted">Aucun résultat — vous pouvez « Ajouter ».</li>
          ) : (
            results.map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => select(p)}>
                  <strong>{displayName(p)}</strong>
                  <span className="muted small">
                    {[p.nic, p.sexe, p.date_naissance, p.lieu_naissance].filter(Boolean).join(" · ")}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}

      {modal ? (
        <div className="modal-backdrop" onClick={() => setModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>Nouvelle personne</h3>
            <form onSubmit={onAdd} className="form-grid">
              <div>
                <label className="form-label">Nom</label>
                <input
                  className="form-control"
                  value={form.nom}
                  onChange={(e) => setForm({ ...form, nom: e.target.value })}
                />
              </div>
              <div>
                <label className="form-label">Post-nom</label>
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
              <div className="full">
                <GeoCascade
                  {...GEO_PRESETS.place}
                  value={geoNaissance}
                  onChange={setGeoNaissance}
                  label="Lieu de naissance"
                />
              </div>
              {error ? <p className="warn-inline full">{error}</p> : null}
              <div className="full" style={{ display: "flex", gap: 8 }}>
                <button type="submit" className="btn-primary">
                  Enregistrer et lier
                </button>
                <button type="button" className="btn-secondary" onClick={() => setModal(false)}>
                  Annuler
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
