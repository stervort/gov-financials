export const dynamic = "force-dynamic";

import Link from "next/link";
import { getEngagement } from "@/src/server/actions/engagements";
import { getLatestImport } from "@/src/server/actions/tb";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Button } from "@/src/components/ui/button";

export default async function EngagementPage({ params }: { params: { engagementId: string } }) {
  const engagement = await getEngagement(params.engagementId);
  const latest = await getLatestImport(params.engagementId);

  const tbReady = Boolean(latest && latest.status === "IMPORTED");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{engagement.name}</h1>
        <div className="text-sm text-gray-500">
          FYE: {new Date(engagement.fiscalYearEnd).toLocaleDateString()}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>1) Trial Balance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-gray-600">
              Upload and map your TB columns (Account, Balance or Debit/Credit, optional Group/Subgroup).
            </p>
            <div className="text-sm">
              Status:{" "}
              {latest ? (
                <span className="font-mono">{latest.status}</span>
              ) : (
                <span className="text-gray-500">No upload</span>
              )}
            </div>
            <Link href={`/dashboard/engagements/${params.engagementId}/tb`}>
              <Button>Upload / Map</Button>
            </Link>
          </CardContent>
        </Card>

        <Card className={!tbReady ? "opacity-60" : ""}>
          <CardHeader>
            <CardTitle>2) Account Groupings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-gray-600">
              Review Group/Subgroup columns and fill in missing groupings for new accounts.
            </p>
            <Link href={`/dashboard/engagements/${params.engagementId}/groupings`}>
              <Button disabled={!tbReady} variant={tbReady ? "default" : "secondary"}>
                {tbReady ? "Open" : "Upload TB first"}
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className={!tbReady ? "opacity-60" : ""}>
          <CardHeader>
            <CardTitle>3) Fund Setup</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-gray-600">
              Confirm fund codes, names, types, and major funds. (Auto-detected from account number rules.)
            </p>
            <Link href={`/dashboard/engagements/${params.engagementId}/funds`}>
              <Button disabled={!tbReady} variant={tbReady ? "default" : "secondary"}>
                {tbReady ? "Open" : "Upload TB first"}
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Next Steps</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-gray-600 space-y-2">
          <div>• After Fund Setup, we'll generate fund statements, GWFS conversion, and exports (Excel + DOCX) in later slices.</div>
          <div>• If a new TB is uploaded, it creates a new import; you can clear old imports if you want a clean reset.</div>
        </CardContent>
      </Card>
    </div>
  );
}
