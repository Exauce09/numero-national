import {
  HOSPITAL_BIRTH_CERT_ACCEPT,
  type HospitalBirthCertificate,
  readHospitalBirthCertificate,
} from "../hospitalBirthCertificate";

type Props = {
  value: HospitalBirthCertificate | null;
  onChange: (v: HospitalBirthCertificate | null) => void;
  required?: boolean;
  disabled?: boolean;
};

export default function HospitalBirthCertificateField({
  value,
  onChange,
  required,
  disabled,
}: Props) {
  async function onFile(file: File | null) {
    if (!file) {
      onChange(null);
      return;
    }
    try {
      const cert = await readHospitalBirthCertificate(file);
      onChange(cert);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Fichier invalide.");
    }
  }

  return (
    <div className="full">
      <label className="form-label">
        Certificat de naissance (établi par l&apos;hôpital)
        {required ? " *" : ""}
      </label>
      <input
        className="form-control"
        type="file"
        accept={HOSPITAL_BIRTH_CERT_ACCEPT}
        disabled={disabled}
        required={required && !value}
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null;
          void onFile(f);
          e.target.value = "";
        }}
      />
      <p className="muted small" style={{ marginTop: "0.35rem" }}>
        Joignez le certificat remis par la maternité (PDF ou photo, max. 2 Mo). Il sera transmis à
        l&apos;officier d&apos;état civil avec la notification.
      </p>
      {value ? (
        <div className="panel" style={{ marginTop: "0.5rem", padding: "0.65rem 0.85rem" }}>
          <p className="small" style={{ margin: 0 }}>
            <strong>{value.file_name}</strong>
            {" · "}
            {value.mime_type.includes("pdf") ? "PDF" : "Image"}
          </p>
          <div style={{ marginTop: "0.5rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <a
              className="btn-secondary btn-sm"
              style={{ width: "auto" }}
              href={value.data_url}
              download={value.file_name}
              target="_blank"
              rel="noreferrer"
            >
              Aperçu / télécharger
            </a>
            <button
              type="button"
              className="btn-secondary btn-sm"
              style={{ width: "auto" }}
              disabled={disabled}
              onClick={() => onChange(null)}
            >
              Retirer
            </button>
          </div>
          {value.mime_type.startsWith("image/") ? (
            <img
              src={value.data_url}
              alt="Certificat de naissance"
              style={{ marginTop: "0.5rem", maxWidth: "100%", maxHeight: 220, borderRadius: 4 }}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
