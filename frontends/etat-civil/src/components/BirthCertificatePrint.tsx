/** Acte de naissance — mise en page conforme au formulaire officiel RDC (Volet 1). */

import { QRCodeSVG } from "qrcode.react";
import { type Act } from "../registry";

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

type ParentSnap = {
  name?: string;
  lieu_naissance?: string;
  date_naissance?: string;
  nationalite?: string;
  profession?: string;
  residence?: string;
};

function readSnap(raw: unknown): ParentSnap | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const s = (k: string) => (typeof o[k] === "string" ? String(o[k]).trim() : undefined);
  return {
    name: s("name") || [s("prenom"), s("postnom"), s("nom")].filter(Boolean).join(" ") || undefined,
    lieu_naissance: s("lieu_naissance"),
    date_naissance: s("date_naissance"),
    nationalite: s("nationalite"),
    profession: s("profession") || s("emploi"),
    residence: s("residence") || s("adresse"),
  };
}

function geoFromPayload(act: Act) {
  const g = act.payload?.geo_naissance;
  if (g && typeof g === "object" && !Array.isArray(g)) {
    const o = g as Record<string, unknown>;
    const s = (k: string) => (typeof o[k] === "string" ? String(o[k]).trim() : "");
    return {
      province: s("province_name"),
      ville: s("ville_name"),
      territoire: s("district_name"),
      commune: s("commune_name"),
      secteur: s("localite_name") || s("quartier_name"),
      quartier: s("quartier_name"),
    };
  }
  return { province: "", ville: "", territoire: "", commune: "", secteur: "", quartier: "" };
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
  return String(n);
}

function parseDateParts(iso: string): {
  d: string;
  dWord: string;
  m: string;
  y: string;
  yWord: string;
  slash: string;
} {
  if (!iso) return { d: "……", dWord: "……", m: "……", y: "……", yWord: "……", slash: "……" };
  let y = 0;
  let mo = 0;
  let da = 0;
  const dt = new Date(iso);
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
  if (!y) return { d: "……", dWord: "……", m: "……", y: "……", yWord: "……", slash: "……" };
  return {
    d: String(da),
    dWord: DAY_WORDS[da] || String(da),
    m: MONTHS[mo - 1] || String(mo),
    y: String(y),
    yWord: yearSuffixWords(y),
    slash: `${String(da).padStart(2, "0")}/${String(mo).padStart(2, "0")}/${y}`,
  };
}

function parentDisplayName(act: Act, role: "mother" | "father", snap: ParentSnap | null): string {
  const keys =
    role === "mother"
      ? ["mere_nom", "mother_name", "mere"]
      : ["pere_nom", "father_name", "pere"];
  const direct = p(act, ...keys);
  if (direct) return direct;
  if (snap?.name) return snap.name;
  return "";
}

export default function BirthCertificatePrint({
  act,
  verificationCode,
  officerName,
  bureauLabel,
}: Props) {
  const geo = geoFromPayload(act);
  const childName =
    [p(act, "prenom", "child_prenom", "child_given_names"), p(act, "postnom", "child_postnom"), p(act, "nom", "child_nom", "child_family_name")]
      .filter(Boolean)
      .join(" ") || "……………………";
  const sexRaw = p(act, "sexe", "sex").toUpperCase();
  const sexLetter = sexRaw.startsWith("F") ? "F" : sexRaw.startsWith("M") ? "M" : "……";
  const childRelation = sexRaw.startsWith("F") ? "fille" : "fils";
  const dob = parseDateParts(p(act, "date_naissance", "date_of_birth") || "");
  const place = p(act, "lieu_naissance", "place_of_birth") || geo.quartier || geo.commune || "……";
  const motherSnap = readSnap(act.payload.mother_snapshot);
  const fatherSnap = readSnap(act.payload.father_snapshot);
  const mother = parentDisplayName(act, "mother", motherSnap) || "……";
  const father = parentDisplayName(act, "father", fatherSnap) || "……";
  const declarant =
    p(act, "declarant", "declarant_name", "declarant_nom") || father || mother || "……";
  const qualiteRaw = p(act, "declarant_qualite", "qualite").toUpperCase();
  const qualite =
    qualiteRaw === "PERE" || qualiteRaw.includes("PERE")
      ? "père"
      : qualiteRaw === "MERE" || qualiteRaw.includes("MERE")
        ? "mère"
        : qualiteRaw || (declarant === father ? "père" : declarant === mother ? "mère" : "……");

  const province = p(act, "province", "province_naissance") || geo.province;
  const ville = p(act, "ville", "ville_naissance") || geo.ville;
  // Champ présent sur le formulaire papier officiel — laissé vide (/) hors anciens districts urbains.
  const districtPapier = p(act, "district_papier", "district_name_legacy") || "";
  const territoireCommune =
    p(act, "territoire", "commune", "commune_name", "commune_naissance") ||
    geo.territoire ||
    geo.commune;
  const chefferieSecteur =
    p(act, "secteur", "chefferie", "quartier_naissance") || geo.secteur || geo.quartier;
  const bureauPrincipal = p(act, "bureau_principal") || "";
  const bureauSecondaire =
    p(act, "bureau_secondaire", "service_bureau") ||
    (p(act, "type_bureau", "serviceBureau").toLowerCase().includes("second")
      ? bureauLabel || ""
      : "") ||
    (!bureauPrincipal ? bureauLabel || p(act, "bureau", "bureau_etat_civil") : "");
  const officer = officerName || p(act, "officer_name") || "……";
  const officerBureau =
    chefferieSecteur || territoireCommune
      ? `SECTEUR / BUREAU DE ${chefferieSecteur || territoireCommune}`.toUpperCase()
      : blank(bureauLabel || "");

  const motherDob = parseDateParts(motherSnap?.date_naissance || p(act, "date_naissance_mere") || "");
  const fatherDob = parseDateParts(fatherSnap?.date_naissance || "");
  const motherBirthPlace = motherSnap?.lieu_naissance || "……";
  const fatherBirthPlace = fatherSnap?.lieu_naissance || "……";
  const motherProf = motherSnap?.profession || p(act, "mother_profession") || "……";
  const fatherProf = fatherSnap?.profession || p(act, "father_profession") || "……";
  const motherNat = /etranger/i.test(motherSnap?.nationalite || "") ? "étrangère" : "congolaise";
  const fatherNat = /etranger/i.test(fatherSnap?.nationalite || "") ? "étranger" : "congolaise";
  const motherRes =
    motherSnap?.residence || p(act, "adresse_mere", "residence_mere") || geo.commune || "……";
  const fatherRes = fatherSnap?.residence || p(act, "residence_pere") || motherRes;
  const declarantBirthPlace =
    qualite === "père" ? fatherBirthPlace : qualite === "mère" ? motherBirthPlace : "……";
  const declarantDob = qualite === "père" ? fatherDob : qualite === "mère" ? motherDob : parseDateParts("");
  const declarantProf = qualite === "père" ? fatherProf : qualite === "mère" ? motherProf : "……";
  const declarantRes = qualite === "père" ? fatherRes : motherRes;

  const created = parseDateParts(act.created_at);
  const acteNo = act.act_number || "……";
  const volume = p(act, "volume", "annee_registre") || "……";
  const folio = p(act, "folio", "numero_registre") || acteNo;
  const hour = (() => {
    const h = p(act, "heure_naissance");
    if (h) {
      const [hh, mm] = h.split(":");
      return `${hh || "……"} heures ${mm || "00"}`;
    }
    const d = new Date(act.created_at);
    if (Number.isNaN(d.getTime())) return "…… heures ……";
    return `${String(d.getHours()).padStart(2, "0")} heures ${String(d.getMinutes()).padStart(2, "0")}`;
  })();

  let qrValue = act.qr_payload;
  const serverQr = act.payload?.qr;
  if (serverQr && typeof serverQr === "object") {
    qrValue = JSON.stringify(serverQr);
  } else {
    try {
      qrValue = JSON.stringify(JSON.parse(act.qr_payload));
    } catch {
      qrValue = JSON.stringify({ act: act.act_number, type: act.type });
    }
  }

  const diag =
    acteNo !== "……"
      ? acteNo
      : verificationCode ||
        (typeof act.payload?.verification_code === "string" ? act.payload.verification_code : "") ||
        String(Math.abs(hashCode(act.id || act.act_number)) % 9000 + 1000).padStart(4, "0");

  return (
    <div className="official-acte birth-acte print-area">
      <div className="official-acte-watermark" aria-hidden>
        ACTE DE NAISSANCE
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
            Chefferie / Secteur ou Cité de <u>{blank(chefferieSecteur)}</u>
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
            &nbsp;&nbsp; Folio n° <u>{folio}</u>
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
          <div className="official-acte-diag">{diag.slice(0, 8)}</div>
        </div>
      </header>

      <h1 className="official-acte-title">ACTE DE NAISSANCE</h1>

      <div className="official-acte-body">
        <p>
          L&apos;an deux mille <u>{created.yWord || created.y}</u> le{" "}
          <u>{created.dWord}</u> jour du mois de <u>{created.m}</u> à <u>{hour}</u>
        </p>
        <p>
          Par devant nous <u>{officer}</u>, Officier de l&apos;État civil de{" "}
          <u>{officerBureau}</u>
        </p>
        <p>
          A comparu <u>{declarant}</u> en qualité de <u>{qualite}</u>
        </p>
        <p>
          Né (e) à <u>{declarantBirthPlace}</u> le <u>{declarantDob.slash}</u> Profession{" "}
          <u>{declarantProf}</u> Résident à <u>{declarantRes}</u>
        </p>
        <p>Lequel (laquelle) nous a déclaré ce qui suit&nbsp;:</p>
        <p>
          Le <u>{dob.dWord}</u> jour du mois de <u>{dob.m}</u> de l&apos;année <u>{dob.y}</u> est
          né (e) à <u>{place}</u> un enfant de sexe <u>{sexLetter}</u> nommé (e){" "}
          <u>{childName}</u>
        </p>
        <p>
          {childRelation} de <u>{father}</u> né à <u>{fatherBirthPlace}</u> le{" "}
          <u>{fatherDob.slash}</u> nationalité <u>{fatherNat}</u> profession <u>{fatherProf}</u>{" "}
          résident à <u>{fatherRes}</u> et de
        </p>
        <p>
          <u>{mother}</u> née à <u>{motherBirthPlace}</u> le <u>{motherDob.slash}</u> nationalité{" "}
          <u>{motherNat}</u> profession <u>{motherProf}</u> résidents à <u>{motherRes}</u>{" "}
          conjoints.
        </p>
        <p>
          Lecture de l&apos;acte a été faite au comparant ou connaissance de l&apos;acte a été
          donnée ou traduction de l&apos;acte a été faite en <u>français</u>, langue que nous
          connaissons.
        </p>
        <p>En foi de quoi, avons dressé le présent acte.</p>
      </div>

      <footer className="official-acte-foot">
        <div>
          <strong>Le déclarant</strong>
          <div className="official-acte-sign" />
        </div>
        <div>
          <strong>L&apos;Officier de l&apos;État civil</strong>
          <div className="official-acte-sign" />
          <p className="official-acte-officer-stamp">{officer}</p>
        </div>
      </footer>

      <div className="official-acte-qr-row">
        <QRCodeSVG value={qrValue} size={72} includeMargin />
        <span className="muted small">Contrôle QR · {diag}</span>
      </div>
    </div>
  );
}

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h;
}
