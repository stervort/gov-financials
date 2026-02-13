export const dynamic = "force-dynamic";

import { getLatestImport, getImportPreview, uploadTB, clearTB } from "@/src/server/actions/tb";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Button } from "@/src/components/ui/button";
import Link from "next/link";

export default async function TBPage({ params }: { params: { engagementId: string } }) {
  const latest = await getLatestImport(params.engagementId);
  const preview = latest && latest.status === "IMPORTED" ? await getImportPreview(latest.id) : null;

  return (
    <div className="space-y-6 max-w-5xl">
      <Card>
        <CardHeader>
          <CardTitle>Trial Balance Upload</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600">
            Upload a trial balance (.csv, .xlsx, or .xls). After upload, you'll map the columns and confirm where the data starts.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <form action={uploadTB} className="flex items-center gap-2">
              <input type="hidden" name="engagementId" value={params.engagementId} />
              <input name="file" type="file" accept=".csv,.xlsx,.xls" required />
              <Button type="submit">Upload & Map</Button>
            </form>

            <form action={clearTB}>
              <input type="hidden" name="engagementId" value={params.engagementId} />
              <Button type="submit" variant="ghost">
                Clear TB
              </Button>
            </form>

            {latest ? (
              <Link href={`/dashboard/engagements/${params.engagementId}/tb/map/${latest.id}`}>
                <Button variant="secondary" type="button">
                  Map Latest
                </Button>
              </Link>
            ) : null}
          </div>

          {latest ? (
            <div className="text-sm text-gray-700">
              <div>
                <span className="font-medium">Latest:</span> {latest.filename} •{" "}
                <span className="font-mono">{latest.status}</span>
              </div>
              {latest.status === "IMPORTED" ? (
                <div className="text-gray-500">
                  Rows: {latest.rowCount} • Total balance: {Number(latest.totalBalance).toLocaleString()}
                </div>
              ) : (
                <div className="text-gray-500">
                  Needs mapping. Click <span className="font-medium">Map Latest</span> to finish.
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm text-gray-500">No trial balance uploaded yet.</div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Preview (first 50 lines)</CardTitle>
        </CardHeader>
        <CardContent>
          {!preview ? (
            <p className="text-sm text-gray-500">
              Upload + map a trial balance to see a preview here.
            </p>
          ) : (
            <div className="overflow-auto border rounded-md">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr className="text-left">
                    <th className="px-3 py-2">Account</th>
                    <th className="px-3 py-2">Description</th>
                    <th className="px-3 py-2 text-right">Final Balance</th>
                    <th className="px-3 py-2">Group</th>
                    <th className="px-3 py-2">Subgroup</th>
                    <th className="px-3 py-2">Fund</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.lines.map((l) => (
                    <tr key={l.id} className="border-t">
                      <td className="px-3 py-2 font-mono">{l.account}</td>
                      <td className="px-3 py-2">{l.description}</td>
                      <td className="px-3 py-2 text-right">
                        {Number(l.finalBalance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-3 py-2">{l.auditGroup ?? ""}</td>
                      <td className="px-3 py-2">{l.auditSubgroup ?? ""}</td>
                      <td className="px-3 py-2">{l.fundCode ?? ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
