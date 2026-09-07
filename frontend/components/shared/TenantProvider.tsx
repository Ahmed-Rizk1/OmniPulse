"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Auth Architecture Note (Slice 11):
 *
 * Supports both:
 * 1. Supabase Auth Session (via `supabase.auth.getSession()`):
 *    - Validates user session when Supabase GoTrue is reachable.
 *    - Falls back gracefully without throwing unhandled network errors when Supabase is down/mocked.
 * 2. Tenant API-Key / SessionStorage Bridge:
 *    - Reads tenant credentials from sessionStorage (populated by RegisterForm or LoginForm).
 *    - Enables uninterrupted access for PostgreSQL tenant workspaces.
 */

export interface TenantContextType {
  tenantName: string | null;
  tenantId: string | null;
  token: string | null;
  isLoading: boolean;
  signOut: () => void;
}

const TenantContext = createContext<TenantContextType>({
  tenantName: null,
  tenantId: null,
  token: null,
  isLoading: true,
  signOut: () => {},
});

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const [tenantName, setTenantName] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;

    async function resolveSession() {
      try {
        // 1. Attempt Supabase Auth session detection (safely catching network errors)
        try {
          const supabase = createClient();
          const { data } = await supabase.auth.getSession();
          if (data?.session && isMounted) {
            const email = data.session.user?.email;
            const metaName = data.session.user?.user_metadata?.company_name;
            if (metaName) {
              setTenantName(metaName);
            } else if (email) {
              setTenantName(email.split("@")[0]);
            }
          }
        } catch {
          // Supabase daemon unreachable or mock key — ignore and proceed to sessionStorage
        }

        // 2. Read sessionStorage for direct tenant / API-key access
        if (typeof window !== "undefined") {
          const storedName = sessionStorage.getItem("omnipulse_tenant_name");
          const storedKey = sessionStorage.getItem("omnipulse_api_key");

          if (isMounted) {
            if (storedName) setTenantName(storedName);
            if (storedKey) setToken(storedKey);
          }
        }
      } catch {
        // sessionStorage not available (SSR pre-render context)
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    resolveSession();

    return () => {
      isMounted = false;
    };
  }, []);

  const signOut = () => {
    try {
      sessionStorage.removeItem("omnipulse_tenant_name");
      sessionStorage.removeItem("omnipulse_api_key");
      sessionStorage.removeItem("omnipulse_user_email");
      createClient().auth.signOut().catch(() => {});
    } catch {
      // ignore
    }
    setTenantName(null);
    setToken(null);
    window.location.href = "/login";
  };

  const tenantId = tenantName;

  return (
    <TenantContext.Provider
      value={{
        tenantName,
        tenantId,
        token,
        isLoading,
        signOut,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
}

export const useTenant = () => {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error("useTenant must be used within a TenantProvider");
  }
  return context;
};
