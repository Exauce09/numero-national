import fs from "fs";
import path from "path";

const docxXml =
  process.argv[2] ||
  path.join(process.env.USERPROFILE || "", "Documents/province_docx_extract/word/document.xml");

const xml = fs.readFileSync(docxXml, "utf8");

function parseTable(tblXml) {
  const rows = [];
  for (const row of tblXml.split(/<w:tr[\s>]/).slice(1)) {
    const rowBody = row.split("</w:tr>")[0];
    const cells = [];
    for (const cell of rowBody.split(/<w:tc[\s>]/).slice(1)) {
      const cellBody = cell.split("</w:tc>")[0];
      const texts = [...cellBody.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]);
      cells.push(texts.join(""));
    }
    if (cells.some((c) => String(c).trim())) rows.push(cells);
  }
  return rows;
}

const tables = xml.split(/<w:tbl>/).slice(1).map((chunk) => parseTable(chunk.split("</w:tbl>")[0]));
const [pRows, tRows] = tables;
const toObjects = (rows) => {
  const header = rows[0];
  return rows.slice(1).map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ""])));
};

const provinces = toObjects(pRows);
const territoires = toObjects(tRows);
console.log(JSON.stringify({ provinces: provinces.length, territoires: territoires.length }, null, 2));

const out = path.resolve("data/sigpop/province_docx_parsed.json");
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify({ provinces, territoires }, null, 2));
console.log("Wrote", out);
