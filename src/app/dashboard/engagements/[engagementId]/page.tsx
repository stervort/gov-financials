import Link from "next/link";
import { getEngagement } from "@/src/server/actions/engagements";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Button } from "@/src/components/ui/button";

export default async function EngagementHome({ params }: { params: { engagementId: string } }) {
  const e = await getEngagement(params.engagementId);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{e.name}</h1>
        <div className="text-sm text-gray-500">FYE: {new Date(e.fiscalYearEnd).toLocaleDateString()}</div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardHeader><CardTitle>Import TB</CardTitle></CardHeader><CardContent>
          <Link href={`/dashboard/engagements/${e.id}/tb`}><Button>Upload</Button></Link>
        </CardContent></Card>
        <Card><CardHeader><CardTitle>Funds</CardTitle></CardHeader><CardContent>
          <Button disabled>Next</Button>
        </CardContent></Card>
        <Card><CardHeader><CardTitle>Statements</CardTitle></CardHeader><CardContent>
          <Button disabled>Later</Button>
        </CardContent></Card>
      </div>
      <Link href="/dashboard"><Button variant="secondary">Back</Button></Link>
    </div>
  );
}
