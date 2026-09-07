"use client";

import React from "react";
import { Mail, ArrowRight, ShieldCheck } from "lucide-react";
import { ChannelCard } from "./ChannelCard";
import { WebhookUrlCopy } from "./WebhookUrlCopy";
import { EmailChannelConfig } from "@/lib/api";

interface EmailChannelCardProps {
  emailConfig?: EmailChannelConfig;
}

export function EmailChannelCard({ emailConfig }: EmailChannelCardProps) {
  const status = emailConfig?.status || "ready";
  const webhookUrl = emailConfig?.webhook_url || "/api/webhooks/tickets?source=email";

  const statusLabel =
    status.toLowerCase() === "connected" ? "Connected" : "Ready for forwarding";

  return (
    <ChannelCard
      icon={Mail}
      iconColor="text-blue-400"
      title="Email Inbound Forwarding"
      description="Ingest customer support emails automatically by forwarding to this webhook URL."
      status={status}
      statusLabel={statusLabel}
    >
      <div>
        <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
          Inbound Webhook URL
        </label>
        <WebhookUrlCopy urlPath={webhookUrl} />
      </div>

      <div className="rounded-xl border border-slate-800/80 bg-slate-950/60 p-4 text-xs text-slate-400 space-y-2">
        <div className="flex items-center space-x-2 text-slate-300 font-medium">
          <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>Setup Instructions:</span>
        </div>
        <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-400 leading-relaxed">
          <li>Configure forwarding rule in Google Workspace, Microsoft 365, or SendGrid inbound parse.</li>
          <li>Set HTTP POST endpoint to the webhook URL above with the customer's email payload.</li>
          <li>Tickets will automatically be triaged and routed into your OmniPulse workspace.</li>
        </ol>
      </div>
    </ChannelCard>
  );
}
