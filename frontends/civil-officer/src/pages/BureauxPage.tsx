import { FormEvent, useEffect, useState } from "react";
import { api } from "../api";
import { getSession } from "../auth";

export default function BureauxPage() {
  const session = getSession();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [communeCode, setCommuneCode] = useState("");
  const [bureauType, setBureauType] = useState("PRINCIPAL");

  async function load() {
    setError(null);
    try {
      setRows(await api.listBureaux());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossible de charger les bureaux");
    }
  }

  useEffect(() => {
    if (session?.accessToken) void load();
  }, [session?.accessToken]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    try {
      await api.createBureau({
        code: code.trim(),
        name: name.trim(),
        commune_code: communeCode.trim() || null,
        bureau_type: bureauType,
      });
      setCode("");
      setName("");
      setMessage("Bureau créé.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Création impossible");
    }
  }

  if (!session?.accessToken) {
    return (
      <div className="panel">
        <p className="muted">Connectez-vous pour administrer les bureaux d&apos;état civil.</p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="page-title">Bureaux d&apos;état civil</h2>
      <p className="page-lead">
        Un bureau est rattaché au référentiel territorial (commune) — un quartier n&apos;est pas
        automatiquement un bureau.
      </p>
      {error ? <div className="login-error">{error}</div> : null}
      {message ? <div className="success-banner">{message}</div> : null}
      <form className="panel form-grid" onSubmit={onSubmit}>
        <div>
          <label className="form-label">Code *</label>
          <input className="form-control" value={code} onChange={(e) => setCode(e.target.value)} required />
        </div>
        <div>
          <label className="form-label">Nom *</label>
          <input className="form-control" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div>
          <label className="form-label">Code commune</label>
          <input
            className="form-control"
            value={communeCode}
            onChange={(e) => setCommuneCode(e.target.value)}
          />
        </div>
        <div>
          <label className="form-label">Type</label>
          <select className="form-control" value={bureauType} onChange={(e) => setBureauType(e.target.value)}>
            <option value="PRINCIPAL">Principal</option>
            <option value="SECONDAIRE">Secondaire</option>
            <option value="CONSULAIRE">Consulaire</option>
          </select>
        </div>
        <div className="full">
          <button type="submit" className="btn-primary">
            Créer le bureau
          </button>
        </div>
      </form>
      <div className="panel">
        <table className="data-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Nom</th>
              <th>Type</th>
              <th>Commune</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((b) => (
              <tr key={String(b.id)}>
                <td>{String(b.code ?? "")}</td>
                <td>{String(b.name ?? "")}</td>
                <td>{String(b.bureau_type ?? "")}</td>
                <td>{String(b.commune_code ?? "—")}</td>
                <td>{String(b.status ?? "")}</td>
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td colSpan={5} className="muted">
                  Aucun bureau.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
