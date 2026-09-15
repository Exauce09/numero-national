type Row = Record<string, string | number | boolean | null | undefined>;

type Props = {
  filename: string;
  rows: Row[];
  columns?: string[];
};

function downloadBlob(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function toCsv(rows: Row[], columns: string[]): string {
  const escape = (v: unknown) => {
    const s = v == null ? "" : String(v);
    if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const header = columns.join(";");
  const body = rows.map((r) => columns.map((c) => escape(r[c])).join(";")).join("\n");
  return `${header}\n${body}`;
}

export default function DataToolbar({ filename, rows, columns }: Props) {
  const cols =
    columns ??
    (rows[0] ? Object.keys(rows[0]) : ["id"]);

  function exportCsv(ext: "csv" | "xls") {
    downloadBlob(`${filename}.${ext}`, toCsv(rows, cols), "text/csv;charset=utf-8");
  }

  return (
    <div className="data-toolbar no-print">
      <button type="button" className="btn-secondary btn-sm" onClick={() => exportCsv("xls")}>
        Excel
      </button>
      <button type="button" className="btn-secondary btn-sm" onClick={() => window.print()}>
        PDF / Imprimer
      </button>
    </div>
  );
}
