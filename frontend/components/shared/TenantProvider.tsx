"use client";

import React, { createContext, useContext, useState } from "react";

export interface TenantContextType {
  tenantId: string | null;
  token: string | null;
  setTenantId: (id: string | null) => void;
  setToken: (token: string | null) => void;
  isLoading: boolean;
}

const TenantContext = createContext<TenantContextType>({
  tenantId: null,
  token: null,
  setTenantId: () => {},
  setToken: () => {},
  isLoading: false,
});

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  return (
    <TenantContext.Provider
      value={{
        tenantId,
        token,
        setTenantId,
        setToken,
        isLoading,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error("useTenant must be used within a TenantProvider");
  }
  return context;
}
