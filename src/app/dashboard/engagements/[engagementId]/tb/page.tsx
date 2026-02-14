export const dynamic = "force-dynamic";

import Link from "next/link";
import { getImportPreview, uploadTB, clearTB } from "@/src/server/actions/tb";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";

function qp(params: Record<string, any>) {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") return;
    sp.set(k, String(v));
  });
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export default async function TBPage({
  params,
  searchParams,
}: {
  params: { engagementId: string };
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const page = Number(Array.isArray(searchParams?.page) ? searchParams?.page[0] : searchParams?.page ?? "1") || 1;
  const pageSize = Number(Array.isArray(searchParams?.pageSize) ? searchParams?.pageSize[0] : searchParams?.pageSize ?? "50") || 50;

  const accountSearch = String(Array.isArray(searchParams?.account) ? searchParams?.account[0] : searchParams?.account ?? "");
  const descSearch = String(Array.isArray(searchParams?.desc) ? searchParams?.desc[0] : searchParams?.desc ?? "");
  const groupSearch = String(Array.isArray(searchParams?.group) ? searchParams?.group[0] : searchParams?.group ?? "");
  const subgroupSearch = String(Array.isArray(searchParams?.subgroup) ? searchParams?.subgroup[0] : searchParams?.subgroup ?? "");
  const fundSearch = String(Array.isArray(searchParams?.fund) ? searchParams?.fund[0] : searchParams?.fund ?? "");

  const preview = await getImportPreview(params.engagementId, {
    page,
    pageSize,
    accountSearch: accountSearch || undefined,
    descSearch: descSearch || undefined,
    groupSearch: groupSearch || undefined,
    subgroupSearch: subgroupSearch || undefined,
    fundSearch: fundSearch || undefined,
  });

  const hasImport = !!preview.import;
  const totalPages = preview.total ? Math.max(1, Math.ceil(preview.total / preview.pageSize)) : 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Trial Balance</h1>
          <p className="text-sm text-gray-500">Upload a file, map columns, then review the imported lines.</p>
        </div>
        <Link href={`/dashboard/engagements/${params.engagementId}`}>
          <Button variant="secondary">Back to Engagement</Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upload / Replace</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form action={uploadTB} className="flex flex-col gap-3">
            <input type="hidden" name="engagementId" value={params.engagementId} />
            <input type="file" name="file" accept=".csv,.xlsx,.xls" required />
            <div className="flex gap-2">
              <Button type="submit">Upload</Button>
              {hasImport && (
                <Link href={`/dashboard/engagements/${params.engagementId}/tb/map/${preview.import.id}`}>
                  <Button type="button" variant="secondary">Re-map</Button>
                </Link>
              )}
            </div>
          </form>

          {hasImport && (
            <form action={clearTB}>
              <input type="hidden" name="engagementId" value={params.engagementId} />
              <Button type="submit" variant="destructive">Clear current imported TB</Button>
            </form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Preview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!hasImport ? (
            <p className="text-sm text-gray-500">No trial balance imported yet.</p>
          ) : (
            <>
              <form method="get" className="grid gap-2 md:grid-cols-6 items-end">
                <div className="md:col-span-1">
                  <label className="text-xs font-medium text-gray-600">Account</label>
                  <Input name="account" defaultValue={accountSearch} placeholder="Search" />
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs font-medium text-gray-600">Description</label>
                  <Input name="desc" defaultValue={descSearch} placeholder="Search" />
                </div>
                <div className="md:col-span-1">
                  <label className="text-xs font-medium text-gray-600">Fund</label>
                  <Input name="fund" defaultValue={fundSearch} placeholder="10" />
                </div>
                <div className="md:col-span-1">
                  <label className="text-xs font-medium text-gray-600">Group</label>
                  <Input name="group" defaultValue={groupSearch} placeholder="Search" />
                </div>
                <div className="md:col-span-1">
                  <label className="text-xs font-medium text-gray-600">Subgroup</label>
                  <Input name="subgroup" defaultValue={subgroupSearch} placeholder="Search" />
                </div>

                <input type="hidden" name="page" value="1" />
                <input type="hidden" name="pageSize" value={String(preview.pageSize)} />

                <div className="md:col-span-6 flex flex-wrap gap-2 items-center">
                  <Button type="submit" variant="secondary">Filter</Button>
                  <Link
                    href={qp({ page: 1, pageSize: preview.pageSize })}
                    className="text-sm text-gray-600 underline"
                  >
                    Clear filters
                  </Link>

                  <div className="ml-auto flex items-center gap-2">
                    <span className="text-xs text-gray-500">Page size</span>
                    <select
                      name="pageSize"
                      defaultValue={String(preview.pageSize)}
                      className="border rounded px-2 py-1 text-sm"
                      onChange={() => {}}
                      // NOTE: This is a server component, so the select is only applied when you click Filter.
                    >
                      {[25,50,100,250,500].map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                </div>
              </form>

              <div className="text-xs text-gray-500">
                Showing {(preview.total === 0) ? 0 : ((preview.page - 1) * preview.pageSize + 1)}-
                {Math.min(preview.page * preview.pageSize, preview.total)} of {preview.total} lines.
              </div>

              <div className="overflow-auto border rounded-md">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr className="text-left">
                      <th className="px-3 py-2">Account</th>
                      <th className="px-3 py-2">Description</th>
                      <th className="px-3 py-2">Fund</th>
                      <th className="px-3 py-2">Group</th>
                      <th className="px-3 py-2">Subgroup</th>
                      <th className="px-3 py-2 text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.lines.map((l) => (
                      <tr key={l.id} className="border-t">
                        <td className="px-3 py-2 font-mono">{l.account}</td>
                        <td className="px-3 py-2">{l.description ?? ""}</td>
                        <td className="px-3 py-2">{l.fundCode ?? ""}</td>
                        <td className="px-3 py-2">{l.group ?? ""}</td>
                        <td className="px-3 py-2">{l.subgroup ?? ""}</td>
                        <td className="px-3 py-2 text-right">{Number(l.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  Page {preview.page} / {totalPages}
                </div>
                <div className="flex gap-2">
                  <Link
                    href={qp({
                      page: Math.max(1, preview.page - 1),
                      pageSize: preview.pageSize,
                      account: accountSearch || undefined,
                      desc: descSearch || undefined,
                      fund: fundSearch || undefined,
                      group: groupSearch || undefined,
                      subgroup: subgroupSearch || undefined,
                    })}
                  >
                    <Button variant="secondary" disabled={preview.page <= 1}>Prev</Button>
                  </Link>
                  <Link
                    href={qp({
                      page: Math.min(totalPages, preview.page + 1),
                      pageSize: preview.pageSize,
                      account: accountSearch || undefined,
                      desc: descSearch || undefined,
                      fund: fundSearch || undefined,
                      group: groupSearch || undefined,
                      subgroup: subgroupSearch || undefined,
                    })}
                  >
                    <Button variant="secondary" disabled={preview.page >= totalPages}>Next</Button>
                  </Link>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
