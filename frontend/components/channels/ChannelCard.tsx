"use client";

import React from "react";
import { LucideIcon } from "lucide-react";
import { ChannelStatusBadge } from "./ChannelStatusBadge";

interface ChannelCardProps {
  icon: LucideIcon;
  iconColor?: string;
  title: string;
  description: string;
  status: string;
  statusLabel?: string;
  children: React.ReactNode;
}

export function ChannelCard({
  icon: Icon,
  iconColor = "text-blue-400",
  title,
  description,
  status,
  statusLabel,
  children,
}: ChannelCardProps) {
  return (
    <div className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-6 backdrop-blur space-y-5 transition duration-200 hover:border-slate-700/80">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-800/60">
        <div className="flex items-center space-x-3.5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-800/80 border border-slate-700/60 shadow-sm">
            <Icon className={`h-5 w-5 ${iconColor}`} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">{title}</h3>
            <p className="text-xs text-slate-400">{description}</p>
          </div>
        </div>

        <div>
          <ChannelStatusBadge status={status} customLabel={statusLabel} />
        </div>
      </div>

      {/* Body Content */}
      <div className="space-y-4">{children}</div>
    </div>
  );
}
