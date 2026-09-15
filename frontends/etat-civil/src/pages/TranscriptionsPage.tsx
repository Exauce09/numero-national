import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import ActFormShell from "../components/ActFormShell";
import ActsDocsNav from "../components/ActsDocsNav";
import { api } from "../api";
import { getActFormSchema } from "../ecActForms";

export default function TranscriptionsPage() {
  const [typeActe, setTypeActe] = useState("NAISSANCE");
  const [sourceActRef, setSourceActRef] = useState("");
  const [sourcePlace, setSourcePlace] = useState("");
  const [sourceAuthority, setSourceAuthority] = useState("");
  const [sourceDate, setSourceDate] = useState("");
  const [sourceNumber, setSourceNumber] = useState("");
  const [legalisation, setLegalisation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<Record<string, unknown> | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(null);
    setCreated(null);
    if (!sourceActRef.trim() || !sourceAuthority.trim() || !sourceNumber.trim()) {
      setError("Type, autorité source, N° source et référence sont obligatoires.");
      return;
    }
    setBusy(true);
    try {
      const row = await api.createTranscription({
        source_act_ref: sourceActRef.trim(),
        source_place: sourcePlace.trim() || null,
        source_authority: sourceAuthority.trim() || null,
        source_date: sourceDate || null,
        source_number: sourceNumber.trim() || null,
        status: "REGISTERED",
        type_acte: typeActe,
        legalisation: legalisation.trim() || null,
      });
      setCreated(row);
      setOk(`Transcription enregistrée — ${String(row.id ?? "").slice(0, 8)}`);
      setSourceActRef("");
      setSourcePlace("");
      setSourceAuthority("");
      setSourceDate("");
      setSourceNumber("");
      setLegalisation("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Enregistrement impossible.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ActFormShell
      schema={getActFormSchema("transcription")!}
      extraLead={
        <p className="eg-breadcrumb">
          <Link to="/">Accueil</Link> / <Link to="/acts">Actes & documents</Link> / Transcriptions
        </p>
      }
    >
      <ActsDocsNav />
      <div className="panel">
        <form className="form-grid" onSubmit={(e) => void onSubmit(e)}>
          {error ? <div className="login-error full">{error}</div> : null}
          {ok ? <div className="success-banner full">{ok}</div> : null}
          <div>
            <label className="form-label">Type d&apos;acte *</label>
            <select
              className="form-control"
              value={typeActe}
              onChange={(e) => setTypeActe(e.target.value)}
            >
              <option value="NAISSANCE">Acte de naissance</option>
              <option value="MARIAGE">Acte de mariage</option>
              <option value="DECES">Acte de décès</option>
              <option value="AUTRE">Autre</option>
            </select>
          </div>
          <div>
            <label className="form-label">N° de l&apos;acte source *</label>
            <input
              className="form-control"
              value={sourceNumber}
              onChange={(e) => setSourceNumber(e.target.value)}
              required
            />
          </div>
          <div className="full">
            <label className="form-label">Référence / cote de l&apos;acte source *</label>
            <input
              className="form-control"
              value={sourceActRef}
              onChange={(e) => setSourceActRef(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="form-label">Autorité / bureau source *</label>
            <input
              className="form-control"
              value={sourceAuthority}
              onChange={(e) => setSourceAuthority(e.target.value)}
              required
              placeholder="Commune, consulat, greffe…"
            />
          </div>
          <div>
            <label className="form-label">Lieu source *</label>
            <input
              className="form-control"
              value={sourcePlace}
              onChange={(e) => setSourcePlace(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="form-label">Date de l&apos;acte source *</label>
            <input
              className="form-control"
              type="date"
              value={sourceDate}
              onChange={(e) => setSourceDate(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="form-label">Légalisation / apostille</label>
            <input
              className="form-control"
              value={legalisation}
              onChange={(e) => setLegalisation(e.target.value)}
              placeholder="Réf. si acte étranger"
            />
          </div>
          <div className="full">
            <button className="btn-primary" type="submit" disabled={busy} style={{ width: "auto", minWidth: 240 }}>
              {busy ? "Enregistrement…" : "Enregistrer la transcription"}
            </button>
          </div>
        </form>
      </div>
      {created ? (
        <div className="panel" style={{ marginTop: "1rem" }}>
          <pre className="muted small" style={{ whiteSpace: "pre-wrap" }}>
            {JSON.stringify(created, null, 2)}
          </pre>
        </div>
      ) : null}
    </ActFormShell>
  );
}
