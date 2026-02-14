"use client";

import * as React from "react";
import { useMemo, useState } from "react";
import { Button } from "@/src/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/card";

type FieldKey =
  | "accountCol"
  | "descriptionCol"
  | "finalBalanceCol"
  | "debitCol"
  | "creditCol"
  | "groupCol"
  | "subgroupCol"
  | "fundCol";

type ColumnMapping = Partial<Record<FieldKey, number>>;

type Props = {
  engagementId: string;
  importId: string;
  matrix: any[][];
  finalizeAction: (formData: FormData) => Promise<void>;
  // ✅ make optional so the page doesn't have to pass it
  suggestedHasHeaders?: boolean;
};

const FIELD_OPTIONS: Array<{ key: "" | FieldKey; label: string }> = [
  { key: "", label: "(none)" },
  { key: "accountCol", label: "Account (required)" },
  { key: "descriptionCol", label: "Description (optional)" },
  { key: "finalBalanceCol", label: "Final Balance (choose this OR Debit/Credit)" },
  { key: "debitCol", label: "Debit (if no Final Balance)" },
  { key: "creditCol", label: "Credit (if no Final Balance)" },
  { key: "groupCol", label: "Group (optional)" },
  { key: "subgroupCol", label: "Subgroup (optional)" },
  { key: "fundCol", label: 'Fund (code or "10 - Name")' },
];

function colLetter(i: number) {
  // A, B, C...
  return String.fromCharCode("A".charCodeAt(0) + i);
}

export default function TBMapperClient({
  engagementId,
  importId,
  matrix,
  finalizeAction,
  suggestedHasHeaders,
}: Props) {
  // ✅ default if undefined
  const defaultHasHeaders = suggestedHasHeaders ?? false;

  const [hasHeaders, setHasHeaders] = useState<boolean>(defaultHasHeaders);
  const [headerRowsToSkip, setHeaderRowsToSkip] = useState<number>(hasHeaders ? 1 : 0);

  // mapping by column index => selected field
  const colCount = useMemo(() => {
    const firstRow = matrix?.[0] ?? [];
    return Array.isArray(firstRow) ? firstRow.length : 0;
  }, [matrix]);

  const [colToField, setColToField] = useState<Record<number, "" | FieldKey>>({});

  const [activeCol, setActiveCol] = useState<number | null>(null);

  const headerPreviewRowIndex = hasHeaders ? headerRowsToSkip - 1 : -1;

  const previewRows = useMemo(() => {
    const start = Math.max(headerRowsToSkip, 0);
    return (matrix ?? []).slice(start, start + 25);
  }, [matrix, headerRowsToSkip]);

  const headerRow = useMemo(() => {
    if (!hasHeaders) return null;
    if (headerPreviewRowIndex < 0) return null;
    return matrix?.[headerPreviewRowIndex] ?? null;
  }, [hasHeaders, headerPreviewRowIndex, matrix]);

  const mapping = useMemo(() => {
    const m: ColumnMapping = {};
    for (const [colStr, field] of Object.entries(colToField)) {
      if (!field) continue;
      const col = Number(colStr);
      m[field] = col;
    }
    return m;
  }, [colToField]);

  const mappingValidation = useMemo(() => {
    const hasAccount = typeof mapping.accountCol === "number";
    const hasFinal = typeof mapping.finalBalanceCol === "number";
    const hasDebit = typeof mapping.debitCol === "number";
    const hasCredit = typeof mapping.creditCol === "number";

    if (!hasAccount) return { ok: false, msg: "You must map Account." };
    if (hasFinal && (hasDebit || hasCredit)) {
      return { ok: false, msg: "Choose Final Balance OR Debit/Credit, not both." };
    }
    if (!hasFinal && !(hasDebit && hasCredit)) {
      return { ok: false, msg: "You must map Final Balance OR both Debit and Credit." };
    }
    return { ok: true, msg: "" };
  }, [mapping]);

  function setActiveColToField(field: "" | FieldKey) {
    if (activeCol === null) return;

    setColToField((prev) => {
      // prevent duplicate assignment of same field (except "")
      const next = { ...prev };

      if (field) {
        for (const [k, v] of Object.entries(next)) {
          if (v === field) delete next[Number(k)];
        }
      }

      if (!field) {
        delete next[activeCol];
      } else {
        next[activeCol] = field;
      }
      return next;
    });
  }

  function handleFinalize() {
    if (!mappingValidation.ok) return;

    const fd = new FormData();
    fd.set("engagementId", engagementId);
    fd.set("importId", importId);
    fd.set("hasHeaders", hasHeaders ? "true" : "false");
    fd.set("headerRowsToSkip", String(headerRowsToSkip));

    // send mapping fields => numeric column index
    for (const [field, col] of Object.entries(mapping)) {
      fd.set(field, String(col));
    }

    finalizeAction(fd);
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Header Rows</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={hasHeaders}
              onChange={(e) => {
                const v = e.target.checked;
                setHasHeaders(v);
                setHeaderRowsToSkip(v ? 1 : 0);
              }}
            />
            My file has header rows (skip them)
          </label>

          <div className="text-sm flex items-center gap-3">
            <div className={hasHeaders ? "" : "opacity-50"}>
              TB data starts on row:
            </div>
            <input
              type="number"
              min={1}
              disabled={!hasHeaders}
              value={hasHeaders ? headerRowsToSkip + 1 : 1}
              onChange={(e) => {
                const startRow = Math.max(parseInt(e.target.value || "1", 10), 1);
                setHeaderRowsToSkip(Math.max(startRow - 1, 0));
              }}
              className="w-24 border rounded px-2 py-1 text-sm"
            />
            <div className="text-xs text-gray-500">
              (Set to the row number where the TB data begins)
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Preview + Click-to-Map Columns</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm text-gray-600">
            Click a column header (A, B, C…) to choose what that column represents.
          </div>

          {activeCol !== null && (
            <div className="flex items-center gap-3">
              <div className="text-sm font-medium">
                Mapping Column {colLetter(activeCol)}
                {headerRow?.[activeCol] ? ` (${String(headerRow[activeCol])})` : ""}
              </div>

              <select
                className="border rounded px-2 py-1 text-sm"
                value={colToField[activeCol] ?? ""}
                onChange={(e) => setActiveColToField(e.target.value as any)}
              >
                {FIELD_OPTIONS.map((o) => (
                  <option key={o.key} value={o.key}>
                    {o.label}
                  </option>
                ))}
              </select>

              {colToField[activeCol] ? (
                <div className="text-xs text-gray-500">
                  Currently: {FIELD_OPTIONS.find((x) => x.key === colToField[activeCol])?.label}
                </div>
              ) : null}
            </div>
          )}

          <div className="overflow-auto border rounded">
            <table className="min-w-[900px] w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {Array.from({ length: colCount }).map((_, i) => {
                    const mapped = colToField[i];
                    return (
                      <th
                        key={i}
                        className="p-2 border-b cursor-pointer select-none text-left"
                        onClick={() => setActiveCol(i)}
                        title="Click to map this column"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-semibold">
                            {colLetter(i)}
                            {headerRow?.[i] ? `: ${String(headerRow[i])}` : ""}
                          </div>
                          <div className="text-xs text-gray-500">
                            {mapped ? FIELD_OPTIONS.find((x) => x.key === mapped)?.label : "(unmapped)"}
                          </div>
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>

              <tbody>
                {previewRows.map((row, rIdx) => (
                  <tr key={rIdx} className="odd:bg-white even:bg-gray-50">
                    {Array.from({ length: colCount }).map((_, cIdx) => (
                      <td key={cIdx} className="p-2 border-b">
                        {row?.[cIdx] == null ? "" : String(row[cIdx])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!mappingValidation.ok ? (
            <div className="text-sm text-red-600">{mappingValidation.msg}</div>
          ) : (
            <div className="text-sm text-green-700">
              Ready to import. (Account + Final Balance OR Debit+Credit selected)
            </div>
          )}

          <div className="flex items-center gap-2">
            <Button type="button" onClick={handleFinalize} disabled={!mappingValidation.ok}>
              Finish Import
            </Button>
            <a href={`/dashboard/engagements/${engagementId}/tb`} className="text-sm underline">
              Cancel
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
