export const dynamic = "force-dynamic";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Button } from "@/src/components/ui/button";
import { getEngagement } from "@/src/server/actions/engagements";
import { listGroupingLines } from "@/src/server/actions/groupings";
import GroupingsClient from "./groupings-client";

export default async function GroupingsPage({
  params,
  searchParams,
}: {
  params: { engagementId: string };
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const engagementId = params.engagementId;
  const e = await getEngagement(engagementId);

  const page = Number(searchParams?.page ?? 1) || 1;
  const pageSize = Number(searchParams?.pageSize ?? 50) || 50;
  const q = String(searchParams?.q ?? "");
  const ungroupedOnly = String(searchParams?.ungroupedOnly ?? "") === "1";

  const data = await listGroupingLines(engagementId, { page, pageSize, q, ungroupedOnly });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Account Groupings</h1>
          <div className="text-sm text-gray-500">{e.name}</div>
        </div>
        <Link href={`/dashboard/engagements/${engagementId}`}>
          <Button variant="secondary">Back</Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Groupings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!data.importId ? (
            <div className="text-sm text-gray-600">
              No imported trial balance found yet. Upload + finalize a TB first.
            </div>
          ) : (
            <GroupingsClient
              engagementId={engagementId}
              importId={data.importId}
              lines={data.lines}
              fundsByCode={data.fundsByCode}
              total={data.total}
              page={data.page}
              pageSize={data.pageSize}
              q={q}
              ungroupedOnly={ungroupedOnly}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
