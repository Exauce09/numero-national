import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import ActPrintCard from "../components/ActPrintCard";
import DataToolbar from "../components/DataToolbar";
import {
  actTypeLabel,
  ageDays,
  getAct,
  listActs,
  listPersons,
  type Act,
} from "../registry";

const CREATE_LINKS: Record<string, string> = {
  BIRTH: "/births",
  DEATH: "/deaths",
  CENSUS: "/census",
  MARRIAGE: "/marriages",
  ADOPTION: "/adoptions",
  DISPLACEMENT: "/displacements",
  DIVORCE: "/divorces",
  DOCUMENT: "/documents",
};

export default function DashboardPage() {
  const navigate = useNavigate();
  const persons = listPersons();
  const acts = listActs();
  const [viewAct, setViewAct] = useState<Act | null>(null);

  const newbornStats = useMemo(() => {
    const birthActs = listActs("BIRTH");
    const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
    let garcons = 0;
    let filles = 0;
    for (const act of birthActs) {
      const dob = String(act.payload.date_naissance ?? "");
      const createdOk = new Date(act.created_at).getTime() >= cutoff;
      const ageOk = dob ? ageDays(dob) <= 90 : false;
      if (!createdOk && !ageOk) continue;
      const sexe = String(act.payload.sexe ?? "").toUpperCase();
      if (sexe === "M") garcons += 1;
      else if (sexe === "F") filles += 1;
    }
    return { garcons, filles, total: garcons + filles };
  }, [acts.length]);

  const recent = acts.slice(0, 15);
  const toolbarRows = recent.map((a) => ({
    act_number: a.act_number,
    type: a.type,
    national_id: a.national_id,
    created_at: a.created_at,
  }));

  return (
    <div>
      <h2 className="page-title">Tableau de bord</h2>
      <p className="page-lead">
        Registre communal local · synchronisation API best-effort (KIN-GOMBE).
      </p>

      <div className="metrics-row">
        <div className="metric-card">
          <span className="muted">Personnes</span>
          <strong>{persons.length}</strong>
        </div>
        <div className="metric-card">
          <span className="muted">Actes</span>
          <strong>{acts.length}</strong>
        </div>
        <div className="metric-card">
          <span className="muted">Mariages actifs</span>
          <strong>{acts.filter((a) => a.type === "MARRIAGE").length}</strong>
        </div>
      </div>

      {newbornStats.total > 0 ? (
        <div className="panel" style={{ marginTop: "1rem" }}>
          <h3 className="panel-title">Naissances — 90 derniers jours</h3>
          <div className="metrics-row">
            <div className="metric-card">
              <span className="muted">Garçons</span>
              <strong>{newbornStats.garcons}</strong>
            </div>
            <div className="metric-card">
              <span className="muted">Filles</span>
              <strong>{newbornStats.filles}</strong>
            </div>
          </div>
        </div>
      ) : null}

      <div className="panel" style={{ marginTop: "1rem" }}>
        <div className="panel-head">
          <h3 className="panel-title">Actes récents</h3>
          <DataToolbar filename="actes_recents" rows={toolbarRows} />
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>N°</th>
              <th>Type</th>
              <th>NIC</th>
              <th>Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {recent.length === 0 ? (
              <tr>
                <td colSpan={5} className="muted">
                  Aucun acte enregistré.
                </td>
              </tr>
            ) : (
              recent.map((a) => (
                <tr key={a.id}>
                  <td>{a.act_number}</td>
                  <td>{actTypeLabel(a.type)}</td>
                  <td>{a.national_id}</td>
                  <td>{new Date(a.created_at).toLocaleString("fr-CD")}</td>
                  <td className="table-actions">
                    <button
                      type="button"
                      className="btn-secondary btn-sm"
                      onClick={() => setViewAct(getAct(a.id) ?? a)}
                    >
                      Voir
                    </button>
                    <Link className="btn-secondary btn-sm" to={CREATE_LINKS[a.type] ?? "/acts"}>
                      Créer
                    </Link>
                    <button
                      type="button"
                      className="btn-secondary btn-sm"
                      onClick={() => navigate(`/acts?edit=${a.id}`)}
                    >
                      Modifier
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {viewAct ? (
        <div className="modal-backdrop" onClick={() => setViewAct(null)}>
          <div className="modal-panel modal-wide" onClick={(e) => e.stopPropagation()}>
            <div className="modal-actions" style={{ marginBottom: "1rem" }}>
              <button type="button" className="btn-secondary" onClick={() => window.print()}>
                Imprimer
              </button>
              <button type="button" className="btn-secondary" onClick={() => setViewAct(null)}>
                Fermer
              </button>
            </div>
            <ActPrintCard act={viewAct} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
