import { FormEvent, useState } from "react";
import { api } from "../api";

export default function TranscriptionsPage() {
  const [sourceActRef, setSourceActRef] = useState("");
  const [sourcePlace, setSourcePlace] = useState("");
  const [sourceAuthority, setSourceAuthority] = useState("");
  const [sourceDate, setSourceDate] = useState("");
  const [sourceNumber, setSourceNumber] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<Record<string, unknown> | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(null);
    setCreated(null);
    if (!sourceActRef.trim()) {
      setError("La référence de l'acte source est obligatoire.");
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
      });
      setCreated(row);
      setOk(`Transcription enregistrée — ${String(row.id ?? "").slice(0, 8)}`);
      setSourceActRef("");
      setSourcePlace("");
      setSourceAuthority("");
      setSourceDate("");
      setSourceNumber("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Enregistrement impossible.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h2 className="page-title">Transcriptions</h2>
      <p className="page-lead">
        Transcription d&apos;un acte établi ailleurs (autre commune / autorité) dans le registre local.
      </p>
      <div className="panel">
        <form className="form-grid" onSubmit={onSubmit}>
          {error ? <div className="login-error full">{error}</div> : null}
          {ok ? <div className="success-banner full">{ok}</div> : null}
          <div className="full">
            <label className="form-label">Référence acte source</label>
            <input
              className="form-control"
              value={sourceActRef}
              onChange={(e) => setSourceActRef(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="form-label">Lieu source</label>
            <input className="form-control" value={sourcePlace} onChange={(e) => setSourcePlace(e.target.value)} />
          </div>
          <div>
            <label className="form-label">Autorité source</label>
            <input
              className="form-control"
              value={sourceAuthority}
              onChange={(e) => setSourceAuthority(e.target.value)}
            />
          </div>
          <div>
            <label className="form-label">Date source</label>
            <input
              className="form-control"
              type="date"
              value={sourceDate}
              onChange={(e) => setSourceDate(e.target.value)}
            />
          </div>
          <div>
            <label className="form-label">N° source</label>
            <input className="form-control" value={sourceNumber} onChange={(e) => setSourceNumber(e.target.value)} />
          </div>
          <div className="full">
            <button className="btn-primary" type="submit" disabled={busy} style={{ width: "auto", minWidth: 220 }}>
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
    </div>
  );
}
