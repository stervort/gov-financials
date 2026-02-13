import Link from "next/link";
import { listEngagements } from "@/src/server/actions/engagements";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Button } from "@/src/components/ui/button";

export default async function Dashboard() {
  const engagements = await listEngagements();
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Engagements</h1>
        <Link href="/dashboard/engagements/new"><Button>Create</Button></Link>
      </div>
      <Card>
        <CardHeader><CardTitle>List</CardTitle></CardHeader>
        <CardContent>
          {engagements.length === 0 ? <p className="text-sm text-gray-500">No engagements yet.</p> : (
            <ul className="divide-y">
              {engagements.map(e => (
                <li key={e.id} className="py-3 flex items-center justify-between">
                  <div>
                    <div className="font-medium">{e.name}</div>
                    <div className="text-sm text-gray-500">FYE: {new Date(e.fiscalYearEnd).toLocaleDateString()}</div>
                  </div>
                  <Link href={`/dashboard/engagements/${e.id}`}><Button variant="secondary">Open</Button></Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
