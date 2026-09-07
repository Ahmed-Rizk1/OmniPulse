"use client";

import React from "react";
import { TicketStatus } from "@/lib/api";

export function StatusBadge({ status }: { status: TicketStatus }) {
  let label = status;
  let color = "bg-slate-800 text-slate-300 border-slate-700";

  switch (status) {
    case "pending":
      label = "Pending";
      color = "bg-amber-500/10 text-amber-400 border-amber-500/30";
      break;
    case "processing":
      label = "Processing";
      color = "bg-blue-500/10 text-blue-400 border-blue-500/30 animate-pulse";
      break;
    case "open":
      label = "Open";
      color = "bg-indigo-500/10 text-indigo-400 border-indigo-500/30";
      break;
    case "resolved_cached":
      label = "Resolved (Cache)";
      color = "bg-cyan-500/10 text-cyan-400 border-cyan-500/30";
      break;
    case "resolved_tier1":
      label = "Resolved (Tier 1)";
      color = "bg-blue-500/10 text-blue-400 border-blue-500/30";
      break;
    case "resolved_tier2":
      label = "Resolved (Tier 2)";
      color = "bg-purple-500/10 text-purple-400 border-purple-500/30";
      break;
    case "escalated_human":
    case "escalated":
      label = "Escalated";
      color = "bg-rose-500/10 text-rose-400 border-rose-500/30";
      break;
    default:
      if (status.startsWith("resolved")) {
        label = "Resolved";
        color = "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
      }
      break;
  }

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border ${color}`}
    >
      {label}
    </span>
  );
}
