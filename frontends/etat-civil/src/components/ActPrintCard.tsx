import { QRCodeSVG } from "qrcode.react";
import { getSession } from "../auth";
import { getOfficerCommune } from "../commune";
import { actTypeLabel, type Act } from "../registry";
import BirthCertificatePrint from "./BirthCertificatePrint";

type Props = {
  act: Act;
  title?: string;
  extraFields?: { label: string; value: string }[];
  verificationCode?: string | null;
  mentions?: { label: string; value: string }[];
};

/** Affiche un libellé lisible pour les objets géo (évite le JSON brut). */
function formatPayloadValue(key: string, value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "object" && !Array.isArray(value)) {
    const o = value as Record<string, unknown>;
    if (typeof o.label === "string" && o.label.trim()) return o.label.trim();
    const parts = [
      o.province_name,
      o.ville_name,
      o.district_name,
      o.commune_name,
      o.localite_name,
      o.quartier_name,
      o.avenue_name ? `Av. ${o.avenue_name}` : null,
      o.rue_name ? `Rue ${o.rue_name}` : null,
    ]
      .map((x) => (typeof x === "string" ? x.trim() : ""))
      .filter(Boolean);
    if (parts.length) return parts.join(" · ");
    // Ne pas afficher le JSON technique (ids UUID, etc.)
    if (key.startsWith("geo_")) return null;
    return null;
  }
  const s = String(value).trim();
  return s || null;
}

function fieldLabel(key: string): string {
  const labels: Record<string, string> = {
    geo_enregistrement: "Lieu d'enregistrement",
    lieu_enregistrement: "Lieu d'enregistrement",
    geo_deces: "Lieu du décès",
    lieu_deces: "Lieu du décès",
    geo_enterrement: "Lieu d'enterrement",
    lieu_enterrement: "Lieu d'enterrement",
    geo_naissance: "Lieu de naissance",
    lieu_naissance: "Lieu de naissance",
    geo_actuelle: "Adresse actuelle",
    cause_deces: "Cause du décès",
    date_deces: "Date du décès",
    date_enterrement: "Date d'enterrement",
    cimetiere: "Cimetière",
    deceased_name: "Défunt",
    responsable_name: "Responsable",
  };
  return labels[key] ?? key.replace(/_/g, " ");
}

export default function ActPrintCard({
  act,
  title,
  extraFields,
  verificationCode,
  mentions,
}: Props) {
  if (act.type === "BIRTH") {
    const session = getSession();
    const commune = getOfficerCommune();
    const auth =
      act.payload?.authentication && typeof act.payload.authentication === "object"
        ? (act.payload.authentication as Record<string, unknown>)
        : null;
    const officerName =
      (typeof auth?.officer_name === "string" && auth.officer_name.trim()) ||
      session?.displayName ||
      (typeof act.payload.officer_name === "string" ? act.payload.officer_name : undefined);
    const bureauLabel =
      (typeof act.payload.bureau === "string" && act.payload.bureau.trim()) ||
      (typeof act.payload.bureau_etat_civil === "string" && act.payload.bureau_etat_civil.trim()) ||
      `Commune de ${commune.name}`;
    return (
      <BirthCertificatePrint
        act={act}
        verificationCode={verificationCode}
        officerName={officerName}
        bureauLabel={bureauLabel}
      />
    );
  }
  const auth =
    act.payload?.authentication && typeof act.payload.authentication === "object"
      ? (act.payload.authentication as Record<string, unknown>)
      : null;

  const payloadEntries =
    extraFields ??
    (() => {
      const entries = Object.entries(act.payload).filter(([k, v]) => {
        if (k === "authentication" || k === "qr" || k === "verification_code") return false;
        if (k.endsWith("_id") && typeof v === "string" && v.length > 20) return false;
        // Évite doublon lieu_* + geo_* : on privilégie le libellé formaté.
        if (k.startsWith("geo_") && act.payload[`lieu_${k.slice(4)}`]) return false;
        return formatPayloadValue(k, v) !== null;
      });
      return entries.slice(0, 14).map(([k, v]) => ({
        label: fieldLabel(k),
        value: formatPayloadValue(k, v)!,
      }));
    })();

  const serverQr = act.payload?.qr;
  let qrValue = act.qr_payload;
  if (serverQr && typeof serverQr === "object") {
    qrValue = JSON.stringify(serverQr);
  } else {
    try {
      qrValue = JSON.stringify(JSON.parse(act.qr_payload));
    } catch {
      qrValue = JSON.stringify(act.qr_payload);
    }
  }

  const code =
    verificationCode ||
    (typeof act.payload?.verification_code === "string" ? act.payload.verification_code : null);

  return (
    <div className="act-print-card print-area">
      <div className="act-print-header">
        <img src="/logo-rdc.jpg" alt="RDC" />
        <div>
          <strong>République Démocratique du Congo</strong>
          <div>SIGPOP-RDC · État civil</div>
          <div>{title ?? `Extrait — ${actTypeLabel(act.type)}`}</div>
        </div>
      </div>
      <div className="act-print-body">
        <div className="act-print-meta">
          <div>
            <span className="muted">N° d&apos;acte</span>
            <strong>{act.act_number}</strong>
          </div>
          <div>
            <span className="muted">ID naissance</span>
            <strong>{act.national_id}</strong>
          </div>
          <div>
            <span className="muted">Type</span>
            <strong>{actTypeLabel(act.type)}</strong>
          </div>
          <div>
            <span className="muted">Émis le</span>
            <strong>{new Date(act.created_at).toLocaleString("fr-CD")}</strong>
          </div>
        </div>
        <dl className="act-print-fields">
          {payloadEntries.map((f) => (
            <div key={f.label}>
              <dt>{f.label}</dt>
              <dd>{f.value}</dd>
            </div>
          ))}
        </dl>
        {auth ? (
          <div className="act-print-meta" style={{ marginTop: "0.75rem" }}>
            <div>
              <span className="muted">Officier</span>
              <strong>{String(auth.officer_name ?? "—")}</strong>
            </div>
            <div>
              <span className="muted">Matricule / fonction</span>
              <strong>{String(auth.officer_matricule ?? "—")}</strong>
            </div>
            <div>
              <span className="muted">Cachet</span>
              <strong>{String(auth.seal_ref ?? "—")}</strong>
            </div>
            <div>
              <span className="muted">Signature</span>
              <strong>{String(auth.signature_ref ?? "—")}</strong>
            </div>
          </div>
        ) : null}
        {code ? (
          <p className="muted small" style={{ marginTop: "0.5rem" }}>
            Code de vérification : <code>{code}</code>
          </p>
        ) : null}
        {mentions && mentions.length > 0 ? (
          <div style={{ marginTop: "0.75rem" }}>
            <strong className="muted small">Mentions marginales</strong>
            <ul className="muted small" style={{ margin: "0.25rem 0 0", paddingLeft: "1.1rem" }}>
              {mentions.map((m) => (
                <li key={`${m.label}-${m.value}`}>
                  {m.label} : {m.value}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="act-print-qr">
          <QRCodeSVG value={qrValue} size={128} includeMargin />
          <span className="muted small">Contrôle QR</span>
        </div>
      </div>
    </div>
  );
}
