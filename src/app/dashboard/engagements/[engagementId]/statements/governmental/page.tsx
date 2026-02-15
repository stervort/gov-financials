import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Button } from "@/src/components/ui/button";
import { getFundAssignmentCounts } from "@/src/server/actions/tb";
import { getGovernmentalStatementOverview } from "@/src/server/actions/statements";

type Params = { engagementId: string };

export default async function GovernmentalStatementsHome({ params }: { params: Params }) {
  const [fundCounts, overview] = await Promise.all([
    getFundAssignmentCounts(params.engagementId),
    getGovernmentalStatementOverview(params.engagementId),
  ]);

  const canProceed = !!overview.importId && fundCounts.unassigned === 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Governmental fund statements</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-gray-700">
          <div>
            Latest imported TB: <span className="font-medium">{overview.importId ? "Yes" : "No"}</span>
          </div>
          <div>
            Fund codes assigned: <span className="font-medium">{fundCounts.assigned}</span> / {fundCounts.total}
            {fundCounts.unassigned > 0 ? (
              <span className="ml-2 text-red-600">({fundCounts.unassigned} missing fund code)</span>
            ) : (
              <span className="ml-2 text-green-700">(all set)</span>
            )}
          </div>
          {!canProceed && (
            <div className="text-xs text-gray-600">
              Finish Fund Setup first (every TB line needs a Fund Code) before building statements.
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Available statements</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button asChild disabled={!canProceed}>
              <Link href={`/dashboard/engagements/${params.engagementId}/statements/governmental/balance-sheet`}>
                Balance Sheet (Governmental Funds)
              </Link>
            </Button>
            <Button asChild disabled>
              <Link href="#">Revenues, Expenditures & Changes (coming next)</Link>
            </Button>
          </div>

          <div className="pt-2 text-xs text-gray-600">
            Templates loaded: {overview.templates.length}. Funds: {overview.funds.length}.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
