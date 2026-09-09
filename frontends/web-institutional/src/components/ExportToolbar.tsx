/** Barre d'export Présidence — CSV, Excel, PDF, Imprimer, SQL. */

export type ExportRow = Record<string, string | number | boolean | null | undefined>;

type Props = {
  filename: string;
  title?: string;
  rows: ExportRow[];
  columns?: string[];
  tableName?: string;
};

function downloadBlob(filename: string, content: string | Blob, mime: string) {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function resolveColumns(rows: ExportRow[], columns?: string[]): string[] {
  if (columns?.length) return columns;
  if (rows[0]) return Object.keys(rows[0]);
  return ["id"];
}

function escapeCsv(v: unknown): string {
  const s = v == null ? "" : String(v);
  if (/[",;\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(rows: ExportRow[], columns: string[]): string {
  const header = columns.join(";");
  const body = rows.map((r) => columns.map((c) => escapeCsv(r[c])).join(";")).join("\n");
  return `\uFEFF${header}\n${body}`;
}

function toExcelHtml(rows: ExportRow[], columns: string[], title: string): string {
  const th = columns.map((c) => `<th>${escapeHtml(c)}</th>`).join("");
  const tr = rows
    .map(
      (r) =>
        `<tr>${columns.map((c) => `<td>${escapeHtml(r[c] == null ? "" : String(r[c]))}</td>`).join("")}</tr>`,
    )
    .join("");
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>table{border-collapse:collapse;width:100%;font-family:Arial,sans-serif;font-size:12px}
th,td{border:1px solid #999;padding:6px 8px;text-align:left}th{background:#eef5f1}</style>
</head><body><h2>${escapeHtml(title)}</h2><p>Export Présidence — ${new Date().toLocaleString("fr-CD")}</p>
<table><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table></body></html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function toSql(rows: ExportRow[], columns: string[], table: string): string {
  if (!rows.length) return `-- Aucune donnée\n-- table: ${table}\n`;
  const safeTable = table.replace(/\W+/g, "_").toLowerCase();
  const header = `-- Export SQL Présidence — ${new Date().toISOString()}\n-- Table: ${safeTable}\n\n`;
  const create = `CREATE TABLE IF NOT EXISTS ${safeTable} (\n${columns
    .map((c) => `  ${c.replace(/\W+/g, "_")} TEXT`)
    .join(",\n")}\n);\n\n`;
  const inserts = rows
    .map((r) => {
      const vals = columns
        .map((c) => {
          const v = r[c];
          if (v == null) return "NULL";
          if (typeof v === "number") return String(v);
          if (typeof v === "boolean") return v ? "1" : "0";
          return `'${String(v).replace(/'/g, "''")}'`;
        })
        .join(", ");
      return `INSERT INTO ${safeTable} (${columns.map((c) => c.replace(/\W+/g, "_")).join(", ")}) VALUES (${vals});`;
    })
    .join("\n");
  return `${header}${create}${inserts}\n`;
}

function openPrintable(title: string, rows: ExportRow[], columns: string[]) {
  const html = toExcelHtml(rows, columns, title);
  const w = window.open("", "_blank", "noopener,noreferrer,width=1024,height=768");
  if (!w) {
    window.print();
    return;
  }
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => {
    w.print();
  }, 250);
}

export default function ExportToolbar({ filename, title, rows, columns, tableName }: Props) {
  const cols = resolveColumns(rows, columns);
  const label = title ?? filename;
  const base = filename.replace(/\W+/g, "_");
  const stamp = new Date().toISOString().slice(0, 10);

  function exportCsv() {
    downloadBlob(`${base}_${stamp}.csv`, toCsv(rows, cols), "text/csv;charset=utf-8");
  }

  function exportExcel() {
    downloadBlob(
      `${base}_${stamp}.xls`,
      toExcelHtml(rows, cols, label),
      "application/vnd.ms-excel;charset=utf-8",
    );
  }

  function exportSql() {
    downloadBlob(
      `${base}_${stamp}.sql`,
      toSql(rows, cols, tableName ?? base),
      "application/sql;charset=utf-8",
    );
  }

  function exportPdf() {
    openPrintable(`${label} (PDF)`, rows, cols);
  }

  function doPrint() {
    openPrintable(label, rows, cols);
  }

  return (
    <div className="export-toolbar no-print">
      <span className="export-toolbar-label muted small">Exporter</span>
      <button type="button" className="btn-secondary btn-sm" onClick={exportCsv} disabled={!rows.length}>
        CSV
      </button>
      <button type="button" className="btn-secondary btn-sm" onClick={exportExcel} disabled={!rows.length}>
        Excel
      </button>
      <button type="button" className="btn-secondary btn-sm" onClick={exportPdf} disabled={!rows.length}>
        PDF
      </button>
      <button type="button" className="btn-secondary btn-sm" onClick={doPrint} disabled={!rows.length}>
        Imprimer
      </button>
      <button type="button" className="btn-secondary btn-sm" onClick={exportSql} disabled={!rows.length}>
        SQL
      </button>
      <span className="muted small">{rows.length} ligne(s)</span>
    </div>
  );
}
