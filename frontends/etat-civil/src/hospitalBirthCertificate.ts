/** Certificat de naissance établi par l'hôpital — pièce jointe notification IT. */

export type HospitalBirthCertificate = {
  file_name: string;
  mime_type: string;
  data_url: string;
};

export const HOSPITAL_BIRTH_CERT_MAX_BYTES = 2 * 1024 * 1024;

export const HOSPITAL_BIRTH_CERT_ACCEPT =
  "application/pdf,image/jpeg,image/png,image/webp,.pdf,.jpg,.jpeg,.png,.webp";

export function hospitalBirthCertFromPayload(
  payload: Record<string, unknown>,
): HospitalBirthCertificate | null {
  const data_url = String(payload.certificat_naissance_hopital_data ?? "").trim();
  if (!data_url) return null;
  return {
    file_name: String(payload.certificat_naissance_hopital_fichier ?? "certificat-naissance.pdf"),
    mime_type: String(payload.certificat_naissance_hopital_mime ?? "application/octet-stream"),
    data_url,
  };
}

export function hospitalBirthCertPayload(
  cert: HospitalBirthCertificate | null,
): Record<string, unknown> {
  if (!cert) return {};
  return {
    certificat_naissance_hopital_fichier: cert.file_name,
    certificat_naissance_hopital_mime: cert.mime_type,
    certificat_naissance_hopital_data: cert.data_url,
  };
}

export function readHospitalBirthCertificate(file: File): Promise<HospitalBirthCertificate> {
  const allowed =
    file.type === "application/pdf" ||
    file.type === "image/jpeg" ||
    file.type === "image/png" ||
    file.type === "image/webp";
  if (!allowed) {
    return Promise.reject(
      new Error("Format accepté : PDF, JPEG, PNG ou WebP."),
    );
  }
  if (file.size > HOSPITAL_BIRTH_CERT_MAX_BYTES) {
    return Promise.reject(new Error("Fichier trop volumineux (max. 2 Mo)."));
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const data_url = String(reader.result ?? "");
      if (!data_url.startsWith("data:")) {
        reject(new Error("Lecture du fichier impossible."));
        return;
      }
      resolve({
        file_name: file.name,
        mime_type: file.type || "application/octet-stream",
        data_url,
      });
    };
    reader.onerror = () => reject(new Error("Lecture du fichier impossible."));
    reader.readAsDataURL(file);
  });
}

export function payloadWithoutBirthCertBlob(payload: Record<string, unknown>): Record<string, unknown> {
  const { certificat_naissance_hopital_data, ...rest } = payload;
  if (certificat_naissance_hopital_data) {
    return {
      ...rest,
      certificat_naissance_hopital_data: "[fichier joint — voir aperçu]",
    };
  }
  return rest;
}
