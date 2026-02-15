export const dynamic = "force-dynamic";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/card";
import { getFundAssignmentCounts } from "@/src/server/actions/tb";
import {
  getGovernmentalBalanceSheetBuilderData,
  getFundCellDetails,
  saveFundCellAssignments,
} from "@/src/server/actions/statements";
import { BalanceSheetBuilderClient } from "./builder-client";

type Params = { engagementId: string };

export default async function GovBalanceSheetPage({ params }: { params: Params }) {
  const fundCounts = await getFundAssignmentCounts(params.engagementId);
  const data = await getGovernmentalBalanceSheetBuilderData(params.engagementId);

  if (!data) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Governmental Funds — Balance Sheet</h1>

        <Card>
          <CardHeader>
            <CardTitle>Get started</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm text-gray-700">No imported trial balance found yet.</div>

            <Link
              href={`/dashboard/engagements/${params.engagementId}`}
              className="inline-flex items-center justify-center rounded-md px-3 py-2 text-sm font-medium bg-black text-white hover:bg-black/90"
            >
              Back to engagement
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Governmental Funds — Balance Sheet</h1>

        <Link
          href={`/dashboard/engagements/${params.engagementId}`}
          className="inline-flex items-center justify-center rounded-md px-3 py-2 text-sm font-medium bg-gray-100 text-gray-900 hover:bg-gray-200"
        >
          Back
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Imported trial balance</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-gray-700">
          Using latest import: <span className="font-medium">{data.importId}</span>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Fund readiness</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-gray-700">
          Funds assigned: {fundCounts.assigned} / {fundCounts.total} trial balance lines
        </CardContent>
      </Card>

      <BalanceSheetBuilderClient
        engagementId={params.engagementId}
        importId={data.importId}
        templateId={data.templateId}
        lineItems={data.lineItems}
        funds={data.funds}
        sums={data.sums}
        loadCellDetails={getFundCellDetails}
        saveCell={saveFundCellAssignments}
      />
    </div>
  );
}
