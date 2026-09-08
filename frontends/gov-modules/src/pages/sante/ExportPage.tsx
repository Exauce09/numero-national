import { useEffect, useState } from "react";
import { api, type HealthStats } from "../../api";

const POLICY = [
  "Aucun identifiant personnel (NIC, noms, dates de naissance) n'est exporté.",
  "Seules des agrégations nationales ou par commune anonymisées sont incluses.",
  "Les seuils bas (< 5) peuvent être masqués côté serveur pour éviter la ré-identification.",
  "Usage réservé aux statistiques officielles du Ministère de la Santé.",
];

export default function ExportPage() {
  const [payload, setPayload] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    void (async () => {
      const [stats, gov] = await Promise.all([
        api.healthStats(),
        api.gov("ministry", "health"),
      ]);
      setPayload({
        exported_at: new Date().toISOString(),
        anonymization: "aggregate-only",
        health_stats: stats as HealthStats,
        gov_health: gov,
      });
    })();
  }, []);

  function download() {
    if (!payload) return;
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sante-aggregats-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <h2 className="page-title">Export anonymisé</h2>
      <p className="page-lead">Politique d&apos;anonymisation et téléchargement des agrégats JSON.</p>
      <div className="panel" style={{ marginBottom: "1rem" }}>
        <h3 style={{ marginTop: 0 }}>Politique d&apos;anonymisation</h3>
        <ul>
          {POLICY.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <button type="button" className="btn-primary" style={{ width: "auto" }} onClick={download}>
          Télécharger JSON
        </button>
      </div>
      <div className="panel">
        <h3 style={{ marginTop: 0 }}>Aperçu</h3>
        <pre className="pre-box">{payload ? JSON.stringify(payload, null, 2) : "Chargement…"}</pre>
      </div>
    </div>
  );
}
