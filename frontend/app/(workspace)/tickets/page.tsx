"use client";

import React from "react";
import { useTenant } from "@/components/shared/TenantProvider";
import Link from "next/link";
import {
  Inbox,
  ShieldCheck,
  Key,
  ArrowRight,
} from "lucide-react";

export default function TicketsPage() {
  const { tenantId, tenantName } = useTenant();

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Banner */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium mb-2">
              <ShieldCheck className="h-3 w-3" />
              <span>Authenticated Tenant Session Active</span>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white">
              Support Ticket Pipeline
            </h1>
            <p className="mt-1 text-xs text-slate-400">
              Workspace:{" "}
              <span className="text-slate-200 font-medium">{tenantName ?? tenantId}</span>
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <Link
              href="/settings/api-keys"
              className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium transition"
            >
              <Key className="h-3.5 w-3.5 text-amber-400" />
              <span>Manage API Keys</span>
              <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Link>
          </div>
        </div>
      </div>

      {/* Placeholder / Slice 12 Readiness Card */}
      <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/30 p-12 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 mb-4">
          <Inbox className="h-7 w-7" />
        </div>
        <h2 className="text-lg font-semibold text-white tracking-tight">
          Ticket Queue Awaiting Ingestion
        </h2>
        <p className="mt-1.5 text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
          Authentication and tenant onboarding is verified. Inbound tickets submitted via webhook using your tenant API key will stream here for fast triage and automated copilot assistance.
        </p>

        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            href="/settings/api-keys"
            className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium shadow-md shadow-blue-500/20 transition"
          >
            <Key className="h-3.5 w-3.5" />
            <span>Generate Ingestion API Key</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
