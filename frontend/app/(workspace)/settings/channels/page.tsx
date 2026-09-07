"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchChannels, ChannelsStatus } from "@/lib/api";
import { useTenant } from "@/components/shared/TenantProvider";
import { EmailChannelCard } from "@/components/channels/EmailChannelCard";
import { WhatsAppChannelCard } from "@/components/channels/WhatsAppChannelCard";
import { Radio, Loader2, AlertCircle } from "lucide-react";
import Link from "next/link";

export default function ChannelsPage() {
  const { tenantId, token } = useTenant();

  const { data: channels, isLoading, error } = useQuery<ChannelsStatus>({
    queryKey: ["channels", tenantId],
    queryFn: () => fetchChannels(tenantId!, token),
    enabled: Boolean(tenantId),
    staleTime: 30_000,
  });

  if (!tenantId) {
    return null;
  }

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-200 max-w-5xl mx-auto">
      {/* Header & Breadcrumbs */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center space-x-2 text-xs text-blue-400 font-medium mb-1">
            <Link href="/settings/api-keys" className="hover:underline text-slate-400">
              Settings
            </Link>
            <span className="text-slate-600">/</span>
            <span className="flex items-center space-x-1">
              <Radio className="h-3 w-3" />
              <span>Inbound Channels</span>
            </span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white">
            Inbound Support Channels
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            Configure omnichannel customer contact points. Support tickets ingested via these channels are processed by the asynchronous classification pipeline.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-slate-400">
          <Loader2 className="h-6 w-6 animate-spin text-blue-500 mr-2" />
          <span className="text-xs font-medium">Loading channel configurations...</span>
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-5 text-rose-300">
          <div className="flex items-center space-x-2 font-medium text-xs mb-1">
            <AlertCircle className="h-4 w-4" />
            <span>Failed to load channels</span>
          </div>
          <p className="text-xs text-rose-400">{(error as Error).message}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {/* Email Channel */}
          <EmailChannelCard emailConfig={channels?.email} />

          {/* WhatsApp Channel */}
          <WhatsAppChannelCard
            whatsappConfig={channels?.whatsapp}
            tenantId={tenantId}
            token={token}
          />
        </div>
      )}
    </div>
  );
}
