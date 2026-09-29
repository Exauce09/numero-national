/** Acte de mariage — mise en page conforme au formulaire officiel RDC (Volet 1). */

import { QRCodeSVG } from "qrcode.react";
import {
  displayName,
  getPerson,
  personNationalite,
  type Act,
  type EtatCivil,
  type Person,
} from "../registry";

type Props = {
  act: Act;
  verificationCode?: string | null;
  officerName?: string;
  bureauLabel?: string;
};

function p(act: Act, ...keys: string[]): string {
  for (const k of keys) {
    const v = act.payload?.[k];
    if (v !== null && v !== undefined && String(v).trim() !== "") return String(v).trim();
  }
  return "";
}

function blank(s: string): string {
  return s.trim() || "…………";
}

function slashIfEmpty(s: string): string {
  return s.trim() || "/";
}

function geoFromPayload(act: Act) {
  const g = act.payload?.geo;
  if (g && typeof g === "object" && !Array.isArray(g)) {
    const o = g as Record<string, unknown>;
    const s = (k: string) => (typeof o[k] === "string" ? String(o[k]).trim() : "");
    return {
      province: s("province_name"),
      ville: s("ville_name"),
      territoire: s("district_name"),
      commune: s("commune_name"),
      quartier: s("quartier_name") || s("localite_name"),
      avenue: s("avenue_name") || s("rue_name"),
      numero: s("numero"),
      label: s("label"),
    };
  }
  return {
    province: "",
    ville: "",
    territoire: "",
    commune: "",
    quartier: "",
    avenue: "",
    numero: "",
    label: "",
  };
}

const MONTHS = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];

const DAY_WORDS = [
  "",
  "premier",
  "deuxième",
  "troisième",
  "quatrième",
  "cinquième",
  "sixième",
  "septième",
  "huitième",
  "neuvième",
  "dixième",
  "onzième",
  "douzième",
  "treizième",
  "quatorzième",
  "quinzième",
  "seizième",
  "dix-septième",
  "dix-huitième",
  "dix-neuvième",
  "vingtième",
  "vingt et unième",
  "vingt-deuxième",
  "vingt-troisième",
  "vingt-quatrième",
  "vingt-cinquième",
  "vingt-sixième",
  "vingt-septième",
  "vingt-huitième",
  "vingt-neuvième",
  "trentième",
  "trente et unième",
];

function yearSuffixWords(y: number): string {
  if (y < 2000 || y > 2099) return String(y);
  const n = y - 2000;
  const units = ["", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf"];
  const teens = [
    "dix",
    "onze",
    "douze",
    "treize",
    "quatorze",
    "quinze",
    "seize",
    "dix-sept",
    "dix-huit",
    "dix-neuf",
  ];
  if (n === 0) return "";
  if (n < 10) return units[n];
  if (n < 20) return teens[n - 10];
  if (n === 20) return "vingt";
  if (n === 21) return "vingt et un";
  if (n < 30) return `vingt-${units[n - 20]}`;
  if (n === 30) return "trente";
  return String(n);
}

function parseDateParts(iso: string): {
  dWord: string;
  m: string;
  y: string;
  yWord: string;
  slash: string;
} {
  if (!iso) return { dWord: "……", m: "……", y: "……", yWord: "……", slash: "……" };
  const dt = new Date(iso);
  let y = 0;
  let mo = 0;
  let da = 0;
  if (!Number.isNaN(dt.getTime())) {
    y = dt.getFullYear();
    mo = dt.getMonth() + 1;
    da = dt.getDate();
  } else {
    const raw = iso.slice(0, 10).split("-");
    if (raw.length === 3) {
      y = Number(raw[0]);
      mo = Number(raw[1]);
      da = Number(raw[2]);
    }
  }
  if (!y) return { dWord: "……", m: "……", y: "……", yWord: "……", slash: "……" };
  return {
    dWord: DAY_WORDS[da] || String(da),
    m: MONTHS[mo - 1] || String(mo),
    y: String(y),
    yWord: yearSuffixWords(y),
    slash: `${String(da).padStart(2, "0")}/${String(mo).padStart(2, "0")}/${y}`,
  };
}

function etatLabel(code: string | EtatCivil | undefined, sexe?: string): string {
  const c = String(code || "").toUpperCase();
  const f = (sexe || "").toUpperCase().startsWith("F");
  if (c.includes("CELIB")) return "Célibataire";
  if (c.includes("MARI")) return f ? "Mariée" : "Marié";
  if (c.includes("DIVOR")) return f ? "Divorcée" : "Divorcé";
  if (c.includes("VEUF") || c.includes("VEUVE")) return f ? "Veuve" : "Veuf";
  return code || "……";
}

function natLabel(person?: Person | null, raw?: string): string {
  if (raw) {
    return /etranger/i.test(raw) ? "étrangère" : /congo/i.test(raw) ? "congolaise" : raw;
  }
  if (!person) return "congolaise";
  return personNationalite(person) === "ETRANGER" ? "étrangère" : "congolaise";
}

function regimeLabel(code: string): string {
  const c = code.toUpperCase();
  if (c.includes("SEPAR")) return "la Séparation de biens";
  if (c.includes("DOTALE") || c === "DOT") return "la Dot";
  return "la Communauté Universelle";
}

function residenceOf(person?: Person | null, fallback = ""): string {
  if (!person) return fallback || "……";
  const g = person.adresse_geo;
  if (g) {
    const parts = [
      g.label,
      [g.avenue_name ? `Avenue/Rue ${g.avenue_name}` : "", g.numero ? `n° ${g.numero}` : ""]
        .filter(Boolean)
        .join(" "),
      g.quartier_name || g.localite_name ? `Quartier ${g.quartier_name || g.localite_name}` : "",
      g.commune_name ? `Commune de ${g.commune_name}` : "",
      g.ville_name || g.province_name,
    ].filter((x) => x && String(x).trim());
    if (parts.length) return parts.filter(Boolean).join(" ");
  }
  return (
    [person.adresse, person.secteur, person.ville || person.territoire, person.province]
      .filter(Boolean)
      .join(", ") ||
    fallback ||
    "……"
  );
}

function professionOf(person?: Person | null): string {
  if (!person?.parcours_professionnel?.trim()) return "……";
  return person.parcours_professionnel.trim();
}

function parentOf(person: Person | undefined, role: "mother" | "father"): { name: string; profession: string; residence: string } {
  if (!person) return { name: "……", profession: "……", residence: "……" };
  const id = role === "mother" ? person.mother_id : person.father_id;
  const parent = id ? getPerson(id) : undefined;
  if (!parent) return { name: "……", profession: "……", residence: residenceOf(person) };
  return {
    name: displayName(parent),
    profession: professionOf(parent),
    residence: residenceOf(parent, residenceOf(person)),
  };
}

function partyFromId(
  act: Act,
  idKey: string,
  nameKey: string,
): {
  name: string;
  lieu: string;
  dob: string;
  etat: string;
  profession: string;
  nationalite: string;
  residence: string;
  father: { name: string; profession: string; residence: string };
  mother: { name: string; profession: string; residence: string };
  sexe: string;
} {
  const id = p(act, idKey);
  const person = id ? getPerson(id) : undefined;
  const snapKey = idKey.replace(/_id$/, "_snapshot");
  const snap = act.payload?.[snapKey];
  const snapO =
    snap && typeof snap === "object" && !Array.isArray(snap)
      ? (snap as Record<string, unknown>)
      : null;
  const s = (k: string) =>
    snapO && typeof snapO[k] === "string" ? String(snapO[k]).trim() : "";

  const name = p(act, nameKey) || (person ? displayName(person) : "") || "……";
  const lieu = s("lieu_naissance") || person?.lieu_naissance || "……";
  const dobRaw = s("date_naissance") || person?.date_naissance || "";
  const dob = parseDateParts(dobRaw).slash;
  const etat = etatLabel(s("etat_civil") || person?.etat_civil, s("sexe") || person?.sexe);
  const profession = s("profession") || professionOf(person);
  const nationalite = natLabel(person, s("nationalite"));
  const residence = s("residence") || residenceOf(person);
  const father = parentOf(person, "father");
  const mother = parentOf(person, "mother");
  if (s("pere_name")) father.name = s("pere_name");
  if (s("mere_name")) mother.name = s("mere_name");
  if (s("pere_profession")) father.profession = s("pere_profession");
  if (s("mere_profession")) mother.profession = s("mere_profession");

  return {
    name,
    lieu,
    dob,
    etat,
    profession,
    nationalite,
    residence,
    father,
    mother,
    sexe: s("sexe") || person?.sexe || "",
  };
}

export default function MarriageCertificatePrint({
  act,
  verificationCode,
  officerName,
  bureauLabel,
}: Props) {
  const geo = geoFromPayload(act);
  const epoux = partyFromId(act, "epoux_id", "epoux_name");
  const epouse = partyFromId(act, "epouse_id", "epouse_name");
  const temoin1 = partyFromId(act, "temoin1_id", "temoin1_name");
  const temoin2 = partyFromId(act, "temoin2_id", "temoin2_name");
  const dateMariage = parseDateParts(p(act, "date_mariage") || act.created_at);
  const datePub = parseDateParts(p(act, "date_publications") || "");
  const officer =
    officerName || p(act, "officier_name", "officier_celebrant_name", "officer_name") || "……";
  const province = p(act, "province") || geo.province;
  const ville = p(act, "ville") || geo.ville;
  const districtPapier = p(act, "district_papier") || geo.territoire;
  const territoireCommune =
    p(act, "commune", "commune_name") || geo.commune || geo.territoire;
  const bureauPrincipal = p(act, "bureau_principal") || "";
  const bureauSecondaire =
    p(act, "bureau_secondaire") ||
    (!bureauPrincipal ? bureauLabel || p(act, "lieu_etat_civil", "bureau") || geo.quartier : "");
  const officerCommune = territoireCommune || bureauLabel || "……";
  const regime = regimeLabel(p(act, "regime_matrimonial"));
  const dote = p(act, "montant_dote", "dote", "dot") || "……";
  const dateDote = parseDateParts(p(act, "date_dote") || "");
  const acteNo = act.act_number || "……";
  const volume = p(act, "volume") || "I";
  const folio = p(act, "folio") || "……";
  const hour = (() => {
    const d = new Date(p(act, "date_mariage") || act.created_at);
    if (Number.isNaN(d.getTime())) return { h: "……", m: "……" };
    return { h: String(d.getHours()), m: String(d.getMinutes()).padStart(2, "0") };
  })();

  let qrValue = act.qr_payload;
  try {
    qrValue = JSON.stringify(JSON.parse(act.qr_payload));
  } catch {
    qrValue = JSON.stringify({ act: act.act_number, type: act.type });
  }
  const diag =
    verificationCode ||
    (typeof act.payload?.verification_code === "string" ? act.payload.verification_code : "") ||
    acteNo;

  return (
    <div className="official-acte marriage-acte print-area">
      <div className="official-acte-watermark" aria-hidden>
        ACTE DE MARIAGE
      </div>

      <header className="official-acte-head">
        <div className="official-acte-head-left">
          <p className="official-acte-state">REPUBLIQUE DEMOCRATIQUE DU CONGO</p>
          <p>
            Province de <u>{blank(province)}</u>
          </p>
          <p>
            Ville de <u>{slashIfEmpty(ville)}</u>
          </p>
          <p>
            District de <u>{slashIfEmpty(districtPapier)}</u>
          </p>
          <p>
            Territoire / Commune de <u>{blank(territoireCommune)}</u>
          </p>
          <p>
            Bureau Principal de l&apos;État civil de <u>{slashIfEmpty(bureauPrincipal)}</u>
          </p>
          <p>
            Bureau Secondaire de l&apos;État civil de <u>{slashIfEmpty(bureauSecondaire)}</u>
          </p>
          <p className="official-acte-refs">
            Acte n° <u>{acteNo}</u>
            &nbsp;&nbsp; Volume <u>{volume}</u>
            &nbsp;&nbsp; Folio <u>{folio}</u>
          </p>
        </div>
        <div className="official-acte-head-right">
          <div className="official-acte-volet">Volet 1</div>
          <img
            className="official-acte-flag"
            src="/flag-rdc.svg"
            alt="Drapeau RDC"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
              const fb = (e.target as HTMLImageElement).nextElementSibling as HTMLElement | null;
              if (fb) fb.style.display = "block";
            }}
          />
          <div className="official-acte-flag-fallback" style={{ display: "none" }} aria-hidden />
          <div className="official-acte-diag">{String(diag).slice(0, 12)}</div>
        </div>
      </header>

      <h1 className="official-acte-title">ACTE DE MARIAGE</h1>

      <div className="official-acte-body">
        <p>
          L&apos;an deux mille <u>{dateMariage.yWord || dateMariage.y}</u> le{" "}
          <u>{dateMariage.dWord}</u> jour du mois de <u>{dateMariage.m}</u> à{" "}
          <u>{hour.h}</u> heures <u>{hour.m}</u> minutes
        </p>
        <p>
          Par devant nous <u>{officer}</u>, Officier de l&apos;État civil de{" "}
          <u>{blank(officerCommune)}</u>
        </p>
        <p>
          Ont comparu en séance publique le nommé <u>{epoux.name}</u> né à <u>{epoux.lieu}</u> le{" "}
          <u>{epoux.dob}</u> état civil <u>{epoux.etat}</u> profession <u>{epoux.profession}</u>{" "}
          nationalité <u>{epoux.nationalite}</u> résidant à <u>{epoux.residence}</u>.
        </p>
        <p>
          Fils de <u>{epoux.father.name}</u> profession <u>{epoux.father.profession}</u> résidant à{" "}
          <u>{epoux.father.residence}</u> et de <u>{epoux.mother.name}</u> profession{" "}
          <u>{epoux.mother.profession}</u> résidant à <u>{epoux.mother.residence}</u>.
        </p>
        <p>
          Et la nommée <u>{epouse.name}</u> née à <u>{epouse.lieu}</u> le <u>{epouse.dob}</u> état
          civil <u>{epouse.etat}</u> profession <u>{epouse.profession}</u> nationalité{" "}
          <u>{epouse.nationalite}</u> résidant à <u>{epouse.residence}</u>.
        </p>
        <p>
          Fille de <u>{epouse.father.name}</u> profession <u>{epouse.father.profession}</u> résidant
          à <u>{epouse.father.residence}</u> et de <u>{epouse.mother.name}</u> profession{" "}
          <u>{epouse.mother.profession}</u> résidant à <u>{epouse.mother.residence}</u>.
        </p>
        <p>
          Lesquels nous ont requis de procéder à la célébration du mariage projeté entre eux et dont
          nous avons publié le projet conformément aux prescrits de l&apos;article 384 de la loi du
          15 juillet 2016 complétant celle du 1er août 1987 par voie d&apos;affichage
          {datePub.slash !== "……" ? (
            <>
              {" "}
              faite en date du <u>{datePub.slash}</u> à la porte du bureau
            </>
          ) : null}
          , et nous ont produit à cet effet les documents requis (attestations de célibat,
          résidence, et le cas échéant l&apos;ayant droit coutumier).
        </p>
        <p>
          Faisant suite à la réquisition, lecture des pièces relatives à leur état civil étant
          faite, nous leur avons instruit de leurs droits et devoirs respectifs et leur avons demandé
          s&apos;ils veulent se prendre en mariage pour mari et femme ; chacun d&apos;eux ayant
          répondu séparément affirmativement, prononçons qu&apos;ils sont unis légalement par le
          mariage, dont la dot de <u>{dote}</u>
          {dateDote.slash !== "……" ? (
            <>
              {" "}
              est versée en date du <u>{dateDote.slash}</u>
            </>
          ) : null}
          , en présence de <u>{temoin1.name}</u> né(e) à <u>{temoin1.lieu}</u> le{" "}
          <u>{temoin1.dob}</u> état civil <u>{temoin1.etat}</u> profession{" "}
          <u>{temoin1.profession}</u> résidant à <u>{temoin1.residence}</u> et de{" "}
          <u>{temoin2.name}</u> né(e) à <u>{temoin2.lieu}</u> le <u>{temoin2.dob}</u> état civil{" "}
          <u>{temoin2.etat}</u> profession <u>{temoin2.profession}</u> résidant à{" "}
          <u>{temoin2.residence}</u>.
        </p>
        <p>
          Les époux ont adopté le régime matrimonial <u>{regime}</u>.
        </p>
        <p>
          Lecture de l&apos;acte a été faite aux témoins qui contresignent avec nous. En foi de
          quoi, nous avons dressé le présent acte.
        </p>
      </div>

      <footer className="official-acte-foot marriage-acte-foot">
        <div>
          <strong>Signatures des témoins</strong>
          <div className="official-acte-sign" />
          <p className="official-acte-sign-caption">(1) {temoin1.name}</p>
          <div className="official-acte-sign" />
          <p className="official-acte-sign-caption">(2) {temoin2.name}</p>
        </div>
        <div>
          <strong>Signatures des époux</strong>
          <div className="official-acte-sign" />
          <p className="official-acte-sign-caption">(1) {epoux.name}</p>
          <div className="official-acte-sign" />
          <p className="official-acte-sign-caption">(2) {epouse.name}</p>
        </div>
        <div>
          <strong>L&apos;Officier de l&apos;État civil</strong>
          <div className="official-acte-sign" />
          <p className="official-acte-officer-stamp">{officer}</p>
        </div>
      </footer>

      <div className="official-acte-qr-row">
        <QRCodeSVG value={qrValue} size={72} includeMargin />
        <span className="muted small">Contrôle QR · {acteNo}</span>
      </div>
    </div>
  );
}
