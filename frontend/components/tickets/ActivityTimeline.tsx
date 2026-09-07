"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchTicketEvents, TicketEvent } from "@/lib/api";
import { useTenant } from "@/components/shared/TenantProvider";
import { Clock, Cpu, CheckCircle2, ArrowRight, Loader2 } from "lucide-react";

export function ActivityTimeline({ ticketId }: { ticketId: string }) {
  const { tenantId, session } = useTenant();

  const { data: events, isLoading } = useQuery<TicketEvent[]>({
    queryKey: ["ticket-events", ticketId],
    queryFn: () => fetchTicketEvents(ticketId, tenantId!, session?.access_token),
    enabled: Boolean(ticketId && tenantId),
    refetchInterval: 15_000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-6 text-slate-500 text-xs">
        <Loader2 className="h-4 w-4 animate-spin mr-2 text-blue-500" />
        <span>Loading activity...</span>
      </div>
    );
  }

  const items = events || [];

  if (items.length === 0) {
    return (
      <p className="text-xs text-slate-500 italic py-2">No activity recorded yet.</p>
    );
  }

  const getEventIcon = (type: string) => {
    switch (type) {
      case "triaged":
        return <Cpu className="h-3.5 w-3.5 text-purple-400" />;
      case "resolved":
      case "status_changed":
        return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />;
      case "ingested":
      default:
        return <Clock className="h-3.5 w-3.5 text-blue-400" />;
    }
  };

  return (
    <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
      {items.map((evt) => {
        const timeStr = new Date(evt.timestamp).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        });

        return (
          <div key={evt.id} className="relative group">
            <div className="absolute -left-6 mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 border border-slate-700 shadow">
              {getEventIcon(evt.type)}
            </div>
            <div>
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-slate-200">{evt.message}</span>
                <span className="font-mono text-[10px] text-slate-500 ml-2">
                  {timeStr}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
