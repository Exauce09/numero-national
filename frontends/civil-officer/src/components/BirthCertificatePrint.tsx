/** Acte de naissance — mise en page officielle RDC (registre d'état civil). */

import { actTypeLabel, type Act } from "../registry";

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
  const childName =
    [p(act, "prenom", "child_given_names", "given_names"), p(act, "postnom"), p(act, "nom", "child_family_name", "family_name")]
      .filter(Boolean)
      .join(" ") || "……………………";
  const sexRaw = p(act, "sexe", "sex").toUpperCase();
  const sexLabel = sexRaw.startsWith("F") ? "féminin" : sexRaw.startsWith("M") ? "masculin" : "……";
  const dob = parseDateParts(p(act, "date_naissance", "date_of_birth", "child_dob") || act.created_at);
  const place = p(act, "lieu_naissance", "place_of_birth", "lieu_etat_civil") || "……";
  const mother =
    p(act, "mere_nom", "mother_name", "mere") ||
    [p(act, "mother_given_names"), p(act, "mother_family_name")].filter(Boolean).join(" ") ||
    "……";
  const father =
    p(act, "pere_nom", "father_name", "pere") ||
    [p(act, "father_given_names"), p(act, "father_family_name")].filter(Boolean).join(" ") ||
    "……";
  const declarant = p(act, "declarant", "declarant_name", "declarant_nom") || "……";
  const qualite = p(act, "declarant_qualite", "qualite") || "……";
  const province = p(act, "province") || "Kinshasa";
  const ville = p(act, "ville", "city") || province;
  const district = p(act, "district") || "……";
  const commune = p(act, "commune", "commune_name") || "……";
  const bureau = bureauLabel || p(act, "bureau", "bureau_etat_civil") || commune || "……";
  const officer = officerName || p(act, "officer_name") || "……";
  const created = parseDateParts(act.created_at);
  const nic =
    (act.national_id || "").replace(/\D/g, "") ||
    (p(act, "nic", "national_id") || "").replace(/\D/g, "") ||
    "——————————————";
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
          <p>District de <u>{district}</u></p>
          <p>Territoire / Secteur ou Cité de <u>{commune}</u></p>
          <p>Chefferie / secteur ou Cité de <u>{commune}</u></p>
          <p>Bureau Principal de l&apos;État civil de <u>{bureau}</u></p>
          <p>Bureau secondaire de l&apos;État civil de <u>……</u></p>
          <p>
            Acte n° <strong>{nic}</strong> &nbsp; Volume <u>{volume}</u> &nbsp; Folio n° <u>{folio}</u>
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
      <p className="birth-acte-subtitle muted small">{actTypeLabel(act.type)}</p>

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
          Né(e) à <u>{place}</u> le <u>……</u> Profession <u>……</u>
        </p>
        <p>
          Résident à <u>{commune || place}</u>
        </p>
        <p>Lequel (laquelle) nous a déclaré ce qui suit :</p>
        <p>
          Le <u>{dob.d}</u> jour du mois de <u>{dob.m}</u> de l&apos;année <u>{dob.y}</u> est né à{" "}
          <u>{place}</u> un enfant de sexe <u>{sexLabel}</u> nommé <u>{childName}</u>
        </p>
        <p>
          fils (fille) de <u>{father}</u> né à <u>……</u> le <u>……</u> nationalité <u>congolaise</u>{" "}
          profession <u>……</u> résident à <u>……</u> et de
        </p>
        <p>
          <u>{mother}</u> né(e) à <u>……</u> Le <u>……</u> nationalité <u>congolaise</u> profession{" "}
          <u>……</u> résidents à <u>……</u> conjoints.
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
        </div>
        <div>
          <strong>L&apos;Officier de l&apos;État civil</strong>
          <div className="birth-acte-sign" />
          <p className="muted small">{officer}</p>
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
