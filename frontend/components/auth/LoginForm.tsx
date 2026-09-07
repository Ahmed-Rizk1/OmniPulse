"use client";

import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { env } from "@/lib/env";
import {
  Mail,
  Lock,
  Building2,
  Key,
  LogIn,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  ShieldAlert,
} from "lucide-react";

/**
 * Authentication Architecture & Wiring:
 *
 * 1. Direct Supabase Auth (Default Tab):
 *    - Calls `supabase.auth.signInWithPassword({ email, password })` directly against `env.supabaseUrl`.
 *    - If `NEXT_PUBLIC_SUPABASE_URL` is unreachable (e.g. local Docker Supabase daemon is down,
 *      or host:port is unreachable), the browser fetch throws/returns `Failed to fetch`.
 *    - Handled via try/catch and structured error inspection with an actionable diagnostic banner.
 *
 * 2. API Key / Tenant Direct Access (Fallback Tab):
 *    - Allows authenticating into the workspace directly using the Tenant Name and API Key
 *      generated at `/register` (stored in PostgreSQL `tenants` table).
 *    - Bypasses external Supabase Auth dependencies, unblocking local development and static exports.
 */

const emailLoginSchema = z.object({
  email: z
    .string()
    .min(1, { message: "Email is required" })
    .email({ message: "Please enter a valid email address" }),
  password: z
    .string()
    .min(1, { message: "Password is required" }),
});

const apiKeyLoginSchema = z.object({
  tenant_name: z
    .string()
    .min(1, { message: "Company / Tenant name is required" }),
  api_key: z
    .string()
    .min(1, { message: "API key is required" }),
});

type EmailLoginFormValues = z.infer<typeof emailLoginSchema>;
type ApiKeyLoginFormValues = z.infer<typeof apiKeyLoginSchema>;

export function LoginForm() {
  const [authMode, setAuthMode] = useState<"email" | "apikey">("email");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isFetchError, setIsFetchError] = useState(false);
  const [success, setSuccess] = useState(false);

  // Email login form
  const emailForm = useForm<EmailLoginFormValues>({
    resolver: zodResolver(emailLoginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  // API Key login form
  const apiKeyForm = useForm<ApiKeyLoginFormValues>({
    resolver: zodResolver(apiKeyLoginSchema),
    defaultValues: {
      tenant_name: "",
      api_key: "",
    },
  });

  // Populate cached registration hints if present
  useEffect(() => {
    try {
      const savedEmail = sessionStorage.getItem("omnipulse_user_email");
      const savedTenant = sessionStorage.getItem("omnipulse_tenant_name");
      const savedKey = sessionStorage.getItem("omnipulse_api_key");

      if (savedEmail) {
        emailForm.setValue("email", savedEmail);
      }
      if (savedTenant) {
        apiKeyForm.setValue("tenant_name", savedTenant);
      }
      if (savedKey) {
        apiKeyForm.setValue("api_key", savedKey);
      }
    } catch {
      // sessionStorage unavailable during SSR pre-rendering
    }
  }, [emailForm, apiKeyForm]);

  // Handle Email + Password Submission via Supabase Auth
  const onEmailSubmit = async (values: EmailLoginFormValues) => {
    setIsLoading(true);
    setErrorMessage(null);
    setIsFetchError(false);

    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: values.email.trim(),
        password: values.password,
      });

      if (error) {
        // Detect connection refused or unreachable Supabase URL
        const isNetworkError =
          error.message?.includes("Failed to fetch") ||
          error.message?.includes("NetworkError") ||
          error.name === "AuthRetryableFetchError" ||
          error.status === 0;

        if (isNetworkError) {
          setIsFetchError(true);
          setErrorMessage(
            `Failed to fetch: Supabase Auth server is unreachable at "${env.supabaseUrl}". Make sure your Supabase service is running, or switch to API Key login.`
          );
          return;
        }

        setErrorMessage(error.message || "Invalid email or password.");
        return;
      }

      if (data?.session) {
        // Cache user and tenant details in sessionStorage
        if (typeof window !== "undefined") {
          sessionStorage.setItem("omnipulse_user_email", values.email.trim());
          const tenantName =
            (data.session.user?.user_metadata?.company_name as string) ||
            sessionStorage.getItem("omnipulse_tenant_name") ||
            values.email.split("@")[0];
          sessionStorage.setItem("omnipulse_tenant_name", tenantName);

          const tenantUuid =
            (data.session.user?.user_metadata?.tenant_id as string) ||
            sessionStorage.getItem("omnipulse_tenant_id");
          if (tenantUuid) {
            sessionStorage.setItem("omnipulse_tenant_id", tenantUuid);
          }
        }

        setSuccess(true);
        setTimeout(() => {
          window.location.href = "/tickets";
        }, 600);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("Failed to fetch")) {
        setIsFetchError(true);
        setErrorMessage(
          `Failed to fetch: Supabase Auth server is unreachable at "${env.supabaseUrl}". Verify NEXT_PUBLIC_SUPABASE_URL or switch to API Key login.`
        );
      } else {
        setErrorMessage(msg || "Login failed. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Handle API Key Direct Submission (FastAPI Tenant Database)
  const onApiKeySubmit = async (values: ApiKeyLoginFormValues) => {
    setIsLoading(true);
    setErrorMessage(null);
    setIsFetchError(false);

    try {
      // Verify credentials with the backend and retrieve the real tenant UUID.
      const res = await fetch("/api/tenants/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_name: values.tenant_name.trim(),
          api_key: values.api_key.trim(),
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        setErrorMessage(
          errJson?.detail ?? "Invalid tenant name or API key. Please try again."
        );
        return;
      }

      const data: { tenant_id: string; tenant_name: string } = await res.json();

      if (typeof window !== "undefined") {
        sessionStorage.setItem("omnipulse_tenant_id",   data.tenant_id);
        sessionStorage.setItem("omnipulse_tenant_name", data.tenant_name);
        sessionStorage.setItem("omnipulse_api_key",     values.api_key.trim());
      }

      setSuccess(true);
      setTimeout(() => {
        window.location.href = "/tickets";
      }, 600);
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to authenticate. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };


  if (success) {
    return (
      <div className="flex flex-col items-center justify-center space-y-3 py-8 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <p className="text-sm font-medium text-slate-200">
          Authentication successful — entering workspace...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Auth Mode Toggle Tabs */}
      <div className="flex rounded-xl bg-slate-900/80 p-1 border border-slate-800">
        <button
          type="button"
          onClick={() => {
            setAuthMode("email");
            setErrorMessage(null);
            setIsFetchError(false);
          }}
          className={`flex-1 flex items-center justify-center space-x-2 py-2 text-xs font-medium rounded-lg transition ${
            authMode === "email"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Mail className="h-3.5 w-3.5" />
          <span>Email & Password</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setAuthMode("apikey");
            setErrorMessage(null);
            setIsFetchError(false);
          }}
          className={`flex-1 flex items-center justify-center space-x-2 py-2 text-xs font-medium rounded-lg transition ${
            authMode === "apikey"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Key className="h-3.5 w-3.5" />
          <span>API Key Login</span>
        </button>
      </div>

      {/* Error Message with Fallback Switcher */}
      {errorMessage && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3.5 space-y-2 text-red-300 text-xs">
          <div className="flex items-start space-x-2.5">
            <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{errorMessage}</span>
          </div>

          {isFetchError && authMode === "email" && (
            <div className="pt-2 border-t border-red-500/20 flex items-center justify-between">
              <span className="text-slate-300 text-[11px]">
                Supabase daemon down or unreachable?
              </span>
              <button
                type="button"
                onClick={() => {
                  setAuthMode("apikey");
                  setErrorMessage(null);
                  setIsFetchError(false);
                }}
                className="inline-flex items-center space-x-1 text-blue-400 hover:text-blue-300 font-medium text-[11px] underline underline-offset-2 transition"
              >
                <span>Use API Key Login</span>
                <ArrowRight className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Tab 1: Supabase Email & Password Form */}
      {authMode === "email" && (
        <form onSubmit={emailForm.handleSubmit(onEmailSubmit)} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Admin Email
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                <Mail className="h-4 w-4" />
              </div>
              <input
                type="email"
                placeholder="admin@acme.com"
                {...emailForm.register("email")}
                disabled={isLoading}
                className={`w-full rounded-xl border bg-slate-950/60 pl-9 pr-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition ${
                  emailForm.formState.errors.email
                    ? "border-red-500/50"
                    : "border-slate-800 hover:border-slate-700 focus:border-blue-500"
                }`}
              />
            </div>
            {emailForm.formState.errors.email && (
              <p className="mt-1 text-xs text-red-400">
                {emailForm.formState.errors.email.message}
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                <Lock className="h-4 w-4" />
              </div>
              <input
                type="password"
                placeholder="••••••••••••"
                {...emailForm.register("password")}
                disabled={isLoading}
                className={`w-full rounded-xl border bg-slate-950/60 pl-9 pr-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition ${
                  emailForm.formState.errors.password
                    ? "border-red-500/50"
                    : "border-slate-800 hover:border-slate-700 focus:border-blue-500"
                }`}
              />
            </div>
            {emailForm.formState.errors.password && (
              <p className="mt-1 text-xs text-red-400">
                {emailForm.formState.errors.password.message}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex items-center justify-center space-x-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 px-4 py-3 text-sm font-medium text-white shadow-lg shadow-blue-500/20 transition active:scale-[0.99] mt-2 cursor-pointer disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Signing In...</span>
              </>
            ) : (
              <>
                <LogIn className="h-4 w-4" />
                <span>Sign In with Supabase</span>
              </>
            )}
          </button>
        </form>
      )}

      {/* Tab 2: API Key Direct Login Form */}
      {authMode === "apikey" && (
        <form onSubmit={apiKeyForm.handleSubmit(onApiKeySubmit)} className="space-y-4">
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-300/90 leading-relaxed space-y-1">
            <p className="font-semibold text-amber-200">Direct Workspace Access</p>
            <p>
              Authenticate directly using your company name and the primary API key shown
              upon registration.
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Company Name
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                <Building2 className="h-4 w-4" />
              </div>
              <input
                type="text"
                placeholder="Acme Corp"
                {...apiKeyForm.register("tenant_name")}
                disabled={isLoading}
                className={`w-full rounded-xl border bg-slate-950/60 pl-9 pr-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition ${
                  apiKeyForm.formState.errors.tenant_name
                    ? "border-red-500/50"
                    : "border-slate-800 hover:border-slate-700 focus:border-blue-500"
                }`}
              />
            </div>
            {apiKeyForm.formState.errors.tenant_name && (
              <p className="mt-1 text-xs text-red-400">
                {apiKeyForm.formState.errors.tenant_name.message}
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              API Key
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                <Key className="h-4 w-4" />
              </div>
              <input
                type="password"
                placeholder="omni_..."
                {...apiKeyForm.register("api_key")}
                disabled={isLoading}
                className={`w-full rounded-xl border bg-slate-950/60 pl-9 pr-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition ${
                  apiKeyForm.formState.errors.api_key
                    ? "border-red-500/50"
                    : "border-slate-800 hover:border-slate-700 focus:border-blue-500"
                }`}
              />
            </div>
            {apiKeyForm.formState.errors.api_key && (
              <p className="mt-1 text-xs text-red-400">
                {apiKeyForm.formState.errors.api_key.message}
              </p>
            )}
            <p className="mt-1 text-[11px] text-slate-500">
              The key starting with <code className="text-slate-400">omni_</code> generated at registration.
            </p>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex items-center justify-center space-x-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 px-4 py-3 text-sm font-medium text-white shadow-lg shadow-blue-500/20 transition active:scale-[0.99] mt-2 cursor-pointer disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Authenticating...</span>
              </>
            ) : (
              <>
                <LogIn className="h-4 w-4" />
                <span>Enter Workspace</span>
              </>
            )}
          </button>
        </form>
      )}

      {/* Link to register */}
      <p className="text-center text-xs text-slate-400 pt-2">
        Don&apos;t have a workspace yet?{" "}
        <Link
          href="/register"
          className="text-blue-400 hover:text-blue-300 font-medium transition"
        >
          Create company account
        </Link>
      </p>
    </div>
  );
}
