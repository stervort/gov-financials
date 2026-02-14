"use client";

import * as React from "react";
import { Button } from "@/src/components/ui/button";

type PreviewRow = {
  rowNumber: number; // 1-based original file row
  cells: string[];
};

export type FieldKey =
  | "accountCol"
  | "descriptionCol"
  | "finalBalanceCol"
  | "debitCol"
  | "creditCol"
  | "groupCol"
  | "subgroupCol"
  | "fundCol";

type FieldOption = { key: FieldKey | ""; label: string };

const FIELD_OPTIONS: FieldOption[] = [
  { key: "", label: "(none)" },
  { key: "accountCol", label: "Account (required)" },
  { key: "descriptionCol", label: "Description (optional)" },
  { key: "finalBalanceCol", label: "Final Balance (use this OR Debit/Credit)" },
  { key: "debitCol", label: "Debit (if no Final Balance)" },
  { key: "creditCol", label: "Credit (if no Final Balance)" },
  { key: "groupCol", label: "Group (optional)" },
  { key: "subgroupCol", label: "Subgroup (optional)" },
  { key: "fundCol", label: 'Fund (code or "10 - Name")' },
];

function colLetter(i: number) {
  // 0 -> A, 1 -> B, ...
  return String.fromCharCode("A".charCodeAt(0) + i);
}

function normalizeFund(raw: string) {
  // Accept:
  // 10
  // 10 - General Fund
  // 10- General Fund
  // 10–General Fund (en dash)
  // Return: "10" (fund code)
  const s = (raw ?? "").trim();
  if (!s) return "";
  const m = s.match(/^(\d{1,4})\s*(?:[-–—]\s*.*)?$/);
  return m ? m[1] : s; // if not numeric prefix, store raw
}

type Props = {
  engagementId: string;
  importId: string;
  fileName: string | null;
  hasHeaders: boolean;
  headerRowsToSkip: number;
  preview: {
    maxCols: number;
    rows: PreviewRow[];
  };
  existingMapping?: Partial<Record<FieldKey, number>>; // 0-based column index
  actionFinalize: (payload: {
    engagementId: string;
    importId: string;
    mapping: Partial<Record<FieldKey, number>>;
    hasHeaders: boolean;
    headerRowsToSkip: number;
  }) => Promise<{ ok: boolean; error?: string; redirectTo?: string }>;
};

export default function TBMapperClient(props: Props) {
  const [hasHeaders, setHasHeaders] = React.useState<boolean>(props.hasHeaders);
  const [headerRowsToSkip, setHeaderRowsToSkip] = React.useState<number>(
    props.headerRowsToSkip ?? 0
  );

  const [mapping, setMapping] = React.useState<Partial<Record<FieldKey, number>>>(
    props.existingMapping ?? {}
  );

  const [activeCol, setActiveCol] = React.useState<number | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const rows = props.preview.rows ?? [];
  const maxCols = props.preview.maxCols ?? 0;

  const activeColCurrentField: FieldKey | "" = React.useMemo(() => {
    if (activeCol == null) return "";
    const hit = (Object.entries(mapping) as Array<[FieldKey, number]>).find(
      ([, colIdx]) => colIdx === activeCol
    );
    return hit ? hit[0] : "";
  }, [activeCol, mapping]);

  function setActiveColToField(field: FieldKey | "") {
    if (activeCol == null) return;

    setMapping((prev) => {
      const next = { ...prev };

      // remove any field currently pointing at this column
      for (const k of Object.keys(next) as FieldKey[]) {
        if (next[k] === activeCol) delete next[k];
      }

      // if selecting a field, ensure it isn't already mapped elsewhere
      if (field) {
        // remove field from any other column
        if (next[field] != null) delete next[field];
        next[field] = activeCol;
      }

      return next;
    });
  }

  function isValid(mappingObj: Partial<Record<FieldKey, number>>) {
    const hasAccount = mappingObj.accountCol != null;
    const hasFinal = mappingObj.finalBalanceCol != null;
    const hasDebit = mappingObj.debitCol != null;
    const hasCredit = mappingObj.creditCol != null;

    if (!hasAccount) return { ok: false, msg: "You must map Account." };

    // Must have either Final OR (Debit + Credit)
    if (hasFinal) return { ok: true, msg: "" };
    if (hasDebit && hasCredit) return { ok: true, msg: "" };

    return { ok: false, msg: "Select Final Balance OR both Debit and Credit." };
  }

  const validation = isValid(mapping);

  async function onFinish() {
    setError(null);
    const v = isValid(mapping);
    if (!v.ok) {
      setError(v.msg);
      return;
    }

    setSaving(true);
    try {
      const res = await props.actionFinalize({
        engagementId: props.engagementId,
        importId: props.importId,
        mapping,
        hasHeaders,
        headerRowsToSkip,
      });

      if (!res.ok) {
        setError(res.error ?? "Failed to finalize mapping.");
        setSaving(false);
        return;
      }

      // Redirect if provided; otherwise go back to engagement
      const fallback = `/dashboard/engagements/${props.engagementId}`;
      window.location.href = res.redirectTo ?? fallback;
    } catch (e: any) {
      setError(e?.message ?? "Failed to finalize mapping.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Header rows */}
      <div className="rounded-md border p-4 space-y-3">
        <div className="font-medium">Header Rows</div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={hasHeaders}
            onChange={(e) => setHasHeaders(e.target.checked)}
          />
          My file has header rows (skip them)
        </label>

        <div className="flex items-center gap-3 text-sm">
          <div className={hasHeaders ? "" : "text-gray-400"}>TB data starts on row:</div>
          <input
            type="number"
            min={1}
            className="h-9 w-24 rounded-md border px-2"
            disabled={!hasHeaders}
            value={hasHeaders ? headerRowsToSkip + 1 : 1}
            onChange={(e) => {
              const startRow = Math.max(1, Number(e.target.value || 1));
              setHeaderRowsToSkip(Math.max(0, startRow - 1));
            }}
          />
          <div className="text-gray-500">(row number in the file)</div>
        </div>
      </div>

      {/* Mapping instructions */}
      <div className="rounded-md border p-4 space-y-2">
        <div className="font-medium">Column Mapping</div>
        <div className="text-sm text-gray-600">
          Click a column header (A, B, C...) then choose what that column represents.
        </div>

        {activeCol != null ? (
          <div className="flex items-center gap-3 text-sm">
            <div className="font-medium">
              Selected Column: {colLetter(activeCol)}
            </div>

            <select
              className="h-9 rounded-md border px-2"
              value={activeColCurrentField}
              onChange={(e) => setActiveColToField(e.target.value as FieldKey | "")}
            >
              {FIELD_OPTIONS.map((o) => (
                <option key={o.label} value={o.key}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="text-sm text-gray-500">Select a column header to map it.</div>
        )}

        <div className="text-xs text-gray-500 pt-1">
          Rule: You must select <b>Account</b>, and either <b>Final Balance</b> OR both{" "}
          <b>Debit</b> + <b>Credit</b>.
        </div>

        {!validation.ok && (
          <div className="text-sm text-red-600">{validation.msg}</div>
        )}
        {error && <div className="text-sm text-red-600">{error}</div>}

        <div className="flex items-center gap-2 pt-2">
          <Button onClick={onFinish} disabled={saving || !validation.ok}>
            {saving ? "Finishing..." : "Finish Import"}
          </Button>

          <Button
            variant="secondary"
            onClick={() => (window.location.href = `/dashboard/engagements/${props.engagementId}`)}
            disabled={saving}
          >
            Cancel
          </Button>
        </div>
      </div>

      {/* Preview table */}
      <div className="rounded-md border overflow-hidden">
        <div className="p-3 text-sm text-gray-600 border-b">
          Preview ({rows.length} rows shown)
        </div>

        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                <th className="text-left px-3 py-2 border-b w-20">Row</th>
                {Array.from({ length: maxCols }).map((_, idx) => {
                  const mappedField = (Object.entries(mapping) as Array<[FieldKey, number]>).find(
                    ([, colIdx]) => colIdx === idx
                  )?.[0];

                  const isSelected = activeCol === idx;

                  return (
                    <th
                      key={idx}
                      className={[
                        "text-left px-3 py-2 border-b cursor-pointer whitespace-nowrap",
                        isSelected ? "bg-white" : "",
                      ].join(" ")}
                      onClick={() => setActiveCol(idx)}
                      title="Click to map this column"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{colLetter(idx)}</span>
                        {mappedField ? (
                          <span className="text-xs text-gray-600">
                            • {FIELD_OPTIONS.find((o) => o.key === mappedField)?.label ?? mappedField}
                          </span>
                        ) : null}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>

            <tbody>
              {rows.map((r) => {
                const shouldSkip =
                  hasHeaders && r.rowNumber <= headerRowsToSkip ? true : false;

                return (
                  <tr
                    key={r.rowNumber}
                    className={shouldSkip ? "bg-gray-100 text-gray-500" : ""}
                  >
                    <td className="px-3 py-2 border-b">{r.rowNumber}</td>
                    {Array.from({ length: maxCols }).map((_, idx) => (
                      <td key={idx} className="px-3 py-2 border-b whitespace-nowrap">
                        {r.cells[idx] ?? ""}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tiny UX hint */}
      <div className="text-xs text-gray-500">
        Tip: If your file includes a fund column like <code>10 - General Fund</code>, map it to{" "}
        <b>Fund</b>. We’ll store the fund code (e.g., <code>10</code>) and keep the display name
        later from Fund Setup.
      </div>
    </div>
  );
}
