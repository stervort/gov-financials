import Link from "next/link";
export function Sidebar() {
  return (
    <aside className="w-64 border-r bg-white">
      <div className="px-6 py-4 font-semibold">GovFS</div>
      <nav className="px-3 space-y-1">
        <Link href="/dashboard" className="block rounded-md px-3 py-2 text-sm hover:bg-gray-100">Dashboard</Link>
      </nav>
    </aside>
  );
}
