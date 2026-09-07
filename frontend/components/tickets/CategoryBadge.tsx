"use client";

import React from "react";
import { TicketCategory } from "@/lib/api";

export function CategoryBadge({ category }: { category?: TicketCategory | null }) {
  const cat = (category || "general").toLowerCase();

  let label = "General";
  let style = "bg-slate-800/80 text-slate-300 border-slate-700";

  switch (cat) {
    case "billing":
      label = "Billing";
      style = "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
      break;
    case "technical":
      label = "Technical";
      style = "bg-blue-500/10 text-blue-400 border-blue-500/30";
      break;
    case "account":
      label = "Account";
      style = "bg-indigo-500/10 text-indigo-400 border-indigo-500/30";
      break;
    case "feature_request":
      label = "Feature Req";
      style = "bg-purple-500/10 text-purple-400 border-purple-500/30";
      break;
    default:
      label = category || "General";
      style = "bg-slate-800 text-slate-300 border-slate-700";
      break;
  }

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${style}`}
    >
      {label}
    </span>
  );
}
