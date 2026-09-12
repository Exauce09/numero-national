import { FormEvent, useEffect, useState } from "react";
import GeoCascade, { GEO_PRESETS, ORIGIN_FIELD_LABELS, type GeoSelection } from "./GeoCascade";
import {
  ETAT_CIVIL_OPTIONS,
  addPerson,
  displayName,
  listPersons,
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
  /** Filtre recherche père : province → territoire → secteur → village. */
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

function matchesOriginFilter(person: Person, geo: GeoSelection): boolean {
  const hasFilter = Boolean(
    geo.province_name || geo.district_name || geo.commune_name || geo.localite_name || geo.ville_name,
  );
  if (!hasFilter) return true;
  const origin = personOrigin(person);
  const norm = (s: string) => s.trim().toLowerCase();
  if (geo.province_name && !norm(origin.province).includes(norm(geo.province_name))) return false;
  if (geo.ville_name && origin.ville && !norm(origin.ville).includes(norm(geo.ville_name))) return false;
  if (geo.district_name && !norm(origin.territoire).includes(norm(geo.district_name))) return false;
  if (geo.commune_name && !norm(origin.secteur || origin.commune).includes(norm(geo.commune_name))) {
    return false;
  }
  if (geo.localite_name && !norm(origin.village).includes(norm(geo.localite_name))) return false;
  return true;
}

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
  const [geoFilter, setGeoFilter] = useState<GeoSelection>({});

  useEffect(() => {
    if (forceAddOpen) {
      setModal(true);
      onForceAddConsumed?.();
    }
  }, [forceAddOpen, onForceAddConsumed]);

  useEffect(() => {
    if (!open || value) return;
    const q = query.trim();
    const hasGeo = Boolean(
      geoFilter.province_name ||
        geoFilter.district_name ||
        geoFilter.commune_name ||
        geoFilter.localite_name,
    );
    if (q.length < 1 && !(originGeoFilter && hasGeo)) {
      setResults([]);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setSearching(true);
      const apply = (hits: Person[]) => {
        if (cancelled) return;
        setResults(
          (originGeoFilter ? hits.filter((p) => matchesOriginFilter(p, geoFilter)) : hits).slice(
            0,
            20,
          ),
        );
      };
      if (q.length < 1 && originGeoFilter && hasGeo) {
        apply(listPersons());
        setSearching(false);
        return;
      }
      void searchEveryone(q)
        .then(apply)
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 220);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, open, value, originGeoFilter, geoFilter]);

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
      {originGeoFilter && !value ? (
        <div style={{ marginBottom: "0.65rem" }}>
          <GeoCascade
            embedded
            label="Filtrer par origine (province → territoire → secteur → village)"
            levels={GEO_PRESETS.origin}
            fieldLabels={ORIGIN_FIELD_LABELS}
            value={geoFilter}
            onChange={(g) => {
              setGeoFilter(g);
              setOpen(true);
            }}
          />
        </div>
      ) : null}
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
            placeholder={
              originGeoFilter
                ? "Recherche père (nom, NIC…) — filtre géo ci-dessus…"
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
          {query.trim().length < 1 && !originGeoFilter ? (
            <li className="muted">Tapez pour chercher dans le registre national…</li>
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
                <label className="form-label">Lieu de naissance</label>
                <input
                  className="form-control"
                  value={lieuNaissance}
                  onChange={(e) => setLieuNaissance(e.target.value)}
                  placeholder="Saisie manuelle"
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
