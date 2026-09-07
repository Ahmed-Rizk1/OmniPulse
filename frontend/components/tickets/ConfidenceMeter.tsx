"use client";

import React from "react";

export function ConfidenceMeter({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(1, value));
  const pct = Math.round(clamped * 100);

  // Dynamic color tone based on confidence tier
  const barColor =
    pct >= 90
      ? "from-emerald-500 to-teal-400"
      : pct >= 75
      ? "from-blue-600 to-cyan-400"
      : pct >= 50
      ? "from-amber-500 to-yellow-400"
      : "from-rose-600 to-red-400";

  return (
    <div className="w-full">
      <div className="flex items-center justify-between text-xs mb-1.5">
        <span className="font-medium text-slate-400">Confidence Score</span>
        <span className="font-mono font-semibold text-slate-200">{pct}%</span>
      </div>
      <div className="h-2 bg-slate-800/80 rounded-full overflow-hidden border border-slate-700/50">
        <div
          className={`h-full bg-gradient-to-r ${barColor} rounded-full transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
