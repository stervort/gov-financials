export const dynamic = "force-dynamic";

import Link from "next/link";
import { listGroupingLines, updateLineGrouping } from "@/src/server/actions/groupings";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";

export default async function GroupingsPage({ params }: { params: { engagementId: string } }) {
  const { importId, lines } = await listGroupingLines(params.engagementId);

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Account Groupings</h1>
          <p className="text-sm text-gray-500">
            Fill in or edit Group/Subgroup for accounts. (We’ll add bulk editing + filters next.)
          </p>
        </div>
        <Link href={`/dashboard/engagements/${params.engagementId}`}>
          <Button variant="secondary">Back</Button>
        </Link>
      </div>

      {!importId ? (
        <Card>
          <CardHeader><CardTitle>No imported trial balance yet</CardTitle></CardHeader>
          <CardContent className="text-sm text-gray-600">
            Upload + map a trial balance first.
            <div className="mt-3">
              <Link href={`/dashboard/engagements/${params.engagementId}/tb`}>
                <Button>Go to TB Upload</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader><CardTitle>Lines (first 500)</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-auto border rounded-md">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr className="text-left">
                    <th className="px-3 py-2">Account</th>
                    <th className="px-3 py-2">Description</th>
                    <th className="px-3 py-2 text-right">Balance</th>
                    <th className="px-3 py-2">Group</th>
                    <th className="px-3 py-2">Subgroup</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l) => {
                    const formId = `save-${l.id}`;
                    return (
                      <tr key={l.id} className="border-t align-top">
                        <td className="px-3 py-2 font-mono whitespace-nowrap">{l.account}</td>
                        <td className="px-3 py-2">{l.description ?? ""}</td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">
                          {Number(l.finalBalance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-3 py-2">
                          <Input form={formId} name="auditGroup" defaultValue={l.auditGroup ?? ""} placeholder="e.g., Assets" />
                        </td>
                        <td className="px-3 py-2">
                          <Input form={formId} name="auditSubgroup" defaultValue={l.auditSubgroup ?? ""} placeholder="e.g., Cash" />
                        </td>
                        <td className="px-3 py-2">
                          <form id={formId} action={updateLineGrouping}>
                            <input type="hidden" name="engagementId" value={params.engagementId} />
                            <input type="hidden" name="lineId" value={l.id} />
                            <Button type="submit" variant="secondary">Save</Button>
                          </form>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <p className="text-xs text-gray-500 mt-3">
              Note: This page saves one row at a time to keep it simple. Next improvement: bulk edit + “only show missing groupings”.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
