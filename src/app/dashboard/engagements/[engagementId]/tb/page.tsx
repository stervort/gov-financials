import { uploadTB, getLatestImports } from "@/src/server/actions/tb";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";

export default async function TBPage({ params }: { params: { engagementId: string } }) {
  const imports = await getLatestImports(params.engagementId);
  return (
    <div className="space-y-6 max-w-3xl">
      <Card>
        <CardHeader><CardTitle>Upload Trial Balance (CSV)</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-gray-500">Columns: Account, Description, FINAL BALANCE, Group, Subgroup.</p>
          <form action={uploadTB} className="space-y-3">
            <input type="hidden" name="engagementId" value={params.engagementId} />
            <Input name="file" type="file" accept=".csv" required />
            <Button type="submit">Import</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Recent Imports</CardTitle></CardHeader>
        <CardContent>
          {imports.length === 0 ? <p className="text-sm text-gray-500">None yet.</p> : (
            <ul className="divide-y">
              {imports.map(i => (
                <li className="py-3" key={i.id}>
                  <div className="font-medium">{i.filename}</div>
                  <div className="text-sm text-gray-500">{i.status} • {new Date(i.createdAt).toLocaleString()}</div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
