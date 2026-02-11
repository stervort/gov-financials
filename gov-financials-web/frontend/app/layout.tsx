import "./globals.css";

export const metadata = {
  title: "Gov Financials Web MVP",
  description: "Trial balance upload → mapping → statements → conversions → narrative tokens",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
