import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import ActsDocsNav from "../components/ActsDocsNav";
import { api } from "../api";
import { getSession } from "../auth";

export default function DocumentVerifyPage() {
  const [code, setCode] = useState("");
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    try {
      setResult(await api.verifyDocument(code.trim()));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Vérification impossible");
    }
  }

  return (
    <div>
      <p className="eg-breadcrumb">
        <Link to="/">Accueil</Link> / <Link to="/acts">Actes & documents</Link> / Vérifier
      </p>
      <h2 className="page-title">Vérification de document</h2>
      <p className="page-lead">
        Contrôle d&apos;authenticité par code — sans exposer toutes les données personnelles de
        l&apos;acte.
      </p>
      <ActsDocsNav />
      {error ? <div className="login-error">{error}</div> : null}
      <form className="panel form-grid" onSubmit={onSubmit}>
        <div className="full">
          <label className="form-label">Code de vérification</label>
          <input className="form-control" value={code} onChange={(e) => setCode(e.target.value)} required />
        </div>
        <div className="full">
          <button type="submit" className="btn-primary">
            Vérifier
          </button>
        </div>
      </form>
      {result ? (
        <div className="panel">
          <p>
            <strong>{String(result.status)}</strong>
          </p>
          {result.act_number ? (
            <p className="muted">
              Type {String(result.act_type)} · n° {String(result.act_number)}
              {getSession()?.accessToken ? "" : ""}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
