"use client";

import React from "react";
import {
  Layers,
  Cpu,
  Database,
  Radio,
  CheckCircle2,
  ExternalLink,
  ShieldAlert,
  ArrowRight,
} from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-between">
      {/* Top Header */}
      <header className="border-b border-slate-800 bg-slate-950/80 px-8 py-4 backdrop-blur flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white shadow-lg shadow-blue-500/30">
            Ω
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-white flex items-center gap-2">
              OmniPulse Console
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                Shell Ready
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              Enterprise Multi-Tenant AI Operational Platform
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-4 text-xs">
          <div className="flex items-center gap-1.5 text-slate-400">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Slice 10 Verified</span>
          </div>
          <a
            href="/health"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
          >
            Backend Health <ExternalLink className="h-3 w-3" />
          </a>
          <a
            href="/metrics"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
          >
            Metrics <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-6xl mx-auto w-full px-8 py-12 flex-1 flex flex-col justify-center">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          {/* Card 1: Shell Foundation */}
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <span className="p-2.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
                <Layers className="h-5 w-5" />
              </span>
              <span className="text-xs font-mono text-slate-500">NEXT.JS 15</span>
            </div>
            <h2 className="text-base font-semibold text-white mb-1">
              Frontend Shell Stack
            </h2>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              App Router, TypeScript strict, Tailwind CSS v3, and shadcn/ui base design tokens.
            </p>
            <div className="space-y-2 text-xs text-slate-300">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                <span>TanStack Query v5 configured</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                <span>Strict API boundary (`lib/api.ts`)</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                <span>Fail-fast environment accessor</span>
              </div>
            </div>
          </div>

          {/* Card 2: Security & Multi-Tenancy */}
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <span className="p-2.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                <ShieldAlert className="h-5 w-5" />
              </span>
              <span className="text-xs font-mono text-slate-500">ISOLATION</span>
            </div>
            <h2 className="text-base font-semibold text-white mb-1">
              Context & Propagation
            </h2>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              Strict isolation and telemetry headers enforced on every external call.
            </p>
            <div className="space-y-2 text-xs text-slate-300">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-indigo-400" />
                <span>TenantProvider session context ready</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-indigo-400" />
                <span>`X-Tenant-Id` header injection</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-indigo-400" />
                <span>`X-Correlation-Id` UUID propagation</span>
              </div>
            </div>
          </div>

          {/* Card 3: Reverse Proxy Architecture */}
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <span className="p-2.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                <Radio className="h-5 w-5" />
              </span>
              <span className="text-xs font-mono text-slate-500">DOCKER + NGINX</span>
            </div>
            <h2 className="text-base font-semibold text-white mb-1">
              Gateway Integration
            </h2>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              Multi-stage Docker container deployed behind the primary Nginx reverse proxy.
            </p>
            <div className="space-y-2 text-xs text-slate-300">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-cyan-400" />
                <span>Static export via `nginx:alpine`</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-cyan-400" />
                <span>`/api/*` forwarded to Backend :8000</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-cyan-400" />
                <span>Production security headers active</span>
              </div>
            </div>
          </div>
        </div>

        {/* Roadmap Banner */}
        <div className="rounded-xl border border-blue-900/40 bg-blue-950/20 p-6 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-blue-200 mb-1">
              Next Phase: Slice 11 (Tenant Auth & Onboarding)
            </h3>
            <p className="text-xs text-blue-300/70">
              Proceeding to company registration, Supabase authentication, and API key management screens.
            </p>
          </div>
          <div className="flex items-center text-xs font-medium text-blue-400 gap-1">
            <span>Slices 11–13 Queued</span>
            <ArrowRight className="h-4 w-4" />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-950 px-8 py-3 text-center text-xs text-slate-500">
        OmniPulse Architecture · Slice 10 Operational Baseline · Antigravity AI Systems
      </footer>
    </div>
  );
}
