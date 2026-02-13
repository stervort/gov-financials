import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Button } from "@/src/components/ui/button";
export default function Home() {
  return (
    <main className="mx-auto max-w-3xl p-6">
      <Card>
        <CardHeader><CardTitle>Gov Financials (Slice 2)</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600">TB preview + fund rules + fund manager.</p>
          <Link href="/dashboard"><Button>Go to Dashboard</Button></Link>
        </CardContent>
      </Card>
    </main>
  );
}
