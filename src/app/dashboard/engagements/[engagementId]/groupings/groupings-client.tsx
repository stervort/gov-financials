"use client";

import { useMemo, useState } from "react";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";

type Line = {
  id: string;
  account: string;
  description: string | null;
  finalBalance: any; // Prisma Decimal serialized
  auditGroup: string | null;
  auditSubgroup: string | null;
};

type Props = {
  engagementId: string;
  lines: Line[];
  updateLineGrouping: (formData: FormData) => Promise<void>;
};

type Filters = {
  account: string;
  description: string;
  balance: string; // supports: >1000, <0, =0, 100..200, or plain substring
  auditGroup: string;
  auditSubgroup: string;
  onlyUngrouped: boolean;
};

function parseBalanceFilter(expr: string): ((n: number) => boolean) | null {
  const s = expr.trim();
  if (!s) return null;

  // range: 100..200
  const mRange = s.match(/^(-?\d+(?:\.\d+)?)\s*\.\.\s*(-?\d+(?:\.\d+)?)$/);
  if (mRange) {
    const a = Number(mRange[1]);
    const b = Number(mRange[2]);
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    return (n) => n >= lo && n <= hi;
  }

  // comparisons: >, >=, <, <=, =
  const mComp = s.match(/^(>=|<=|>|<|=)\s*(-?\d+(?:\.\d+)?)$/);
  if (mComp) {
    const op = mComp[1];
    const v = Number(mComp[2]);
    if (op === ">") return (n) => n > v;
    if (op === ">=") return (n) => n >= v;
    if (op === "<") return (n) => n < v;
    if (op === "<=") return (n) => n <= v;
    return (n) => n === v;
  }

  // plain text: treat as substring on formatted number
  return (n) => String(n).includes(s);
}

export default function GroupingsClient({ engagementId, lines, updateLineGrouping }: Props) {
  const [filters, setFilters] = useState<Filters>({
    account: "",
    description: "",
    balance: "",
    auditGroup: "",
    auditSubgroup: "",
    onlyUngrouped: false,
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ auditGroup: string; auditSubgroup: string }>({
    auditGroup: "",
    auditSubgroup: "",
  });

  const balancePredicate = useMemo(() => parseBalanceFilter(filters.balance), [filters.balance]);

  const filtered = useMemo(() => {
    const f = {
      account: filters.account.trim().toLowerCase(),
      description: filters.description.trim().toLowerCase(),
      auditGroup: filters.auditGroup.trim().toLowerCase(),
      auditSubgroup: filters.auditSubgroup.trim().toLowerCase(),
      onlyUngrouped: filters.onlyUngrouped,
    };

    return lines.filter((l) => {
      const ungrouped = !l.auditGroup || !l.auditGroup.trim();
      if (f.onlyUngrouped && !ungrouped) return false;

      if (f.account && !l.account.toLowerCase().includes(f.account)) return false;
      if (f.description && !(l.description ?? "").toLowerCase().includes(f.description)) return false;
      if (f.auditGroup && !(l.auditGroup ?? "").toLowerCase().includes(f.auditGroup)) return false;
      if (f.auditSubgroup && !(l.auditSubgroup ?? "").toLowerCase().includes(f.auditSubgroup)) return false;

      if (balancePredicate) {
        const n = Number(l.finalBalance ?? 0);
        if (!balancePredicate(n)) return false;
      }

      return true;
    });
  }, [lines, filters, balancePredicate]);

  const counts = useMemo(() => {
    const total = lines.length;
    const ungrouped = lines.filter((l) => !l.auditGroup || !l.auditGroup.trim()).length;
    return { total, ungrouped, grouped: total - ungrouped, showing: filtered.length };
  }, [lines, filtered]);

  function startEdit(l: Line) {
    setEditingId(l.id);
    setDraft({
      auditGroup: l.auditGroup ?? "",
      auditSubgroup: l.auditSubgroup ?? "",
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft({ auditGroup: "", auditSubgroup: "" });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3 items-center text-sm">
        <div>
          <span className="font-medium">Total:</span> {counts.total.toLocaleString()}
        </div>
        <div>
          <span className="font-medium">Grouped:</span> {counts.grouped.toLocaleString()}
        </div>
        <div className={counts.ungrouped ? "text-red-700" : ""}>
          <span className="font-medium">Ungrouped:</span> {counts.ungrouped.toLocaleString()}
        </div>
        <div className="text-gray-500">Showing: {counts.showing.toLocaleString()}</div>

        <div className="ml-auto flex items-center gap-2">
          <input
            id="onlyUngrouped"
            type="checkbox"
            checked={filters.onlyUngrouped}
            onChange={(e) => setFilters((p) => ({ ...p, onlyUngrouped: e.target.checked }))}
          />
          <label htmlFor="onlyUngrouped">Only ungrouped</label>
        </div>
      </div>

      <div className="overflow-auto border rounded-md">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left">
              <th className="px-3 py-2">Account</th>
              <th className="px-3 py-2">Description</th>
              <th className="px-3 py-2 text-right">Balance</th>
              <th className="px-3 py-2">Group</th>
              <th className="px-3 py-2">Subgroup</th>
              <th className="px-3 py-2 w-[220px]"></th>
            </tr>
            <tr className="text-left border-t">
              <th className="px-3 py-2">
                <Input
                  value={filters.account}
                  onChange={(e) => setFilters((p) => ({ ...p, account: e.target.value }))}
                  placeholder="filter…"
                />
              </th>
              <th className="px-3 py-2">
                <Input
                  value={filters.description}
                  onChange={(e) => setFilters((p) => ({ ...p, description: e.target.value }))}
                  placeholder="filter…"
                />
              </th>
              <th className="px-3 py-2">
                <Input
                  value={filters.balance}
                  onChange={(e) => setFilters((p) => ({ ...p, balance: e.target.value }))}
                  placeholder="e.g. >0, 0..1000"
                />
              </th>
              <th className="px-3 py-2">
                <Input
                  value={filters.auditGroup}
                  onChange={(e) => setFilters((p) => ({ ...p, auditGroup: e.target.value }))}
                  placeholder="filter…"
                />
              </th>
              <th className="px-3 py-2">
                <Input
                  value={filters.auditSubgroup}
                  onChange={(e) => setFilters((p) => ({ ...p, auditSubgroup: e.target.value }))}
                  placeholder="filter…"
                />
              </th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>

          <tbody>
            {filtered.map((l) => {
              const isUngrouped = !l.auditGroup || !l.auditGroup.trim();
              const isEditing = editingId === l.id;
              const formId = `line-${l.id}`;

              return (
                <tr key={l.id} className={"border-t align-top " + (isUngrouped ? "bg-red-50" : "")}>
                  <td className="px-3 py-2 font-mono whitespace-nowrap">{l.account}</td>
                  <td className="px-3 py-2">{l.description ?? ""}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    {Number(l.finalBalance).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>

                  <td className="px-3 py-2">
                    <Input
                      form={formId}
                      name="auditGroup"
                      value={isEditing ? draft.auditGroup : l.auditGroup ?? ""}
                      onChange={(e) => setDraft((p) => ({ ...p, auditGroup: e.target.value }))}
                      disabled={!isEditing}
                      className={!isEditing ? "bg-gray-100" : ""}
                      placeholder="e.g., Assets"
                    />
                  </td>

                  <td className="px-3 py-2">
                    <Input
                      form={formId}
                      name="auditSubgroup"
                      value={isEditing ? draft.auditSubgroup : l.auditSubgroup ?? ""}
                      onChange={(e) => setDraft((p) => ({ ...p, auditSubgroup: e.target.value }))}
                      disabled={!isEditing}
                      className={!isEditing ? "bg-gray-100" : ""}
                      placeholder="e.g., Cash"
                    />
                  </td>

                  <td className="px-3 py-2">
                    <form id={formId} action={updateLineGrouping} className="flex items-center gap-2">
                      <input type="hidden" name="engagementId" value={engagementId} />
                      <input type="hidden" name="lineId" value={l.id} />

                      {isEditing ? (
                        <>
                          <Button type="submit" variant="secondary">
                            Save
                          </Button>
                          <Button type="button" variant="ghost" onClick={cancelEdit}>
                            Cancel
                          </Button>
                        </>
                      ) : (
                        <Button type="button" variant="secondary" onClick={() => startEdit(l)}>
                          Edit
                        </Button>
                      )}
                    </form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="text-xs text-gray-500">
        Balance filter examples: <span className="font-mono">&gt;0</span>, <span className="font-mono">&lt;0</span>,{" "}
        <span className="font-mono">100..500</span>
      </div>
    </div>
  );
}
