import { FormEvent, useEffect, useState } from "react";
import { api, type Institution } from "../../api";

const TYPES = [
  "MINISTRY",
  "COMMUNE",
  "HOSPITAL",
  "ONIP",
  "PRESIDENCY",
  "PRIMATURE",
  "ORGANIZATION",
  "RELYING_PARTY",
  "OTHER",
];

const ROLE_BY_TYPE: Record<string, string> = {
  HOSPITAL: "HEALTH_AGENT",
  MINISTRY: "MINISTRY_STATS",
  COMMUNE: "CIVIL_OFFICER",
  ONIP: "ONIP_OPS",
  PRESIDENCY: "PRESIDENCY_VIEW",
  PRIMATURE: "PRIMATURE_VIEW",
};

export default function InstitutionsPage() {
  const [rows, setRows] = useState<Institution[]>([]);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState("MINISTRY");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [acctInstId, setAcctInstId] = useState("");
  const [acctEmail, setAcctEmail] = useState("");
  const [acctPassword, setAcctPassword] = useState("");
  const [acctName, setAcctName] = useState("");

  async function refresh() {
    setRows(await api.institutionsList());
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(null);
    try {
      await api.institutionsCreate({ code: code.trim(), name: name.trim(), type });
      setOk("Institution créée.");
      setCode("");
      setName("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Création impossible");
    }
  }

  async function onCreateAccount(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(null);
    const inst = rows.find((r) => r.id === acctInstId);
    if (!inst) {
      setError("Choisissez une institution.");
      return;
    }
    try {
      await api.registerUser({
        email: acctEmail.trim(),
        password: acctPassword,
        full_name: acctName.trim() || inst.name,
        institution_id: inst.id,
        role_codes: [ROLE_BY_TYPE[inst.type] ?? "CITIZEN"],
      });
      setOk(`Compte créé pour ${inst.name} (${acctEmail.trim()}).`);
      setAcctEmail("");
      setAcctPassword("");
      setAcctName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Création de compte impossible");
    }
  }

  return (
    <div>
      <h2 className="page-title">Institutions</h2>
      <p className="page-lead">
        Référentiel des organismes. Créez l&apos;institution puis un compte de connexion rattaché.
      </p>
      {error ? <div className="login-error">{error}</div> : null}
      {ok ? <div className="success-banner">{ok}</div> : null}

      <div className="panel" style={{ marginBottom: "1.25rem" }}>
        <h3 style={{ marginTop: 0 }}>Créer une institution</h3>
        <form className="form-grid" onSubmit={onCreate}>
          <div>
            <label className="form-label" htmlFor="inst_code">
              Code
            </label>
            <input
              id="inst_code"
              className="form-control"
              required
              minLength={2}
              value={code}
              onChange={(ev) => setCode(ev.target.value)}
            />
          </div>
          <div>
            <label className="form-label" htmlFor="inst_name">
              Nom
            </label>
            <input
              id="inst_name"
              className="form-control"
              required
              value={name}
              onChange={(ev) => setName(ev.target.value)}
            />
          </div>
          <div>
            <label className="form-label" htmlFor="inst_type">
              Type
            </label>
            <select
              id="inst_type"
              className="form-control"
              value={type}
              onChange={(ev) => setType(ev.target.value)}
            >
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="full">
            <button type="submit" className="btn-primary" style={{ width: "auto" }}>
              Créer
            </button>
          </div>
        </form>
      </div>

      <div className="panel" style={{ marginBottom: "1.25rem" }}>
        <h3 style={{ marginTop: 0 }}>Créer un compte pour une institution</h3>
        <form className="form-grid" onSubmit={onCreateAccount}>
          <div className="full">
            <label className="form-label" htmlFor="acct_inst">
              Institution
            </label>
            <select
              id="acct_inst"
              className="form-control"
              required
              value={acctInstId}
              onChange={(ev) => setAcctInstId(ev.target.value)}
            >
              <option value="">Choisir…</option>
              {rows.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.code} — {i.name} ({i.type})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label" htmlFor="acct_email">
              Email de connexion
            </label>
            <input
              id="acct_email"
              className="form-control"
              type="email"
              required
              value={acctEmail}
              onChange={(ev) => setAcctEmail(ev.target.value)}
            />
          </div>
          <div>
            <label className="form-label" htmlFor="acct_password">
              Mot de passe
            </label>
            <input
              id="acct_password"
              className="form-control"
              type="password"
              required
              minLength={8}
              value={acctPassword}
              onChange={(ev) => setAcctPassword(ev.target.value)}
            />
          </div>
          <div>
            <label className="form-label" htmlFor="acct_name">
              Nom affiché
            </label>
            <input
              id="acct_name"
              className="form-control"
              value={acctName}
              onChange={(ev) => setAcctName(ev.target.value)}
            />
          </div>
          <div className="full">
            <button type="submit" className="btn-primary" style={{ width: "auto" }}>
              Créer le compte
            </button>
          </div>
        </form>
      </div>

      <div className="panel">
        <table className="data-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Nom</th>
              <th>Type</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((i) => (
              <tr key={i.id}>
                <td>{i.code}</td>
                <td>{i.name}</td>
                <td>{i.type}</td>
                <td>{i.status}</td>
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td colSpan={4} className="muted">
                  Aucune institution.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
