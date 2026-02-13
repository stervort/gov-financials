export const dynamic = "force-dynamic";


import Link from "next/link";
import { getEngagement } from "@/src/server/actions/engagements";
import { getLatestImport } from "@/src/server/actions/tb";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Button } from "@/src/components/ui/button";

export default async function EngagementHome({ params }: { params: { engagementId: string } }) {
  const e = await getEngagement(params.engagementId);
  const latest = await getLatestImport(params.engagementId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{e.name}</h1>
        <div className="text-sm text-gray-500">FYE: {new Date(e.fiscalYearEnd).toLocaleDateString()}</div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardHeader><CardTitle>1) Import TB</CardTitle></CardHeader><CardContent className="space-y-2">
          <Link href={`/dashboard/engagements/${e.id}/tb`}><Button>Upload</Button></Link>
          {latest ? <div className="text-xs text-gray-500">Latest: {latest.filename}</div> : <div className="text-xs text-gray-500">No TB yet</div>}
        </CardContent></Card>

        <Card><CardHeader><CardTitle>2) Fund Rules</CardTitle></CardHeader><CardContent>
          <Link href={`/dashboard/engagements/${e.id}/fund-rules`}><Button variant="secondary">Edit</Button></Link>
        </CardContent></Card>

        <Card><CardHeader><CardTitle>3) Funds</CardTitle></CardHeader><CardContent>
          <Link href={`/dashboard/engagements/${e.id}/funds`}><Button variant="secondary">Manage</Button></Link>
        </CardContent></Card>
      </div>

      <Link href="/dashboard"><Button variant="secondary">Back</Button></Link>
    </div>
  );
}
