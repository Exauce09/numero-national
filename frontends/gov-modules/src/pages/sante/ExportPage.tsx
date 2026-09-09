import { useMemo, useState } from "react";
import { ministryExportPayload } from "../../santeData";

const POLICY = [
  "Aucun identifiant personnel (NIC, noms complets, dates de naissance) n'est exporté.",
  "Seules des agrégations nationales / par province / par structure anonymisées sont incluses.",
  "Les volumes unitaires par structure restent des totaux, sans fiche individuelle.",
  "Usage réservé aux statistiques officielles du Ministère de la Santé.",
];

export default function ExportPage() {
  const [, bump] = useState(0);
  const payload = useMemo(() => ministryExportPayload(), [bump]);

  function download() {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sante-aggregats-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadCsv() {
    const lines = [
      "province,structures,births,deaths",
      ...payload.dashboard.by_province.map(
        (p) => `${JSON.stringify(p.province)},${p.facilities},${p.births},${p.deaths}`,
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sante-provinces-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="eg-page-head">
        <div>
          <h2 className="page-title">Export anonymisé</h2>
          <p className="page-lead">Téléchargement des agrégats dynamiques du département Santé.</p>
        </div>
        <button type="button" className="btn-secondary btn-sm" onClick={() => bump((n) => n + 1)}>
          Actualiser
        </button>
      </div>

      <div className="panel" style={{ marginBottom: "1rem" }}>
        <h3 className="panel-title">Politique d&apos;anonymisation</h3>
        <ul>
          {POLICY.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <div className="toolbar" style={{ marginBottom: 0 }}>
          <button type="button" className="btn-primary" style={{ width: "auto" }} onClick={download}>
            Télécharger JSON
          </button>
          <button type="button" className="btn-secondary" onClick={downloadCsv}>
            Télécharger CSV provinces
          </button>
        </div>
      </div>

      <div className="panel">
        <h3 className="panel-title">Aperçu</h3>
        <pre className="pre-box">{JSON.stringify(payload, null, 2)}</pre>
      </div>
    </div>
  );
}
