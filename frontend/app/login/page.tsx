import React from "react";
import Link from "next/link";
import { LoginForm } from "@/components/auth/LoginForm";
import { Lock, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In — OmniPulse",
  description: "Sign in to your OmniPulse tenant workspace",
};

export default function LoginPage() {
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
          href="/register"
          className="text-xs text-slate-400 hover:text-slate-200 transition"
        >
          Need an account? <span className="text-blue-400">Register</span>
        </Link>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          {/* Card */}
          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/70 backdrop-blur-md p-8 shadow-2xl shadow-blue-950/20">
            <div className="mb-6 text-center">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium mb-3">
                <Lock className="h-3 w-3" />
                <span>Secure Authentication</span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-white">
                Sign in to workspace
              </h1>
              <p className="mt-1 text-xs text-slate-400">
                Enter your credentials to access your organization&apos;s ticket pipeline.
              </p>
            </div>

            {/* Login Form */}
            <LoginForm />
          </div>

          <div className="mt-6 flex items-center justify-center space-x-2 text-xs text-slate-500">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500/70" />
            <span>End-to-end encrypted session with Supabase Auth</span>
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
