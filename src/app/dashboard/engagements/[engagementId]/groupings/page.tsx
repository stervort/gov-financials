export const dynamic = "force-dynamic";

import Link from "next/link";
import { listGroupingLines, updateLineGrouping } from "@/src/server/actions/groupings";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Button } from "@/src/components/ui/button";
import GroupingsClient from "./groupings-client";

export default async function GroupingsPage({ params }: { params: { engagementId: string } }) {
  const { importId, lines } = await listGroupingLines(params.engagementId);

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Account Groupings</h1>
          <p className="text-sm text-gray-500">
            Review and complete Group/Subgroup assignments. Ungrouped accounts are highlighted in red.
          </p>
        </div>
        <Link href={`/dashboard/engagements/${params.engagementId}`}>
          <Button variant="secondary">Back</Button>
        </Link>
      </div>

      {!importId ? (
        <Card>
          <CardHeader>
            <CardTitle>No imported trial balance yet</CardTitle>
          </CardHeader>
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
          <CardHeader>
            <CardTitle>Lines (up to 2,000)</CardTitle>
          </CardHeader>
          <CardContent>
            <GroupingsClient
              engagementId={params.engagementId}
              lines={lines}
              updateLineGrouping={updateLineGrouping}
            />
            <p className="text-xs text-gray-500 mt-3">
              Tip: Use the filters under each column heading to quickly find accounts. We’ll add paging if you run into
              the 2,000 line cap.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
