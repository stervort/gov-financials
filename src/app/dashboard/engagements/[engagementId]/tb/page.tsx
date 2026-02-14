export const dynamic = "force-dynamic";

import Link from "next/link";
import { uploadTB, getLatestImport, getImportPreview, clearTB } from "@/src/server/actions/tb";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";

export default async function TBPage({ params }: { params: { engagementId: string } }) {
  const latest = await getLatestImport(params.engagementId);
  const preview = latest && latest.status === "IMPORTED" ? await getImportPreview(latest.id) : null;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Upload Trial Balance (CSV or Excel)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-gray-500">
            Accepts single signed balance (Final Balance / Balance) or Debit/Credit.
            After upload, you’ll map columns (account, description, balance, etc.) so we can import cleanly.
          </p>

          <div className="flex flex-wrap gap-2">
            <form action={uploadTB} className="flex items-center gap-2">
              <input type="hidden" name="engagementId" value={params.engagementId} />
              <Input name="file" type="file" accept=".csv,.xlsx,.xls" required />
              <Button type="submit">Import</Button>
            </form>

            {latest ? (
              <form action={clearTB}>
                <input type="hidden" name="engagementId" value={params.engagementId} />
                <Button type="submit" variant="secondary">
                  Clear TB
                </Button>
              </form>
            ) : null}

            <Link href={`/dashboard/engagements/${params.engagementId}`}>
              <Button variant="ghost">Back</Button>
            </Link>
          </div>

          {latest ? (
            <div className="text-xs text-gray-500">
              Latest: {latest.filename} ({latest.status})
              {latest.status === "NEEDS_MAPPING" ? (
                <>
                  {" "}
                  •{" "}
                  <Link
                    className="underline"
                    href={`/dashboard/engagements/${params.engagementId}/tb/map/${latest.id}`}
                  >
                    Finish mapping
                  </Link>
                </>
              ) : null}
            </div>
          ) : (
            <div className="text-xs text-gray-500">No TB yet</div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Latest Import Preview</CardTitle>
        </CardHeader>
        <CardContent>
          {!latest ? (
            <p className="text-sm text-gray-500">No import yet.</p>
          ) : latest.status === "NEEDS_MAPPING" ? (
            <p className="text-sm text-gray-500">
              Latest import needs column mapping. Click{" "}
              <Link
                className="underline"
                href={`/dashboard/engagements/${params.engagementId}/tb/map/${latest.id}`}
              >
                Finish mapping
              </Link>
              .
            </p>
          ) : !preview ? (
            <p className="text-sm text-gray-500">No preview available.</p>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-2 md:grid-cols-3">
                <div className="text-sm">
                  <span className="text-gray-500">File:</span>{" "}
                  <span className="font-medium">{preview.filename}</span>
                </div>
                <div className="text-sm">
                  <span className="text-gray-500">Rows:</span>{" "}
                  <span className="font-medium">{preview.rowCount}</span>
                </div>
                <div className="text-sm">
                  <span className="text-gray-500">Total:</span>{" "}
                  <span className="font-medium">
                    {Number(preview.totalBalance).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
              </div>

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
                        <td className="px-3 py-2">{l.description ?? ""}</td>
                        <td className="px-3 py-2 text-right">
                          {Number(l.finalBalance).toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                        <td className="px-3 py-2">{l.auditGroup ?? ""}</td>
                        <td className="px-3 py-2">{l.auditSubgroup ?? ""}</td>
                        <td className="px-3 py-2">{l.fundCode ?? ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="text-xs text-gray-500">
                This shows the latest import. Clear TB deletes all TB imports and derived funds.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
