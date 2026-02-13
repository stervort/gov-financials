import { parse } from "csv-parse/sync";

function norm(h: string) { return h.trim().toLowerCase().replace(/\uFEFF/g,""); }
function num(v: any) {
  const s = String(v ?? "").replace(/[$,]/g,"").trim();
  if (!s) return 0;
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

export type TBRow = {
  account: string;
  description?: string;
  finalBalance: number;
  auditGroup?: string;
  auditSubgroup?: string;
};

export function parseTBFromCSV(text: string): TBRow[] {
  const rows: any[] = parse(text, {
    columns: (h: string[]) => h.map(norm),
    skip_empty_lines: true,
    relax_quotes: true,
    relax_column_count: true,
    bom: true,
  });

  const out: TBRow[] = [];
  for (const r of rows) {
    const account = (r["account"] ?? r["acct"] ?? r["account number"] ?? "").toString().trim();
    if (!account) continue;
    const desc = r["description"] ?? r["desc"];
    const fb = r["final balance"] ?? r["final_balance"] ?? r["ending balance"] ?? r["balance"];
    out.push({
      account,
      description: desc ? String(desc).trim() : undefined,
      finalBalance: num(fb),
      auditGroup: r["group"] ? String(r["group"]).trim() : undefined,
      auditSubgroup: r["subgroup"] ? String(r["subgroup"]).trim() : undefined,
    });
  }
  return out;
}
