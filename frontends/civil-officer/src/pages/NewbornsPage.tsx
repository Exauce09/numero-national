/** manage-ne.php — nouveaux-nés (90 j) style e-gov. */

import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import ActPrintCard from "../components/ActPrintCard";
import DataToolbar from "../components/DataToolbar";
import { actTypeLabel, ageDays, getAct, listActs, type Act } from "../registry";

export default function NewbornsPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const initialSexe = params.get("sexe")?.toUpperCase() === "F" ? "F" : params.get("sexe")?.toUpperCase() === "M" ? "M" : "";
  const [q, setQ] = useState("");
  const [sexe, setSexe] = useState(initialSexe);
  const [viewAct, setViewAct] = useState<Act | null>(null);

  const newborns = useMemo(() => {
    const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
    return listActs("BIRTH").filter((act) => {
      const dob = String(act.payload.date_naissance ?? "");
      const createdOk = new Date(act.created_at).getTime() >= cutoff;
      const ageOk = dob ? ageDays(dob) <= 90 : false;
      if (!createdOk && !ageOk) return false;
      const s = String(act.payload.sexe ?? "").toUpperCase();
      if (sexe && s !== sexe) return false;
      const needle = q.trim().toLowerCase();
      if (!needle) return true;
      const blob = `${act.act_number} ${act.national_id} ${act.payload.nom ?? ""} ${act.payload.prenom ?? ""} ${act.payload.lieu_naissance ?? ""}`.toLowerCase();
      return blob.includes(needle);
    });
  }, [q, sexe]);

  const exportRows = newborns.map((a) => ({
    act_number: a.act_number,
    nic: a.national_id,
    nom: String(a.payload.nom ?? ""),
    prenom: String(a.payload.prenom ?? ""),
    sexe: String(a.payload.sexe ?? ""),
    date_naissance: String(a.payload.date_naissance ?? ""),
    lieu_naissance: String(a.payload.lieu_naissance ?? ""),
  }));

  return (
    <div>
      <div className="eg-page-head">
        <div>
          <p className="eg-breadcrumb">
            <Link to="/">Accueil</Link> / Nouveaux-nés
          </p>
          <h2 className="page-title">Gérer les nouveaux-nés</h2>
          <p className="page-lead">
            Même logique que{" "}
            <a href="https://www.justicia.website/egouv/COMMUNE/manage-ne.php" target="_blank" rel="noreferrer">
              manage-ne.php
            </a>{" "}
            — naissances récentes (≤ 90 jours), filtre sexe et fiche acte.
          </p>
        </div>
        <button type="button" className="btn-add" onClick={() => navigate("/births")}>
          + Ajouter
        </button>
      </div>

      <div className="metrics-row" style={{ marginBottom: "1rem" }}>
        <div className="metric-card">
          <span className="muted">Total NE</span>
          <strong>{newborns.length}</strong>
        </div>
        <div className="metric-card">
          <span className="muted">Garçons</span>
          <strong>{newborns.filter((a) => String(a.payload.sexe).toUpperCase() === "M").length}</strong>
        </div>
        <div className="metric-card">
          <span className="muted">Filles</span>
          <strong>{newborns.filter((a) => String(a.payload.sexe).toUpperCase() === "F").length}</strong>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <div className="eg-filter-bar">
            <input
              className="form-control"
              style={{ marginBottom: 0, minWidth: 200 }}
              placeholder="Rechercher (nom, NIC, n° acte)…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <select
              className="form-control"
              style={{ marginBottom: 0, width: "auto" }}
              value={sexe}
              onChange={(e) => setSexe(e.target.value)}
            >
              <option value="">Tous sexes</option>
              <option value="M">Garçons</option>
              <option value="F">Filles</option>
            </select>
          </div>
          <DataToolbar filename="nouveaux_nes" rows={exportRows} />
        </div>

        <div className="table-scroll">
          <table className="data-table eg-table">
            <thead>
              <tr>
                <th>N° acte</th>
                <th>NIC</th>
                <th>Enfant</th>
                <th>Sexe</th>
                <th>Date naissance</th>
                <th>Lieu</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {newborns.length === 0 ? (
                <tr>
                  <td colSpan={7} className="muted">
                    Aucun nouveau-né sur la période.
                  </td>
                </tr>
              ) : (
                newborns.map((a) => (
                  <tr key={a.id}>
                    <td>{a.act_number}</td>
                    <td>
                      <code>{a.national_id}</code>
                    </td>
                    <td>
                      {String(a.payload.nom ?? "")} {String(a.payload.postnom ?? "")}{" "}
                      {String(a.payload.prenom ?? "")}
                    </td>
                    <td>{String(a.payload.sexe ?? "—")}</td>
                    <td>{String(a.payload.date_naissance ?? "—")}</td>
                    <td>{String(a.payload.lieu_naissance ?? "—")}</td>
                    <td className="table-actions">
                      <button
                        type="button"
                        className="btn-add btn-sm"
                        onClick={() => setViewAct(getAct(a.id) ?? a)}
                      >
                        Voir
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {viewAct ? (
        <div className="modal-backdrop" onClick={() => setViewAct(null)}>
          <div className="modal-panel modal-wide" onClick={(e) => e.stopPropagation()}>
            <div className="panel-head">
              <h3 className="panel-title" style={{ margin: 0 }}>
                {actTypeLabel(viewAct.type)} — {viewAct.act_number}
              </h3>
              <button type="button" className="btn-secondary btn-sm" onClick={() => setViewAct(null)}>
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
