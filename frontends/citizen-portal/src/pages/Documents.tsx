import { FormEvent, useMemo, useState } from "react";
import {
  UPLOADABLE_DOC_TYPES,
  docStatusLabel,
  getCitizenProfile,
  submitDocumentUpload,
  type CitizenDocument,
  type CitizenProfile,
  type RequiredDocType,
} from "../citizenProfile";

export default function DocumentsPage() {
  const [profile, setProfile] = useState<CitizenProfile>(() => getCitizenProfile());
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [docType, setDocType] = useState<RequiredDocType>("ATTESTATION_RESIDENCE");
  const [note, setNote] = useState("");
  const [fileName, setFileName] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const docs = useMemo(
    () => [...profile.documents].sort((a, b) => a.order - b.order),
    [profile.documents],
  );

  const missing = docs.filter((d) => d.status === "MANQUANT");
  const pending = docs.filter((d) => d.status === "EN_ATTENTE");

  function statusColor(d: CitizenDocument): string {
    switch (d.status) {
      case "PRESENT":
        return "#1a5f4a";
      case "EN_ATTENTE":
        return "#8a6d1a";
      case "REJETE":
        return "#8a1a1a";
      default:
        return "#8a4b1a";
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    if (!file || !fileName) {
      setError("Sélectionnez un fichier à déposer.");
      return;
    }
    if (file.size > 2_500_000) {
      setError("Fichier trop volumineux (max. 2,5 Mo pour la démo).");
      return;
    }
    try {
      const { profile: next, request } = submitDocumentUpload({
        docType,
        fileName: file.name || fileName,
        note,
      });
      setProfile(next);
      setMessage(
        `« ${request.doc_label} » transmis à l'état civil (réf. ${request.id.slice(0, 8)}). L'officier a été notifié.`,
      );
      setNote("");
      setFile(null);
      setFileName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Envoi impossible.");
    }
  }

  return (
    <div>
      <div className="eg-page-head">
        <div>
          <h2 className="page-title">Documents</h2>
          <p className="page-lead">
            Liste ordonnée de vos pièces, documents manquants, et dépôt pour compléter le dossier auprès de
            l&apos;état civil.
          </p>
        </div>
      </div>

      {message ? <div className="success-banner">{message}</div> : null}
      {error ? <div className="login-error">{error}</div> : null}

      <div className="metrics-row" style={{ marginBottom: "1rem" }}>
        <div className="metric-card">
          <span className="muted small">Total</span>
          <strong>{docs.length}</strong>
        </div>
        <div className="metric-card">
          <span className="muted small">Manquants</span>
          <strong>{missing.length}</strong>
        </div>
        <div className="metric-card">
          <span className="muted small">En attente</span>
          <strong>{pending.length}</strong>
        </div>
      </div>

      <div className="panel">
        <h3 className="panel-title">Dossier (ordre officiel)</h3>
        <table className="data-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Document</th>
              <th>Obligatoire</th>
              <th>Statut</th>
              <th>Fichier / note</th>
            </tr>
          </thead>
          <tbody>
            {docs.map((d) => (
              <tr key={d.id}>
                <td>{d.order}</td>
                <td>{d.label}</td>
                <td>{d.required ? "Oui" : "Non"}</td>
                <td>
                  <strong style={{ color: statusColor(d) }}>{docStatusLabel(d.status)}</strong>
                </td>
                <td className="muted small">
                  {d.file_name || d.note || d.issued_at || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {missing.length > 0 ? (
        <div className="panel" style={{ marginTop: "1rem" }}>
          <h3 className="panel-title">Ce qui manque</h3>
          <ul style={{ margin: 0, paddingLeft: "1.1rem" }}>
            {missing.map((d) => (
              <li key={d.id}>
                <strong>{d.label}</strong>
                {d.required ? " (obligatoire)" : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="panel" style={{ marginTop: "1rem" }}>
        <h3 className="panel-title">Ajouter / déposer un document</h3>
        <p className="muted" style={{ marginTop: 0 }}>
          Le dépôt notifie automatiquement l&apos;officier d&apos;état civil pour compléter votre dossier.
        </p>
        <form className="form-grid" onSubmit={onSubmit}>
          <div>
            <label className="form-label">Type de document</label>
            <select
              className="form-control"
              value={docType}
              onChange={(e) => setDocType(e.target.value as RequiredDocType)}
            >
              {UPLOADABLE_DOC_TYPES.map((t) => (
                <option key={t.type} value={t.type}>
                  {t.label}
                  {t.required ? " *" : ""}
                </option>
              ))}
              <option value="AUTRE">Autre</option>
            </select>
          </div>
          <div>
            <label className="form-label">Fichier</label>
            <input
              className="form-control"
              type="file"
              accept=".pdf,image/*"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                setFile(f);
                setFileName(f?.name ?? "");
              }}
              required
            />
          </div>
          <div className="full">
            <label className="form-label">Note (optionnel)</label>
            <input
              className="form-control"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Précision pour l'officier…"
            />
          </div>
          <div className="full">
            <button type="submit" className="btn-primary" style={{ width: "auto", minWidth: 200 }}>
              Déposer et notifier l&apos;état civil
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
