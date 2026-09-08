import { useEffect, useState } from "react";
import { api } from "../../api";

export default function BriefingPage() {
  const [payload, setPayload] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    void (async () => {
      const [overview, onip, metrics] = await Promise.all([
        api.gov("presidency", "overview"),
        api.onipDashboard(),
        api.analyticsMetrics(),
      ]);
      setPayload({
        title: "Briefing Présidence — Numéro National",
        generated_at: new Date().toISOString(),
        overview,
        onip_summary: {
          population: onip.population,
          cards: onip.cards,
          duplicates_open: onip.duplicates_open,
          anomalies: onip.anomalies,
        },
        metrics,
      });
    })();
  }, []);

  function download() {
    if (!payload) return;
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `briefing-presidence-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <h2 className="page-title">Briefing</h2>
      <p className="page-lead">Export JSON consolidé pour notes stratégiques.</p>
      <div className="panel" style={{ marginBottom: "1rem" }}>
        <button type="button" className="btn-primary" style={{ width: "auto" }} onClick={download}>
          Télécharger le briefing JSON
        </button>
      </div>
      <div className="panel">
        <pre className="pre-box">{payload ? JSON.stringify(payload, null, 2) : "Chargement…"}</pre>
      </div>
    </div>
  );
}
