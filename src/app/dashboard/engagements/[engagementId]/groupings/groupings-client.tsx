"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { updateGroupingsBulk } from "@/src/server/actions/groupings";

type Line = {
  id: string;
  account: string;
  description: string | null;
  finalBalance: any;
  auditGroup: string | null;
  auditSubgroup: string | null;
  fundCode: string | null;
  originalAuditGroup: string | null;
  originalAuditSubgroup: string | null;
  originalFundCode: string | null;
};

export default function GroupingsClient(props: {
  engagementId: string;
  importId: string;
  lines: Line[];
  fundsByCode: Record<string, { fundCode: string; name: string | null }>;
  total: number;
  page: number;
  pageSize: number;
  q: string;
  ungroupedOnly: boolean;
}) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [showOriginal, setShowOriginal] = useState(false);

  // local editable buffer
  const [draft, setDraft] = useState<Record<string, { auditGroup: string; auditSubgroup: string }>>(
    () =>
      Object.fromEntries(
        props.lines.map((l) => [
          l.id,
          { auditGroup: l.auditGroup ?? "", auditSubgroup: l.auditSubgroup ?? "" },
        ])
      )
  );

  // snapshot used for Cancel
  const [snapshot, setSnapshot] = useState(draft);

  const hasChanges = useMemo(() => {
    for (const l of props.lines) {
      const d = draft[l.id];
      if (!d) continue;
      if ((d.auditGroup ?? "") !== (l.auditGroup ?? "")) return true;
      if ((d.auditSubgroup ?? "") !== (l.auditSubgroup ?? "")) return true;
    }
    return false;
  }, [draft, props.lines]);

  function setQueryParam(key: string, val: string) {
    const sp = new URLSearchParams(window.location.search);
    if (val) sp.set(key, val);
    else sp.delete(key);
    sp.delete("page"); // reset paging on filter change
    router.push(`?${sp.toString()}`);
  }

  function gotoPage(p: number) {
    const sp = new URLSearchParams(window.location.search);
    sp.set("page", String(p));
    router.push(`?${sp.toString()}`);
  }

  const totalPages = Math.max(1, Math.ceil(props.total / props.pageSize));

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Input
            placeholder="Search account, description, fund, group..."
            defaultValue={props.q}
            onChange={(e) => setQueryParam("q", e.target.value)}
            className="w-[320px]"
          />
          <label className="text-sm flex items-center gap-2">
            <input
              type="checkbox"
              checked={props.ungroupedOnly}
              onChange={(e) => setQueryParam("ungroupedOnly", e.target.checked ? "1" : "")}
            />
            Only ungrouped
          </label>
        </div>

        <div className="flex items-center gap-2">
          {!isEditing ? (
            <Button
              onClick={() => {
                setSnapshot(draft);
                setIsEditing(true);
              }}
            >
              Edit
            </Button>
          ) : (
            <>
              <Button
                disabled={!hasChanges || isPending}
                onClick={() => {
                  startTransition(async () => {
                    const updates = props.lines.map((l) => ({
                      lineId: l.id,
                      auditGroup: draft[l.id]?.auditGroup ?? "",
                      auditSubgroup: draft[l.id]?.auditSubgroup ?? "",
                    }));
                    await updateGroupingsBulk({ engagementId: props.engagementId, updates });
                    setIsEditing(false);
                    router.refresh();
                  });
                }}
              >
                Save
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setDraft(snapshot);
                  setIsEditing(false);
                }}
                disabled={isPending}
              >
                Cancel
              </Button>
            </>
          )}

          <label className="ml-3 flex items-center gap-2 text-sm text-gray-600 select-none">
            <input
              type="checkbox"
              checked={showOriginal}
              onChange={(e) => setShowOriginal(e.target.checked)}
            />
            Show original upload columns
          </label>
        </div>
      </div>

      {/* Table */}
      <div className="border rounded-md overflow-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left">
              <th className="px-3 py-2">Account</th>
              <th className="px-3 py-2">Description</th>
              <th className="px-3 py-2">Fund</th>
              {showOriginal ? <th className="px-3 py-2">Orig Fund</th> : null}
              <th className="px-3 py-2">Group</th>
              {showOriginal ? <th className="px-3 py-2">Orig Group</th> : null}
              <th className="px-3 py-2">Subgroup</th>
              {showOriginal ? <th className="px-3 py-2">Orig Subgroup</th> : null}
              <th className="px-3 py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {props.lines.map((l) => {
              const d = draft[l.id] ?? { auditGroup: "", auditSubgroup: "" };
              const ungrouped = !(d.auditGroup?.trim() || d.auditSubgroup?.trim());
              const fund = l.fundCode ? props.fundsByCode[l.fundCode] : null;
              const fundLabel = l.fundCode
                ? `${l.fundCode}${fund?.name ? ` - ${fund.name}` : ""}`
                : "";

              const origFund = l.originalFundCode ? props.fundsByCode[l.originalFundCode] : null;
              const origFundLabel = l.originalFundCode
                ? `${l.originalFundCode}${origFund?.name ? ` - ${origFund.name}` : ""}`
                : "";

              return (
                <tr key={l.id} className={`border-t ${ungrouped ? "bg-red-50" : ""}`}>
                  <td className="px-3 py-2 font-mono">{l.account}</td>
                  <td className="px-3 py-2">{l.description ?? ""}</td>
                  <td className="px-3 py-2">{fundLabel}</td>
                  {showOriginal ? <td className="px-3 py-2 text-gray-600">{origFundLabel}</td> : null}

                  <td className="px-3 py-2">
                    <Input
                      value={d.auditGroup}
                      disabled={!isEditing}
                      className={isEditing ? "bg-white" : "bg-gray-100"}
                      onChange={(e) =>
                        setDraft((prev) => ({
                          ...prev,
                          [l.id]: { ...prev[l.id], auditGroup: e.target.value },
                        }))
                      }
                    />
                  </td>

                  {showOriginal ? (
                    <td className="px-3 py-2 text-gray-600">{l.originalAuditGroup ?? ""}</td>
                  ) : null}

                  <td className="px-3 py-2">
                    <Input
                      value={d.auditSubgroup}
                      disabled={!isEditing}
                      className={isEditing ? "bg-white" : "bg-gray-100"}
                      onChange={(e) =>
                        setDraft((prev) => ({
                          ...prev,
                          [l.id]: { ...prev[l.id], auditSubgroup: e.target.value },
                        }))
                      }
                    />
                  </td>

                  {showOriginal ? (
                    <td className="px-3 py-2 text-gray-600">{l.originalAuditSubgroup ?? ""}</td>
                  ) : null}

                  <td className="px-3 py-2 text-right font-mono">
                    {Number(l.finalBalance ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-sm">
        <div>
          Showing {(props.page - 1) * props.pageSize + 1}–{Math.min(props.total, props.page * props.pageSize)} of{" "}
          {props.total}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" disabled={props.page <= 1} onClick={() => gotoPage(props.page - 1)}>
            Prev
          </Button>
          <span>
            Page {props.page} / {totalPages}
          </span>
          <Button
            variant="secondary"
            disabled={props.page >= totalPages}
            onClick={() => gotoPage(props.page + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
