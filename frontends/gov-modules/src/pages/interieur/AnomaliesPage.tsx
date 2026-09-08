import { useEffect, useState } from "react";
import { api, type OnipDashboard } from "../../api";

export default function AnomaliesPage() {
  const [anomalies, setAnomalies] = useState<OnipDashboard["anomalies"]>([]);

  useEffect(() => {
    void api.onipDashboard().then((d) => setAnomalies(d.anomalies ?? []));
  }, []);

  return (
    <div>
      <h2 className="page-title">Anomalies ONIP</h2>
      <p className="page-lead">Signaux opérationnels remontés par le tableau de bord national.</p>
      <div className="panel">
        {anomalies.length ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Sévérité</th>
                <th>Message</th>
                <th>Compte</th>
              </tr>
            </thead>
            <tbody>
              {anomalies.map((a) => (
                <tr key={a.code}>
                  <td>
                    <strong>{a.code}</strong>
                  </td>
                  <td>{a.severity}</td>
                  <td>{a.message}</td>
                  <td>{a.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="muted">Aucune anomalie signalée.</p>
        )}
      </div>
    </div>
  );
}
