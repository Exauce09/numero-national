/** Construit une Fiche d'identification à partir du registre local / personne. */

import { getOfficerCommune } from "./commune";
import {
  emptyFichePerson,
  type FicheIdentificationData,
  type FichePersonBlock,
} from "./components/FicheIdentificationForm";
import {
  displayName,
  getPerson,
  listActs,
  personOrigin,
  provinceDigitsFromName,
  type Person,
} from "./registry";

function sexLabel(sexe: string): string {
  const s = sexe.toUpperCase();
  if (s === "F") return "Féminin";
  if (s === "M") return "Masculin";
  return sexe || "";
}

function etatLabel(etat: string): string {
  const map: Record<string, string> = {
    CELIBATAIRE: "Célibataire",
    MARIE: "Marié(e)",
    DIVORCE: "Divorcé(e)",
    VEUF: "Veuf / veuve",
  };
  return map[etat] || etat || "";
}

function addressFromPerson(p: Person): string {
  const o = personOrigin(p);
  const parts = [o.village, o.secteur || o.commune, o.ville, o.province].filter(Boolean);
  return parts.join(", ");
}

function personToBlock(p: Person | null | undefined): FichePersonBlock {
  if (!p) return emptyFichePerson();
  const o = personOrigin(p);
  return {
    nom: p.nom || "",
    postnom: p.postnom || "",
    prenom: p.prenom || "",
    sexe: sexLabel(p.sexe),
    etat_civil: etatLabel(p.etat_civil),
    lieu_date_naissance: [p.lieu_naissance, p.date_naissance].filter(Boolean).join(" — "),
    nationalite:
      String(p.nationalite ?? "").toUpperCase().includes("ETRANG") || p.nationalite === "ETRANGER"
        ? "Étrangère"
        : "Congolaise",
    profession: String(p.parcours_professionnel ?? "").trim() || "",
    secteur: o.secteur || o.commune || "",
    territoire: o.territoire || "",
    ville: o.ville || "",
    province: o.province || "",
    adresse: addressFromPerson(p),
  };
}

function findSpouse(p: Person): Person | null {
  const marriage = listActs("MARRIAGE").find((a) => {
    const id1 = String(a.payload.epoux_id ?? "");
    const id2 = String(a.payload.epouse_id ?? "");
    return id1 === p.id || id2 === p.id || a.national_id === p.nic;
  });
  if (!marriage) return null;
  const otherId =
    String(marriage.payload.epoux_id ?? "") === p.id
      ? String(marriage.payload.epouse_id ?? "")
      : String(marriage.payload.epoux_id ?? "");
  if (otherId) return getPerson(otherId) ?? null;
  const name =
    String(marriage.payload.epoux_id ?? "") === p.id
      ? String(marriage.payload.epouse_name ?? "")
      : String(marriage.payload.epoux_name ?? "");
  if (!name) return null;
  return {
    id: "",
    nic: "",
    nom: name,
    postnom: "",
    prenom: "",
    sexe: p.sexe === "M" ? "F" : "M",
    date_naissance: String(marriage.payload.epouse_date_naissance ?? marriage.payload.epoux_date_naissance ?? ""),
    lieu_naissance: "",
    etat_civil: "MARIE",
    created_at: "",
  } as Person;
}

/** Remplit la fiche officielle (intéressé + conjoint + père + mère). */
export function buildFicheFromPerson(
  person: Person,
  opts?: { serieSuffix?: string },
): FicheIdentificationData {
  const officer = getOfficerCommune();
  const father = person.father_id ? getPerson(person.father_id) : null;
  const mother = person.mother_id ? getPerson(person.mother_id) : null;
  const spouse = findSpouse(person);
  const pp = provinceDigitsFromName(officer.province || "Kinshasa");
  const tail = opts?.serieSuffix?.trim() || "………";

  return {
    communeName: officer.name,
    villeProvince: officer.ville || officer.province || "Kinshasa",
    serie: `${pp}/INF001-TSL/${tail}`,
    interesse: personToBlock(person),
    conjoint: spouse
      ? {
          nom: displayName(spouse),
          lieu_date_naissance: [spouse.lieu_naissance, spouse.date_naissance]
            .filter(Boolean)
            .join(" — "),
          profession: String(spouse.parcours_professionnel ?? "").trim() || "",
          adresse: addressFromPerson(spouse),
        }
      : { nom: "", lieu_date_naissance: "", profession: "", adresse: "" },
    pere: personToBlock(father),
    mere: personToBlock(mother),
    dateLieu: `${officer.ville || "Kinshasa"}, le ${new Date().toLocaleDateString("fr-FR")}`,
  };
}

export function buildFicheFromPersonId(
  personId: string,
  opts?: { serieSuffix?: string },
): FicheIdentificationData | null {
  const p = getPerson(personId);
  if (!p) return null;
  return buildFicheFromPerson(p, opts);
}
