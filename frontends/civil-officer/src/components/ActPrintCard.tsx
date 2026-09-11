import { QRCodeSVG } from "qrcode.react";
import { actTypeLabel, type Act } from "../registry";

type Props = {
  act: Act;
  title?: string;
  extraFields?: { label: string; value: string }[];
  verificationCode?: string | null;
  mentions?: { label: string; value: string }[];
};

export default function ActPrintCard({
  act,
  title,
  extraFields,
  verificationCode,
  mentions,
}: Props) {
  const auth =
    act.payload?.authentication && typeof act.payload.authentication === "object"
      ? (act.payload.authentication as Record<string, unknown>)
      : null;

  const payloadEntries =
    extraFields ??
    Object.entries(act.payload)
      .filter(([k, v]) => {
        if (k === "authentication" || k === "qr") return false;
        return v !== null && v !== undefined && String(v).trim() !== "";
      })
      .slice(0, 10)
      .map(([k, v]) => ({
        label: k.replace(/_/g, " "),
        value: typeof v === "object" ? JSON.stringify(v) : String(v),
      }));

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
          <div>E-GOUV · État civil communal</div>
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
            <span className="muted">NIC</span>
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
