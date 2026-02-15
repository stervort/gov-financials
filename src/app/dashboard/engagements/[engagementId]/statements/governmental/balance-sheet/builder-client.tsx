"use client";

import { useMemo, useState, useTransition } from "react";
import { Button } from "@/src/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/card";

type Fund = { fundCode: string; name: string | null };
type LineItem = { id: string; code: string; label: string; category: string; order: number };

type FundTBLine = {
  id: string;
  account: string;
  description: string | null;
  finalBalance: number;
  assignedLineItemId: string | null;
};

type Props = {
  engagementId: string;
  importId: string;
  funds: Fund[];
  lineItems: LineItem[];
  matrix: any[];
  loadFundTB: (engagementId: string, importId: string, fundCode: string) => Promise<{ lines: FundTBLine[] }>;
  saveAssignments: (payload: {
    engagementId: string;
    importId: string;
    fundCode: string;
    lineItemId: string;
    checkedTbLineIds: string[];
  }) => Promise<void>;
};

function fmt(n: number) {
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  return `${sign}$${abs.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export default function BalanceSheetBuilderClient(props: Props) {
  const [open, setOpen] = useState<null | { fundCode: string; lineItemId: string }>(null);
  const [fundTbLines, setFundTbLines] = useState<FundTBLine[] | null>(null);
  const [saving, startSaving] = useTransition();
  const [loading, setLoading] = useState(false);
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const openLabel = useMemo(() => {
    if (!open) return "";
    const fund = props.funds.find((f) => f.fundCode === open.fundCode);
    const li = props.lineItems.find((x) => x.id === open.lineItemId);
    return `${fund?.fundCode ?? open.fundCode} - ${fund?.name ?? ""} • ${li?.label ?? ""}`;
  }, [open, props.funds, props.lineItems]);

  async function handleOpen(fundCode: string, lineItemId: string) {
    setOpen({ fundCode, lineItemId });
    setLoading(true);
    try {
      const res = await props.loadFundTB(props.engagementId, props.importId, fundCode);
      setFundTbLines(res.lines);
      const next: Record<string, boolean> = {};
      for (const l of res.lines) {
        next[l.id] = l.assignedLineItemId === lineItemId;
      }
      setChecked(next);
    } finally {
      setLoading(false);
    }
  }

  function toggle(id: string) {
    setChecked((p) => ({ ...p, [id]: !p[id] }));
  }

  function close() {
    setOpen(null);
    setFundTbLines(null);
    setChecked({});
  }

  function save() {
    if (!open) return;
    const checkedIds = Object.entries(checked)
      .filter(([, v]) => v)
      .map(([id]) => id);
    startSaving(async () => {
      await props.saveAssignments({
        engagementId: props.engagementId,
        importId: props.importId,
        fundCode: open.fundCode,
        lineItemId: open.lineItemId,
        checkedTbLineIds: checkedIds,
      });
      close();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Balance sheet matrix</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="overflow-auto border rounded">
          <table className="min-w-[900px] w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-2 border-b">Line item</th>
                {props.funds.map((f) => (
                  <th key={f.fundCode} className="text-right p-2 border-b whitespace-nowrap">
                    {f.fundCode} {f.name ? `- ${f.name}` : ""}
                  </th>
                ))}
                <th className="text-right p-2 border-b">Total</th>
              </tr>
            </thead>
            <tbody>
              {props.matrix.map((row: any) => (
                <tr key={row.lineItemId} className="hover:bg-gray-50">
                  <td className="p-2 border-b">
                    <div className="font-medium">{row.label}</div>
                    <div className="text-xs text-gray-500">{row.category}</div>
                  </td>
                  {props.funds.map((f) => (
                    <td key={f.fundCode} className="p-2 border-b text-right">
                      <button
                        type="button"
                        className="underline underline-offset-2"
                        onClick={() => handleOpen(f.fundCode, row.lineItemId)}
                        title="Click to assign accounts"
                      >
                        {fmt(Number(row[f.fundCode] ?? 0))}
                      </button>
                    </td>
                  ))}
                  <td className="p-2 border-b text-right font-medium">{fmt(Number(row.total ?? 0))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {open && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4">
            <div className="bg-white rounded shadow-lg w-full max-w-3xl max-h-[85vh] overflow-hidden">
              <div className="p-4 border-b flex items-start justify-between gap-4">
                <div>
                  <div className="font-semibold">Assign accounts</div>
                  <div className="text-xs text-gray-600">{openLabel}</div>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={close} disabled={saving}>
                    Cancel
                  </Button>
                  <Button onClick={save} disabled={saving || loading}>
                    {saving ? "Saving…" : "Save"}
                  </Button>
                </div>
              </div>
              <div className="p-4 overflow-auto max-h-[70vh]">
                {loading || !fundTbLines ? (
                  <div className="text-sm text-gray-700">Loading fund trial balance…</div>
                ) : fundTbLines.length === 0 ? (
                  <div className="text-sm text-gray-700">No TB lines found for this fund.</div>
                ) : (
                  <div className="space-y-2">
                    <div className="text-xs text-gray-600">
                      Tip: checked lines will be moved to this line item. If a line was previously assigned to a different line item, it will be removed from the old one.
                    </div>
                    <div className="overflow-auto border rounded">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="p-2 text-left border-b w-10"> </th>
                            <th className="p-2 text-left border-b">Account</th>
                            <th className="p-2 text-left border-b">Description</th>
                            <th className="p-2 text-right border-b">Amount</th>
                            <th className="p-2 text-left border-b">Currently grouped</th>
                          </tr>
                        </thead>
                        <tbody>
                          {fundTbLines.map((l) => (
                            <tr key={l.id} className={l.assignedLineItemId && l.assignedLineItemId !== open.lineItemId ? "bg-yellow-50" : ""}>
                              <td className="p-2 border-b">
                                <input type="checkbox" checked={!!checked[l.id]} onChange={() => toggle(l.id)} />
                              </td>
                              <td className="p-2 border-b font-mono">{l.account}</td>
                              <td className="p-2 border-b">{l.description ?? ""}</td>
                              <td className="p-2 border-b text-right">{fmt(l.finalBalance)}</td>
                              <td className="p-2 border-b text-xs text-gray-700">
                                {l.assignedLineItemId ? (l.assignedLineItemId === open.lineItemId ? "This line" : "Other line") : "Unassigned"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
