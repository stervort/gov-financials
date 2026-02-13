import { createEngagement } from "@/src/server/actions/engagements";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Input } from "@/src/components/ui/input";
import { Button } from "@/src/components/ui/button";

export default function NewEngagement() {
  return (
    <div className="max-w-xl">
      <Card>
        <CardHeader><CardTitle>New Engagement</CardTitle></CardHeader>
        <CardContent>
          <form action={createEngagement} className="space-y-4">
            <div>
              <label className="text-sm font-medium">Name</label>
              <Input name="name" placeholder="Box Elder County" required />
            </div>
            <div>
              <label className="text-sm font-medium">Fiscal year end</label>
              <Input name="fiscalYearEnd" type="date" required />
            </div>
            <Button type="submit">Create</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
