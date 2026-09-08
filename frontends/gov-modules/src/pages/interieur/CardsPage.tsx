import { FormEvent, useState } from "react";
import { api } from "../../api";

export default function CardsPage() {
  const [citizenId, setCitizenId] = useState("");
  const [cardId, setCardId] = useState("");
  const [action, setAction] = useState("activate");
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function issue(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const data = await api.cardsIssue({ citizen_id: citizenId.trim() });
      setResult(JSON.stringify(data, null, 2));
      if (typeof data.id === "string") setCardId(data.id);
      if (typeof data.card_id === "string") setCardId(String(data.card_id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Émission impossible");
    } finally {
      setBusy(false);
    }
  }

  async function verify(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const data = await api.cardsGet(cardId.trim());
      setResult(JSON.stringify(data, null, 2));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Consultation impossible");
    } finally {
      setBusy(false);
    }
  }

  async function runAction(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const data = await api.cardsAction(cardId.trim(), action);
      setResult(JSON.stringify(data, null, 2));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action impossible");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h2 className="page-title">Cartes nationales</h2>
      <p className="page-lead">Émission, consultation et actions sur les cartes d&apos;identité.</p>

      <div className="panel" style={{ marginBottom: "1.25rem" }}>
        <h3 style={{ marginTop: 0 }}>Émettre une carte</h3>
        <form className="form-grid" onSubmit={issue}>
          <div className="full">
            <label className="form-label" htmlFor="citizen_id">
              Identifiant citoyen (UUID)
            </label>
            <input
              id="citizen_id"
              className="form-control"
              required
              value={citizenId}
              onChange={(ev) => setCitizenId(ev.target.value)}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            />
          </div>
          <button type="submit" className="btn-primary" style={{ width: "auto" }} disabled={busy}>
            Émettre
          </button>
        </form>
      </div>

      <div className="panel" style={{ marginBottom: "1.25rem" }}>
        <h3 style={{ marginTop: 0 }}>Consulter / vérifier</h3>
        <form className="form-grid" onSubmit={verify}>
          <div>
            <label className="form-label" htmlFor="card_id">
              ID carte
            </label>
            <input
              id="card_id"
              className="form-control"
              required
              value={cardId}
              onChange={(ev) => setCardId(ev.target.value)}
            />
          </div>
          <div style={{ alignSelf: "end" }}>
            <button type="submit" className="btn-secondary" disabled={busy}>
              Consulter
            </button>
          </div>
        </form>
        <form className="toolbar" onSubmit={runAction} style={{ marginTop: "0.75rem" }}>
          <select
            className="form-control"
            value={action}
            onChange={(ev) => setAction(ev.target.value)}
          >
            <option value="activate">Activer</option>
            <option value="suspend">Suspendre</option>
            <option value="report-lost">Signaler perte</option>
            <option value="revoke">Révoquer</option>
          </select>
          <button type="submit" className="btn-secondary btn-sm" disabled={busy}>
            Exécuter l&apos;action
          </button>
        </form>
      </div>

      {error ? <div className="login-error">{error}</div> : null}
      {result ? (
        <div className="panel">
          <h3 style={{ marginTop: 0 }}>Résultat</h3>
          <pre className="pre-box">{result}</pre>
        </div>
      ) : null}
    </div>
  );
}
