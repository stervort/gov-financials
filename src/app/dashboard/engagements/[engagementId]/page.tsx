export const dynamic = "force-dynamic";

import Link from "next/link";
import { getEngagement } from "@/src/server/actions/engagements";
import { getLatestImport, clearTB } from "@/src/server/actions/tb";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Button } from "@/src/components/ui/button";

export default async function EngagementHome({ params }: { params: { engagementId: string } }) {
  const e = await getEngagement(params.engagementId);
  const latest = await getLatestImport(params.engagementId);

  // ✅ Correct: after mapping+finalize we set status to "IMPORTED"
  const tbImported = !!latest && latest.status === "IMPORTED";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{e.name}</h1>
        <div className="text-sm text-gray-500">
          FYE: {new Date(e.fiscalYearEnd).toLocaleDateString()}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>1) Trial Balance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2 flex-wrap">
              <Link href={`/dashboard/engagements/${e.id}/tb`}>
                <Button>Upload</Button>
              </Link>

              {latest && latest.status === "NEEDS_MAPPING" ? (
                <Link href={`/dashboard/engagements/${e.id}/tb/map/${latest.id}`}>
                  <Button variant="secondary">Map</Button>
                </Link>
              ) : null}

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
                Latest: {latest.filename}{" "}
                <span className={tbImported ? "text-green-700" : "text-amber-700"}>
                  {tbImported ? " (imported)" : " (needs mapping)"}
                </span>
              </div>
            ) : (
              <div className="text-xs text-gray-500">No TB yet</div>
            )}

            {!tbImported ? (
              <div className="text-xs text-amber-700">
                Next steps are locked until the latest Trial Balance is imported.
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>2) Account Groupings</CardTitle>
          </CardHeader>
          <CardContent>
            <Link href={`/dashboard/engagements/${e.id}/groupings`}>
              <Button variant="secondary" disabled={!tbImported}>
                Open
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>3) Fund Setup</CardTitle>
          </CardHeader>
          <CardContent>
            <Link href={`/dashboard/engagements/${e.id}/funds`}>
              <Button variant="secondary" disabled={!tbImported}>
                Open
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      <Link href="/dashboard">
        <Button variant="secondary">Back</Button>
      </Link>
    </div>
  );
}
