import { FormEvent, useState } from "react";
import PersonPicker from "../components/PersonPicker";
import { displayName, type Person } from "../registry";
import { getHealthSession } from "../healthAuth";
import { listFacilityDeclarations, notifyEtatCivil } from "../civilDeclarations";
import { pushHealthNotification } from "../healthPrefs";

export default function HealthDeathsPage() {
  const session = getHealthSession()!;
  const [deceased, setDeceased] = useState<Person | null>(null);
  const [responsable, setResponsable] = useState<Person | null>(null);
  const [dateDeces, setDateDeces] = useState("");
  const [cause, setCause] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, bump] = useState(0);
  const rows = listFacilityDeclarations(session.facilityId).filter((d) => d.declaration_type === "DEATH");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    if (!deceased) {
      setError("La personne décédée est obligatoire (recherche ou ajout).");
      return;
    }
    if (!dateDeces || !cause.trim()) {
      setError("Date et cause du décès sont requis.");
      return;
    }
    const decl = await notifyEtatCivil({
      type: "DEATH",
      facilityName: session.facilityName,
      payload: {
        facility_id: session.facilityId,
        facility_name: session.facilityName,
        commune_code: session.commune_code,
        commune_name: session.commune_name,
        deceased_id: deceased.id,
        deceased_nic: deceased.nic,
        deceased_name: displayName(deceased),
        sexe: deceased.sexe,
        date_deces: dateDeces,
        cause_deces: cause.trim(),
        lieu_deces: session.facilityName,
        responsable_id: responsable?.id ?? null,
        responsable_nic: responsable?.nic ?? null,
        responsable_name: responsable ? displayName(responsable) : null,
      },
    });
    pushHealthNotification({
      title: "Décès notifié à l'état civil",
      body: `${displayName(deceased)} — en attente de validation officier (réf. ${decl.id.slice(0, 8)}).`,
      href: "/sante/deaths",
    });
    setMessage(
      `Enregistrement transmis à l'état civil pour validation (réf. ${decl.id.slice(0, 8)}). L'officier a été notifié.`,
    );
    setDeceased(null);
    setResponsable(null);
    setDateDeces("");
    setCause("");
    bump((n) => n + 1);
  }

  return (
    <div>
      <h2 className="page-title">Décès</h2>
      <p className="page-lead">
        Enregistrement à la structure sanitaire — transmission et notification automatiques vers l&apos;état civil.
      </p>
      <div className="panel">
        <form className="form-grid" onSubmit={onSubmit}>
          {error ? <div className="login-error full">{error}</div> : null}
          {message ? <div className="success-banner full">{message}</div> : null}
          <div className="full">
            <PersonPicker label="Nom du défunt" value={deceased} onChange={setDeceased} required />
          </div>
          <div className="full">
            <PersonPicker label="Responsable" value={responsable} onChange={setResponsable} />
          </div>
          <div>
            <label className="form-label">Date du décès</label>
            <input
              className="form-control"
              type="date"
              value={dateDeces}
              onChange={(e) => setDateDeces(e.target.value)}
              required
            />
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
              <th>Responsable</th>
              <th>Date</th>
              <th>Statut état civil</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.id}>
                <td>{String(d.payload.deceased_name ?? "—")}</td>
                <td>{String(d.payload.responsable_name ?? "—")}</td>
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
