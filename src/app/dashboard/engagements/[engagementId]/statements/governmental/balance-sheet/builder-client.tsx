"use client";

import { useMemo, useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Button } from "@/src/components/ui/button";

import type {
  FundRow,
  FundCellDetails,
  StatementLineItemRow,
} from "@/src/server/actions/statements";

function formatNumber(n: number) {
  if (!n) return "";
  const abs = Math.abs(n);
  const s = abs.toLocaleString(undefined, { maximumFractionDigits: 0 });
  return n < 0 ? `(${s})` : s;
}

export function BalanceSheetBuilderClient(props: {
  engagementId: string;
  importId: string;
  templateId: string;
  lineItems: StatementLineItemRow[];
  funds: FundRow[];
  sums: Record<string, Record<string, number>>;
  loadCellDetails: (args: {
    engagementId: string;
    importId: string;
    fundCode: string;
    lineItemId: string;
  }) => Promise<FundCellDetails>;
  saveCell: (payload: {
    engagementId: string;
    importId: string;
    fundCode: string;
    lineItemId: string;
    selectedTbLineIds: string[];
  }) => Promise<void>;
}) {
  const [open, setOpen] = useState<null | { fundCode: string; lineItemId: string }>(null);
  const [details, setDetails] = useState<FundCellDetails | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [isLoading, setIsLoading] = useState(false);

  const fundIndex = useMemo(() => {
    const m: Record<string, FundRow> = {};
    for (const f of props.funds) m[f.fundCode] = f;
    return m;
  }, [props.funds]);

  async function openCell(fundCode: string, lineItemId: string) {
    setOpen({ fundCode, lineItemId });
    setIsLoading(true);
    try {
      const d = await props.loadCellDetails({
        engagementId: props.engagementId,
        importId: props.importId,
        fundCode,
        lineItemId,
      });
      setDetails(d);
      setSelected(new Set(d.included.map((x) => x.tbLineId)));
    } finally {
      setIsLoading(false);
    }
  }

  function close() {
    setOpen(null);
    setDetails(null);
    setSelected(new Set());
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function save() {
    if (!open) return;
    const selectedTbLineIds = Array.from(selected);
    startTransition(async () => {
      await props.saveCell({
        engagementId: props.engagementId,
        importId: props.importId,
        fundCode: open.fundCode,
        lineItemId: open.lineItemId,
        selectedTbLineIds,
      });
      // Refresh modal lists after save so "moved" lines show correctly
      const d = await props.loadCellDetails({
        engagementId: props.engagementId,
        importId: props.importId,
        fundCode: open.fundCode,
        lineItemId: open.lineItemId,
      });
      setDetails(d);
      setSelected(new Set(d.included.map((x) => x.tbLineId)));
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Builder</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-sm text-gray-600 mb-3">
          Click a fund/line-item cell to assign trial balance accounts. The top list is what makes up that line item.
          The bottom list is the rest of the fund’s trial balance (including items already assigned elsewhere).
        </div>

        <div className="overflow-auto border rounded">
          <table className="min-w-[900px] w-full text-sm">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b">
                <th className="text-left p-2 w-[360px]">Line item</th>
                {props.funds.map((f) => (
                  <th key={f.fundCode} className="text-right p-2 whitespace-nowrap">
                    <div className="font-medium">{f.fundCode}</div>
                    <div className="text-[11px] text-gray-500">{f.name ?? ""}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {props.lineItems.map((li) => (
                <tr key={li.id} className="border-b last:border-b-0">
                  <td className="p-2 align-top">
                    <div className="font-medium">{li.label}</div>
                    <div className="text-[11px] text-gray-500">{li.accountType}</div>
                  </td>
                  {props.funds.map((f) => {
                    const v = props.sums?.[li.id]?.[f.fundCode] ?? 0;
                    return (
                      <td key={f.fundCode} className="p-2 text-right align-top">
                        <button
                          type="button"
                          className="w-full rounded border px-2 py-1 hover:bg-gray-50 disabled:opacity-50"
                          onClick={() => openCell(f.fundCode, li.id)}
                        >
                          {formatNumber(v)}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {open ? (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50">
            <div className="bg-white w-full max-w-5xl rounded shadow-lg border">
              <div className="p-4 border-b flex items-center justify-between">
                <div>
                  <div className="text-sm text-gray-500">Assign accounts</div>
                  <div className="font-semibold">
                    Fund {open.fundCode} — {fundIndex[open.fundCode]?.name ?? ""}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={save} disabled={isPending || isLoading}>
                    {isPending ? "Saving…" : "Save"}
                  </Button>
                  <Button variant="secondary" onClick={close} disabled={isPending}>
                    Close
                  </Button>
                </div>
              </div>

              <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border rounded">
                  <div className="p-3 border-b bg-gray-50 font-medium">Included in this line item</div>
                  <div className="max-h-[420px] overflow-auto">
                    {isLoading || !details ? (
                      <div className="p-3 text-sm text-gray-600">Loading…</div>
                    ) : details.included.length === 0 ? (
                      <div className="p-3 text-sm text-gray-600">None yet.</div>
                    ) : (
                      <ul className="divide-y">
                        {details.included.map((l) => (
                          <li key={l.tbLineId} className="p-2 flex items-start gap-2">
                            <input
                              type="checkbox"
                              checked={selected.has(l.tbLineId)}
                              onChange={() => toggle(l.tbLineId)}
                            />
                            <div className="flex-1">
                              <div className="flex justify-between gap-3">
                                <div className="font-mono text-xs">{l.account}</div>
                                <div className="font-mono text-xs">{formatNumber(l.finalBalance)}</div>
                              </div>
                              <div className="text-xs text-gray-600">{l.description ?? ""}</div>
                              <div className="text-[11px] text-gray-500">
                                Uploaded: {l.originalAuditGroup ?? ""}{l.originalAuditSubgroup ? ` / ${l.originalAuditSubgroup}` : ""}
                                {" • "}Current: {l.auditGroup ?? ""}{l.auditSubgroup ? ` / ${l.auditSubgroup}` : ""}
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                <div className="border rounded">
                  <div className="p-3 border-b bg-gray-50 font-medium">Other trial balance lines for this fund</div>
                  <div className="max-h-[420px] overflow-auto">
                    {isLoading || !details ? (
                      <div className="p-3 text-sm text-gray-600">Loading…</div>
                    ) : details.others.length === 0 ? (
                      <div className="p-3 text-sm text-gray-600">No other lines found.</div>
                    ) : (
                      <ul className="divide-y">
                        {details.others.map((l) => (
                          <li key={l.tbLineId} className="p-2 flex items-start gap-2">
                            <input
                              type="checkbox"
                              checked={selected.has(l.tbLineId)}
                              onChange={() => toggle(l.tbLineId)}
                            />
                            <div className="flex-1">
                              <div className="flex justify-between gap-3">
                                <div className="font-mono text-xs">{l.account}</div>
                                <div className="font-mono text-xs">{formatNumber(l.finalBalance)}</div>
                              </div>
                              <div className="text-xs text-gray-600">{l.description ?? ""}</div>
                              <div className="text-[11px] text-gray-500">
                                Assigned to: {l.assignedLineItemId ? "another line" : "(unassigned)"}
                                {" • "}Uploaded: {l.originalAuditGroup ?? ""}{l.originalAuditSubgroup ? ` / ${l.originalAuditSubgroup}` : ""}
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-4 border-t text-xs text-gray-600">
                Tip: checking a box in “Other” will move that account into this line item when you Save (it will be removed from
                the line item it was previously assigned to).
              </div>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
