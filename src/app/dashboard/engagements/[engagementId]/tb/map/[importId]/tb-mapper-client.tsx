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
  | "subgroupCol"
  | "fundCol";

const FIELD_OPTIONS: { key: FieldKey | ""; label: string }[] = [
  { key: "", label: "(none)" },
  { key: "accountCol", label: "Account (required)" },
  { key: "descriptionCol", label: "Description" },
  { key: "finalBalanceCol", label: "Final Balance" },
  { key: "debitCol", label: "Debit" },
  { key: "creditCol", label: "Credit" },
  { key: "groupCol", label: "Group" },
  { key: "subgroupCol", label: "Subgroup" },
  { key: "fundCol", label: 'Fund (code or "10 - Name")' },
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
  const [fieldMap, setFieldMap] = React.useState<Record<FieldKey, number | null>>({
    accountCol: 0,
    descriptionCol: null,
    finalBalanceCol: null,
    debitCol: null,
    creditCol: null,
    groupCol: null,
    subgroupCol: null,
    fundCol: null,
  });

  const headerRowIndex = React.useMemo(() => {
    // The last header row shown in the preview is row (headerRowsToSkip - 1)
    return Math.max(0, (hasHeaders ? headerRowsToSkip : 0) - 1);
  }, [hasHeaders, headerRowsToSkip]);

  const preview = React.useMemo(() => {
    const rows = matrix ?? [];
    const skip = hasHeaders ? Math.max(0, headerRowsToSkip) : 0;
    const shown = rows.slice(0, Math.min(rows.length, skip + 30)); // show headers + first ~30 data rows
    return { rows: shown, skip };
  }, [matrix, hasHeaders, headerRowsToSkip]);

  const activeColLabel = React.useMemo(() => colLetter(activeCol), [activeCol]);

  const activeColCurrentField = React.useMemo(() => {
    const entry = Object.entries(fieldMap).find(([, idx]) => idx === activeCol);
    return (entry?.[0] as FieldKey | undefined) ?? undefined;
  }, [fieldMap, activeCol]);

  function setActiveColToField(field: FieldKey | "") {
    setFieldMap((prev) => {
      const next = { ...prev };

      // remove this column from any other field
      for (const k of Object.keys(next) as FieldKey[]) {
        if (next[k] === activeCol) next[k] = null;
      }

      if (field) {
        next[field] = activeCol;
      }
      return next;
    });
  }

  function validateMapping() {
    const accountOk = fieldMap.accountCol !== null;

    const hasFinal = fieldMap.finalBalanceCol !== null;
    const hasDebit = fieldMap.debitCol !== null;
    const hasCredit = fieldMap.creditCol !== null;

    const balanceOk = hasFinal || (hasDebit && hasCredit);
    return { ok: accountOk && balanceOk, accountOk, balanceOk };
  }

  const v = validateMapping();

  function buildFinalizeFormData(): FormData {
    const fd = new FormData();
    fd.set("engagementId", engagementId);
    fd.set("importId", importId);
    fd.set("hasHeaders", String(hasHeaders));
    fd.set("headerRowsToSkip", String(safeInt(headerRowsToSkip, 0)));

    // Map
    for (const [k, idx] of Object.entries(fieldMap) as [FieldKey, number | null][]) {
      fd.set(k, idx === null ? "" : String(idx));
    }

    return fd;
  }

  async function onFinalize() {
    const fd = buildFinalizeFormData();
    await finalizeAction(fd);
  }

  const headerTextForCol = React.useMemo(() => {
    if (!hasHeaders) return "";
    const row = matrix?.[headerRowIndex] ?? [];
    return String(row?.[activeCol] ?? "");
  }, [hasHeaders, matrix, headerRowIndex, activeCol]);

  const isHeaderRow = (rowIndex: number) => hasHeaders && rowIndex < headerRowsToSkip;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Header Rows</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <input
              id="hasHeaders"
              type="checkbox"
              checked={hasHeaders}
              onChange={(e) => {
                const checked = e.target.checked;
                setHasHeaders(checked);
                if (!checked) setHeaderRowsToSkip(0);
                if (checked && headerRowsToSkip === 0) setHeaderRowsToSkip(1);
              }}
            />
            <label htmlFor="hasHeaders" className="text-sm">
              My file has header rows (skip them)
            </label>
          </div>

          <div className="flex items-center gap-2">
            <div className="text-sm text-gray-600">TB data starts on row:</div>
            <Input
              className="w-24"
              type="number"
              min={1}
              value={String((hasHeaders ? headerRowsToSkip : 0) + 1)}
              disabled={!hasHeaders}
              onChange={(e) => {
                const startsOn = safeInt(e.target.value, 1);
                // if data starts on row N, skip N-1 header rows
                const skip = Math.max(0, startsOn - 1);
                setHeaderRowsToSkip(skip);
              }}
            />
            <div className="text-xs text-gray-500">
              {hasHeaders ? `(skipping ${headerRowsToSkip} header row${headerRowsToSkip === 1 ? "" : "s"})` : ""}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Preview + Column Mapping</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="text-sm">
              Selected column: <span className="font-semibold">{activeColLabel}</span>
              {hasHeaders && headerTextForCol ? (
                <span className="text-gray-500"> — “{headerTextForCol}”</span>
              ) : null}
            </div>

            <div className="flex items-center gap-2">
              <div className="text-sm text-gray-600">Map selected column to:</div>
              <Select
  value={activeColCurrentField ?? ""}
  onChange={(e) => setActiveColToField((e.target as HTMLSelectElement).value as FieldKey | "")}
>
  {FIELD_OPTIONS.map((o) => (
    <option key={o.key} value={o.key}>
      {o.label}
    </option>
  ))}
</Select>

            </div>

            <div className="text-xs text-gray-500">
              Rule: You must select Account, and either Final Balance OR both Debit + Credit.
            </div>
          </div>

          {!v.ok ? (
            <div className="text-sm text-red-600">
              {!v.accountOk ? "Account column is required. " : ""}
              {!v.balanceOk ? "Select Final Balance OR both Debit + Credit." : ""}
            </div>
          ) : (
            <div className="text-sm text-green-700">Mapping looks good.</div>
          )}

          <div className="overflow-auto border rounded-md">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left w-20">Row</th>
                  {Array.from({ length: maxCols }).map((_, c) => {
                    const mappedField = (Object.entries(fieldMap).find(([, idx]) => idx === c)?.[0] ??
                      "") as FieldKey | "";
                    const isActive = c === activeCol;

                    return (
                      <th
                        key={c}
                        className={`px-3 py-2 text-left cursor-pointer select-none ${
                          isActive ? "bg-blue-100" : ""
                        }`}
                        onClick={() => setActiveCol(c)}
                        title="Click to select this column for mapping"
                      >
                        <div className="font-semibold">{colLetter(c)}</div>
                        <div className="text-xs text-gray-500">
                          {mappedField ? FIELD_OPTIONS.find((x) => x.key === mappedField)?.label : "(none)"}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row, rIdx) => {
                  const header = isHeaderRow(rIdx);
                  return (
                    <tr key={rIdx} className={header ? "bg-gray-100" : ""}>
                      <td className="px-3 py-2 text-gray-500">{rIdx + 1}</td>
                      {Array.from({ length: maxCols }).map((_, c) => {
                        const cell = row?.[c] ?? "";
                        return (
                          <td key={c} className="px-3 py-2 whitespace-nowrap">
                            {String(cell)}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center gap-2">
            <Button disabled={!v.ok} onClick={onFinalize}>
              Finish Import
            </Button>
            <Button variant="secondary" type="button" onClick={() => history.back()}>
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Quick Balance Check (from preview)</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-gray-700 space-y-2">
          <div>
            This is only a rough check using the preview rows (not the full file). Full balance validation happens
            on finalize.
          </div>

          <div className="flex gap-6">
            <div>
              <div className="text-xs text-gray-500">Preview sum</div>
              <div className="font-medium">
                {(() => {
                  const skip = hasHeaders ? headerRowsToSkip : 0;
                  const rows = (matrix ?? []).slice(skip, Math.min((matrix ?? []).length, skip + 30));
                  const fb = fieldMap.finalBalanceCol;
                  const d = fieldMap.debitCol;
                  const c = fieldMap.creditCol;

                  let sum = 0;
                  for (const r of rows) {
                    if (fb !== null) sum += parseNumberLoose(r?.[fb]);
                    else if (d !== null && c !== null) sum += parseNumberLoose(r?.[d]) - parseNumberLoose(r?.[c]);
                  }
                  return sum.toLocaleString(undefined, { maximumFractionDigits: 2 });
                })()}
              </div>
            </div>

            <div>
              <div className="text-xs text-gray-500">Preview rows used</div>
              <div className="font-medium">
                {(() => {
                  const skip = hasHeaders ? headerRowsToSkip : 0;
                  const rows = (matrix ?? []).slice(skip, Math.min((matrix ?? []).length, skip + 30));
                  return rows.length;
                })()}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
