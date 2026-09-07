"use client";

import React, { useEffect } from "react";
import { useTenant } from "@/components/shared/TenantProvider";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  Inbox,
  Key,
  LogOut,
  Building,
  Loader2,
} from "lucide-react";

export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { tenantId, isLoading, tenantName, signOut } = useTenant();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && !tenantId) {
      router.replace("/login");
    }
  }, [tenantId, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500 mb-3" />
        <p className="text-sm font-medium tracking-wide text-slate-300">
          Loading tenant workspace...
        </p>
      </div>
    );
  }

  if (!tenantId) {
    return null;
  }

  const navItems = [
    { href: "/tickets", label: "Tickets", icon: Inbox },
    { href: "/settings/api-keys", label: "API Keys", icon: Key },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Workspace Header */}
      <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center space-x-6">
          <Link href="/tickets" className="flex items-center space-x-2.5 group">
            <div className="h-7 w-7 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white shadow-md shadow-blue-500/20 group-hover:scale-105 transition">
              Ω
            </div>
            <span className="font-semibold text-sm tracking-tight text-white">
              OmniPulse
            </span>
          </Link>

          {/* Navigation Links */}
          <nav className="flex items-center space-x-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                    isActive
                      ? "bg-blue-600/10 text-blue-400 border border-blue-500/20"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Tenant Info & User Controls */}
        <div className="flex items-center space-x-3">
          {/* Tenant Badge */}
          <div className="hidden sm:flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-slate-300 text-xs">
            <Building className="h-3 w-3 text-slate-500" />
            <span className="text-slate-400">Workspace:</span>
            <span className="text-blue-400 font-medium">
              {tenantName ?? tenantId}
            </span>
          </div>

          {/* Sign Out */}
          <button
            type="button"
            onClick={signOut}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-red-400 transition text-xs cursor-pointer"
            title="Sign out of workspace"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Workspace Body */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-6 py-8">
        {children}
      </main>
    </div>
  );
}
