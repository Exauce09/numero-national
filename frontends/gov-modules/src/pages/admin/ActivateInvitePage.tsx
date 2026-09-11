import { FormEvent, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../../api";

export default function ActivateInvitePage() {
  const [params] = useSearchParams();
  const initial = useMemo(() => params.get("token") || "", [params]);
  const [token, setToken] = useState(initial);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Confirmation incorrecte.");
      return;
    }
    setBusy(true);
    try {
      await api.activateInvite(token.trim(), password);
      setOk(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Activation impossible");
    } finally {
      setBusy(false);
    }
  }

  if (ok) {
    return (
      <div className="panel" style={{ maxWidth: 480, margin: "2rem auto" }}>
        <h2 className="page-title">Compte activé</h2>
        <p>Vous pouvez maintenant vous connecter.</p>
        <Link className="btn-primary" to="/admin/login">
          Connexion administration
        </Link>
      </div>
    );
  }

  return (
    <div className="panel" style={{ maxWidth: 480, margin: "2rem auto" }}>
      <h2 className="page-title">Activation du compte</h2>
      <p className="page-lead">Définissez votre mot de passe à partir de l'invitation sécurisée.</p>
      {error ? <div className="login-error">{error}</div> : null}
      <form className="form-grid" onSubmit={onSubmit}>
        <div className="full">
          <label className="form-label">Jeton d'invitation</label>
          <input
            className="form-control"
            required
            value={token}
            onChange={(e) => setToken(e.target.value)}
          />
        </div>
        <div className="full">
          <label className="form-label">Nouveau mot de passe</label>
          <input
            className="form-control"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div className="full">
          <label className="form-label">Confirmation</label>
          <input
            className="form-control"
            type="password"
            required
            minLength={8}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>
        <div className="full">
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? "Activation…" : "Activer mon compte"}
          </button>
        </div>
      </form>
    </div>
  );
}
