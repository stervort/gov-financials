export const dynamic = "force-dynamic";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Button } from "@/src/components/ui/button";

import {
  listGroupingLines,
  getLatestImportedTB,
} from "@/src/server/actions/groupings";

import GroupingsClient from "./groupings-client";

export default async function GroupingsPage({
  params,
  searchParams,
}: {
  params: { engagementId: string };
  searchParams?: { page?: string; q?: string; ungrouped?: string };
}) {
  const engagementId = params.engagementId;

  // Determine if we even have an imported TB yet (industry behavior: block page until TB exists)
  const latestTB = await getLatestImportedTB(engagementId);

  // Pagination + filters
  const page = Math.max(parseInt(searchParams?.page ?? "1", 10) || 1, 1);
  const q = (searchParams?.q ?? "").trim();
  const ungroupedOnly =
    (searchParams?.ungrouped ?? "").toLowerCase() === "1" ||
    (searchParams?.ungrouped ?? "").toLowerCase() === "true";

  // If no TB, show guidance and stop
  if (!latestTB) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Account Groupings</h1>
          <Link href={`/dashboard/engagements/${engagementId}`}>
            <Button variant="secondary">Back to engagement</Button>
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>No Trial Balance Imported</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm text-gray-600">
              Upload and finalize a Trial Balance first. Groupings are based on the latest imported TB.
            </div>
            <Link href={`/dashboard/engagements/${engagementId}/tb`}>
              <Button>Go to Trial Balance Import</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // We have a TB, so load grouping lines
  const data = await listGroupingLines(engagementId, {
    page,
    pageSize: 100, // you can tune this; pagination is now built-in
    q,
    ungroupedOnly,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Account Groupings</h1>
          <div className="text-sm text-gray-500">
            Latest TB import:{" "}
            {new Date(latestTB.createdAt).toLocaleString()}
          </div>
        </div>

        <Link href={`/dashboard/engagements/${engagementId}`}>
          <Button variant="secondary">Back to engagement</Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Groupings</CardTitle>
        </CardHeader>
        <CardContent>
          <GroupingsClient
            engagementId={engagementId}
            fundsByCode={(data as any).fundsByCode ?? {}}
            page={data.page}
            pageSize={data.pageSize}
            total={data.total}
            lines={data.lines}
            initialQ={q}
            initialUngroupedOnly={ungroupedOnly}
          />
        </CardContent>
      </Card>
    </div>
  );
}
