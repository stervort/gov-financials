export const dynamic = "force-dynamic";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/card";
import { getLatestImportedTB } from "@/src/server/actions/groupings";

type Params = { engagementId: string };

export default async function GovBalanceSheetPage({ params }: { params: Params }) {
  const imp = await getLatestImportedTB(params.engagementId);

  if (!imp) {
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

  // Placeholder UI for now — next step is the actual statement builder.
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
          Using latest import: <span className="font-medium">{imp.id}</span>
          <div className="mt-2 text-gray-500">
            Next: we’ll build the statement line-item template + assignment UI.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
