"use client";

import React from "react";
import { TicketStatus } from "@/lib/api";

const SOURCE_MAP: Record<string, { label: string; className: string }> = {
  resolved_cached: {
    label: "⚡ Cached",
    className: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
  },
  resolved_tier2: {
    label: "🧠 Grounded RAG",
    className: "bg-purple-500/10 text-purple-400 border-purple-500/30",
  },
  resolved_tier1: {
    label: "⚡ Groq Tier 1",
    className: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  },
  escalated_human: {
    label: "⚠️ Human Escalation",
    className: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  },
};

export function SourceBadge({ status }: { status: TicketStatus }) {
  const item = SOURCE_MAP[status];
  if (!item) return null;

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${item.className}`}
    >
      {item.label}
    </span>
  );
}
