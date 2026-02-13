import { listFundRules, createFundRule, toggleFundRule, rerunFundDetection } from "@/src/server/actions/fundRules";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Input } from "@/src/components/ui/input";
import { Button } from "@/src/components/ui/button";

export default async function FundRulesPage({ params }: { params: { engagementId: string } }) {
  const rules = await listFundRules(params.engagementId);

  return (
    <div className="space-y-6 max-w-4xl">
      <Card>
        <CardHeader><CardTitle>Fund Detection Rules</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600">
            Clients use many account formats (10-xxxx, 10.4000, 10-50-4000, 10-50400.1, 1040000, etc).
            We detect the fund with flexible regex rules; the fund code comes from a capture group (usually group 1).
          </p>

          <form action={rerunFundDetection} className="flex gap-2">
            <input type="hidden" name="engagementId" value={params.engagementId} />
            <Button type="submit" variant="secondary">Re-run detection on latest TB</Button>
          </form>

          <div className="overflow-auto border rounded-md">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="text-left">
                  <th className="px-3 py-2">Enabled</th>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Regex</th>
                  <th className="px-3 py-2">Group</th>
                </tr>
              </thead>
              <tbody>
                {rules.map(r => (
                  <tr key={r.id} className="border-t">
                    <td className="px-3 py-2">
                      <form action={toggleFundRule}>
                        <input type="hidden" name="engagementId" value={params.engagementId} />
                        <input type="hidden" name="ruleId" value={r.id} />
                        <input type="hidden" name="enabled" value={String(!r.enabled)} />
                        <Button type="submit" variant={r.enabled ? "default" : "secondary"}>{r.enabled ? "On" : "Off"}</Button>
                      </form>
                    </td>
                    <td className="px-3 py-2 font-medium">{r.name}</td>
                    <td className="px-3 py-2 font-mono">{r.accountRegex}</td>
                    <td className="px-3 py-2">{r.captureGroup}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="border rounded-md p-4">
            <div className="font-medium mb-2">Add Rule</div>
            <form action={createFundRule} className="grid gap-3 md:grid-cols-3">
              <input type="hidden" name="engagementId" value={params.engagementId} />
              <div className="md:col-span-1">
                <label className="text-xs font-medium">Name</label>
                <Input name="name" placeholder="Fund = first 2 digits (10-50400.1)" required />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-medium">Regex</label>
                <Input name="accountRegex" placeholder="^(\\d{2})-\\d{5}\\.\\d$" required />
                <div className="text-xs text-gray-500 mt-1">
                  Tip: put fund code in capture group 1 like <span className="font-mono">^(\\d{{2}})</span>.
                </div>
              </div>
              <div>
                <label className="text-xs font-medium">Capture group #</label>
                <Input name="captureGroup" placeholder="1" defaultValue="1" required />
              </div>
              <div className="md:col-span-3">
                <Button type="submit">Create</Button>
              </div>
            </form>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
