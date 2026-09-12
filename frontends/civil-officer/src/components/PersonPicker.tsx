import { FormEvent, useEffect, useState } from "react";
import {
  ETAT_CIVIL_OPTIONS,
  addPerson,
  displayName,
  personOrigin,
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
  /** Masque le bouton Ajouter (ex. un seul bouton partagé en bas de section). */
  hideAdd?: boolean;
  /** Force l'ouverture du modal d'ajout (contrôlé par le parent). */
  forceAddOpen?: boolean;
  onForceAddConsumed?: () => void;
  /**
   * Recherche intelligente père : un seul champ (nom, NIC, province, territoire,
   * secteur / chefferie / commune, village) — sans cascade visuelle.
   */
  originGeoFilter?: boolean;
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
  hideAdd = false,
  forceAddOpen = false,
  onForceAddConsumed,
  originGeoFilter = false,
}: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [lieuNaissance, setLieuNaissance] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<Person[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (forceAddOpen) {
      setModal(true);
      onForceAddConsumed?.();
    }
  }, [forceAddOpen, onForceAddConsumed]);

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
          if (!cancelled) setResults(hits.slice(0, 20));
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
        lieu_naissance: lieuNaissance.trim(),
        etat_civil: form.etat_civil,
      });
      onChange(person);
      setForm(emptyForm);
      setLieuNaissance("");
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
            {originGeoFilter ? (
              <div className="muted small">
                {[
                  personOrigin(value).province,
                  personOrigin(value).ville,
                  personOrigin(value).territoire,
                  personOrigin(value).secteur || personOrigin(value).commune,
                  personOrigin(value).village,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
            ) : null}
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
            placeholder={
              originGeoFilter
                ? "Sélection intelligente : nom, NIC, province, ville, territoire, secteur, village…"
                : "Recherche nationale (nom, post-nom, prénom, NIC)…"
            }
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
          />
          {!hideAdd ? (
            <button type="button" className="btn-add" onClick={() => setModal(true)}>
              Ajouter
            </button>
          ) : null}
        </div>
      )}
      {open && !value ? (
        <ul className="person-picker-list">
          {query.trim().length < 1 ? (
            <li className="muted">
              {originGeoFilter
                ? "Tapez un nom ou un lieu (province, territoire, secteur, village)…"
                : "Tapez pour chercher dans le registre national…"}
            </li>
          ) : searching ? (
            <li className="muted">Recherche nationale…</li>
          ) : results.length === 0 ? (
            <li className="muted">Aucun résultat — vous pouvez « Ajouter ».</li>
          ) : (
            results.map((p) => {
              const o = personOrigin(p);
              return (
                <li key={p.id}>
                  <button type="button" onClick={() => select(p)}>
                    <strong>{displayName(p)}</strong>
                    <span className="muted small">
                      {[
                        p.nic,
                        p.sexe,
                        p.date_naissance,
                        o.province,
                        o.ville,
                        o.territoire,
                        o.secteur || o.commune,
                        o.village,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      ) : null}

      {modal ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={() => setModal(false)}>
          <div className="modal-panel modal-wide person-add-modal" onClick={(e) => e.stopPropagation()}>
            <header className="person-add-head">
              <div>
                <h3>
                  {label.toLowerCase().includes("papa") || label.toLowerCase().includes("père")
                    ? "Ajouter le père"
                    : label.toLowerCase().includes("maman") || label.toLowerCase().includes("mère")
                      ? "Ajouter la mère"
                      : "Ajouter une personne"}
                </h3>
                <p className="muted small" style={{ margin: 0 }}>
                  Renseignez l&apos;identité, puis validez pour lier la fiche.
                </p>
              </div>
              <button
                type="button"
                className="btn-secondary btn-sm"
                aria-label="Fermer"
                onClick={() => setModal(false)}
              >
                ×
              </button>
            </header>

            <form onSubmit={onAdd} className="person-add-form">
              <fieldset className="id-fieldset">
                <legend>Identité</legend>
                <div className="form-grid person-add-grid">
                  <div>
                    <label className="form-label">Nom *</label>
                    <input
                      className="form-control"
                      value={form.nom}
                      onChange={(e) => setForm({ ...form, nom: e.target.value })}
                      autoFocus
                      required
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
                    <label className="form-label">Prénom *</label>
                    <input
                      className="form-control"
                      value={form.prenom}
                      onChange={(e) => setForm({ ...form, prenom: e.target.value })}
                      required
                    />
                  </div>
                </div>
              </fieldset>

              <fieldset className="id-fieldset">
                <legend>État civil</legend>
                <div className="form-grid person-add-grid">
                  <div>
                    <label className="form-label">Sexe *</label>
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
                    <label className="form-label">Date de naissance *</label>
                    <input
                      className="form-control"
                      type="date"
                      value={form.date_naissance}
                      onChange={(e) => setForm({ ...form, date_naissance: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label className="form-label">Situation matrimoniale</label>
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
                </div>
              </fieldset>

              <fieldset className="id-fieldset">
                <legend>Naissance</legend>
                <div className="form-grid">
                  <div className="full">
                    <label className="form-label">Lieu de naissance</label>
                    <input
                      className="form-control"
                      value={lieuNaissance}
                      onChange={(e) => setLieuNaissance(e.target.value)}
                      placeholder="Ex. Kinshasa, Gombe…"
                    />
                  </div>
                </div>
              </fieldset>

              {error ? <div className="login-error">{error}</div> : null}

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setModal(false)}>
                  Annuler
                </button>
                <button type="submit" className="btn-primary" style={{ width: "auto", minWidth: 180 }}>
                  Enregistrer et lier
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
