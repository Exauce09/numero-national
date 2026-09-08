import { useState } from "react";
import { api } from "../../api";

const CHECKLIST = [
  "APP_ENV=production",
  "ALLOW_DEV_AUTH_HEADERS=false",
  "ALLOW_OPEN_REGISTRATION=false",
  "SECRET_KEY / JWT / MFA / QR keys distincts + KMS",
  "REDIS_URL obligatoire multi-instance",
  "TLS terminé au reverse-proxy",
  "Backups PostgreSQL + tests restore",
  "MFA TOTP activé pour les comptes administrateurs",
];

export default function ConfigPage() {
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    setBusy(true);
    setMsg(null);
    setError(null);
    try {
      const res = await api.analyticsRefresh();
      setMsg(`Rafraîchissement OK — période ${res.period}, ${res.updated} métriques.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec du rafraîchissement");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h2 className="page-title">Configuration système</h2>
      <p className="page-lead">Analytics, MFA et checklist de production (cahier des charges).</p>

      <div className="panel" style={{ marginBottom: "1.25rem" }}>
        <h3 style={{ marginTop: 0 }}>Pipeline analytics</h3>
        <p className="muted">
          Recalcule les agrégats nationaux sans exposer de données personnelles.
        </p>
        <button
          type="button"
          className="btn-primary"
          style={{ width: "auto" }}
          disabled={busy}
          onClick={() => void refresh()}
        >
          {busy ? "Rafraîchissement…" : "Rafraîchir les agrégats"}
        </button>
        {msg ? <div className="success-banner" style={{ marginTop: "1rem" }}>{msg}</div> : null}
        {error ? <div className="login-error" style={{ marginTop: "1rem" }}>{error}</div> : null}
      </div>

      <div className="panel" style={{ marginBottom: "1.25rem" }}>
        <h3 style={{ marginTop: 0 }}>Authentification MFA</h3>
        <p>
          L&apos;API expose <code>/api/v1/auth/mfa/setup</code> et{" "}
          <code>/api/v1/auth/mfa/verify</code> (TOTP). Les comptes sensibles (admin, opérateurs
          cartes) doivent activer le second facteur avant mise en production.
        </p>
      </div>

      <div className="panel">
        <h3 style={{ marginTop: 0 }}>Checklist système</h3>
        <ul className="checklist">
          {CHECKLIST.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
