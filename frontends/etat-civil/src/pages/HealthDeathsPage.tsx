import { FormEvent, useState } from "react";
import ActFormShell from "../components/ActFormShell";
import PersonPicker from "../components/PersonPicker";
import { getActFormSchema } from "../ecActForms";
import { displayName, type Person } from "../registry";
import { getHealthSession } from "../healthAuth";
import { listFacilityDeclarations, notifyEtatCivil } from "../civilDeclarations";
import { pushHealthNotification } from "../healthPrefs";

export default function HealthDeathsPage() {
  const session = getHealthSession()!;
  const [deceased, setDeceased] = useState<Person | null>(null);
  const [declarant, setDeclarant] = useState<Person | null>(null);
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
      setError("L'identité du défunt est obligatoire.");
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
        notification_type: "DECES",
        deceased_id: deceased.id,
        deceased_nic: deceased.nic,
        deceased_name: displayName(deceased),
        sexe: deceased.sexe,
        date_deces: dateDeces,
        cause_deces: cause.trim(),
        lieu_deces: session.facilityName,
        declarant_id: declarant?.id ?? null,
        declarant_name: declarant ? displayName(declarant) : null,
        responsable_id: declarant?.id ?? null,
        responsable_nic: declarant?.nic ?? null,
        responsable_name: declarant ? displayName(declarant) : null,
      },
    });
    pushHealthNotification({
      title: "Notification de décès transmise",
      body: `${displayName(deceased)} — en attente de validation officier (réf. ${decl.id.slice(0, 8)}).`,
      href: "/sante/deaths",
    });
    setMessage(
      `Notification transmise à l'état civil (réf. ${decl.id.slice(0, 8)}). Ce n'est pas un acte officiel.`,
    );
    setDeceased(null);
    setDeclarant(null);
    setDateDeces("");
    setCause("");
    bump((n) => n + 1);
  }

  return (
    <ActFormShell schema={getActFormSchema("notif_deces")!}>
      <div className="panel">
        <form className="form-grid" onSubmit={(e) => void onSubmit(e)}>
          {error ? <div className="login-error full">{error}</div> : null}
          {message ? <div className="success-banner full">{message}</div> : null}
          <div className="full">
            <PersonPicker label="Identité du défunt *" value={deceased} onChange={setDeceased} required />
          </div>
          <div className="full">
            <PersonPicker
              label="Déclarant / responsable de la déclaration"
              value={declarant}
              onChange={setDeclarant}
            />
          </div>
          <div>
            <label className="form-label">Date du décès *</label>
            <input
              className="form-control"
              type="date"
              value={dateDeces}
              onChange={(e) => setDateDeces(e.target.value)}
              required
            />
          </div>
          <div className="full">
            <label className="form-label">Cause du décès *</label>
            <input
              className="form-control"
              value={cause}
              onChange={(e) => setCause(e.target.value)}
              required
            />
          </div>
          <div className="full">
            <button className="btn-primary" type="submit" style={{ width: "auto", minWidth: 280 }}>
              Transmettre la notification à l&apos;état civil
            </button>
          </div>
        </form>
      </div>

      <div className="panel" style={{ marginTop: "1rem" }}>
        <h3 className="panel-title">Notifications transmises</h3>
        <table className="data-table">
          <thead>
            <tr>
              <th>Défunt</th>
              <th>Date</th>
              <th>Cause</th>
              <th>Déclarant</th>
              <th>Statut EC</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.id}>
                <td>{String(d.payload.deceased_name ?? "—")}</td>
                <td>{String(d.payload.date_deces ?? "—")}</td>
                <td>{String(d.payload.cause_deces ?? "—")}</td>
                <td>{String(d.payload.declarant_name ?? d.payload.responsable_name ?? "—")}</td>
                <td>{d.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ActFormShell>
  );
}
