export const dynamic = "force-dynamic";


import { listFunds, updateFund } from "@/src/server/actions/funds";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Input } from "@/src/components/ui/input";
import { Button } from "@/src/components/ui/button";
import { Select } from "@/src/components/ui/select";

const fundTypes = ["GOVERNMENTAL","PROPRIETARY","FIDUCIARY","COMPONENT_UNIT_BLENDED","COMPONENT_UNIT_DISCRETE"];

export default async function FundsPage({ params }: { params: { engagementId: string } }) {
  const funds = await listFunds(params.engagementId);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Funds</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-gray-600">Funds are inferred from the latest TB using fund rules. Set types and major flags.</p>

          {funds.length === 0 ? (
            <p className="text-sm text-gray-500">No funds inferred yet. Upload a TB and/or adjust fund rules.</p>
          ) : (
            <div className="space-y-3">
              {funds.map(f => (
                <form key={f.id} action={updateFund} className="border rounded-md p-3 grid gap-3 md:grid-cols-5 items-end">
                  <input type="hidden" name="engagementId" value={params.engagementId} />
                  <input type="hidden" name="fundId" value={f.id} />
                  <div>
                    <label className="text-xs font-medium">Fund Code</label>
                    <Input value={f.fundCode} readOnly />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-xs font-medium">Name</label>
                    <Input name="name" defaultValue={f.name ?? ""} placeholder="General Fund" />
                  </div>
                  <div>
                    <label className="text-xs font-medium">Fund Type</label>
                    <Select name="fundType" defaultValue={f.fundType}>
                      {fundTypes.map(t => <option key={t} value={t}>{t}</option>)}
                    </Select>
                  </div>
                  <div className="flex gap-2 items-center">
                    <label className="text-sm">
                      <input type="checkbox" name="isMajor" defaultChecked={f.isMajor} className="mr-2" />
                      Major
                    </label>
                    <Button type="submit" className="ml-auto">Save</Button>
                  </div>
                </form>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
