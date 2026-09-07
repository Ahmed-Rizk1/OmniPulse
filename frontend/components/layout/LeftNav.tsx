"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { fetchTicketCounts, TicketCounts } from "@/lib/api";
import { useTenant } from "@/components/shared/TenantProvider";
import {
  Inbox,
  BarChart2,
  Plug,
  FolderOpen,
  Users,
  Settings,
  Bell,
  LogOut,
  Building,
  CheckCircle2,
  AlertTriangle,
  Clock,
  CircleDot,
  Layers,
  FilterX,
} from "lucide-react";

interface LeftNavProps {
  className?: string;
}

export function LeftNav({ className = "" }: LeftNavProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { tenantId, tenantName, session, signOut } = useTenant();

  // Polling ticket counts every 10 seconds
  const { data: counts } = useQuery<TicketCounts>({
    queryKey: ["ticket-counts", tenantId],
    queryFn: () => fetchTicketCounts(tenantId!, session?.access_token),
    enabled: Boolean(tenantId),
    refetchInterval: 10_000,
  });

  const activeView = searchParams.get("view") || "all";
  const activeCategory = searchParams.get("category");
  const activePriority = searchParams.get("priority");

  const updateParam = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (!value || params.get(key) === value) {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    // Always navigate to /tickets when changing filters
    router.push(`/tickets?${params.toString()}`);
  };

  const clearAllFilters = () => {
    router.push("/tickets");
  };

  const views = [
    { id: "all", label: "All Tickets", icon: Layers, count: counts?.all ?? 0 },
    { id: "new", label: "New", icon: CircleDot, count: counts?.new ?? 0 },
    { id: "open", label: "Open", icon: Inbox, count: counts?.open ?? 0 },
    { id: "pending", label: "Pending", icon: Clock, count: counts?.pending ?? 0 },
    { id: "resolved", label: "Resolved", icon: CheckCircle2, count: counts?.resolved ?? 0 },
    { id: "escalated", label: "Escalated", icon: AlertTriangle, count: counts?.escalated ?? 0 },
  ];

  const categories = [
    { id: "billing", label: "Billing" },
    { id: "technical", label: "Technical" },
    { id: "account", label: "Account" },
    { id: "feature_request", label: "Feature Req" },
    { id: "general", label: "General" },
  ];

  const priorities = [
    { id: "critical", label: "Critical", color: "bg-rose-500" },
    { id: "high", label: "High", color: "bg-amber-500" },
    { id: "medium", label: "Medium", color: "bg-blue-500" },
    { id: "low", label: "Low", color: "bg-slate-500" },
  ];

  const railIcons = [
    { icon: Inbox, href: "/tickets", label: "Tickets", active: pathname.startsWith("/tickets") },
    { icon: BarChart2, href: "/tickets", label: "Analytics", active: false },
    { icon: Plug, href: "/settings/api-keys", label: "Integrations", active: false },
    { icon: FolderOpen, href: "/tickets", label: "Knowledge Base", active: false },
    { icon: Users, href: "/tickets", label: "Team", active: false },
    { icon: Bell, href: "/tickets", label: "Notifications", active: false },
    { icon: Settings, href: "/settings/api-keys", label: "Settings", active: pathname.startsWith("/settings") },
  ];

  const hasActiveFilters = activeCategory || activePriority || (activeView && activeView !== "all");

  return (
    <aside className={`flex h-full border-r border-slate-800/80 bg-slate-950 select-none ${className}`}>
      {/* 1. Slim Left Icon Rail (60px) */}
      <div className="w-14 shrink-0 flex flex-col items-center justify-between border-r border-slate-800/60 bg-slate-950/80 py-3.5">
        <div className="flex flex-col items-center space-y-4">
          <Link
            href="/tickets"
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white font-black text-base shadow-lg shadow-blue-600/30 hover:scale-105 transition"
            title="OmniPulse"
          >
            Ω
          </Link>
          <div className="w-6 h-px bg-slate-800 my-1" />

          {railIcons.map((item, idx) => {
            const Icon = item.icon;
            return (
              <Link
                key={idx}
                href={item.href}
                className={`flex h-9 w-9 items-center justify-center rounded-xl transition ${
                  item.active
                    ? "bg-blue-600/20 text-blue-400 border border-blue-500/30 shadow"
                    : "text-slate-400 hover:text-slate-100 hover:bg-slate-900"
                }`}
                title={item.label}
              >
                <Icon className="h-4 w-4" />
              </Link>
            );
          })}
        </div>

        {/* Bottom Rail User Avatar & Sign Out */}
        <div className="flex flex-col items-center space-y-2">
          <button
            type="button"
            onClick={signOut}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
            title="Sign Out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* 2. Operational Filters & Navigation Drawer */}
      <div className="flex-1 flex flex-col overflow-y-auto px-3.5 py-4 space-y-6">
        {/* Workspace Brand & Tenant */}
        <div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Workspace
            </span>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="inline-flex items-center space-x-1 text-[10px] text-blue-400 hover:text-blue-300 transition cursor-pointer"
              >
                <FilterX className="h-3 w-3" />
                <span>Reset</span>
              </button>
            )}
          </div>
          <div className="mt-1 flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900/80 border border-slate-800 text-xs text-slate-300">
            <Building className="h-3.5 w-3.5 text-blue-400 shrink-0" />
            <span className="truncate font-medium text-slate-200">
              {tenantName ?? tenantId?.slice(0, 8)}
            </span>
          </div>
        </div>

        {/* Primary Views */}
        <div>
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-1">
            Views
          </span>
          <div className="mt-2 space-y-1">
            {views.map((v) => {
              const Icon = v.icon;
              const isSelected = activeView === v.id;
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => updateParam("view", v.id === "all" ? null : v.id)}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                    isSelected
                      ? "bg-blue-600/15 text-blue-400 border border-blue-500/30"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/60"
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <Icon className="h-3.5 w-3.5" />
                    <span>{v.label}</span>
                  </div>
                  <span
                    className={`text-[11px] px-1.5 py-0.2 rounded-full font-mono ${
                      isSelected
                        ? "bg-blue-500/20 text-blue-300"
                        : "bg-slate-900 text-slate-400 border border-slate-800"
                    }`}
                  >
                    {v.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Category Filters */}
        <div>
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-1">
            Categories
          </span>
          <div className="mt-2 space-y-1">
            {categories.map((c) => {
              const isSelected = activeCategory === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => updateParam("category", c.id)}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                    isSelected
                      ? "bg-purple-600/15 text-purple-400 border border-purple-500/30"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/60"
                  }`}
                >
                  <span>{c.label}</span>
                  {isSelected && (
                    <span className="h-1.5 w-1.5 rounded-full bg-purple-400" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Priority Filters */}
        <div>
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-1">
            Priority
          </span>
          <div className="mt-2 space-y-1">
            {priorities.map((p) => {
              const isSelected = activePriority === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => updateParam("priority", p.id)}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                    isSelected
                      ? "bg-slate-800 text-slate-100 border border-slate-700"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/60"
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <span className={`h-2 w-2 rounded-full ${p.color}`} />
                    <span>{p.label}</span>
                  </div>
                  {isSelected && (
                    <span className="text-[10px] font-mono text-slate-400">active</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </aside>
  );
}
