import { hospitalBirthCertFromPayload } from "../hospitalBirthCertificate";

export default function HospitalBirthCertificateView({
  payload,
}: {
  payload: Record<string, unknown>;
}) {
  const cert = hospitalBirthCertFromPayload(payload);
  if (!cert) {
    return <p className="muted small">Aucun certificat de naissance joint.</p>;
  }
  const isImage = cert.mime_type.startsWith("image/");
  return (
    <div className="panel" style={{ marginBottom: "1rem" }}>
      <h4 className="panel-title" style={{ marginTop: 0 }}>
        Certificat de naissance (hôpital)
      </h4>
      <p className="small" style={{ margin: "0 0 0.5rem" }}>
        <strong>{cert.file_name}</strong>
      </p>
      <a
        className="btn-secondary btn-sm"
        style={{ width: "auto" }}
        href={cert.data_url}
        download={cert.file_name}
        target="_blank"
        rel="noreferrer"
      >
        Ouvrir / télécharger
      </a>
      {isImage ? (
        <img
          src={cert.data_url}
          alt="Certificat"
          style={{ display: "block", marginTop: "0.75rem", maxWidth: "100%", maxHeight: 280 }}
        />
      ) : null}
    </div>
  );
}
