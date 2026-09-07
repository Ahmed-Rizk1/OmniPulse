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
  // Synchronously initialize state from sessionStorage if available in browser context
  const [tenantName, setTenantName] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem("omnipulse_tenant_name");
    }
    return null;
  });
  const [tenantId, setTenantId] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem("omnipulse_tenant_id");
    }
    return null;
  });
  const [token, setToken] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem("omnipulse_api_key");
    }
    return null;
  });
  const [isLoading, setIsLoading] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      // If tenantId is already in sessionStorage, unblock initial render immediately
      return !sessionStorage.getItem("omnipulse_tenant_id");
    }
    return true;
  });

  useEffect(() => {
    let isMounted = true;

    async function resolveSession() {
      try {
        // 1. Attempt Supabase Auth session detection (safely catching network errors)
        try {
          const supabase = createClient();
          const { data } = await supabase.auth.getSession();
          if (data?.session && isMounted) {
            const meta = data.session.user?.user_metadata;
            const email = data.session.user?.email;
            // tenant_id in user_metadata is the UUID set during registration
            if (meta?.tenant_id) {
              setTenantId(meta.tenant_id);
              if (typeof window !== "undefined") {
                sessionStorage.setItem("omnipulse_tenant_id", meta.tenant_id);
              }
            }
            if (meta?.company_name) {
              setTenantName(meta.company_name);
              if (typeof window !== "undefined") {
                sessionStorage.setItem("omnipulse_tenant_name", meta.company_name);
              }
            } else if (email) {
              setTenantName(email.split("@")[0]);
            }
          }
        } catch {
          // Supabase daemon unreachable or mock key — ignore and proceed to sessionStorage
        }

        // 2. Read sessionStorage for direct tenant / API-key access.
        // omnipulse_tenant_id is the UUID; omnipulse_tenant_name is display-only.
        if (typeof window !== "undefined" && isMounted) {
          const storedId   = sessionStorage.getItem("omnipulse_tenant_id");
          const storedName = sessionStorage.getItem("omnipulse_tenant_name");
          const storedKey  = sessionStorage.getItem("omnipulse_api_key");

          if (storedId)   setTenantId(storedId);
          if (storedName) setTenantName(storedName);
          if (storedKey)  setToken(storedKey);
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
      sessionStorage.removeItem("omnipulse_tenant_id");
      sessionStorage.removeItem("omnipulse_tenant_name");
      sessionStorage.removeItem("omnipulse_api_key");
      sessionStorage.removeItem("omnipulse_user_email");
      createClient().auth.signOut().catch(() => {});
    } catch {
      // ignore
    }
    setTenantName(null);
    setTenantId(null);
    setToken(null);
    window.location.href = "/login";
  };

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
