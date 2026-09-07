"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { registerTenant } from "@/lib/api";
import { OneTimeKeyModal } from "@/components/auth/OneTimeKeyModal";
import { Building2, Mail, Lock, Loader2, ArrowRight, AlertCircle } from "lucide-react";

const registerSchema = z.object({
  company_name: z
    .string()
    .min(2, { message: "Company name must be at least 2 characters" })
    .max(255, { message: "Company name must not exceed 255 characters" }),
  admin_email: z
    .string()
    .min(1, { message: "Admin email is required" })
    .email({ message: "Please enter a valid email address" }),
  password: z
    .string()
    .min(8, { message: "Password must be at least 8 characters" }),
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export function RegisterForm() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [newKey, setNewKey] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      company_name: "",
      admin_email: "",
      password: "",
    },
  });

  const onSubmit = async (values: RegisterFormValues) => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      // Send both `name` and `company_name` to satisfy FastAPI TenantCreate schema
      // while forwarding admin_email and password for complete tenant onboarding
      const payload = {
        name: values.company_name.trim(),
        company_name: values.company_name.trim(),
        admin_email: values.admin_email.trim(),
        password: values.password,
      };

      const response = await registerTenant(payload);

      // Pre-save tenant and email in sessionStorage for a seamless login bridge
      if (typeof window !== "undefined") {
        sessionStorage.setItem("omnipulse_tenant_name", values.company_name.trim());
        sessionStorage.setItem("omnipulse_user_email", values.admin_email.trim());
        sessionStorage.setItem("omnipulse_api_key", response.api_key);
      }

      // Show the one-time API key modal
      setNewKey(response.api_key);
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "Registration failed. Check that the company name is not already taken."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleModalClose = () => {
    setNewKey(null);
    router.push("/login");
  };

  return (
    <>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {errorMessage && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3.5 flex items-start space-x-3 text-red-300 text-xs">
            <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Company / Tenant Name */}
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
              {...register("company_name")}
              disabled={isLoading}
              className={`w-full rounded-xl border bg-slate-950/60 pl-9 pr-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition ${
                errors.company_name
                  ? "border-red-500/50"
                  : "border-slate-800 hover:border-slate-700 focus:border-blue-500"
              }`}
            />
          </div>
          {errors.company_name && (
            <p className="mt-1 text-xs text-red-400">{errors.company_name.message}</p>
          )}
        </div>

        {/* Admin Email */}
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
              {...register("admin_email")}
              disabled={isLoading}
              className={`w-full rounded-xl border bg-slate-950/60 pl-9 pr-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition ${
                errors.admin_email
                  ? "border-red-500/50"
                  : "border-slate-800 hover:border-slate-700 focus:border-blue-500"
              }`}
            />
          </div>
          {errors.admin_email && (
            <p className="mt-1 text-xs text-red-400">{errors.admin_email.message}</p>
          )}
        </div>

        {/* Password */}
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
              {...register("password")}
              disabled={isLoading}
              className={`w-full rounded-xl border bg-slate-950/60 pl-9 pr-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition ${
                errors.password
                  ? "border-red-500/50"
                  : "border-slate-800 hover:border-slate-700 focus:border-blue-500"
              }`}
            />
          </div>
          {errors.password && (
            <p className="mt-1 text-xs text-red-400">{errors.password.message}</p>
          )}
        </div>

        {/* Info callout */}
        <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3.5 text-xs text-blue-300 leading-relaxed space-y-1">
          <p className="font-semibold text-blue-200">Workspace Provisioning</p>
          <ul className="list-disc list-inside text-blue-300/80 space-y-0.5">
            <li>Creates tenant workspace and generates primary ingestion API key.</li>
            <li>API key is displayed once after creation — save it securely.</li>
          </ul>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full flex items-center justify-center space-x-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 px-4 py-3 text-sm font-medium text-white shadow-lg shadow-blue-500/20 transition active:scale-[0.99] mt-2 cursor-pointer disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Provisioning Workspace...</span>
            </>
          ) : (
            <>
              <span>Create Workspace</span>
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>

        {/* Link to login */}
        <p className="text-center text-xs text-slate-400 pt-2">
          Already have an account?{" "}
          <Link
            href="/login"
            className="text-blue-400 hover:text-blue-300 font-medium transition"
          >
            Sign in
          </Link>
        </p>
      </form>

      {/* One-Time API Key Display Modal */}
      <OneTimeKeyModal
        isOpen={Boolean(newKey)}
        apiKey={newKey ?? ""}
        title="Workspace Created — Save Your API Key"
        description="Your OmniPulse tenant workspace is ready. This is your primary ingestion API key. Copy it now — it cannot be retrieved again."
        actionText="I have saved my key"
        onClose={handleModalClose}
        onAction={handleModalClose}
      />
    </>
  );
}
