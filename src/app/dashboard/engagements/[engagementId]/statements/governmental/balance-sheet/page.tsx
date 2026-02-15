import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Button } from "@/src/components/ui/button";
import {
  getGovernmentalBalanceSheetMatrix,
  getFundTBForAssignment,
  setLineItemAssignments,
} from "@/src/server/actions/statements";
import BalanceSheetBuilderClient from "./builder-client";

type Params = { engagementId: string };

export default async function GovFundsBalanceSheetPage({ params }: { params: Params }) {
  const data: any = await getGovernmentalBalanceSheetMatrix(params.engagementId);

  if (!data.importId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Governmental Funds Balance Sheet</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm text-gray-700">No imported trial balance found yet.</div>
          <Button asChild>
            <Link href={`/dashboard/engagements/${params.engagementId}`}>Back to engagement</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-lg font-semibold">Governmental Funds Balance Sheet</div>
          <div className="text-xs text-gray-600">Template: {data.template?.name}</div>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="ghost">
            <Link href={`/dashboard/engagements/${params.engagementId}/statements/governmental`}>Back</Link>
          </Button>
          <Button asChild>
            <Link href={`/dashboard/engagements/${params.engagementId}`}>Engagement</Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Assignment status</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-gray-700">
          Unassigned fund TB lines: {data.unassignedCount}{" "}
          {data.unassignedCount > 0 ? <span className="text-red-600">(needs grouping)</span> : <span className="text-green-700">(all assigned)</span>}
        </CardContent>
      </Card>

      <BalanceSheetBuilderClient
        engagementId={params.engagementId}
        importId={data.importId}
        funds={data.funds}
        lineItems={data.lineItems}
        matrix={data.matrix}
        loadFundTB={getFundTBForAssignment}
        saveAssignments={setLineItemAssignments}
      />
    </div>
  );
}
