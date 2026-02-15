export const dynamic = "force-dynamic";

import Link from "next/link";
import { getEngagement } from "@/src/server/actions/engagements";
import { getLatestImport, clearTB, getFundAssignmentCounts } from "@/src/server/actions/tb";
import { getGroupingCounts } from "@/src/server/actions/groupings";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Button } from "@/src/components/ui/button";

export default async function EngagementHome({ params }: { params: { engagementId: string } }) {
  const e = await getEngagement(params.engagementId);
  const latest = await getLatestImport(params.engagementId);

  const tbImported = !!latest && latest.status === "IMPORTED";
  const counts = tbImported ? await getGroupingCounts(e.id) : { total: 0, grouped: 0, ungrouped: 0 };
  const fundCounts = tbImported ? await getFundAssignmentCounts(e.id) : { importId: null, total: 0, assigned: 0, unassigned: 0 };
  const fundsReady = tbImported && fundCounts.unassigned === 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{e.name}</h1>
        <div className="text-sm text-gray-500">FYE: {new Date(e.fiscalYearEnd).toLocaleDateString()}</div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* 1) TB */}
        <Card>
          <CardHeader>
            <CardTitle>1) Trial Balance Import</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2 flex-wrap">
              <Link href={`/dashboard/engagements/${e.id}/tb`}>
                <Button>Upload / Map</Button>
              </Link>

              {latest ? (
                <form action={clearTB}>
                  <input type="hidden" name="engagementId" value={e.id} />
                  <Button type="submit" variant="secondary">
                    Clear TB
                  </Button>
                </form>
              ) : null}
            </div>

            {latest ? (
              <div className="text-xs text-gray-500">
                Latest: <span className="font-medium">{latest.filename}</span> • Status:{" "}
                <span className="font-medium">{latest.status}</span> • Rows:{" "}
                <span className="font-medium">{latest.rowCount}</span> • Total:{" "}
                <span className="font-medium">{Number(latest.totalBalance).toFixed(2)}</span>
              </div>
            ) : (
              <div className="text-xs text-gray-500">No TB uploaded yet.</div>
            )}
          </CardContent>
        </Card>

        {/* 2) Funds */}
        <Card className={!tbImported ? "opacity-60" : ""}>
          <CardHeader>
            <CardTitle>2) Funds Setup</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm text-gray-600">
              Create/edit funds, set fund types, names, majors, and review detected fund codes.
            </div>
            <Link href={`/dashboard/engagements/${e.id}/funds`}>
              <Button disabled={!tbImported} variant="secondary">
                Open Funds
              </Button>
            </Link>
            {tbImported ? (
              <div className="text-xs text-gray-600">
                Fund codes assigned: <span className="font-medium">{fundCounts.assigned}</span> / {fundCounts.total}
                {fundCounts.unassigned > 0 ? (
                  <span className="ml-2 text-red-600">({fundCounts.unassigned} missing)</span>
                ) : (
                  <span className="ml-2 text-green-700">(all set)</span>
                )}
              </div>
            ) : null}
            {!tbImported ? <div className="text-xs text-gray-500">Upload + finalize TB first.</div> : null}
          </CardContent>
        </Card>

        {/* 3) Groupings */}
        <Card className={!tbImported ? "opacity-60" : ""}>
          <CardHeader>
            <CardTitle>3) Account Groupings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm text-gray-600">
              Review/edit audit groupings. Shows Fund, Amount, and grouping fields.
            </div>

            {tbImported ? (
              <div className="text-xs text-gray-600">
                Grouped: <span className="font-medium">{counts.grouped}</span> • Ungrouped:{" "}
                <span className="font-medium">{counts.ungrouped}</span>
              </div>
            ) : null}

            <Link href={`/dashboard/engagements/${e.id}/groupings`}>
              <Button disabled={!tbImported} variant="secondary">
                Open Groupings
              </Button>
            </Link>
            {!tbImported ? <div className="text-xs text-gray-500">Upload + finalize TB first.</div> : null}
          </CardContent>
        </Card>

        {/* 4) Statements */}
        <Card className={!fundsReady ? "opacity-60" : ""}>
          <CardHeader>
            <CardTitle>4) Fund Statements</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm text-gray-600">Build governmental fund statements from your TB + assignments.</div>
            <Link href={`/dashboard/engagements/${e.id}/statements/governmental`}>
              <Button disabled={!fundsReady} variant="secondary">
                Open Statements
              </Button>
            </Link>
            {!tbImported ? (
              <div className="text-xs text-gray-500">Upload + finalize TB first.</div>
            ) : fundCounts.unassigned > 0 ? (
              <div className="text-xs text-gray-500">Finish Fund Setup first (every TB line needs a Fund Code).</div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
