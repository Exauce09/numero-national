import { QRCodeSVG } from "qrcode.react";
import { actTypeLabel, type Act } from "../registry";

type Props = {
  act: Act;
  title?: string;
  extraFields?: { label: string; value: string }[];
};

export default function ActPrintCard({ act, title, extraFields }: Props) {
  const payloadEntries =
    extraFields ??
    Object.entries(act.payload)
      .filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== "")
      .slice(0, 10)
      .map(([k, v]) => ({
        label: k.replace(/_/g, " "),
        value: typeof v === "object" ? JSON.stringify(v) : String(v),
      }));

  let qrValue = act.qr_payload;
  try {
    qrValue = JSON.stringify(JSON.parse(act.qr_payload));
  } catch {
    qrValue = JSON.stringify(act.qr_payload);
  }

  return (
    <div className="act-print-card print-area">
      <div className="act-print-header">
        <img src="/logo-rdc.jpg" alt="RDC" />
        <div>
          <strong>République Démocratique du Congo</strong>
          <div>E-GOUV · État civil communal</div>
          <div>{title ?? `Acte de ${actTypeLabel(act.type)}`}</div>
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
        <div className="act-print-qr">
          <QRCodeSVG value={qrValue} size={128} includeMargin />
          <span className="muted small">Contrôle QR</span>
        </div>
      </div>
    </div>
  );
}
