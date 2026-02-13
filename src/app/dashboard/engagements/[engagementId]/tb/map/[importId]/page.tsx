export const dynamic = "force-dynamic";

import Link from "next/link";
import { getImportForMapping, finalizeTBMapping } from "@/src/server/actions/tb";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Button } from "@/src/components/ui/button";

function colLabel(i: number) {
  // A, B, C...
  return String.fromCharCode("A".charCodeAt(0) + i);
}

export default async function TBMapPage({
  params,
}: {
  params: { engagementId: string; importId: string };
}) {
  const imp = await getImportForMapping(params.importId);

  const matrixRaw = imp.rawMatrix as any;
  const matrix: any[][] = Array.isArray(matrixRaw) ? matrixRaw : [];
  const preview = matrix.slice(0, 10);
  const maxCols =
    preview.reduce((m, r) => Math.max(m, Array.isArray(r) ? r.length : 0), 0) || 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Map TB Columns (No Headers Detected)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600">
            File: <span className="font-medium">{imp.filename}</span>
          </p>

          <div className="overflow-auto border rounded-md">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="text-left">
                  {Array.from({ length: maxCols }).map((_, i) => (
                    <th key={i} className="px-3 py-2">
                      {colLabel(i)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map((row, rIdx) => (
                  <tr key={rIdx} className="border-t">
                    {Array.from({ length: maxCols }).map((_, cIdx) => (
                      <td key={cIdx} className="px-3 py-2">
                        {String((row?.[cIdx] ?? "")).slice(0, 80)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <form action={finalizeTBMapping} className="grid gap-4 md:grid-cols-2">
            <input type="hidden" name="engagementId" value={params.engagementId} />
            <input type="hidden" name="importId" value={params.importId} />

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
    </div>
  );
}
