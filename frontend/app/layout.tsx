import type { Metadata } from "next";
import "./globals.css";
import { TenantProvider } from "@/components/shared/TenantProvider";
import { QueryProvider } from "@/components/shared/QueryProvider";

export const metadata: Metadata = {
  title: "OmniPulse Console",
  description: "Enterprise Multi-Tenant AI Ticket Handling Workspace",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen bg-slate-50 text-slate-900 font-sans">
        <QueryProvider>
          <TenantProvider>{children}</TenantProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
