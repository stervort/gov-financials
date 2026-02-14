"use client";

import { useMemo, useState } from "react";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";

type Line = {
  id: string;
  account: string;
  description: string | null;
  finalBalance: any;
  auditGroup: string | null;
  auditSubgroup: string | null;
};

type Props = {
  engagementId: string;
  lines: Line[];
  totalLines: number;
  bulkUpdateGroupings: (formData: FormData) => Promise<void>;
};

type Filters = {
  account: string;
  description: string;
  balance: string; // >0, <0, =0, 100..200, etc
  auditGroup: string;
  auditSubgroup: string;
  onlyUngrouped: boolean;
};

function parseBalanceFilter(expr: string): ((n: number) => boolean) | null {
  const s = expr.trim();
  if (!s) return null;

  const mRange = s.match(/^(-?\d+(?:\.\d+)?)\s*\.\.\s*(-?\d+(?:\.\d+)?)$/);
  if (mRange) {
    const a = Number(mRange[1]);
    const b = Number(mRange[2]);
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    return (n) => n >= lo && n <= hi;
  }

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

  return (n) => String(n).includes(s);
}

export default function GroupingsClient({ engagementId, lines, totalLines, bulkUpdateGroupings }: Props) {
  const [filters, setFilters] = useState<Filters>({
    account: "",
    description: "",
    balance: "",
    auditGroup: "",
    auditSubgroup: "",
    onlyUngrouped: false,
  });

  // Edit mode & staged edits
  const [editMode, setEditMode] = useState(false);

  // Original values snapshot for cancel behavior
  const originalById = useMemo(() => {
    const m = new Map<string, { auditGroup: string; auditSubgroup: string }>();
    for (const l of lines) {
      m.set(l.id, {
        auditGroup: l.auditGroup ?? "",
        auditSubgroup: l.auditSubgroup ?? "",
      });
    }
    return m;
  }, [lines]);

  // Staged values (what user is editing)
  const [draftById, setDraftById] = useState<Record<string, { auditGroup: string; auditSubgroup: string }>>(() => {
    const o: Record<string, { auditGroup: string; auditSubgroup: string }> = {};
    for (const l of lines) {
      o[l.id] = { auditGroup: l.auditGroup ?? "", auditSubgroup: l.auditSubgroup ?? "" };
    }
    return o;
  });

  // When lines change (new import), reset draft
  // (not fancy: if you want, we can preserve if same import)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  // @ts-ignore
  if (Object.keys(draftById).length === 0 && lines.length > 0) {
    // no-op
  }

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
      const d = draftById[l.id] ?? { auditGroup: l.auditGroup ?? "", auditSubgroup: l.auditSubgroup ?? "" };
      const ungrouped = !d.auditGroup || !d.auditGroup.trim();

      if (f.onlyUngrouped && !ungrouped) return false;
      if (f.account && !l.account.toLowerCase().includes(f.account)) return false;
      if (f.description && !(l.description ?? "").toLowerCase().includes(f.description)) return false;
      if (f.auditGroup && !(d.auditGroup ?? "").toLowerCase().includes(f.auditGroup)) return false;
      if (f.auditSubgroup && !(d.auditSubgroup ?? "").toLowerCase().includes(f.auditSubgroup)) return false;

      if (balancePredicate) {
        const n = Number(l.finalBalance ?? 0);
        if (!balancePredicate(n)) return false;
      }

      return true;
    });
  }, [lines, filters, balancePredicate, draftById]);

  const counts = useMemo(() => {
    const total = lines.length;
    const ungrouped = lines.filter((l) => {
      const d = draftById[l.id] ?? { auditGroup: l.auditGroup ?? "", auditSubgroup: l.auditSubgroup ?? "" };
      return !d.auditGroup || !d.auditGroup.trim();
    }).length;
    return { total, ungrouped, grouped: total - ungrouped, showing: filtered.length };
  }, [lines, filtered, draftById]);

  const isDirty = useMemo(() => {
    for (const l of lines) {
      const o = originalById.get(l.id);
      const d = draftById[l.id];
      if (!o || !d) continue;
      if ((o.auditGroup ?? "") !== (d.auditGroup ?? "")) return true;
      if ((o.auditSubgroup ?? "") !== (d.auditSubgroup ?? "")) return true;
    }
    return false;
  }, [lines, draftById, originalById]);

  function onEdit() {
    setEditMode(true);
  }

  function onCancel() {
    // revert staged edits back to original snapshot
    const next: Record<string, { auditGroup: string; auditSubgroup: string }> = { ...draftById };
    for (const l of lines) {
      const o = originalById.get(l.id);
      if (!o) continue;
      next[l.id] = { auditGroup: o.auditGroup ?? "", auditSubgroup: o.auditSubgroup ?? "" };
    }
    setDraftById(next);
    setEditMode(false);
  }

  async function onSave() {
    // only send changed rows
    const edits: Array<{ lineId: string; auditGroup: string; auditSubgroup: string }> = [];

    for (const l of lines) {
      const o = originalById.get(l.id);
      const d = draftById[l.id];
      if (!o || !d) continue;

      if ((o.auditGroup ?? "") !== (d.auditGroup ?? "") || (o.auditSubgroup ?? "") !== (d.auditSubgroup ?? "")) {
        edits.push({
          lineId: l.id,
          auditGroup: d.auditGroup ?? "",
          auditSubgroup: d.auditSubgroup ?? "",
        });
      }
    }

    const fd = new FormData();
    fd.set("engagementId", engagementId);
    fd.set("editsJson", JSON.stringify(edits));

    await bulkUpdateGroupings(fd);

    // After server action completes, the page will revalidate and refresh.
    // We can also lock immediately for the UX.
    setEditMode(false);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3 items-center text-sm">
        <div>
          <span className="font-medium">Loaded:</span> {counts.total.toLocaleString()}{" "}
          <span className="text-gray-500">(DB total {totalLines.toLocaleString()})</span>
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

          {/* Top-right controls */}
          {!editMode ? (
            <Button variant="secondary" onClick={onEdit}>
              Edit
            </Button>
          ) : (
            <>
              <Button variant="secondary" onClick={onSave} disabled={!isDirty}>
                Save
              </Button>
              <Button variant="ghost" onClick={onCancel}>
                Cancel
              </Button>
            </>
          )}
        </div>
      </div>

      {editMode && !isDirty ? (
        <div className="text-xs text-gray-500">
          Edit mode is on. Make changes, then Save. (Save enables after you change something.)
        </div>
      ) : null}

      <div className="overflow-auto border rounded-md">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left">
              <th className="px-3 py-2">Account</th>
              <th className="px-3 py-2">Description</th>
              <th className="px-3 py-2 text-right">Balance</th>
              <th className="px-3 py-2">Group</th>
              <th className="px-3 py-2">Subgroup</th>
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
            </tr>
          </thead>

          <tbody>
            {filtered.map((l) => {
              const d = draftById[l.id] ?? { auditGroup: l.auditGroup ?? "", auditSubgroup: l.auditSubgroup ?? "" };
              const isUngrouped = !d.auditGroup || !d.auditGroup.trim();

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
                      value={d.auditGroup}
                      onChange={(e) =>
                        setDraftById((p) => ({
                          ...p,
                          [l.id]: { ...(p[l.id] ?? { auditGroup: "", auditSubgroup: "" }), auditGroup: e.target.value },
                        }))
                      }
                      disabled={!editMode}
                      className={!editMode ? "bg-gray-100" : ""}
                      placeholder="e.g., Assets"
                    />
                  </td>

                  <td className="px-3 py-2">
                    <Input
                      value={d.auditSubgroup}
                      onChange={(e) =>
                        setDraftById((p) => ({
                          ...p,
                          [l.id]: { ...(p[l.id] ?? { auditGroup: "", auditSubgroup: "" }), auditSubgroup: e.target.value },
                        }))
                      }
                      disabled={!editMode}
                      className={!editMode ? "bg-gray-100" : ""}
                      placeholder="e.g., Cash"
                    />
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
