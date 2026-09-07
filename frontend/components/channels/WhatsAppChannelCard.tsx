"use client";

import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { MessageSquare, Check, Loader2, Save, KeyRound } from "lucide-react";
import { ChannelCard } from "./ChannelCard";
import { WebhookUrlCopy } from "./WebhookUrlCopy";
import { WhatsAppChannelConfig, updateWhatsAppVerifyToken } from "@/lib/api";

interface WhatsAppChannelCardProps {
  whatsappConfig?: WhatsAppChannelConfig;
  tenantId: string;
  token?: string | null;
}

export function WhatsAppChannelCard({
  whatsappConfig,
  tenantId,
  token,
}: WhatsAppChannelCardProps) {
  const [verifyToken, setVerifyToken] = useState("");
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const queryClient = useQueryClient();

  const status = whatsappConfig?.status || "not_connected";
  const webhookUrl = whatsappConfig?.webhook_url || "/api/webhooks/tickets?source=whatsapp";
  const hasTokenSet = whatsappConfig?.verify_token_set || false;

  const mutation = useMutation({
    mutationFn: (tokenValue: string) =>
      updateWhatsAppVerifyToken(tokenValue, tenantId, token),
    onSuccess: () => {
      setSavedSuccess(true);
      setSaveError(null);
      setVerifyToken("");
      queryClient.invalidateQueries({ queryKey: ["channels", tenantId] });
      setTimeout(() => setSavedSuccess(false), 3000);
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Failed to update verify token";
      setSaveError(msg);
      setSavedSuccess(false);
    },
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyToken.trim()) return;
    mutation.mutate(verifyToken.trim());
  };

  return (
    <ChannelCard
      icon={MessageSquare}
      iconColor="text-emerald-400"
      title="WhatsApp Business API"
      description="Connect Meta Cloud API or Twilio WhatsApp endpoint to handle real-time customer chats."
      status={status}
      statusLabel={status === "connected" ? "Connected" : "Not Connected"}
    >
      {/* Webhook Endpoint */}
      <div>
        <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
          WhatsApp Webhook URL
        </label>
        <WebhookUrlCopy urlPath={webhookUrl} />
      </div>

      {/* Verify Token Input */}
      <form onSubmit={handleSave} className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Webhook Verify Token
          </label>
          {hasTokenSet && (
            <span className="inline-flex items-center space-x-1 text-[11px] font-medium text-emerald-400">
              <Check className="h-3 w-3" />
              <span>Token Configured</span>
            </span>
          )}
        </div>

        <div className="flex items-center space-x-2">
          <div className="relative flex-1">
            <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input
              type="text"
              value={verifyToken}
              onChange={(e) => setVerifyToken(e.target.value)}
              placeholder={
                hasTokenSet
                  ? "Enter new token to update verify token..."
                  : "Enter WhatsApp verify token (e.g. meta_omni_sec_...)"
              }
              className="w-full rounded-xl border border-slate-800 bg-slate-950 pl-9 pr-4 py-2 text-xs text-slate-100 placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono transition"
            />
          </div>

          <button
            type="submit"
            disabled={!verifyToken.trim() || mutation.isPending}
            className="inline-flex items-center space-x-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-500 transition disabled:opacity-50 cursor-pointer shrink-0"
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Saving...</span>
              </>
            ) : savedSuccess ? (
              <>
                <Check className="h-3.5 w-3.5" />
                <span>Saved!</span>
              </>
            ) : (
              <>
                <Save className="h-3.5 w-3.5" />
                <span>Save Token</span>
              </>
            )}
          </button>
        </div>

        {saveError && (
          <p className="text-xs text-rose-400 mt-1">{saveError}</p>
        )}
      </form>
    </ChannelCard>
  );
}
