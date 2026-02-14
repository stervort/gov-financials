"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Select } from "@/src/components/ui/select";

type Props = {
  engagementId: string;
  importId: string;
  suggestedHasHeaders: boolean;
  matrix: any[][];
  // Server action
  finalizeAction: (formData: FormData) => Promise<void>;
};

type FieldKey =
  | "accountCol"
  | "descriptionCol"
  | "finalBalanceCol"
  | "debitCol"
  | "creditCol"
  | "groupCol"
  | "subgroupCol";

const FIELD_OPTIONS: { key: FieldKey | ""; label: string }[] = [
  { key: "", label: "(none)" },
  { key: "accountCol", label: "Account (required)" },
  { key: "descriptionCol", label: "Description" },
  { key: "finalBalanceCol", label: "Final Balance" },
  { key: "debitCol", label: "Debit" },
  { key: "creditCol", label: "Credit" },
  { key: "groupCol", label: "Group" },
  { key: "subgroupCol", label: "Subgroup" },
];

function colLetter(i: number) {
  // A, B, C...
  return String.fromCharCode("A".charCodeAt(0) + i);
}

function safeInt(v: any, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.floor(n) : fallback;
}

function parseNumberLoose(v: any): number {
  const raw = String(v ?? "").trim();
  if (!raw) return 0;
  const isParen = raw.startsWith("(") && raw.endsWith(")");
  const s = raw.replace(/[()$,]/g, "").trim();
  const n = Number(s.replace(/,/g, ""));
  if (!Number.isFinite(n)) return 0;
  return isParen ? -n : n;
}

export default function TBMapperClient({
  engagementId,
  importId,
  suggestedHasHeaders,
  matrix,
  finalizeAction,
}: Props) {
  const maxCols = React.useMemo(() => {
    let m = 0;
    for (const r of matrix ?? []) m = Math.max(m, (r ?? []).length);
    return m;
  }, [matrix]);

  const [hasHeaders, setHasHeaders] = React.useState<boolean>(!!suggestedHasHeaders);
  const [headerRowsToSkip, setHeaderRowsToSkip] = React.useState<number>(
    suggestedHasHeaders ? 1 : 0
  );

  // Which column is currently selected in the preview
  const [activeCol, setActiveCol] = React.useState<number>(0);

  // Field -> column index (or null)
  const [map, setMap] = React.useState<Record<FieldKey, number | null>>({
    accountCol: 0,
    descriptionCol: 1,
    finalBalanceCol: null,
    debitCol: null,
    creditCol: null,
    groupCol: null,
    subgroupCol: null,
  });

  // If we have headers and row1 looks like headers, default to A=account, B=description, C=final
  React.useEffect(() => {
    // Keep account mapped to A by default
    setMap((prev) => ({ ...prev, accountCol: prev.accountCol ?? 0 }));
  }, []);

  const effectiveSkip = hasHeaders ? Math.max(0, headerRowsToSkip) : 0;
  const previewRows = React.useMemo(() => {
    const rows = (matrix ?? []).slice(0, 25);
    return rows;
  }, [matrix]);

  const setFieldForActiveCol = (field: FieldKey | "") => {
    setMap((prev) => {
      const next = { ...prev };

      // Remove any existing mapping that points to activeCol
      (Object.keys(next) as FieldKey[]).forEach((k) => {
        if (next[k] === activeCol) next[k] = null;
      });

      // If choosing none, we're done
      if (!field) return next;

      // If mapping this field was previously mapped elsewhere, that's fine: move it
      next[field] = activeCol;
      return next;
    });
  };

  const activeField = React.useMemo(() => {
    const entries = Object.entries(map) as [FieldKey, number | null][];
    const hit = entries.find(([, idx]) => idx === activeCol);
    return hit?.[0] ?? "";
  }, [map, activeCol]);

  const usingFinal = map.finalBalanceCol != null;
  const usingDrCr = map.debitCol != null && map.creditCol != null;
  const canSubmit = map.accountCol != null && (usingFinal || usingDrCr);

  // Validation helpers
  const balanceInfo = React.useMemo(() => {
    if (!canSubmit) return null;

    const accIdx = map.accountCol ?? 0;
    const fbIdx = map.finalBalanceCol;
    const drIdx = map.debitCol;
    const crIdx = map.creditCol;

    const start = effectiveSkip;
    const rows = (matrix ?? []).slice(start);

    let total = 0;
    const accounts: string[] = [];
    for (const r of rows) {
      if (!r) continue;
      if (r.every((c: any) => String(c ?? "").trim() === "")) continue;
      const acct = String(r[accIdx] ?? "").trim();
      if (!acct) continue;
      accounts.push(acct);

      let fb = 0;
      if (fbIdx != null) {
        fb = parseNumberLoose(r[fbIdx]);
      } else {
        const d = drIdx != null ? Math.abs(parseNumberLoose(r[drIdx])) : 0;
        const c = crIdx != null ? Math.abs(parseNumberLoose(r[crIdx])) : 0;
        fb = d - c;
      }
      total += fb;
    }

    // Duplicates
    const seen = new Set<string>();
    let dupCount = 0;
    for (const a of accounts) {
      if (seen.has(a)) dupCount++;
      seen.add(a);
    }

    return { total, dupCount };
  }, [canSubmit, map, matrix, effectiveSkip]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>1) Header Rows</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={hasHeaders}
                onChange={(e) => setHasHeaders(e.target.checked)}
              />
              My file has header rows (skip them)
            </label>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-600">Header rows to skip:</span>
              <Input
                type="number"
                min={0}
                className="w-24"
                value={hasHeaders ? headerRowsToSkip : 0}
                onChange={(e) => setHeaderRowsToSkip(safeInt(e.target.value, 0))}
                disabled={!hasHeaders}
              />
              <span className="text-xs text-gray-500">
                ({hasHeaders ? headerRowsToSkip : 0} means data starts on row {effectiveSkip + 1})
              </span>
            </div>
          </div>
          <p className="text-xs text-gray-500">
            We remove fully blank rows automatically. Everything after the skipped header rows will be imported.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2) Column Mapping</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border p-3 space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <div className="text-sm">
                <span className="text-gray-600">Selected column:</span>{" "}
                <span className="font-mono font-medium">{colLetter(activeCol)}</span>
              </div>

              <div className="w-full md:w-80">
                <Select
                  value={activeField}
                  onChange={(e) => setFieldForActiveCol(e.target.value as any)}
                >
                  {FIELD_OPTIONS.map((o) => (
                    <option key={o.label} value={o.key}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="flex-1" />

              <form action={finalizeAction}>
                <input type="hidden" name="engagementId" value={engagementId} />
                <input type="hidden" name="importId" value={importId} />
                <input type="hidden" name="hasHeaders" value={String(hasHeaders)} />
                <input type="hidden" name="headerRowsToSkip" value={String(effectiveSkip)} />

                {(Object.keys(map) as FieldKey[]).map((k) => (
                  <input
                    key={k}
                    type="hidden"
                    name={k}
                    value={map[k] == null ? "" : String(map[k])}
                  />
                ))}

                <Button type="submit" disabled={!canSubmit}>
                  Finish Import
                </Button>
              </form>
            </div>

            <div className="text-xs text-gray-500">
              Rule: you must map <b>Account</b>, and either <b>Final Balance</b> OR both <b>Debit</b> + <b>Credit</b>.
            </div>

            {balanceInfo ? (
              <div className="text-xs">
                <span className="text-gray-600">TB total:</span>{" "}
                <span className={Math.abs(balanceInfo.total) < 0.005 ? "text-green-700 font-medium" : "text-red-700 font-medium"}>
                  {balanceInfo.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                {balanceInfo.dupCount > 0 ? (
                  <span className="ml-3 text-amber-700">
                    Duplicates detected: {balanceInfo.dupCount} (we recommend fixing before import)
                  </span>
                ) : null}
              </div>
            ) : (
              <div className="text-xs text-gray-500">Select required mappings to see TB total / duplicates.</div>
            )}
          </div>

          <div className="overflow-auto border rounded-md">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="text-left">
                  <th className="px-3 py-2 w-16">Row</th>
                  {Array.from({ length: maxCols }).map((_, i) => {
                    const labelField = (Object.entries(map) as [FieldKey, number | null][]).find(([, idx]) => idx === i)?.[0];
                    const pretty = labelField
                      ? FIELD_OPTIONS.find((o) => o.key === labelField)?.label ?? ""
                      : "";
                    const isActive = i === activeCol;
                    return (
                      <th
                        key={i}
                        className={
                          "px-3 py-2 cursor-pointer select-none " +
                          (isActive ? "bg-gray-100" : "")
                        }
                        title="Click to map this column"
                        onClick={() => setActiveCol(i)}
                      >
                        <div className="flex items-baseline gap-2">
                          <span className="font-mono">{colLetter(i)}</span>
                          {pretty ? <span className="text-xs text-gray-600">• {pretty}</span> : null}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {previewRows.map((r, rowIdx) => {
                  const isHeaderRow = rowIdx < effectiveSkip;
                  const isBlank = (r ?? []).every((c: any) => String(c ?? "").trim() === "");
                  const rowClass =
                    isBlank
                      ? "text-gray-300"
                      : isHeaderRow
                        ? "bg-gray-50 text-gray-500"
                        : "bg-green-50/40";

                  return (
                    <tr key={rowIdx} className={"border-t " + rowClass}>
                      <td className="px-3 py-2 text-xs text-gray-500">{rowIdx + 1}</td>
                      {Array.from({ length: maxCols }).map((_, colIdx) => (
                        <td key={colIdx} className="px-3 py-2 whitespace-nowrap">
                          {String((r ?? [])[colIdx] ?? "")}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-gray-500">
            Tip: click a column header (A, B, C...) to select it, then choose what it represents in the dropdown above.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
