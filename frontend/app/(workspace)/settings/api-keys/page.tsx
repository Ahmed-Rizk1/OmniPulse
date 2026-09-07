"use client";

import React from "react";
import { useTenant } from "@/components/shared/TenantProvider";
import { ApiKeyTable } from "@/components/settings/ApiKeyTable";
import { GenerateKeyButton } from "@/components/settings/GenerateKeyButton";
import { Key, Terminal } from "lucide-react";

export default function ApiKeysPage() {
  const { tenantId, token } = useTenant();

  if (!tenantId) {
    return null;
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center space-x-2 text-xs text-blue-400 font-medium mb-1">
            <Key className="h-3.5 w-3.5" />
            <span>Tenant Settings</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white">
            API Keys & Webhooks
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            Generate and manage secret keys for inbound webhook ingestion and automated ticket pipelines.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <GenerateKeyButton tenantId={tenantId} token={token} />
        </div>
      </div>

      {/* API Key Table */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-200">
          Active API Keys
        </h2>
        <ApiKeyTable tenantId={tenantId} token={token} />
      </section>

      {/* Developer Integration Card */}
      <section className="rounded-2xl border border-slate-800/80 bg-slate-900/50 p-6 backdrop-blur">
        <div className="flex items-center space-x-2 text-slate-200 text-xs font-semibold mb-3">
          <Terminal className="h-4 w-4 text-blue-400" />
          <span>Webhook Ingestion Quick Start</span>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed mb-4">
          Authenticate your customer support ticket ingestion endpoint by providing your secret key in the request headers:
        </p>

        <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 font-mono text-xs text-slate-300 overflow-x-auto">
          <pre>
{`curl -X POST https://api.omnipulse.local/api/tickets \\
  -H "Content-Type: application/json" \\
  -H "X-Tenant-Id: ${tenantId}" \\
  -H "X-API-Key: sk_om_..." \\
  -d '{
    "customer_id": "cust_12345",
    "subject": "System downtime inquiry",
    "body": "Unable to access the billing dashboard this morning."
  }'`}
          </pre>
        </div>
      </section>
    </div>
  );
}
