/**
 * Lot de 30 actes de naissance (démo / saisie métier).
 * Idempotent : ne recrée pas si l’enfant est déjà au registre.
 */
import {
  addAct,
  addPerson,
  findDuplicatePerson,
  generateBirthDossierId,
  listActs,
  type Person,
  type Sexe,
} from "./registry";
import { listAllCommunesFlat } from "./geoFallback";

const SEED_FLAG = "nn_civil_seed_births_batch_30_v1";

type Row = {
  fullName: string;
  sexe: Sexe;
  fatherFull: string;
  motherFull: string;
  adresse: string; // "Kinshasa, Lemba"
  provinceOrigine: string;
};

const ROWS: Row[] = [
  { fullName: "KABONGO Grâce Élie", sexe: "F", fatherFull: "Kabongo Jean-Pierre", motherFull: "Mukendi Esther", adresse: "Kinshasa, Lemba", provinceOrigine: "Kasaï-Oriental" },
  { fullName: "TSHIBANGU Sarah Noëlle", sexe: "F", fatherFull: "Tshibangu Patrick", motherFull: "Kalala Marie", adresse: "Kinshasa, Ngaliema", provinceOrigine: "Kasaï-Central" },
  { fullName: "MUKENDI David Israël", sexe: "M", fatherFull: "Mukendi Joseph", motherFull: "Tshilumba Grâce", adresse: "Kinshasa, Mont-Ngafula", provinceOrigine: "Lomami" },
  { fullName: "KALALA Emmanuel Junior", sexe: "M", fatherFull: "Kalala André", motherFull: "Kabeya Ruth", adresse: "Kinshasa, Kimbanseke", provinceOrigine: "Kasaï-Oriental" },
  { fullName: "ILUNGA Grâce-Merveille", sexe: "F", fatherFull: "Ilunga Michel", motherFull: "Mutombo Chantal", adresse: "Kinshasa, Masina", provinceOrigine: "Haut-Katanga" },
  { fullName: "KASONGO Nathanël", sexe: "M", fatherFull: "Kasongo Daniel", motherFull: "Mulamba Esther", adresse: "Kinshasa, Matete", provinceOrigine: "Sud-Kivu" },
  { fullName: "MULUMBA Gloria Esther", sexe: "F", fatherFull: "Mulumba Serge", motherFull: "Ilunga Béatrice", adresse: "Kinshasa, Limete", provinceOrigine: "Haut-Lomami" },
  { fullName: "MUTOMBO Israël David", sexe: "M", fatherFull: "Mutombo Paul", motherFull: "Mbuyi Carine", adresse: "Kinshasa, Bumbu", provinceOrigine: "Kasaï" },
  { fullName: "MBUYI Grâce Divine", sexe: "F", fatherFull: "Mbuyi François", motherFull: "Tshomba Ruth", adresse: "Kinshasa, Selembao", provinceOrigine: "Kasaï-Central" },
  { fullName: "KABEYI Jonathan Emmanuel", sexe: "M", fatherFull: "Kabeyi Albert", motherFull: "Mukendi Alice", adresse: "Kinshasa, Ndjili", provinceOrigine: "Lomami" },
  { fullName: "TSHILUMBA Naomi Grâce", sexe: "F", fatherFull: "Tshilumba Joseph", motherFull: "Kalala Élodie", adresse: "Kinshasa, Kisenso", provinceOrigine: "Kasaï-Oriental" },
  { fullName: "LUKUSA Samuel David", sexe: "M", fatherFull: "Lukusa Robert", motherFull: "Mamba Jeanne", adresse: "Kinshasa, Gombe", provinceOrigine: "Kongo-Central" },
  { fullName: "KAMBA Ruth-Merveille", sexe: "F", fatherFull: "Kamba Didier", motherFull: "Nsimba Grâce", adresse: "Kinshasa, Barumbu", provinceOrigine: "Kongo-Central" },
  { fullName: "NSIMBA Ethan Israël", sexe: "M", fatherFull: "Nsimba Christian", motherFull: "Kiala Sarah", adresse: "Kinshasa, Lingwala", provinceOrigine: "Kongo-Central" },
  { fullName: "KIALA Esther Noëlle", sexe: "F", fatherFull: "Kiala André", motherFull: "Mbuyi Pauline", adresse: "Kinshasa, Kalamu", provinceOrigine: "Kwango" },
  { fullName: "LUMBU Moïse Emmanuel", sexe: "M", fatherFull: "Lumbu Joseph", motherFull: "Kanku Marie", adresse: "Kinshasa, Bandalungwa", provinceOrigine: "Kwilu" },
  { fullName: "KANKU Béthel Grâce", sexe: "F", fatherFull: "Kanku Philippe", motherFull: "Ilunga Rachel", adresse: "Kinshasa, Kintambo", provinceOrigine: "Kwilu" },
  { fullName: "MAMBA Daniel Grâce", sexe: "M", fatherFull: "Mamba Didier", motherFull: "Kabeya Ruth", adresse: "Kinshasa, Ngaba", provinceOrigine: "Mai-Ndombe" },
  { fullName: "KALUME Josué Élie", sexe: "M", fatherFull: "Kalume Albert", motherFull: "Furaha Esther", adresse: "Kinshasa, Makala", provinceOrigine: "Nord-Kivu" },
  { fullName: "FURAHA Amani Grâce", sexe: "F", fatherFull: "Furaha Patrick", motherFull: "Bahati Chantal", adresse: "Kinshasa, Nsele", provinceOrigine: "Sud-Kivu" },
  { fullName: "BAHATI Samuel Junior", sexe: "M", fatherFull: "Bahati Emmanuel", motherFull: "Mutesi Jeanne", adresse: "Kinshasa, Kimbanseke", provinceOrigine: "Nord-Kivu" },
  { fullName: "MUTONI Grâce Esther", sexe: "F", fatherFull: "Mutoni David", motherFull: "Nyirabera Alice", adresse: "Kinshasa, Masina", provinceOrigine: "Nord-Kivu" },
  { fullName: "KOFFI Nathan Grâce", sexe: "M", fatherFull: "Koffi Marc", motherFull: "Mbala Ruth", adresse: "Kinshasa, Mont-Ngafula", provinceOrigine: "Ituri" },
  { fullName: "MBALA Sarah Divine", sexe: "F", fatherFull: "Mbala Joseph", motherFull: "Kiala Béatrice", adresse: "Kinshasa, Limete", provinceOrigine: "Kwango" },
  { fullName: "KABAMBA Emmanuel Grâce", sexe: "M", fatherFull: "Kabamba Jean", motherFull: "Tshibola Marie", adresse: "Kinshasa, Lemba", provinceOrigine: "Haut-Katanga" },
  { fullName: "TSHIBOLA Naomi Esther", sexe: "F", fatherFull: "Tshibola Pierre", motherFull: "Kabeya Grâce", adresse: "Kinshasa, Matete", provinceOrigine: "Kasaï-Central" },
  { fullName: "LUBAKI David Emmanuel", sexe: "M", fatherFull: "Lubaki André", motherFull: "Mbuyi Sarah", adresse: "Kinshasa, Ndjili", provinceOrigine: "Sankuru" },
  { fullName: "ONASAKA Grâce Noëlle", sexe: "F", fatherFull: "Onasaka Michel", motherFull: "Kanku Esther", adresse: "Kinshasa, Ngaliema", provinceOrigine: "Tshopo" },
  { fullName: "KASONGO Israël Junior", sexe: "M", fatherFull: "Kasongo Paul", motherFull: "Ilunga Ruth", adresse: "Kinshasa, Bumbu", provinceOrigine: "Maniema" },
  { fullName: "KALONJI Élie Merveille", sexe: "M", fatherFull: "Kalonji Daniel", motherFull: "Tshibangu Chantal", adresse: "Kinshasa, Kisenso", provinceOrigine: "Kasaï-Oriental" },
];

function splitIdentity(full: string): { nom: string; postnom: string; prenom: string } {
  const parts = full.trim().replace(/\s+/g, " ").split(" ");
  if (parts.length <= 1) return { nom: parts[0] || "", postnom: "", prenom: "" };
  if (parts.length === 2) return { nom: parts[0], postnom: "", prenom: parts[1] };
  return { nom: parts[0], postnom: parts[1], prenom: parts.slice(2).join(" ") };
}

function normalizeCommune(raw: string): string {
  const c = raw.trim().replace(/^N['']djili$/i, "Ndjili");
  if (/^n['']?djili$/i.test(c)) return "Ndjili";
  return c;
}

function parseAdresse(adresse: string): {
  ville: string;
  commune: string;
  province: string;
  communeCode: string;
} {
  const [villeRaw, communeRaw] = adresse.split(",").map((s) => s.trim());
  const commune = normalizeCommune(communeRaw || "Gombe");
  const ville = villeRaw || "Kinshasa";
  const province = "Kinshasa";
  const flat = listAllCommunesFlat().find(
    (c) =>
      c.province === province &&
      c.ville === ville &&
      c.name.toLowerCase() === commune.toLowerCase(),
  );
  const communeCode =
    flat?.code || `KIN-${commune.toUpperCase().replace(/[^A-Z0-9]+/g, "-")}`;
  return { ville, commune, province, communeCode };
}

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function ensureParent(
  full: string,
  sexe: Sexe,
  lieu: string,
  dob: string,
): Person {
  const idn = splitIdentity(full);
  const dup = findDuplicatePerson({
    nom: idn.nom,
    postnom: idn.postnom,
    prenom: idn.prenom,
    date_naissance: dob,
    sexe,
  });
  if (dup) return dup;
  const loose = findDuplicatePerson({
    nom: idn.nom,
    prenom: idn.prenom,
    date_naissance: dob,
    sexe,
  });
  if (loose && !idn.postnom) return loose;
  try {
    return addPerson({
      nom: idn.nom,
      postnom: idn.postnom,
      prenom: idn.prenom,
      sexe,
      date_naissance: dob,
      lieu_naissance: lieu,
      etat_civil: "MARIE",
      nationalite: "CONGOLAIS",
    });
  } catch {
    const again = findDuplicatePerson({
      nom: idn.nom,
      postnom: idn.postnom,
      prenom: idn.prenom,
      date_naissance: dob,
      sexe,
    });
    if (again) return again;
    throw new Error(`Parent impossible : ${full}`);
  }
}

function childAlreadyRegistered(nom: string, prenom: string, postnom: string, motherId: string): boolean {
  return listActs("BIRTH").some((a) => {
    const p = a.payload;
    return (
      String(p.mother_id ?? "") === motherId &&
      String(p.nom ?? "").toLowerCase() === nom.toLowerCase() &&
      String(p.prenom ?? "").toLowerCase() === prenom.toLowerCase() &&
      String(p.postnom ?? "").toLowerCase() === postnom.toLowerCase()
    );
  });
}

export async function seedBatchBirths(): Promise<{ created: number; skipped: number }> {
  if (typeof localStorage === "undefined") return { created: 0, skipped: 0 };
  if (localStorage.getItem(SEED_FLAG) === "done") {
    return { created: 0, skipped: ROWS.length };
  }

  let created = 0;
  let skipped = 0;

  for (let i = 0; i < ROWS.length; i += 1) {
    const row = ROWS[i];
    const childIdn = splitIdentity(row.fullName);
    const geo = parseAdresse(row.adresse);
    const dateNaissance = isoDaysAgo(i + 1);
    const lieu = `${geo.commune}, ${geo.ville}`;
    const communeCode = geo.communeCode;

    const mother = ensureParent(row.motherFull, "F", lieu, "1990-05-15");
    const father = ensureParent(row.fatherFull, "M", lieu, "1988-03-20");

    if (childAlreadyRegistered(childIdn.nom, childIdn.prenom, childIdn.postnom, mother.id)) {
      skipped += 1;
      continue;
    }

    const existingChild = findDuplicatePerson({
      nom: childIdn.nom,
      postnom: childIdn.postnom,
      prenom: childIdn.prenom,
      date_naissance: dateNaissance,
      sexe: row.sexe,
      mother_id: mother.id,
    });
    if (existingChild) {
      skipped += 1;
      continue;
    }

    const nic = generateBirthDossierId(dateNaissance, { provinceName: geo.province });
    let child: Person;
    try {
      child = addPerson({
        nom: childIdn.nom,
        postnom: childIdn.postnom,
        prenom: childIdn.prenom,
        sexe: row.sexe,
        date_naissance: dateNaissance,
        lieu_naissance: lieu,
        etat_civil: "CELIBATAIRE",
        mother_id: mother.id,
        father_id: father.id,
        nationalite: "CONGOLAIS",
        nic,
      });
    } catch {
      skipped += 1;
      continue;
    }

    const motherFull = [mother.nom, mother.postnom, mother.prenom].filter(Boolean).join(" ");
    const fatherFull = [father.nom, father.postnom, father.prenom].filter(Boolean).join(" ");
    const geoNaissance = {
      province_name: geo.province,
      ville_name: geo.ville,
      commune_name: geo.commune,
      commune_code: communeCode,
      label: lieu,
    };
    const geoOrigine = {
      province_name: row.provinceOrigine,
      label: row.provinceOrigine,
    };

    const payload = {
      child_id: child.id,
      nom: child.nom,
      postnom: child.postnom,
      prenom: child.prenom,
      sexe: child.sexe,
      date_naissance: child.date_naissance,
      heure_naissance: null,
      naissance_multiple: false,
      annee_registre: String(new Date().getFullYear()),
      numero_registre: String(i + 1).padStart(4, "0"),
      lieu_naissance: child.lieu_naissance,
      id_naissance: child.nic,
      code_dossier: child.nic,
      mode_enregistrement: "sans_procuration",
      mode_naissance: "sans_procuration",
      mode: "Sans procuration",
      type_naissance: "Sans procuration",
      delai_enregistrement: "DANS_DELAI",
      delai_enregistrement_label: "Dans le délai",
      avec_procuration: false,
      hopital_naissance: null,
      geo_naissance: geoNaissance,
      commune_naissance: geo.commune,
      ville_naissance: geo.ville,
      province_naissance: geo.province,
      commune_code: communeCode,
      mother_id: mother.id,
      mother_name: motherFull,
      mere_nom: motherFull,
      declarant: motherFull,
      declarant_id: mother.id,
      declarant_qualite: "MERE",
      mother_dossier: mother.nic,
      adresse_mere: row.adresse,
      father_id: father.id,
      father_name: fatherFull,
      pere_nom: fatherFull,
      father_dossier: father.nic,
      province: geo.province,
      ville: geo.ville,
      commune: geo.commune,
      bureau: `Commune de ${geo.commune}`,
      officer_name: "Officier de l'État civil",
      geo_origine: geoOrigine,
      originaire: row.provinceOrigine,
      province_origine: row.provinceOrigine,
      note: "Nouveau-né — lot saisi (30 actes)",
      seed_batch: "births_batch_30_v1",
    };

    try {
      await addAct("BIRTH", payload, child.nic);
      created += 1;
    } catch {
      skipped += 1;
    }
  }

  localStorage.setItem(SEED_FLAG, "done");
  return { created, skipped };
}
