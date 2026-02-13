import "@/src/styles/globals.css";
import type { Metadata } from "next";
export const metadata: Metadata = { title: "Gov Financials", description: "FS compiler" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="en"><body className="min-h-screen bg-gray-50 text-gray-900">{children}</body></html>);
}
