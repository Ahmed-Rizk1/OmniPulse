"use client";

import React from "react";
import { TicketPriority } from "@/lib/api";
import { Flag } from "lucide-react";

export function PriorityFlag({ priority }: { priority?: TicketPriority | null }) {
  const p = (priority || "medium").toLowerCase();

  let color = "text-slate-400";
  let label = "Medium";

  switch (p) {
    case "critical":
      color = "text-rose-400";
      label = "Critical";
      break;
    case "high":
      color = "text-amber-400";
      label = "High";
      break;
    case "medium":
      color = "text-blue-400";
      label = "Medium";
      break;
    case "low":
      color = "text-slate-500";
      label = "Low";
      break;
    default:
      label = priority || "Medium";
  }

  return (
    <div className="flex items-center space-x-1.5 text-xs">
      <Flag className={`h-3.5 w-3.5 ${color}`} fill="currentColor" />
      <span className="capitalize text-slate-300 font-medium">{label}</span>
    </div>
  );
}
