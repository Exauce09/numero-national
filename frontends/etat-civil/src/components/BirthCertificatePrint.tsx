/** Acte de naissance — mise en page officielle RDC (registre d'état civil). */

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

type ParentSnap = {
  name?: string;
  lieu_naissance?: string;
  date_naissance?: string;
  nationalite?: string;
};

function readSnap(raw: unknown): ParentSnap | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  return {
    name: typeof o.name === "string" ? o.name.trim() : undefined,
    lieu_naissance: typeof o.lieu_naissance === "string" ? o.lieu_naissance.trim() : undefined,
    date_naissance: typeof o.date_naissance === "string" ? o.date_naissance.trim() : undefined,
    nationalite: typeof o.nationalite === "string" ? o.nationalite.trim() : undefined,
  };
}

function geoFromPayload(act: Act): {
  province: string;
  ville: string;
  district: string;
  commune: string;
  quartier: string;
} {
  const g = act.payload?.geo_naissance;
  if (g && typeof g === "object" && !Array.isArray(g)) {
    const o = g as Record<string, unknown>;
    const s = (k: string) => (typeof o[k] === "string" ? String(o[k]).trim() : "");
    return {
      province: s("province_name"),
      ville: s("ville_name"),
      district: s("district_name"),
      commune: s("commune_name"),
      quartier: s("quartier_name"),
    };
  }
  return { province: "", ville: "", district: "", commune: "", quartier: "" };
}

function formatPlace(act: Act, geo: ReturnType<typeof geoFromPayload>): string {
  const manual = p(act, "lieu_naissance", "place_of_birth", "lieu_etat_civil");
  if (manual) return manual;
  const parts = [geo.quartier, geo.commune, geo.ville, geo.province].filter(Boolean);
  return parts.join(", ") || "……";
}

function parentDisplayName(act: Act, role: "mother" | "father", snap: ParentSnap | null): string {
  const keys =
    role === "mother"
      ? ["mere_nom", "mother_name", "mere"]
      : ["pere_nom", "father_name", "pere"];
  const direct = p(act, ...keys);
  if (direct) return direct;
  if (snap?.name) return snap.name;
  const given = p(act, role === "mother" ? "mother_given_names" : "father_given_names");
  const family = p(act, role === "mother" ? "mother_family_name" : "father_family_name");
  return [given, family].filter(Boolean).join(" ") || "……";
}

function yearWords(y: number): string {
  if (y < 2000 || y > 2099) return String(y);
  const units = [
    "",
    "un",
    "deux",
    "trois",
    "quatre",
    "cinq",
    "six",
    "sept",
    "huit",
    "neuf",
  ];
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
  const tens = ["", "", "vingt", "trente", "quarante", "cinquante", "soixante", "soixante", "quatre-vingt", "quatre-vingt"];
  const n = y - 2000;
  if (n < 10) return `deux mille ${units[n]}`.trim();
  if (n < 20) return `deux mille ${teens[n - 10]}`;
  const t = Math.floor(n / 10);
  const u = n % 10;
  if (t === 7 || t === 9) {
    return `deux mille ${tens[t]}${u ? `-${teens[u]}` : (t === 7 ? "-dix" : "s")}`.replace("--", "-");
  }
  return `deux mille ${tens[t]}${u ? `-${units[u]}` : (t === 8 ? "s" : "")}`;
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

function parseDateParts(iso: string): { d: string; m: string; y: string; yw: string } {
  if (!iso) return { d: "……", m: "……", y: "……", yw: "……" };
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) {
    const raw = iso.slice(0, 10).split("-");
    if (raw.length === 3) {
      const yi = Number(raw[0]);
      return {
        d: String(Number(raw[2])),
        m: MONTHS[Number(raw[1]) - 1] || raw[1],
        y: raw[0],
        yw: yearWords(yi),
      };
    }
    return { d: "……", m: "……", y: "……", yw: "……" };
  }
  return {
    d: String(dt.getDate()),
    m: MONTHS[dt.getMonth()],
    y: String(dt.getFullYear()),
    yw: yearWords(dt.getFullYear()),
  };
}

export default function BirthCertificatePrint({
  act,
  verificationCode,
  officerName,
  bureauLabel,
}: Props) {
  const geo = geoFromPayload(act);
  const childName =
    [p(act, "prenom", "child_given_names", "given_names"), p(act, "postnom"), p(act, "nom", "child_family_name", "family_name")]
      .filter(Boolean)
      .join(" ") || "……………………";
  const sexRaw = p(act, "sexe", "sex").toUpperCase();
  const sexLabel = sexRaw.startsWith("F") ? "féminin" : sexRaw.startsWith("M") ? "masculin" : "……";
  const childRelation = sexRaw.startsWith("F") ? "fille" : sexRaw.startsWith("M") ? "fils" : "fils (fille)";
  const dob = parseDateParts(p(act, "date_naissance", "date_of_birth", "child_dob") || act.created_at);
  const place = formatPlace(act, geo);
  const motherSnap = readSnap(act.payload.mother_snapshot);
  const fatherSnap = readSnap(act.payload.father_snapshot);
  const mother = parentDisplayName(act, "mother", motherSnap);
  const father = parentDisplayName(act, "father", fatherSnap);
  const declarant =
    p(act, "declarant", "declarant_name", "declarant_nom") || motherSnap?.name || mother || "……";
  const qualite = p(act, "declarant_qualite", "qualite") || (declarant === mother ? "mère de l'enfant" : "……");
  const province =
    p(act, "province", "province_naissance") || geo.province || "Kinshasa";
  const ville = p(act, "ville", "city", "ville_naissance") || geo.ville || province;
  const district = p(act, "district") || geo.district || "……";
  const commune =
    p(act, "commune", "commune_name", "commune_naissance") || geo.commune || "……";
  const quartier = p(act, "quartier_naissance") || geo.quartier || "";
  const bureau =
    bureauLabel ||
    p(act, "bureau", "bureau_etat_civil") ||
    (commune !== "……" ? `Commune de ${commune}` : "……");
  const officer = officerName || p(act, "officer_name") || "……";
  const motherDob = parseDateParts(motherSnap?.date_naissance || "");
  const fatherDob = parseDateParts(fatherSnap?.date_naissance || "");
  const motherBirthPlace = motherSnap?.lieu_naissance || "……";
  const fatherBirthPlace = fatherSnap?.lieu_naissance || "……";
  const motherNat =
    motherSnap?.nationalite === "ETRANGER" ? "étrangère" : motherSnap?.nationalite ? "congolaise" : "congolaise";
  const fatherNat =
    fatherSnap?.nationalite === "ETRANGER" ? "étranger" : fatherSnap?.nationalite ? "congolais" : "congolais";
  const created = parseDateParts(act.created_at);
  const acteNo = act.act_number || p(act, "act_number") || "……";
  const code =
    verificationCode ||
    (typeof act.payload?.verification_code === "string" ? act.payload.verification_code : "") ||
    "—";
  const volume = p(act, "volume") || "……";
  const folio = p(act, "folio") || "……";
  const hour = (() => {
    const d = new Date(act.created_at);
    if (Number.isNaN(d.getTime())) return "……";
    return `${String(d.getHours()).padStart(2, "0")} h ${String(d.getMinutes()).padStart(2, "0")}`;
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

  const residence = [quartier, commune].filter(Boolean).join(", ") || commune || place;

  return (
    <div className="birth-acte print-area">
      <div className="birth-acte-watermark" aria-hidden>
        ACTE DE NAISSANCE
      </div>
      <header className="birth-acte-head">
        <div className="birth-acte-head-left">
          <p className="birth-acte-state">RÉPUBLIQUE DÉMOCRATIQUE DU CONGO</p>
          <p className="birth-acte-brand">SIGPOP-RDC — Système intégré de gouvernance de la population</p>
          <p>Province de <u>{province}</u></p>
          <p>Ville de <u>{ville}</u></p>
          <p>Territoire de <u>{district}</u></p>
          <p>Territoire / Secteur ou Cité de <u>{commune}</u></p>
          <p>Chefferie / secteur ou Cité de <u>{quartier || commune}</u></p>
          <p>Bureau Principal de l&apos;État civil de <u>{bureau}</u></p>
          <p>Bureau secondaire de l&apos;État civil de <u>……</u></p>
          <p>
            Acte n° <strong>{acteNo}</strong> &nbsp; Volume <u>{volume}</u> &nbsp; Folio n° <u>{folio}</u>
          </p>
          <p className="birth-acte-ref">
            N° registre {act.act_number} · Contrôle {code}
          </p>
        </div>
        <div className="birth-acte-head-right">
          <div className="birth-acte-volet">Volet</div>
          <img className="birth-acte-flag" src="/flag-rdc.svg" alt="Drapeau RDC" onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }} />
          <div className="birth-acte-flag-fallback" aria-hidden />
          <div className="birth-acte-diag">{String(Math.abs(hashCode(act.id || act.act_number)) % 9000 + 1000).padStart(4, "0")}</div>
        </div>
      </header>

      <h1 className="birth-acte-title">ACTE DE NAISSANCE</h1>
      {p(act, "mode", "type_naissance") ? (
        <p className="birth-acte-subtitle muted small">{p(act, "mode", "type_naissance")}</p>
      ) : null}

      <div className="birth-acte-body">
        <p>
          L&apos;an deux mille <u>{created.yw.replace(/^deux mille\s*/i, "") || created.y}</u> le{" "}
          <u>{created.d}</u> jour du mois de <u>{created.m}</u> à <u>{hour}</u>.
        </p>
        <p>
          Par devant nous <u>{officer}</u>, Officier de l&apos;État civil de <u>{bureau}</u>
        </p>
        <p>
          A comparu <u>{declarant}</u> en qualité de <u>{qualite}</u>
        </p>
        <p>
          Né(e) à <u>{motherBirthPlace}</u> le{" "}
          <u>{motherSnap?.date_naissance ? `${motherDob.d} ${motherDob.m} ${motherDob.y}` : "……"}</u> Profession{" "}
          <u>……</u>
        </p>
        <p>
          Résident à <u>{residence}</u>
        </p>
        <p>Lequel (laquelle) nous a déclaré ce qui suit :</p>
        <p>
          Le <u>{dob.d}</u> jour du mois de <u>{dob.m}</u> de l&apos;année <u>{dob.y}</u> est né à{" "}
          <u>{place}</u> un enfant de sexe <u>{sexLabel}</u> nommé <u>{childName}</u>
        </p>
        <p>
          {childRelation} de <u>{father}</u> né à <u>{fatherBirthPlace}</u> le{" "}
          <u>{fatherSnap?.date_naissance ? `${fatherDob.d} ${fatherDob.m} ${fatherDob.y}` : "……"}</u> nationalité{" "}
          <u>{fatherNat}</u> profession <u>……</u> résident à <u>{residence}</u> et de
        </p>
        <p>
          <u>{mother}</u> né(e) à <u>{motherBirthPlace}</u> le{" "}
          <u>{motherSnap?.date_naissance ? `${motherDob.d} ${motherDob.m} ${motherDob.y}` : "……"}</u> nationalité{" "}
          <u>{motherNat}</u> profession <u>……</u> résidents à <u>{residence}</u> conjoints.
        </p>
        <p>
          Lecture de l&apos;acte a été faite ou connaissance de l&apos;acte a été donnée ou traduction de
          l&apos;acte a été faite en <u>français</u>, langue que nous connaissons.
        </p>
        <p>En foi de quoi, avons dressé le présent acte :</p>
      </div>

      <footer className="birth-acte-foot">
        <div>
          <strong>Le déclarant</strong>
          <div className="birth-acte-sign" />
          <p className="muted small">{declarant}</p>
        </div>
        <div>
          <strong>L&apos;Officier de l&apos;État civil</strong>
          <div className="birth-acte-sign" />
          <p className="muted small">{officer}</p>
        </div>
        <div className="birth-acte-qr">
          <QRCodeSVG value={qrValue} size={96} includeMargin />
          <span className="muted small">Contrôle QR</span>
        </div>
      </footer>
      <p className="birth-acte-notes muted small">
        (*) Préciser le nom et qualité &nbsp;·&nbsp; (*) Omettre les mentions inutiles
      </p>
    </div>
  );
}

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h;
}
