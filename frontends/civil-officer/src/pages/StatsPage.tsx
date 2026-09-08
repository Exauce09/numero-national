import { FormEvent, useState } from "react";
import { api } from "../api";
import GeoCascade, { type GeoSelection } from "../components/GeoCascade";

export default function StatsPage() {
  const [commune, setCommune] = useState("KIN-GOMBE");
  const [geo, setGeo] = useState<GeoSelection>({});
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const data = await api.stats(geo.commune_code || commune);
      setCounts(data.counts);
      setTotal(data.total);
    } catch (err) {
      setCounts(null);
      setError(err instanceof Error ? err.message : "Statistiques indisponibles.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h2 className="page-title">Statistiques communales</h2>
      <p className="page-lead">Indicateurs agrégés par type d&apos;acte pour la commune.</p>
      <div className="panel">
        <GeoCascade
          value={geo}
          onChange={(g) => {
            setGeo(g);
            if (g.commune_code) setCommune(g.commune_code);
          }}
          label="Sélectionner la commune"
        />
        <form className="toolbar" onSubmit={onSubmit} style={{ marginTop: "1rem" }}>
          <div>
            <label className="form-label">Code commune</label>
            <input className="form-control" value={commune} onChange={(e) => setCommune(e.target.value)} />
          </div>
          <button className="btn-primary" style={{ width: "auto" }} disabled={busy}>
            {busy ? "Chargement…" : "Charger"}
          </button>
        </form>
        {error ? <div className="login-error">{error}</div> : null}
        {counts ? (
          <>
            <p>
              Total actes : <strong>{total}</strong>
            </p>
            <div className="grid">
              {Object.entries(counts).map(([k, v]) => (
                <div className="metric" key={k}>
                  <div className="label">{k}</div>
                  <div className="value">{v}</div>
                </div>
              ))}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
