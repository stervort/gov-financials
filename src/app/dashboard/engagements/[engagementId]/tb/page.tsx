export const dynamic = "force-dynamic";

import { uploadTB, getLatestImport, getImportPreview } from "@/src/server/actions/tb";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";

export default async function TBPage({ params }: { params: { engagementId: string } }) {
  const latest = await getLatestImport(params.engagementId);
  const preview = latest ? await getImportPreview(latest.id) : null;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Upload Trial Balance (CSV or Excel)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-gray-500">
            Accepted: .csv, .xlsx, .xls. Columns should include Account, Description, Final Balance (or Ending Balance),
            plus optional Group/Subgroup.
          </p>

          <form action={uploadTB} className="space-y-3">
            <input type="hidden" name="engagementId" value={params.engagementId} />
            <Input name="file" type="file" accept=".csv,.xlsx,.xls" required />
            <Button type="submit">Import</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Latest Import Preview</CardTitle>
        </CardHeader>
        <CardContent>
          {!preview ? (
            <p className="text-sm text-gray-500">No import yet.</p>
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
                Next: add a “does this TB need to net to 0?” setting + warnings if not.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
