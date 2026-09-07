"use client";

import React, { useEffect } from "react";
import { useTenant } from "@/components/shared/TenantProvider";
import { useRouter, usePathname } from "next/navigation";
import { LeftNav } from "@/components/layout/LeftNav";
import { TicketDetailPanel } from "@/components/layout/TicketDetailPanel";
import { Loader2 } from "lucide-react";

export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { tenantId, isLoading } = useTenant();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && !tenantId) {
      router.replace("/login");
    }
  }, [tenantId, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500 mb-3" />
        <p className="text-sm font-medium tracking-wide text-slate-300">
          Loading tenant workspace...
        </p>
      </div>
    );
  }

  if (!tenantId) {
    return null;
  }

  // Right AI Resolution Cockpit renders on ticket workspace views
  const isTicketsWorkspace =
    pathname.startsWith("/tickets") || pathname === "/";

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950 text-slate-100">
      {/* Column 1: Left Operational Navigation & Filters */}
      <LeftNav className="w-[260px] shrink-0" />

      {/* Column 2: Center Content (Ticket Table / Settings) */}
      <main className="flex-1 overflow-auto bg-slate-950">{children}</main>

      {/* Column 3: Right AI Resolution Cockpit & Timeline */}
      {isTicketsWorkspace && (
        <TicketDetailPanel className="w-[420px] shrink-0" />
      )}
    </div>
  );
}
