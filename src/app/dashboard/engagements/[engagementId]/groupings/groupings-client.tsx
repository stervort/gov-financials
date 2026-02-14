"use client";

import { useEffect, useMemo, useState } from "react";
import { updateGroupingsBulk } from "@/src/server/actions/groupings";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Switch } from "@/src/components/ui/switch";

type Line = {
  id: string;
  account: string;
  description: string | null;
  finalBalance: number;
  auditGroup: string | null;
  auditSubgroup: string | null;
  fundCode: string | null;
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
  const { engagementId, lines, total, page, pageSize, fundsByCode } = props;

  const [isEditing, setIsEditing] = useState(false);
  const [dirty, setDirty] = useState(false);

  const [q, setQ] = useState(props.q ?? "");
  const [ungroupedOnly, setUngroupedOnly] = useState(!!props.ungroupedOnly);

  const [draft, setDraft] = useState<
    Record<string, { auditGroup: string; auditSubgroup: string }>
  >({});

  useEffect(() => {
    const next: Record<string, { auditGroup: string; auditSubgroup: string }> = {};
    for (const l of lines) {
      next[l.id] = { auditGroup: l.auditGroup ?? "", auditSubgroup: l.auditSubgroup ?? "" };
    }
    setDraft(next);
    setDirty(false);
    setIsEditing(false);
  }, [lines]);

  const ungroupedCountOnPage = useMemo(() => {
    return lines.filter(
      (l) => !(l.auditGroup?.trim() || l.auditSubgroup?.trim())
    ).length;
  }, [lines]);

  function setField(lineId: string, field: "auditGroup" | "auditSubgroup", value: string) {
    setDraft((prev) => {
      const next = { ...prev, [lineId]: { ...(prev[lineId] ?? { auditGroup: "", auditSubgroup: "" }) } };
      next[lineId][field] = value;
      return next;
    });
    setDirty(true);
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function buildUrl(next: { page?: number; pageSize?: number; q?: string; ungroupedOnly?: boolean }) {
    const sp = new URLSearchParams();
    sp.set("page", String(next.page ?? page));
    sp.set("pageSize", String(next.pageSize ?? pageSize));

    const nq = (next.q ?? q).trim();
    if (nq) sp.set("q", nq);

    const uo = next.ungroupedOnly ?? ungroupedOnly;
    if (uo) sp.set("ungroupedOnly", "1");

    return `/dashboard/engagements/${engagementId}/groupings?${sp.toString()}`;
  }

  async function onSave() {
    const updates = Object.entries(draft).map(([lineId, v]) => ({
      lineId,
      auditGroup: v.auditGroup,
      auditSubgroup: v.auditSubgroup,
    }));

    await updateGroupingsBulk({ engagementId, updates });
    setDirty(false);
    setIsEditing(false);
  }

  function onCancel() {
    const next: Record<string, { auditGroup: string; auditSubgroup: string }> = {};
    for (const l of lines) next[l.id] = { auditGroup: l.auditGroup ?? "", auditSubgroup: l.auditSubgroup ?? "" };
    setDraft(next);
    setDirty(false);
    setIsEditing(false);
  }

  return (
    <div className="space-y-4">
      {/* Top toolbar */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <div className="text-sm text-gray-600">
            Showing <span className="font-medium">{lines.length}</span> of{" "}
            <span className="font-medium">{total}</span> lines (page {page} / {totalPages})
          </div>
          <div className="text-sm text-gray-600">
            Ungrouped on this page: <span className="font-medium">{ungroupedCountOnPage}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 justify-end">
          {!isEditing ? (
            <Button variant="secondary" onClick={() => setIsEditing(true)}>
              Edit
            </Button>
          ) : (
            <>
              <Button onClick={onSave} disabled={!dirty}>
                Save
              </Button>
              <Button variant="secondary" onClick={onCancel}>
                Cancel
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <form className="flex items-center gap-2" action={buildUrl({ page: 1, q, ungroupedOnly })}>
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search account, description, fund, group, subgroup..."
            className="w-full md:w-[420px]"
          />
          <Button type="button" variant="secondary" onClick={() => (window.location.href = buildUrl({ page: 1, q, ungroupedOnly }))}>
            Apply
          </Button>
        </form>

        <div className="flex items-center gap-2">
          <Switch
            checked={ungroupedOnly}
            onCheckedChange={(v) => {
              setUngroupedOnly(!!v);
              window.location.href = buildUrl({ page: 1, ungroupedOnly: !!v });
            }}
          />
          <div className="text-sm">Ungrouped only</div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-auto border rounded-md">
        <table className="min-w-[980px] w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="px-3 py-2 w-[140px]">Account</th>
              <th className="px-3 py-2">Description</th>
              <th className="px-3 py-2 w-[180px]">Fund</th>
              <th className="px-3 py-2 w-[180px]">Group</th>
              <th className="px-3 py-2 w-[180px]">Subgroup</th>
              <th className="px-3 py-2 w-[140px] text-right">Amount</th>
            </tr>
          </thead>

          <tbody className="divide-y">
            {lines.map((l) => {
              const isUngrouped = !(l.auditGroup?.trim() || l.auditSubgroup?.trim());
              const fund = l.fundCode ? fundsByCode[l.fundCode] : null;
              const fundLabel = l.fundCode
                ? `${l.fundCode}${fund?.name ? ` - ${fund.name}` : ""}`
                : "";

              const row = draft[l.id] ?? { auditGroup: "", auditSubgroup: "" };

              return (
                <tr key={l.id} className={isUngrouped ? "bg-red-50" : ""}>
                  <td className="px-3 py-2 font-mono">{l.account}</td>
                  <td className="px-3 py-2">{l.description ?? ""}</td>
                  <td className="px-3 py-2">{fundLabel}</td>

                  <td className="px-3 py-2">
                    <Input
                      value={row.auditGroup}
                      disabled={!isEditing}
                      className={isEditing ? "bg-white" : "bg-gray-100"}
                      onChange={(e) => setField(l.id, "auditGroup", e.target.value)}
                      placeholder="(none)"
                    />
                  </td>

                  <td className="px-3 py-2">
                    <Input
                      value={row.auditSubgroup}
                      disabled={!isEditing}
                      className={isEditing ? "bg-white" : "bg-gray-100"}
                      onChange={(e) => setField(l.id, "auditSubgroup", e.target.value)}
                      placeholder="(none)"
                    />
                  </td>

                  <td className="px-3 py-2 text-right font-mono">
                    {Number(l.finalBalance ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-600">
          Page {page} of {totalPages}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            disabled={page <= 1}
            onClick={() => (window.location.href = buildUrl({ page: Math.max(1, page - 1) }))}
          >
            Prev
          </Button>
          <Button
            variant="secondary"
            disabled={page >= totalPages}
            onClick={() => (window.location.href = buildUrl({ page: Math.min(totalPages, page + 1) }))}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
