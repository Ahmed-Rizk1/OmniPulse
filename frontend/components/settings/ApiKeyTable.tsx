"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listApiKeys, revokeApiKey, ApiKeyItem } from "@/lib/api";
import {
  Key,
  Trash2,
  Clock,
  Calendar,
  AlertCircle,
  Loader2,
  Shield,
  CheckCircle2,
} from "lucide-react";

interface ApiKeyTableProps {
  tenantId: string;
  token: string | null;
}

export function ApiKeyTable({ tenantId, token }: ApiKeyTableProps) {
  const queryClient = useQueryClient();
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  const queryKey = ["api-keys", tenantId];

  const {
    data: keys,
    isLoading,
    isError,
    error,
  } = useQuery<ApiKeyItem[]>({
    queryKey,
    queryFn: () => listApiKeys(tenantId, token),
    enabled: Boolean(tenantId),
    refetchOnWindowFocus: true,
  });

  const revokeMutation = useMutation({
    mutationFn: (keyId: string) => revokeApiKey(tenantId, keyId, token),
    onMutate: async (keyId) => {
      setRevokingId(keyId);
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey });

      // Snapshot previous value
      const previousKeys = queryClient.getQueryData<ApiKeyItem[]>(queryKey);

      // Optimistically remove key from list
      if (previousKeys) {
        queryClient.setQueryData<ApiKeyItem[]>(
          queryKey,
          previousKeys.filter((k) => k.key_id !== keyId)
        );
      }

      return { previousKeys };
    },
    onError: (err, keyId, context) => {
      // Rollback
      if (context?.previousKeys) {
        queryClient.setQueryData(queryKey, context.previousKeys);
      }
      setFeedbackMessage(
        `Failed to revoke key: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    },
    onSuccess: () => {
      setFeedbackMessage("API key revoked successfully.");
      setTimeout(() => setFeedbackMessage(null), 3500);
    },
    onSettled: () => {
      setRevokingId(null);
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const handleRevoke = (keyId: string, label?: string) => {
    const displayName = label || keyId.slice(0, 8);
    if (
      window.confirm(
        `Are you sure you want to revoke key "${displayName}"? Any webhooks or applications using it will immediately lose access.`
      )
    ) {
      revokeMutation.mutate(keyId);
    }
  };

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-12 flex flex-col items-center justify-center text-slate-400">
        <Loader2 className="h-6 w-6 animate-spin text-blue-500 mb-2" />
        <span className="text-xs">Loading API keys...</span>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5 flex items-start space-x-3 text-red-300 text-xs">
        <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold">Unable to fetch API keys</p>
          <p className="mt-0.5 text-slate-400">
            {error instanceof Error ? error.message : "An unexpected error occurred."}
          </p>
        </div>
      </div>
    );
  }

  const items = keys ?? [];

  return (
    <div className="space-y-4">
      {feedbackMessage && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 flex items-center space-x-2 text-xs text-emerald-300">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>{feedbackMessage}</span>
        </div>
      )}

      {items.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-10 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-800 text-slate-400 mb-3">
            <Key className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-semibold text-slate-200">
            No active API keys
          </h3>
          <p className="mt-1 text-xs text-slate-400 max-w-sm mx-auto">
            Generate an API key to authenticate webhook requests and ingest tickets into OmniPulse.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-800 bg-slate-950/60 text-slate-400 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="px-5 py-3.5">Label / Identifier</th>
                  <th className="px-5 py-3.5">Prefix</th>
                  <th className="px-5 py-3.5">Created</th>
                  <th className="px-5 py-3.5">Last Used</th>
                  <th className="px-5 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {items.map((key) => {
                  const isBeingRevoked = revokingId === key.key_id;
                  const createdDate = new Date(key.created_at).toLocaleDateString(
                    undefined,
                    {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    }
                  );
                  const lastUsed = key.last_used_at
                    ? new Date(key.last_used_at).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "Never";

                  return (
                    <tr
                      key={key.key_id}
                      className="hover:bg-slate-800/40 transition group"
                    >
                      <td className="px-5 py-3.5 font-medium text-slate-100 flex items-center space-x-2">
                        <Key className="h-3.5 w-3.5 text-slate-500 group-hover:text-blue-400 transition" />
                        <span>{key.label || "Default Ingestion Key"}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <code className="font-mono text-xs px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-blue-400">
                          {key.prefix}…
                        </code>
                      </td>
                      <td className="px-5 py-3.5 text-slate-400">
                        <div className="flex items-center space-x-1.5">
                          <Calendar className="h-3 w-3 text-slate-500" />
                          <span>{createdDate}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-slate-400">
                        <div className="flex items-center space-x-1.5">
                          <Clock className="h-3 w-3 text-slate-500" />
                          <span>{lastUsed}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <button
                          type="button"
                          disabled={isBeingRevoked}
                          onClick={() => handleRevoke(key.key_id, key.label)}
                          className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition disabled:opacity-50 cursor-pointer"
                        >
                          {isBeingRevoked ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                          <span>Revoke</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
