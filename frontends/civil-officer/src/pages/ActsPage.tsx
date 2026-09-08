import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import ActPrintCard from "../components/ActPrintCard";
import DataToolbar from "../components/DataToolbar";
import {
  actTypeLabel,
  getAct,
  listActs,
  updateAct,
  type Act,
  type ActType,
} from "../registry";

const TYPES: Array<ActType | ""> = [
  "",
  "BIRTH",
  "DEATH",
  "CENSUS",
  "MARRIAGE",
  "ADOPTION",
  "DISPLACEMENT",
  "DIVORCE",
  "DOCUMENT",
];

export default function ActsPage() {
  const [params, setParams] = useSearchParams();
  const [filter, setFilter] = useState<ActType | "">("");
  const [viewAct, setViewAct] = useState<Act | null>(null);
  const [editAct, setEditAct] = useState<Act | null>(null);
  const [editJson, setEditJson] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const acts = useMemo(
    () => (filter ? listActs(filter) : listActs()),
    [filter, tick]
  );

  useEffect(() => {
    const editId = params.get("edit");
    if (!editId) return;
    const act = getAct(editId);
    if (act) {
      setEditAct(act);
      setEditJson(JSON.stringify(act.payload, null, 2));
    }
    params.delete("edit");
    setParams(params, { replace: true });
  }, [params, setParams]);

  function saveEdit() {
    if (!editAct) return;
    try {
      const payload = JSON.parse(editJson) as Record<string, unknown>;
      updateAct(editAct.id, { payload });
      setEditAct(null);
      setTick((n) => n + 1);
      setError(null);
    } catch {
      setError("JSON invalide.");
    }
  }

  const rows = acts.map((a) => ({
    act_number: a.act_number,
    type: a.type,
    national_id: a.national_id,
    created_at: a.created_at,
  }));

  return (
    <div>
      <h2 className="page-title">Actes</h2>
      <p className="page-lead">Liste complète des actes du registre local.</p>

      <div className="panel">
        <div className="panel-head">
          <div className="toolbar" style={{ marginBottom: 0 }}>
            <div>
              <label className="form-label">Filtrer par type</label>
              <select
                className="form-control"
                value={filter}
                onChange={(e) => setFilter(e.target.value as ActType | "")}
              >
                <option value="">Tous</option>
                {TYPES.filter(Boolean).map((t) => (
                  <option key={t} value={t}>
                    {actTypeLabel(t as ActType)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <DataToolbar filename="tous_actes" rows={rows} />
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th>N°</th>
              <th>Type</th>
              <th>NIC</th>
              <th>Créé</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {acts.length === 0 ? (
              <tr>
                <td colSpan={5} className="muted">
                  Aucun acte.
                </td>
              </tr>
            ) : (
              acts.map((a) => (
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
                    <button
                      type="button"
                      className="btn-secondary btn-sm"
                      onClick={() => {
                        setEditAct(a);
                        setEditJson(JSON.stringify(a.payload, null, 2));
                      }}
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

      {editAct ? (
        <div className="modal-backdrop" onClick={() => setEditAct(null)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <h3>Modifier l&apos;acte {editAct.act_number}</h3>
            {error ? <div className="login-error">{error}</div> : null}
            <textarea
              className="form-control code-area"
              value={editJson}
              onChange={(e) => setEditJson(e.target.value)}
            />
            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={() => setEditAct(null)}>
                Annuler
              </button>
              <button type="button" className="btn-primary" style={{ width: "auto" }} onClick={saveEdit}>
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
