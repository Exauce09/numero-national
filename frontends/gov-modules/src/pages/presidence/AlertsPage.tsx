import { useEffect, useState } from "react";
import { api, type OnipDashboard } from "../../api";

export default function AlertsPage() {
  const [anomalies, setAnomalies] = useState<OnipDashboard["anomalies"]>([]);

  useEffect(() => {
    void api.onipDashboard().then((d) => {
      const list = d.anomalies ?? [];
      setAnomalies(list.filter((a) => a.severity === "HIGH" || a.severity === "CRITICAL" || list.length <= 5));
    });
  }, []);

  return (
    <div>
      <h2 className="page-title">Alertes stratégiques</h2>
      <p className="page-lead">Sous-ensemble des anomalies ONIP pertinentes pour la Présidence.</p>
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
          <p className="muted">Aucune alerte prioritaire.</p>
        )}
      </div>
    </div>
  );
}
