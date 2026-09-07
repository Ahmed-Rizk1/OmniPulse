"use client";

import React from "react";
import { CheckCircle2, Clock, AlertCircle } from "lucide-react";

interface ChannelStatusBadgeProps {
  status: "connected" | "ready" | "not_connected" | string;
  customLabel?: string;
}

export function ChannelStatusBadge({
  status,
  customLabel,
}: ChannelStatusBadgeProps) {
  const normalized = status.toLowerCase();

  if (normalized === "connected") {
    return (
      <span className="inline-flex items-center space-x-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-400">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
        <span>{customLabel || "Connected"}</span>
      </span>
    );
  }

  if (normalized === "ready") {
    return (
      <span className="inline-flex items-center space-x-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 px-2.5 py-0.5 text-[11px] font-semibold text-amber-400">
        <Clock className="h-3 w-3" />
        <span>{customLabel || "Ready for forwarding"}</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center space-x-1.5 rounded-full bg-slate-800 border border-slate-700 px-2.5 py-0.5 text-[11px] font-semibold text-slate-400">
      <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
      <span>{customLabel || "Not Connected"}</span>
    </span>
  );
}
