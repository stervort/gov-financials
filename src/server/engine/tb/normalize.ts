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

function firstDefined(obj: any, keys: string[]) {
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null && String(obj[k]).trim() !== "") return obj[k];
  }
  return undefined;
}

export type TBRow = {
  account: string;
  description?: string;
  finalBalance: number;
  auditGroup?: string;
  auditSubgroup?: string;
};

function recordToRow(r: Record<string, any>): TBRow | null {
  const account = String(
    firstDefined(r, ["account", "acct", "account number", "account #", "account_no"]) ?? ""
  ).trim();
  if (!account) return null;

  const desc = firstDefined(r, ["description", "desc", "account description"]);

  // Prefer a true final balance column if present
  const fb = firstDefined(r, [
    "final balance",
    "final_balance",
    "ending balance",
    "ending_balance",
    "final",
    "balance",
    "amount",
    "net"
  ]);

  // If no final balance column, compute from Debit/Credit
  const debit = firstDefined(r, ["debit", "debits", "dr", "debit amount", "debit_amount"]);
  const credit = firstDefined(r, ["credit", "credits", "cr", "credit amount", "credit_amount"]);

  let finalBalance = 0;

  if (fb !== undefined) {
    finalBalance = toNumber(fb);
  } else if (debit !== undefined || credit !== undefined) {
    const d = Math.abs(toNumber(debit));
    const c = Math.abs(toNumber(credit));
    finalBalance = d - c; // single signed: debit positive, credit negative
  } else {
    finalBalance = 0;
  }

  return {
    account,
    description: desc ? String(desc).trim() : undefined,
    finalBalance,
    auditGroup: r["group"] ? String(r["group"]).trim() : undefined,
    auditSubgroup: r["subgroup"] ? String(r["subgroup"]).trim() : undefined,
  };
}

function mapRecords(records: Record<string, any>[]): TBRow[] {
  const out: TBRow[] = [];
  for (const r of records) {
    const row = recordToRow(r);
    if (row) out.push(row);
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
  return mapRecords(rows);
}

export function parseTBFromExcel(buffer: Buffer): TBRow[] {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const sheetName = wb.SheetNames?.[0];
  if (!sheetName) return [];

  const ws = wb.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: "" });
  if (!matrix || matrix.length < 2) return [];

  const headers = (matrix[0] ?? []).map((h: any) => norm(String(h ?? "")));
  const records: Record<string, any>[] = [];

  for (let i = 1; i < matrix.length; i++) {
    const row = matrix[i] ?? [];
    if (row.every((c: any) => String(c ?? "").trim() === "")) continue;

    const obj: Record<string, any> = {};
    for (let c = 0; c < headers.length; c++) {
      const key = headers[c];
      if (!key) continue;
      obj[key] = row[c];
    }
    records.push(obj);
  }

  return mapRecords(records);
}
