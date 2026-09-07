"use client";

import React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { fetchTickets, TicketDetail, TicketFilterParams } from "@/lib/api";
import { useTenant } from "@/components/shared/TenantProvider";
import { StatusBadge } from "@/components/tickets/StatusBadge";
import { PriorityFlag } from "@/components/tickets/PriorityFlag";
import { CategoryBadge } from "@/components/tickets/CategoryBadge";
import {
  Inbox,
  AlertCircle,
  RefreshCw,
  Clock,
  Sparkles,
  ChevronRight,
  FilterX,
} from "lucide-react";

export function TicketTable() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { tenantId, session } = useTenant();

  const selectedTicketId = searchParams.get("ticket");
  const activeView = searchParams.get("view");
  const activeCategory = searchParams.get("category");
  const activePriority = searchParams.get("priority");
  const activePage = searchParams.get("page")
    ? parseInt(searchParams.get("page")!, 10)
    : 1;

  const filters: TicketFilterParams = {
    view: activeView,
    category: activeCategory,
    priority: activePriority,
    page: activePage,
    pageSize: 50,
  };

  const {
    data: tickets,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery<TicketDetail[]>({
    queryKey: [
      "tickets",
      tenantId,
      activeView,
      activeCategory,
      activePriority,
      activePage,
    ],
    queryFn: () => fetchTickets(filters, tenantId!, session?.access_token),
    enabled: Boolean(tenantId),
    refetchInterval: 10_000,
  });

  const handleSelectTicket = (id: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("ticket", id);
    router.push(`/tickets?${params.toString()}`);
  };

  const clearFilters = () => {
    router.push("/tickets");
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-950">
      {/* Top Action Bar */}
      <div className="px-5 py-3 border-b border-slate-800/80 bg-slate-950/60 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <h1 className="text-sm font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
            <span>Ticket Queue</span>
            {isFetching && !isLoading && (
              <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-ping" />
            )}
          </h1>
          {(activeView || activeCategory || activePriority) && (
            <div className="flex items-center space-x-1.5">
              {activeView && (
                <span className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[11px] capitalize">
                  {activeView}
                </span>
              )}
              {activeCategory && (
                <span className="px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-400 border border-purple-500/20 text-[11px] capitalize">
                  {activeCategory}
                </span>
              )}
              {activePriority && (
                <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[11px] capitalize">
                  {activePriority}
                </span>
              )}
              <button
                type="button"
                onClick={clearFilters}
                className="text-[11px] text-slate-400 hover:text-slate-200 ml-1 underline cursor-pointer"
              >
                Clear
              </button>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-slate-800 transition disabled:opacity-50 cursor-pointer"
          title="Refresh ticket queue"
        >
          <RefreshCw className={`h-3 w-3 ${isFetching ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Main Table Content */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          /* Loading Skeletons (8 rows) */
          <div className="divide-y divide-slate-800/50">
            {Array.from({ length: 8 }).map((_, idx) => (
              <div key={idx} className="p-4 flex items-center justify-between space-x-4 animate-pulse">
                <div className="flex items-center space-x-3 w-1/3">
                  <div className="h-4 w-16 bg-slate-800 rounded" />
                  <div className="h-4 w-40 bg-slate-800/80 rounded" />
                </div>
                <div className="h-4 w-20 bg-slate-800/60 rounded" />
                <div className="h-4 w-20 bg-slate-800/60 rounded" />
                <div className="h-4 w-24 bg-slate-800/60 rounded" />
              </div>
            ))}
          </div>
        ) : isError ? (
          /* Error State */
          <div className="p-8 text-center max-w-md mx-auto">
            <div className="h-10 w-10 mx-auto rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mb-3">
              <AlertCircle className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-semibold text-slate-200">Unable to load tickets</h3>
            <p className="mt-1 text-xs text-slate-400">
              {error instanceof Error ? error.message : "Network error"}
            </p>
            <button
              type="button"
              onClick={() => refetch()}
              className="mt-4 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition cursor-pointer"
            >
              Retry
            </button>
          </div>
        ) : !tickets || tickets.length === 0 ? (
          /* Empty State */
          <div className="p-12 text-center max-w-md mx-auto">
            <div className="h-12 w-12 mx-auto rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 mb-3">
              <Inbox className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-semibold text-slate-200">No tickets found</h3>
            <p className="mt-1 text-xs text-slate-400">
              No support tickets match the current view or filter criteria.
            </p>
            {(activeView || activeCategory || activePriority) && (
              <button
                type="button"
                onClick={clearFilters}
                className="mt-4 inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-blue-600/10 text-blue-400 border border-blue-500/20 text-xs font-medium hover:bg-blue-600/20 transition cursor-pointer"
              >
                <FilterX className="h-3 w-3" />
                <span>Reset Filters</span>
              </button>
            )}
          </div>
        ) : (
          /* Ticket Rows */
          <div className="divide-y divide-slate-800/60">
            {tickets.map((t) => {
              const isSelected = selectedTicketId === t.ticket_id;
              const shortId = `AV-${t.ticket_id.slice(0, 8).toUpperCase()}`;
              const timeFormatted = new Date(t.created_at).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              });

              return (
                <div
                  key={t.ticket_id}
                  onClick={() => handleSelectTicket(t.ticket_id)}
                  className={`px-5 py-3.5 flex items-center justify-between gap-4 transition cursor-pointer group ${
                    isSelected
                      ? "bg-blue-600/10 border-l-4 border-l-blue-500 pl-4"
                      : "hover:bg-slate-900/50 border-l-4 border-l-transparent"
                  }`}
                >
                  {/* Left: ID & Subject */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="font-mono text-xs font-semibold text-blue-400">
                        {shortId}
                      </span>
                      <CategoryBadge category={t.category ?? t.triage_result?.category} />
                      <PriorityFlag priority={t.priority ?? t.triage_result?.priority} />
                    </div>
                    <p className="text-xs font-medium text-slate-200 truncate group-hover:text-white transition">
                      {t.subject}
                    </p>
                    <p className="text-[11px] text-slate-400 truncate mt-0.5">
                      {t.summary ?? t.triage_result?.summary ?? t.body}
                    </p>
                  </div>

                  {/* Right: Status & Timestamp */}
                  <div className="shrink-0 flex items-center space-x-3 text-right">
                    <div className="flex flex-col items-end space-y-1">
                      <StatusBadge status={t.status} />
                      <span className="text-[10px] font-mono text-slate-500 flex items-center space-x-1">
                        <Clock className="h-2.5 w-2.5" />
                        <span>{timeFormatted}</span>
                      </span>
                    </div>
                    <ChevronRight
                      className={`h-4 w-4 transition ${
                        isSelected ? "text-blue-400" : "text-slate-600 group-hover:text-slate-400"
                      }`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
