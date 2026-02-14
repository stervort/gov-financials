export const dynamic = "force-dynamic";

import Link from "next/link";
import { getImportForMapping, finalizeTBMapping } from "@/src/server/actions/tb";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Button } from "@/src/components/ui/button";
import TBMapperClient from "./tb-mapper-client";

type Params = { engagementId: string; importId: string };

export default async function TBMapPage({ params }: { params: Params }) {
  // Server action currently takes ONLY importId.
  // (Some older versions used engagementId+importId; we keep the page simple and call the current signature.)
  const data: any = await getImportForMapping(params.importId);

  const matrix: any[][] = Array.isArray(data?.matrix) ? data.matrix : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Map Trial Balance</h1>
        <Link href={`/dashboard/engagements/${params.engagementId}`}>
          <Button variant="secondary">Back to Engagement</Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Column mapping</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <TBMapperClient
            engagementId={params.engagementId}
            importId={params.importId}
            matrix={matrix}
            finalizeAction={finalizeTBMapping}
          />
        </CardContent>
      </Card>
    </div>
  );
}
