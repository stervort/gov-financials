export const dynamic = "force-dynamic";

import Link from "next/link";
import { getImportForMapping, finalizeTBMapping } from "@/src/server/actions/tb";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Button } from "@/src/components/ui/button";
import TBMapperClient from "./tb-mapper-client";

export default async function TBMapPage({
  params,
}: {
  params: { engagementId: string; importId: string };
}) {
  const imp = await getImportForMapping(params.importId);

  // Basic guard
  if (imp.engagementId !== params.engagementId) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-red-600">Import does not belong to this engagement.</p>
        <Link href={`/dashboard/engagements/${params.engagementId}/tb`}>
          <Button variant="secondary">Back</Button>
        </Link>
      </div>
    );
  }

  const raw = (imp.rawMatrix ?? []) as any[];
  const matrix: any[][] = Array.isArray(raw) ? (raw as any[][]) : [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Map Trial Balance Columns</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-gray-600">
            Industry standard is: <b>choose how many header rows to skip</b>, then <b>map columns</b>.
            We import all non-blank rows after the header rows you skip.
          </p>
          <div className="text-xs text-gray-500">File: {imp.filename}</div>
        </CardContent>
      </Card>

      <TBMapperClient
        engagementId={params.engagementId}
        importId={params.importId}
        suggestedHasHeaders={imp.hasHeaders}
        matrix={matrix}
        finalizeAction={finalizeTBMapping}
      />

      <div>
        <Link href={`/dashboard/engagements/${params.engagementId}/tb`}>
          <Button variant="ghost">Cancel</Button>
        </Link>
      </div>
    </div>
  );
}
