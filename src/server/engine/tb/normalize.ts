import { parse } from "csv-parse/sync";
import * as XLSX from "xlsx";

function norm(h: string) {
  return h.trim().toLowerCase().replace(/\uFEFF/g, "");
}

function toNumber(v: any) {
  const raw = String(v ?? "").trim();
  if (!raw) return 0;

  // Handles (123.45) as negative
  const isParen = raw.startsWith("(") && raw.endsWith(")");
  const s = raw.replace(/[()$,]/g, "").trim();
  const n = Number(s.replace(/,/g, ""));
  if (!Number.isFinite(n)) return 0;
  return isParen ? -n : n;
}

export type TBRow = {
  account: string;
  description?: string;
  finalBalance: number;
  auditGroup?: string;
  auditSubgroup?: string;
};

function mapAnyRecordToTBRows(records: Record<string, any>[]): TBRow[] {
  const out: TBRow[] = [];

  for (const r of records) {
    const account = (r["account"] ?? r["acct"] ?? r["account number"] ?? r["account #"] ?? "")
      .toString()
      .trim();
    if (!account) continue;

    const desc = r["description"] ?? r["desc"] ?? r["account description"];
    const fb =
      r["final balance"] ??
      r["final_balance"] ??
      r["ending balance"] ??
      r["balance"] ??
      r["final"] ??
      r["amount"];

    out.push({
      account,
      description: desc ? String(desc).trim() : undefined,
      finalBalance: toNumber(fb),
      auditGroup: r["group"] ? String(r["group"]).trim() : undefined,
      auditSubgroup: r["subgroup"] ? String(r["subgroup"]).trim() : undefined,
    });
  }

  return out;
}

export function parseTBFromCSV(text: string): TBRow[] {
  const rows: any[] = parse(text, {
    columns: (h: string[]) => h.map(norm),
    skip_empty_lines: true,
    relax_quotes: true,
    relax_column_count: true,
    bom: true,
  });

  return mapAnyRecordToTBRows(rows);
}

export function parseTBFromExcel(buffer: Buffer): TBRow[] {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const sheetName = wb.SheetNames?.[0];
  if (!sheetName) return [];

  const ws = wb.Sheets[sheetName];

  // Pull as a 2D array so we can normalize headers exactly like CSV
  const matrix = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: "" });

  if (!matrix || matrix.length < 2) return [];

  const headerRow = (matrix[0] ?? []).map((h: any) => norm(String(h ?? "")));
  const records: Record<string, any>[] = [];

  for (let i = 1; i < matrix.length; i++) {
    const row = matrix[i] ?? [];
    // skip completely empty rows
    if (row.every((c: any) => String(c ?? "").trim() === "")) continue;

    const obj: Record<string, any> = {};
    for (let c = 0; c < headerRow.length; c++) {
      const key = headerRow[c];
      if (!key) continue;
      obj[key] = row[c];
    }
    records.push(obj);
  }

  return mapAnyRecordToTBRows(records);
}
