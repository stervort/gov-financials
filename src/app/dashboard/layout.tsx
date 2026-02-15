import { Sidebar } from "@/src/components/nav/sidebar";
import { requireAuth } from "@/src/server/security/tenant";
import { SignOutButton } from "@/src/components/nav/sign-out-button";
import Link from "next/link";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAuth();

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1">
        <header className="border-b bg-white px-6 py-4 flex items-center justify-between">
          <Link href="/dashboard" className="font-semibold">
            Gov Financials
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">{user.email}</span>
            <SignOutButton />
          </div>
        </header>
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
