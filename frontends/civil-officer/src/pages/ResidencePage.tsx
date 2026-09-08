import { FormEvent, useEffect, useState } from "react";
import { api, type Residence } from "../api";
import GeoCascade, { type GeoSelection } from "../components/GeoCascade";

export default function ResidencePage() {
  const [commune, setCommune] = useState("KIN-GOMBE");
  const [geo, setGeo] = useState<GeoSelection>({});
  const [citizenId, setCitizenId] = useState("");
  const [address, setAddress] = useState("");
  const [rows, setRows] = useState<Residence[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    try {
      setRows(await api.listResidence(commune || undefined));
      setError(null);
    } catch (err) {
      setRows([]);
      setError(err instanceof Error ? err.message : "Liste indisponible (API).");
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      await api.createResidence({
        citizen_id: citizenId,
        commune_code: geo.commune_code || commune,
        line1: address || geo.label || "Adresse non précisée",
        city: geo.ville_name || "Kinshasa",
        country_code: "COD",
      });
      setMessage("Attestation de résidence créée.");
      setCitizenId("");
      setAddress("");
      await refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Création impossible — vérifiez l'API et le citizen_id UUID."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h2 className="page-title">Attestations de résidence</h2>
      <p className="page-lead">Émission et consultation des attestations communales.</p>
      <div className="panel">
        {message ? <div className="success-banner">{message}</div> : null}
        {error ? <div className="login-error">{error}</div> : null}
        <form className="form-grid" onSubmit={onSubmit}>
          <div>
            <label className="form-label">Citizen ID (UUID)</label>
            <input
              className="form-control"
              required
              value={citizenId}
              onChange={(e) => setCitizenId(e.target.value)}
            />
          </div>
          <div className="full">
            <GeoCascade
              value={geo}
              onChange={(g) => {
                setGeo(g);
                if (g.commune_code) setCommune(g.commune_code);
                if (g.label) setAddress(g.label);
              }}
              label="Adresse territoriale"
            />
          </div>
          <div>
            <label className="form-label">Code commune</label>
            <input className="form-control" required value={commune} onChange={(e) => setCommune(e.target.value)} />
          </div>
          <div className="full">
            <label className="form-label">Adresse (complément)</label>
            <input className="form-control" value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <div className="full">
            <button className="btn-primary" style={{ width: "auto", minWidth: 220 }} disabled={busy}>
              Émettre l&apos;attestation
            </button>
          </div>
        </form>
      </div>
      <div className="panel">
        <button type="button" className="btn-secondary" onClick={() => void refresh()}>
          Actualiser
        </button>
        <table className="data-table" style={{ marginTop: "1rem" }}>
          <thead>
            <tr>
              <th>N° attestation</th>
              <th>Commune</th>
              <th>Citoyen</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="muted">
                  Aucune attestation.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.attestation_number}</td>
                  <td>{r.commune_code}</td>
                  <td>{r.citizen_id}</td>
                  <td>{r.status}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
