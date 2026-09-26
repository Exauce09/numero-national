import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import FicheIdentificationEditor, {
  emptyFicheEditorState,
  type FicheEditorState,
} from "./FicheIdentificationEditor";
import { getOfficerCommune } from "../commune";
import {
  addPerson,
  ageYears,
  displayName,
  findDuplicatePerson,
  getPerson,
  isDeceased,
  personOrigin,
  provinceDigitsFromName,
  searchPersons,
  updatePerson,
  type Nationalite,
  type Person,
  type Sexe,
} from "../registry";
import { searchEveryone } from "../nationalSearch";
import { pushPersonToNationalRegistry } from "../onipSync";
import { PROFESSIONS_KEY, rememberNamed } from "../namedLists";

type Props = {
  label: string;
  value: Person | null;
  onChange: (person: Person | null) => void;
  required?: boolean;
  allowClear?: boolean;
  /** Masque le bouton Ajouter (ex. un seul bouton partagé en bas de section). */
  hideAdd?: boolean;
  /** Libellé du bouton Ajouter à côté du champ. */
  addButtonLabel?: string;
  /** Force l'ouverture du modal d'ajout (contrôlé par le parent). */
  forceAddOpen?: boolean;
  onForceAddConsumed?: () => void;
  /**
   * Recherche intelligente père : un seul champ (nom, NIC, province, territoire,
   * secteur / chefferie / commune, village) — sans cascade visuelle.
   */
  originGeoFilter?: boolean;
  /** Filtre les résultats (et verrouille le sexe à l'ajout) — mère F / père M. */
  sexFilter?: Sexe;
  /** Placeholders axés sur le N° d'état civil (NIC). */
  nicSearchHint?: boolean;
  /** Exclut les personnes déjà déclarées décédées (défaut: true). */
  excludeDeceased?: boolean;
  /** Âge minimum (ans) — exclus des résultats de recherche et du formulaire d'ajout. */
  minAge?: number;
  /** Masque tout affichage / hint lié au NIC (ancien système). */
  hideNic?: boolean;
};

function natFromLabel(raw: string): Nationalite {
  const t = raw.trim().toUpperCase();
  if (t.includes("ETRANG") || t.includes("ÉTRANG")) return "ETRANGER";
  return "CONGOLAIS";
}

function buildEditorSeed(sexFilter?: Sexe): FicheEditorState {
  const officer = getOfficerCommune();
  const pp = provinceDigitsFromName(officer.province || "Kinshasa");
  return emptyFicheEditorState({
    communeName: officer.name,
    villeProvince: officer.ville || officer.province || "Kinshasa",
    serie: `${pp}/INF001-TSL/………`,
    sexe: sexFilter,
  });
}

function tryAddRelative(
  block: {
    nom: string;
    postnom: string;
    prenom: string;
    sexe: string;
    lieu_date_naissance: string;
    nationalite?: string;
    profession?: string;
    province?: string;
    ville?: string;
    territoire?: string;
    secteur?: string;
    adresse?: string;
  },
  sexe: Sexe,
): { id?: string; warning?: string } {
  if (!block.nom.trim()) return {};
  if (!block.prenom.trim()) {
    return { warning: `Parent ${sexe === "M" ? "père" : "mère"} : prénom manquant — non enregistré.` };
  }
  const lieu = block.lieu_date_naissance.trim();
  const dateMatch = /(\d{4}-\d{2}-\d{2}|\d{1,2}[/.]\d{1,2}[/.]\d{4})/.exec(lieu);
  if (!dateMatch) {
    return {
      warning: `Parent ${sexe === "M" ? "père" : "mère"} : date de naissance manquante — non enregistré (saisissez une date dans le lieu ou ignorez le parent).`,
    };
  }
  const date_naissance = dateMatch[1].includes("-")
    ? dateMatch[1]
    : (() => {
        const m = /^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/.exec(dateMatch[1]);
        return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : "";
      })();
  if (!date_naissance) {
    return { warning: `Parent ${sexe === "M" ? "père" : "mère"} : date invalide — non enregistré.` };
  }
  const originLabel = [block.secteur, block.territoire, block.ville, block.province]
    .filter(Boolean)
    .join(" · ");
  const existing = findDuplicatePerson({
    nom: block.nom.trim(),
    postnom: block.postnom.trim(),
    prenom: block.prenom.trim(),
    date_naissance,
    sexe,
  });
  if (existing) return { id: existing.id };
  try {
    const p = addPerson({
      nom: block.nom.trim(),
      postnom: block.postnom.trim(),
      prenom: block.prenom.trim(),
      sexe,
      date_naissance,
      lieu_naissance: lieu.replace(dateMatch[0] ?? "", "").replace(/[—\-–]/g, " ").trim() || originLabel,
      etat_civil: "UNKNOWN" as Person["etat_civil"],
      nationalite: natFromLabel(block.nationalite || "Congolaise"),
      parcours_professionnel: block.profession?.trim() || undefined,
      province: block.province?.trim() || undefined,
      ville: block.ville?.trim() || undefined,
      territoire: block.territoire?.trim() || undefined,
      secteur: block.secteur?.trim() || undefined,
      adresse: block.adresse?.trim() || undefined,
      situation_familiale: originLabel ? `Origine: ${originLabel}` : undefined,
    });
    return { id: p.id };
  } catch (err) {
    return {
      warning: err instanceof Error ? err.message : `Parent ${sexe === "M" ? "père" : "mère"} non enregistré.`,
    };
  }
}

function seedFromQuery(sexFilter: Sexe | undefined, query: string): FicheEditorState {
  const seed = buildEditorSeed(sexFilter);
  const q = query.trim();
  if (!q) return seed;
  const parts = q.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    // Un seul mot (ex. « exo ») → nom + prénom préremplis pour éviter un enregistrement incomplet
    seed.interesse = { ...seed.interesse, nom: parts[0], prenom: parts[0] };
  } else if (parts.length === 2) {
    seed.interesse = { ...seed.interesse, nom: parts[0], prenom: parts[1] };
  } else {
    seed.interesse = {
      ...seed.interesse,
      nom: parts[0],
      postnom: parts[1],
      prenom: parts.slice(2).join(" "),
    };
  }
  return seed;
}

export default function PersonPicker({
  label,
  value,
  onChange,
  required,
  allowClear = true,
  hideAdd = false,
  addButtonLabel = "Ajouter",
  forceAddOpen = false,
  onForceAddConsumed,
  originGeoFilter = false,
  sexFilter,
  nicSearchHint = false,
  excludeDeceased = true,
  minAge,
  hideNic = true,
}: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [modal, setModal] = useState(false);
  const [fiche, setFiche] = useState<FicheEditorState>(() => buildEditorSeed(sexFilter));
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<Person[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);

  const isPere =
    label.toLowerCase().includes("papa") || label.toLowerCase().includes("père");
  const isMere =
    label.toLowerCase().includes("maman") || label.toLowerCase().includes("mère");

  useEffect(() => {
    if (forceAddOpen) {
      setFiche(seedFromQuery(sexFilter, query));
      setOpen(false);
      setModal(true);
      onForceAddConsumed?.();
    }
  }, [forceAddOpen, onForceAddConsumed, sexFilter, query]);

  useEffect(() => {
    if (!open || value) return;
    const q = query.trim();
    if (q.length < 1) {
      setResults([]);
      setSearching(false);
      return;
    }
    const applyFilters = (hits: Person[]) =>
      hits.filter((p) => {
        if (sexFilter && p.sexe !== sexFilter) return false;
        if (excludeDeceased && isDeceased(p.id, p.nic)) return false;
        if (minAge != null) {
          const age = ageYears(p.date_naissance);
          // Sans date → on laisse passer (sinon les fiches API incomplètes disparaissent)
          if (p.date_naissance && age < minAge) return false;
        }
        return true;
      });

    // Résultats locaux immédiats (ne dépendent pas de l'API)
    setResults(applyFilters(searchPersons(q)).slice(0, 50));

    let cancelled = false;
    const timer = window.setTimeout(() => {
      setSearching(true);
      void searchEveryone(q)
        .then((hits) => {
          if (cancelled) return;
          setResults(applyFilters(hits).slice(0, 50));
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 220);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, open, value, sexFilter, excludeDeceased, minAge]);

  function select(person: Person) {
    onChange(person);
    setOpen(false);
    setQuery("");
  }

  function openAddModal() {
    setFiche(seedFromQuery(sexFilter, query));
    setError(null);
    setOpen(false);
    setResults([]);
    setModal(true);
  }

  async function saveNewPerson() {
    setError(null);
    const i = fiche.interesse;
    if (!i.nom.trim() || !i.prenom.trim() || !i.date_naissance) {
      setError("Nom, prénom et date de naissance sont requis.");
      return;
    }
    if (minAge != null && ageYears(i.date_naissance) < minAge) {
      setError(`La personne doit avoir au moins ${minAge} ans.`);
      return;
    }
    setSaving(true);
    try {
      const sexe = sexFilter ?? i.sexe_code;
      const existing = findDuplicatePerson({
        nom: i.nom.trim(),
        postnom: i.postnom.trim(),
        prenom: i.prenom.trim(),
        date_naissance: i.date_naissance,
        sexe,
      });
      if (existing) {
        onChange(existing);
        setQuery("");
        setResults([]);
        setOpen(false);
        setFiche(buildEditorSeed(sexFilter));
        setModal(false);
        setError(null);
        return;
      }

      let person = addPerson({
        nom: i.nom.trim(),
        postnom: i.postnom.trim(),
        prenom: i.prenom.trim(),
        sexe,
        date_naissance: i.date_naissance,
        lieu_naissance: i.lieu_date_naissance.trim(),
        etat_civil: i.etat_civil_code,
        nationalite: natFromLabel(i.nationalite),
        parcours_professionnel: i.profession.trim() || undefined,
        adresse: i.adresse.trim() || undefined,
        secteur: i.secteur.trim() || undefined,
        territoire: i.territoire.trim() || undefined,
        ville: i.ville.trim() || undefined,
        province: i.province.trim() || undefined,
      });

      if (!isPere && !isMere) {
        const fatherRes = tryAddRelative(fiche.pere, "M");
        const motherRes = tryAddRelative(fiche.mere, "F");
        const situationParts = [
          fiche.conjoint.nom.trim()
            ? `Conjoint: ${fiche.conjoint.nom.trim()}${
                fiche.conjoint.lieu_date_naissance ? ` (${fiche.conjoint.lieu_date_naissance})` : ""
              }`
            : "",
          fiche.conjoint.profession.trim() ? `Prof. conjoint: ${fiche.conjoint.profession.trim()}` : "",
          fiche.conjoint.adresse.trim() ? `Adr. conjoint: ${fiche.conjoint.adresse.trim()}` : "",
          [i.secteur, i.territoire, i.ville, i.province].filter(Boolean).length
            ? `Origine: ${[i.secteur, i.territoire, i.ville, i.province].filter(Boolean).join(" · ")}`
            : "",
        ].filter(Boolean);
        if (fatherRes.id || motherRes.id || situationParts.length) {
          updatePerson(person.id, {
            father_id: fatherRes.id ?? undefined,
            mother_id: motherRes.id ?? undefined,
            situation_familiale: situationParts.length ? situationParts.join(" · ") : undefined,
          });
          person = getPerson(person.id) ?? person;
        }
      }

      if (i.profession.trim()) {
        rememberNamed(PROFESSIONS_KEY, i.profession);
      }

      // Sync API en arrière-plan — ne jamais bloquer ni effacer la fiche locale
      void pushPersonToNationalRegistry(person).catch(() => undefined);

      onChange(person);
      setQuery("");
      setResults([]);
      setOpen(false);
      setFiche(buildEditorSeed(sexFilter));
      setModal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ajout impossible.");
    } finally {
      setSaving(false);
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
            {!hideNic && value.nic ? <div className="muted small">{value.nic}</div> : null}
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
              hideNic
                ? "Recherche (nom, post-nom, prénom)…"
                : nicSearchHint
                  ? "Nom de l'officier ou personne…"
                  : originGeoFilter
                    ? "Sélection intelligente : nom, province, ville, territoire, secteur, village…"
                    : sexFilter === "F"
                      ? "Recherche mère (sexe féminin) — nom…"
                      : sexFilter === "M"
                        ? "Recherche père (sexe masculin) — nom…"
                        : "Recherche nationale (nom, post-nom, prénom)…"
            }
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
          />
          {!hideAdd ? (
            <button type="button" className="btn-add" onClick={openAddModal}>
              {addButtonLabel}
            </button>
          ) : null}
        </div>
      )}
      {open && !value && !modal ? (
        <ul className="person-picker-list">
          {query.trim().length < 1 ? (
            <li className="muted">
              {originGeoFilter
                ? "Tapez un nom ou un lieu (province, territoire, secteur, village)…"
                : "Tapez pour chercher dans le registre…"}
            </li>
          ) : searching ? (
            <li className="muted">Recherche…</li>
          ) : results.length === 0 ? (
            <li className="muted">
              {(() => {
                const otherSexHits =
                  sexFilter != null
                    ? searchPersons(query).filter((p) => p.sexe && p.sexe !== sexFilter)
                    : [];
                if (otherSexHits.length > 0) {
                  const sample = displayName(otherSexHits[0]);
                  return sexFilter === "M"
                    ? `« ${sample} » existe mais en sexe féminin — cherchez-la dans Mère, pas Père.`
                    : `« ${sample} » existe mais en sexe masculin — cherchez-le dans Père, pas Mère.`;
                }
                return (
                  <>
                    Aucun résultat
                    {sexFilter ? ` (${sexFilter === "F" ? "féminin" : "masculin"})` : ""}.{" "}
                    {!hideAdd ? (
                      <button type="button" className="btn-add btn-sm" onClick={openAddModal}>
                        Ajouter « {query.trim()} »
                      </button>
                    ) : (
                      "— vous pouvez « Ajouter »."
                    )}
                  </>
                );
              })()}
            </li>
          ) : (
            results.map((p) => {
              const o = personOrigin(p);
              return (
                <li key={p.id}>
                  <button type="button" onClick={() => select(p)}>
                    <strong>{displayName(p)}</strong>
                    <span className="muted small">
                      {[
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

      {modal
        ? createPortal(
            <div
              className="modal-backdrop"
              role="dialog"
              aria-modal="true"
              onClick={() => !saving && setModal(false)}
            >
              <div
                className="modal-panel modal-wide person-add-modal"
                onClick={(e) => e.stopPropagation()}
              >
                <header className="person-add-head">
                  <div>
                    <h3>Ajouter une personne</h3>
                    <p className="muted small" style={{ margin: 0 }}>
                      {isPere
                        ? "Saisie du père — sexe masculin verrouillé. Nom, prénom et date de naissance suffisent."
                        : isMere
                          ? "Saisie de la mère — sexe féminin verrouillé. Nom, prénom et date de naissance suffisent."
                          : "Nom, prénom et date de naissance sont obligatoires. Origine et adresse sont optionnels."}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn-secondary btn-sm"
                    aria-label="Fermer"
                    disabled={saving}
                    onClick={() => setModal(false)}
                  >
                    ×
                  </button>
                </header>

                {/* Pas de <form> : le sélecteur est souvent dans un formulaire parent (mariage…) —
                    un form imbriqué est ignoré par le navigateur et « Enregistrer » ne crée jamais la fiche. */}
                <div className="person-add-form">
                  <FicheIdentificationEditor
                    value={fiche}
                    onChange={setFiche}
                    sexeLocked={sexFilter}
                    compact={isPere || isMere}
                  />

                  {error ? <div className="login-error">{error}</div> : null}

                  <div className="modal-actions">
                    <button
                      type="button"
                      className="btn-secondary"
                      disabled={saving}
                      onClick={() => setModal(false)}
                    >
                      Annuler
                    </button>
                    <button
                      type="button"
                      className="btn-primary"
                      style={{ width: "auto", minWidth: 180 }}
                      disabled={saving}
                      onClick={() => void saveNewPerson()}
                    >
                      {saving ? "Enregistrement…" : "Enregistrer et lier"}
                    </button>
                  </div>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
