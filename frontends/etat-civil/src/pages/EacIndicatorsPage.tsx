/** Indicateurs prioritaires EAC (CAE) — statistiques vitales. */

import { useMemo, useState } from "react";
import {
  buildEacReport,
  exportEacReportCsv,
  exportEacTableCsv,
  refreshPopulationFromRegistry,
  type EacReport,
  type EacTable,
} from "../eacIndicators";
import { listAllCommunesFlat } from "../geoFallback";

type Section = "births" | "deaths" | "causes" | "marriages" | "divorces";

const SECTIONS: { id: Section; label: string }[] = [
  { id: "births", label: "Naissances" },
  { id: "deaths", label: "Décès" },
  { id: "causes", label: "Causes de décès" },
  { id: "marriages", label: "Mariages" },
  { id: "divorces", label: "Divorces" },
];

function downloadText(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function TableCard({ table }: { table: EacTable }) {
  return (
    <div className="panel" style={{ marginBottom: "1rem" }}>
      <div className="panel-head" style={{ alignItems: "flex-start" }}>
        <div>
          <h3 className="panel-title" style={{ margin: 0 }}>
            <span className="muted" style={{ fontWeight: 600, marginRight: 8 }}>
              {table.code}
            </span>
            {table.title}
          </h3>
        </div>
        <button
          type="button"
          className="btn-secondary btn-sm"
          onClick={() => downloadText(`eac_${table.code.replace(/[^\w.-]+/g, "_")}.csv`, exportEacTableCsv(table))}
        >
          CSV
        </button>
      </div>
      {table.rows.length === 0 ? (
        <p className="muted">Aucune donnée pour cette période / ce territoire.</p>
      ) : (
        <div className="eg-acts-table-scroll">
          <table className="eg-acts-table data-table">
            <thead>
              <tr>
                {table.columns.map((c) => (
                  <th key={c}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((r, i) => (
                <tr key={i}>
                  {table.columns.map((c) => (
                    <td key={c}>{String(r[c] ?? "—")}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function EacIndicatorsPage() {
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);
  const [province, setProvince] = useState("");
  const [communeOnly, setCommuneOnly] = useState(false);
  const [section, setSection] = useState<Section>("births");
  const [tick, setTick] = useState(0);

  const provinces = useMemo(
    () =>
      [...new Set(listAllCommunesFlat().map((c) => c.province))].sort((a, b) =>
        a.localeCompare(b, "fr"),
      ),
    [],
  );

  const report: EacReport = useMemo(() => {
    void tick;
    return buildEacReport({
      year,
      province: province || undefined,
      communeOnly,
    });
  }, [year, province, communeOnly, tick]);

  const tables =
    section === "births"
      ? report.births
      : section === "deaths"
        ? report.deaths
        : section === "causes"
          ? report.causes
          : section === "marriages"
            ? report.marriages
            : report.divorces;

  return (
    <div>
      <div className="panel" style={{ marginBottom: "1rem" }}>
        <h2 className="panel-title" style={{ marginTop: 0 }}>
          Indicateurs prioritaires de l&apos;état civil — EAC / CAE
        </h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Tableaux et taux alignés sur les lignes directrices de la Communauté d&apos;Afrique de
          l&apos;Est (naissances, décès, causes, mariages, divorces). Les taux utilisent la population
          de référence (registre local par défaut — importez une population INS pour les
          publications officielles).
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
              className="btn-secondary"
              onClick={() => {
                refreshPopulationFromRegistry(year, province || undefined);
                setTick((n) => n + 1);
              }}
            >
              Recalculer population (registre)
            </button>
            <button
              type="button"
              className="btn-primary"
              style={{ width: "auto" }}
              onClick={() =>
                downloadText(
                  `indicateurs_eac_${year}${province ? `_${province}` : ""}.csv`,
                  exportEacReportCsv(report),
                )
              }
            >
              Exporter tout (CSV)
            </button>
          </div>
        </div>
        <p className="muted small" style={{ marginBottom: 0 }}>
          Population ({report.population.source}) : <strong>{report.population.total}</strong> —{" "}
          {report.population.total_m} H / {report.population.total_f} F — généré{" "}
          {new Date(report.generated_at).toLocaleString("fr-FR")}
        </p>
      </div>

      <div className="action-row" style={{ gap: "0.5rem", flexWrap: "wrap", marginBottom: "1rem" }}>
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            className={section === s.id ? "btn-add btn-sm" : "btn-secondary btn-sm"}
            onClick={() => setSection(s.id)}
          >
            {s.label}
          </button>
        ))}
      </div>

      {tables.map((t) => (
        <TableCard key={t.id} table={t} />
      ))}
    </div>
  );
}
