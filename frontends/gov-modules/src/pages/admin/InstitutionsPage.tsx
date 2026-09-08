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

export default function InstitutionsPage() {
  const [rows, setRows] = useState<Institution[]>([]);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState("MINISTRY");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

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

  return (
    <div>
      <h2 className="page-title">Institutions</h2>
      <p className="page-lead">Référentiel des organismes rattachés au système.</p>
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
