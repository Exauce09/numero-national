import { FormEvent, useEffect, useState } from "react";
import {
  api,
  demoCreateDeclaration,
  demoListDeclarations,
  demoValidateDeclaration,
  type Declaration,
} from "../api";
import GeoCascade, { GEO_PRESETS, type GeoSelection } from "../components/GeoCascade";

export default function DeclarationsPage() {
  const [rows, setRows] = useState<Declaration[]>([]);
  const [commune, setCommune] = useState("KIN-GOMBE");
  const [geo, setGeo] = useState<GeoSelection>({});
  const [type, setType] = useState("BIRTH");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    try {
      setRows(await api.listDeclarations("PENDING_OFFICER"));
    } catch {
      setRows(demoListDeclarations());
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const body = {
      source: "COMMUNE",
      declaration_type: type,
      payload: { notes, commune_code: commune },
    };
    try {
      await api.createDeclaration(body);
      setMessage("Déclaration créée (API).");
    } catch {
      demoCreateDeclaration(body.payload, type);
      setMessage("Déclaration créée en mode démo.");
    }
    setNotes("");
    await refresh();
    setBusy(false);
  }

  async function onValidate(id: string, reject: boolean) {
    setBusy(true);
    try {
      await api.validateDeclaration(id, {
        commune_code: commune,
        reject,
        rejection_reason: reject ? "Rejeté par l'officier" : undefined,
      });
      setMessage(reject ? "Déclaration rejetée." : "Déclaration validée → acte créé.");
    } catch {
      demoValidateDeclaration(id, reject);
      setMessage(reject ? "Rejet démo." : "Validation démo.");
    }
    await refresh();
    setBusy(false);
  }

  return (
    <div>
      <h2 className="page-title">Déclarations (file officier)</h2>
      <p className="page-lead">
        Déclarations hôpital / commune en attente de validation (`PENDING_OFFICER`).
      </p>

      <div className="panel">
        <h3 style={{ marginTop: 0 }}>Nouvelle déclaration (intake)</h3>
        {message ? <div className="success-banner">{message}</div> : null}
        <form className="form-grid" onSubmit={onCreate}>
          <div>
            <label className="form-label">Type</label>
            <select className="form-control" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="BIRTH">Naissance</option>
              <option value="DEATH">Décès</option>
            </select>
          </div>
          <div className="full">
            <GeoCascade
              embedded
              levels={GEO_PRESETS.place}
              value={geo}
              onChange={(g) => {
                setGeo(g);
                if (g.commune_code) setCommune(g.commune_code);
              }}
              label="Commune de la déclaration"
            />
          </div>
          <div className="full">
            <label className="form-label">Notes / payload</label>
            <input className="form-control" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div className="full">
            <button className="btn-primary" style={{ width: "auto", minWidth: 200 }} disabled={busy}>
              Créer la déclaration
            </button>
          </div>
        </form>
      </div>

      <div className="panel">
        <div className="toolbar">
          <button type="button" className="btn-secondary" onClick={() => void refresh()}>
            Actualiser la file
          </button>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Source</th>
              <th>Statut</th>
              <th>Créée</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="muted">
                  Aucune déclaration en attente.
                </td>
              </tr>
            ) : (
              rows.map((d) => (
                <tr key={d.id}>
                  <td>{d.declaration_type}</td>
                  <td>{d.source}</td>
                  <td>{d.status}</td>
                  <td>{new Date(d.created_at).toLocaleString("fr-FR")}</td>
                  <td>
                    <button
                      type="button"
                      className="btn-primary btn-sm"
                      style={{ marginRight: 8 }}
                      disabled={busy}
                      onClick={() => void onValidate(d.id, false)}
                    >
                      Valider
                    </button>
                    <button
                      type="button"
                      className="btn-secondary btn-sm"
                      disabled={busy}
                      onClick={() => void onValidate(d.id, true)}
                    >
                      Rejeter
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
