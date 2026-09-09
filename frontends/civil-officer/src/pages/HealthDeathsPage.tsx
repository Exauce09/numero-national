import { FormEvent, useState } from "react";
import { getHealthSession } from "../healthAuth";
import { listFacilityDeclarations, notifyEtatCivil } from "../civilDeclarations";

export default function HealthDeathsPage() {
  const session = getHealthSession()!;
  const [nom, setNom] = useState("");
  const [sexe, setSexe] = useState<"M" | "F">("M");
  const [dateDeces, setDateDeces] = useState("");
  const [cause, setCause] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, bump] = useState(0);
  const rows = listFacilityDeclarations(session.facilityId).filter((d) => d.declaration_type === "DEATH");

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    if (!nom.trim() || !dateDeces || !cause.trim()) {
      setError("Nom, date et cause du décès sont requis.");
      return;
    }
    const decl = notifyEtatCivil({
      type: "DEATH",
      facilityName: session.facilityName,
      payload: {
        facility_id: session.facilityId,
        facility_name: session.facilityName,
        commune_code: session.commune_code,
        commune_name: session.commune_name,
        deceased_name: nom.trim(),
        sexe,
        date_deces: dateDeces,
        cause_deces: cause.trim(),
        lieu_deces: session.facilityName,
      },
    });
    setMessage(`Notification envoyée à l'état civil (réf. ${decl.id.slice(0, 8)}).`);
    setNom("");
    setDateDeces("");
    setCause("");
    bump((n) => n + 1);
  }

  return (
    <div>
      <h2 className="page-title">Décès (structure sanitaire)</h2>
      <p className="page-lead">Enregistrement puis notification automatique de l&apos;officier d&apos;état civil.</p>
      <div className="panel">
        <form className="form-grid" onSubmit={onSubmit}>
          {error ? <div className="login-error full">{error}</div> : null}
          {message ? <div className="success-banner full">{message}</div> : null}
          <div className="full">
            <label className="form-label">Nom complet du défunt</label>
            <input className="form-control" value={nom} onChange={(e) => setNom(e.target.value)} required />
          </div>
          <div>
            <label className="form-label">Sexe</label>
            <select className="form-control" value={sexe} onChange={(e) => setSexe(e.target.value as "M" | "F")}>
              <option value="M">Masculin</option>
              <option value="F">Féminin</option>
            </select>
          </div>
          <div>
            <label className="form-label">Date du décès</label>
            <input className="form-control" type="date" value={dateDeces} onChange={(e) => setDateDeces(e.target.value)} required />
          </div>
          <div className="full">
            <label className="form-label">Cause</label>
            <input className="form-control" value={cause} onChange={(e) => setCause(e.target.value)} required />
          </div>
          <div className="full">
            <button className="btn-primary" type="submit" style={{ width: "auto", minWidth: 280 }}>
              Enregistrer et notifier l&apos;état civil
            </button>
          </div>
        </form>
      </div>
      <div className="panel" style={{ marginTop: "1rem" }}>
        <h3 className="panel-title">Déclarations envoyées</h3>
        <table className="data-table">
          <thead>
            <tr>
              <th>Défunt</th>
              <th>Date</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.id}>
                <td>{String(d.payload.deceased_name ?? "—")}</td>
                <td>{String(d.payload.date_deces ?? "—")}</td>
                <td>{d.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
