import "@/src/styles/globals.css";
import type { Metadata } from "next";
import { Providers } from "@/src/components/providers";

export const metadata: Metadata = {
  title: "Gov Financials",
  description: "Governmental Financial Statement Creator",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 text-gray-900">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
