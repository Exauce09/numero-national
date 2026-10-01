/** 45 indicateurs gestion EC RDC + 25 prévisions de planification nationale. */

import { useMemo, useState } from "react";
import { listAllCommunesFlat } from "../geoFallback";
import {
  buildRdcIndicatorsReport,
  exportRdcIndicatorsCsv,
  RDC_DOMAIN_ORDER,
  type RdcIndicatorDomain,
  type RdcIndicatorsReport,
} from "../rdcGestionIndicators";
import {
  buildRdcPredictionsReport,
  exportRdcPredictionsCsv,
  type RdcPredictionsReport,
} from "../rdcPlanificationPredictions";

type Tab = "indicateurs" | "predictions";

function downloadText(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function DomainBlock({
  domain,
  report,
}: {
  domain: RdcIndicatorDomain;
  report: RdcIndicatorsReport;
}) {
  const rows = report.byDomain[domain];
  if (!rows?.length) return null;
  const title = rows[0].domainLabel;
  return (
    <div className="panel" style={{ marginBottom: "1rem" }}>
      <div className="panel-head">
        <h3 className="panel-title" style={{ margin: 0 }}>
          {title}
        </h3>
        <span className="muted small">{rows.length} indicateurs</span>
      </div>
      <div className="eg-acts-table-scroll">
        <table className="eg-acts-table data-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Indicateur</th>
              <th>Valeur</th>
              <th>Note</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.code}>
                <td>
                  <strong>{r.code}</strong>
                </td>
                <td>{r.label}</td>
                <td>{r.display}</td>
                <td className="muted small">{r.note || (r.computable ? "" : "Donnée manquante")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function RdcIndicateursPage() {
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);
  const [province, setProvince] = useState("");
  const [communeOnly, setCommuneOnly] = useState(false);
  const [tab, setTab] = useState<Tab>("indicateurs");
  const [domainFilter, setDomainFilter] = useState<RdcIndicatorDomain | "ALL">("ALL");

  const provinces = useMemo(
    () =>
      [...new Set(listAllCommunesFlat().map((c) => c.province))].sort((a, b) =>
        a.localeCompare(b, "fr"),
      ),
    [],
  );

  const scope = useMemo(
    () => ({
      year,
      province: province || undefined,
      communeOnly,
    }),
    [year, province, communeOnly],
  );

  const indicators: RdcIndicatorsReport = useMemo(
    () => buildRdcIndicatorsReport(scope),
    [scope],
  );

  const predictions: RdcPredictionsReport = useMemo(
    () => buildRdcPredictionsReport(scope),
    [scope],
  );

  const domains =
    domainFilter === "ALL" ? RDC_DOMAIN_ORDER : ([domainFilter] as RdcIndicatorDomain[]);

  return (
    <div>
      <div className="panel" style={{ marginBottom: "1rem" }}>
        <h2 className="panel-title" style={{ marginTop: 0 }}>
          Indicateurs de gestion des faits d&apos;état civil — RDC
        </h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Catalogue consolidé de <strong>45 indicateurs</strong> (ODD, naissances, décès, mariages /
          divorces, autres faits, couverture territoriale, performance des bureaux) et{" "}
          <strong>25 prévisions</strong> pour la planification nationale du développement. Les taux
          utilisent la population de référence ; les prévisions sont indicatives (horizon 5 ans).
        </p>
        <div className="form-grid">
          <div>
            <label className="form-label">Année</label>
            <select
              className="form-control"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            >
              {[thisYear, thisYear - 1, thisYear - 2, thisYear - 3, thisYear - 4].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label">Province</label>
            <select
              className="form-control"
              value={province}
              onChange={(e) => setProvince(e.target.value)}
            >
              <option value="">— Toutes —</option>
              {provinces.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div style={{ alignSelf: "end" }}>
            <label className="form-label" style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="checkbox"
                checked={communeOnly}
                onChange={(e) => setCommuneOnly(e.target.checked)}
              />
              Limiter à ma commune
            </label>
          </div>
          <div className="full action-row" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
            <button
              type="button"
              className={tab === "indicateurs" ? "btn-add" : "btn-secondary"}
              onClick={() => setTab("indicateurs")}
            >
              45 indicateurs
            </button>
            <button
              type="button"
              className={tab === "predictions" ? "btn-add" : "btn-secondary"}
              onClick={() => setTab("predictions")}
            >
              25 prévisions
            </button>
            <button
              type="button"
              className="btn-primary"
              style={{ width: "auto" }}
              onClick={() =>
                downloadText(
                  tab === "indicateurs"
                    ? `indicateurs_rdc_${year}${province ? `_${province}` : ""}.csv`
                    : `previsions_rdc_${year}${province ? `_${province}` : ""}.csv`,
                  tab === "indicateurs"
                    ? exportRdcIndicatorsCsv(indicators)
                    : exportRdcPredictionsCsv(predictions),
                )
              }
            >
              Exporter CSV
            </button>
          </div>
        </div>
        <p className="muted small" style={{ marginBottom: 0 }}>
          Population ({indicators.population.source}) :{" "}
          <strong>{indicators.population.total.toLocaleString("fr-FR")}</strong> — croissance retenue
          pour projections :{" "}
          <strong>{(predictions.growth_rate * 100).toFixed(2)} %</strong>/an — généré{" "}
          {new Date(indicators.generated_at).toLocaleString("fr-FR")}
        </p>
      </div>

      {tab === "indicateurs" ? (
        <>
          <div className="action-row" style={{ gap: "0.5rem", flexWrap: "wrap", marginBottom: "1rem" }}>
            <button
              type="button"
              className={domainFilter === "ALL" ? "btn-add btn-sm" : "btn-secondary btn-sm"}
              onClick={() => setDomainFilter("ALL")}
            >
              Tous
            </button>
            {RDC_DOMAIN_ORDER.map((d) => (
              <button
                key={d}
                type="button"
                className={domainFilter === d ? "btn-add btn-sm" : "btn-secondary btn-sm"}
                onClick={() => setDomainFilter(d)}
              >
                {indicators.byDomain[d][0]?.domainLabel.split(" ").slice(0, 3).join(" ") || d}
              </button>
            ))}
          </div>
          {domains.map((d) => (
            <DomainBlock key={d} domain={d} report={indicators} />
          ))}
        </>
      ) : (
        <div className="panel">
          <div className="panel-head">
            <h3 className="panel-title" style={{ margin: 0 }}>
              Prédictions — planification nationale (horizon 5 ans)
            </h3>
            <span className="muted small">{predictions.predictions.length} prévisions</span>
          </div>
          <div className="eg-acts-table-scroll">
            <table className="eg-acts-table data-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Prévision</th>
                  <th>Valeur</th>
                  <th>Méthode</th>
                </tr>
              </thead>
              <tbody>
                {predictions.predictions.map((p) => (
                  <tr key={p.code}>
                    <td>
                      <strong>{p.code}</strong>
                    </td>
                    <td>
                      {p.label}
                      {p.note ? (
                        <div className="muted small" style={{ marginTop: 4 }}>
                          {p.note}
                        </div>
                      ) : null}
                    </td>
                    <td>{p.display}</td>
                    <td className="muted small">{p.method}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
