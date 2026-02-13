import { Sidebar } from "@/src/components/nav/sidebar";
import Link from "next/link";
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1">
        <header className="border-b bg-white px-6 py-4 flex items-center justify-between">
          <Link href="/dashboard" className="font-semibold">Gov Financials</Link>
          <span className="text-sm text-gray-500">slice 2</span>
        </header>
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
