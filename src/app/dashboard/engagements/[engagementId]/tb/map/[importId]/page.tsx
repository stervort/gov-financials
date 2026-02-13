export const dynamic = "force-dynamic";

import Link from "next/link";
import { finalizeTBMapping, getImportForMapping } from "@/src/server/actions/tb";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Button } from "@/src/components/ui/button";

function colLabel(i: number) {
  const base = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  if (i < base.length) return base[i];
  return base[Math.floor(i / 26) - 1] + base[i % 26];
}

export default async function TBMapPage({
  params,
}: {
  params: { engagementId: string; importId: string };
}) {
  const imp = await getImportForMapping(params.importId);

  const raw = imp.rawMatrix as any;
  const matrix: any[][] = Array.isArray(raw) ? raw : [];
  const preview = matrix.slice(0, 25);
  const maxCols = Math.max(0, ...preview.map((r) => (Array.isArray(r) ? r.length : 0)));

  const defaultSkip = imp.headerRowsToSkip ?? (imp.hasHeaders ? 1 : 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Map Trial Balance Columns</h1>
          <p className="text-sm text-gray-500">
            {imp.filename} • We import only the mapped columns and calculate a signed balance (debits positive, credits negative).
          </p>
        </div>
        <Link href={`/dashboard/engagements/${params.engagementId}/tb`}>
          <Button variant="secondary">Back</Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>1) Header Rows</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-6">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="hasHeadersPreview" defaultChecked={Boolean(imp.hasHeaders)} disabled />
              <span>My file has header rows (skip them)</span>
            </label>
            <div className="text-sm">
              TB data starts on row:{" "}
              <span className="font-mono">{defaultSkip + 1}</span>{" "}
              <span className="text-gray-500">(set below)</span>
            </div>
          </div>
          <p className="text-xs text-gray-500">
            Industry standard is to ask where the data starts (how many header rows to skip) and then map the columns.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2) Column Mapping</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form action={finalizeTBMapping} className="grid gap-4 md:grid-cols-2">
            <input type="hidden" name="engagementId" value={params.engagementId} />
            <input type="hidden" name="importId" value={params.importId} />

            <div className="md:col-span-2 flex flex-wrap items-center gap-4 rounded-md border p-3">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="hasHeaders" value="true" defaultChecked={Boolean(imp.hasHeaders)} />
                <span>My file has headers</span>
              </label>

              <div className="text-sm flex items-center gap-2">
                <span>Header rows to skip:</span>
                <input
                  name="headerRowsToSkip"
                  defaultValue={String(defaultSkip)}
                  className="w-20 border rounded-md p-2"
                  inputMode="numeric"
                />
                <span className="text-gray-500">({defaultSkip} means data starts on row {defaultSkip + 1})</span>
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-xs font-medium">Account (required)</div>
              <select name="accountCol" className="w-full border rounded-md p-2" required>
                {Array.from({ length: maxCols }).map((_, i) => (
                  <option key={i} value={i}>
                    {colLabel(i)}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <div className="text-xs font-medium">Description (optional)</div>
              <select name="descriptionCol" className="w-full border rounded-md p-2" defaultValue="">
                <option value="">(none)</option>
                {Array.from({ length: maxCols }).map((_, i) => (
                  <option key={i} value={i}>
                    {colLabel(i)}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <div className="text-xs font-medium">Final Balance (choose this OR Debit/Credit)</div>
              <select name="finalBalanceCol" className="w-full border rounded-md p-2" defaultValue="">
                <option value="">(none)</option>
                {Array.from({ length: maxCols }).map((_, i) => (
                  <option key={i} value={i}>
                    {colLabel(i)}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <div className="text-xs font-medium">Debit (if no Final Balance)</div>
              <select name="debitCol" className="w-full border rounded-md p-2" defaultValue="">
                <option value="">(none)</option>
                {Array.from({ length: maxCols }).map((_, i) => (
                  <option key={i} value={i}>
                    {colLabel(i)}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <div className="text-xs font-medium">Credit (if no Final Balance)</div>
              <select name="creditCol" className="w-full border rounded-md p-2" defaultValue="">
                <option value="">(none)</option>
                {Array.from({ length: maxCols }).map((_, i) => (
                  <option key={i} value={i}>
                    {colLabel(i)}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <div className="text-xs font-medium">Group (optional)</div>
              <select name="groupCol" className="w-full border rounded-md p-2" defaultValue="">
                <option value="">(none)</option>
                {Array.from({ length: maxCols }).map((_, i) => (
                  <option key={i} value={i}>
                    {colLabel(i)}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <div className="text-xs font-medium">Subgroup (optional)</div>
              <select name="subgroupCol" className="w-full border rounded-md p-2" defaultValue="">
                <option value="">(none)</option>
                {Array.from({ length: maxCols }).map((_, i) => (
                  <option key={i} value={i}>
                    {colLabel(i)}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2 flex items-center gap-2">
              <Button type="submit">Finish Import</Button>
              <Link href={`/dashboard/engagements/${params.engagementId}/tb`}>
                <Button variant="secondary" type="button">
                  Cancel
                </Button>
              </Link>
            </div>
          </form>

          <p className="text-xs text-gray-500">
            Rule: You must select Account, and either Final Balance OR both Debit + Credit.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Preview (first 25 rows)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-auto border rounded-md">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left">Row</th>
                  {Array.from({ length: maxCols }).map((_, i) => (
                    <th key={i} className="px-3 py-2 text-left font-mono">
                      {colLabel(i)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map((row, idx) => (
                  <tr key={idx} className="border-t">
                    <td className="px-3 py-2 text-gray-500">{idx + 1}</td>
                    {Array.from({ length: maxCols }).map((_, j) => (
                      <td key={j} className="px-3 py-2 whitespace-nowrap">
                        {String((row ?? [])[j] ?? "")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
