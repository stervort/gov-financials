export const dynamic = "force-dynamic";

import TBMapperClient from "./tb-mapper-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/card";
import { finalizeTBMapping, getImportForMapping } from "@/src/server/actions/tb";

type Params = { engagementId: string; importId: string };

export default async function TBMapPage({ params }: { params: Params }) {
  // IMPORTANT: getImportForMapping likely only accepts (importId)
  const data: any = await getImportForMapping(params.importId);

  const matrix: any[][] = Array.isArray(data?.matrix) ? data.matrix : Array.isArray(data) ? data : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Trial Balance Mapping</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <TBMapperClient
          engagementId={params.engagementId}
          importId={params.importId}
          matrix={matrix}
          finalizeAction={finalizeTBMapping}
          // ✅ optional now, so we can omit it (or pass it if you want later)
        />
      </CardContent>
    </Card>
  );
}
