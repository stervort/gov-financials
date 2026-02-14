export const dynamic = "force-dynamic";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Button } from "@/src/components/ui/button";
import { getLatestTBStatus, getImportPreview, clearTB } from "@/src/server/actions/tb";

type Params = { engagementId: string };

export default async function TBPage({ params }: { params: Params }) {
  const status: any = await getLatestTBStatus(params.engagementId);
  const preview: any = await getImportPreview(params.engagementId);

  const hasImported = Boolean(status?.hasImported);
  const lastImportId = status?.latestImportId ?? null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Trial Balance</h1>

        <div className="flex items-center gap-2">
          <Link href={`/dashboard/engagements/${params.engagementId}`}>
            <Button variant="secondary">Back to Engagement</Button>
          </Link>

          {lastImportId ? (
            <Link
              href={`/dashboard/engagements/${params.engagementId}/tb/map/${lastImportId}`}
            >
              <Button>Map / Finalize</Button>
            </Link>
          ) : null}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upload</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-gray-600">
            Upload a Trial Balance file (CSV or XLSX). After upload, go to mapping to
            confirm headers + map columns.
          </p>

          <div className="flex items-center gap-2">
            <Link href={`/dashboard/engagements/${params.engagementId}/tb/upload`}>
              <Button>Upload TB</Button>
            </Link>

            {hasImported ? (
              <form action={clearTB}>
                <input type="hidden" name="engagementId" value={params.engagementId} />
                {/* ✅ your button component doesn't support variant="destructive" */}
                <Button type="submit" variant="outline">
                  Clear current imported TB
                </Button>
              </form>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Preview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!preview?.lines?.length ? (
            <p className="text-sm text-gray-600">
              No preview available yet. Upload a TB to see the first rows here.
            </p>
          ) : (
            <div className="overflow-auto border rounded-md">
              <table className="min-w-[900px] text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left p-2 border-b">Account</th>
                    <th className="text-left p-2 border-b">Description</th>
                    <th className="text-right p-2 border-b">Debit</th>
                    <th className="text-right p-2 border-b">Credit</th>
                    <th className="text-right p-2 border-b">Final</th>
                    <th className="text-left p-2 border-b">Fund</th>
                    <th className="text-left p-2 border-b">Group</th>
                    <th className="text-left p-2 border-b">Subgroup</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.lines.map((r: any) => (
                    <tr key={r.id ?? `${r.account}-${r.description}`}>
                      <td className="p-2 border-b">{r.account ?? ""}</td>
                      <td className="p-2 border-b">{r.description ?? ""}</td>
                      <td className="p-2 border-b text-right">
                        {r.debit != null ? String(r.debit) : ""}
                      </td>
                      <td className="p-2 border-b text-right">
                        {r.credit != null ? String(r.credit) : ""}
                      </td>
                      <td className="p-2 border-b text-right">
                        {r.finalBalance != null ? String(r.finalBalance) : ""}
                      </td>
                      <td className="p-2 border-b">{r.fundCode ?? ""}</td>
                      <td className="p-2 border-b">{r.auditGroup ?? ""}</td>
                      <td className="p-2 border-b">{r.auditSubgroup ?? ""}</td>
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
