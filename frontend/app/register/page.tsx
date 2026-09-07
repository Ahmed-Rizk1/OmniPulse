import React from "react";
import Link from "next/link";
import { RegisterForm } from "@/components/auth/RegisterForm";
import { Shield, Sparkles, Database } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Register Company — OmniPulse",
  description: "Create an isolated multi-tenant workspace on OmniPulse",
};

export default function RegisterPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-blue-500/30">
      {/* Top Bar */}
      <header className="px-8 py-5 flex items-center justify-between border-b border-slate-900 bg-slate-950/60 backdrop-blur">
        <Link href="/" className="flex items-center space-x-3 group">
          <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white shadow-lg shadow-blue-500/20 group-hover:scale-105 transition">
            Ω
          </div>
          <span className="font-semibold text-base tracking-tight text-white">
            OmniPulse
          </span>
        </Link>
        <Link
          href="/login"
          className="text-xs text-slate-400 hover:text-slate-200 transition"
        >
          Already registered? <span className="text-blue-400">Sign in</span>
        </Link>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          {/* Card */}
          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/70 backdrop-blur-md p-8 shadow-2xl shadow-blue-950/20">
            <div className="mb-6 text-center">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium mb-3">
                <Sparkles className="h-3 w-3" />
                <span>Multi-Tenant Onboarding</span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-white">
                Create your account
              </h1>
              <p className="mt-1 text-xs text-slate-400">
                Register your organization to access automated AI ticket triage and RAG copilot.
              </p>
            </div>

            {/* Registration Form */}
            <RegisterForm />
          </div>

          {/* Feature Badges */}
          <div className="mt-8 grid grid-cols-2 gap-3 text-center">
            <div className="rounded-xl border border-slate-800/60 bg-slate-900/40 p-3">
              <Shield className="h-4 w-4 text-emerald-400 mx-auto mb-1" />
              <p className="text-xs font-medium text-slate-300">Tenant RLS Isolation</p>
              <p className="text-[10px] text-slate-500">PostgreSQL enforced</p>
            </div>
            <div className="rounded-xl border border-slate-800/60 bg-slate-900/40 p-3">
              <Database className="h-4 w-4 text-blue-400 mx-auto mb-1" />
              <p className="text-xs font-medium text-slate-300">Dedicated Streams</p>
              <p className="text-[10px] text-slate-500">Redis event queue</p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-4 text-center text-xs text-slate-600 border-t border-slate-900">
        &copy; {new Date().getFullYear()} OmniPulse SaaS Inc. All rights reserved.
      </footer>
    </div>
  );
}
