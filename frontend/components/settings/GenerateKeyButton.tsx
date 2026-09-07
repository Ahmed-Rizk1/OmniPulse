"use client";

import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { generateApiKey, GenerateApiKeyResponse } from "@/lib/api";
import { OneTimeKeyModal } from "@/components/auth/OneTimeKeyModal";
import { Plus, Key, Loader2, X, AlertCircle } from "lucide-react";

interface GenerateKeyButtonProps {
  tenantId: string;
  token: string | null;
}

export function GenerateKeyButton({ tenantId, token }: GenerateKeyButtonProps) {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [newKey, setNewKey] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (keyLabel: string) => generateApiKey(tenantId, keyLabel, token),
    onSuccess: (data: GenerateApiKeyResponse) => {
      setIsDialogOpen(false);
      setLabel("");
      setErrorMessage(null);
      // Invalidate table
      queryClient.invalidateQueries({ queryKey: ["api-keys", tenantId] });
      // Open one-time key modal
      setNewKey(data.api_key);
    },
    onError: (err) => {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to generate API key"
      );
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim()) {
      setErrorMessage("Please provide a label for this key");
      return;
    }
    setErrorMessage(null);
    mutation.mutate(label.trim());
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setIsDialogOpen(true);
          setErrorMessage(null);
        }}
        className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium shadow-md shadow-blue-500/20 transition active:scale-[0.98] cursor-pointer"
      >
        <Plus className="h-4 w-4" />
        <span>Generate Key</span>
      </button>

      {/* Input Dialog */}
      {isDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="relative w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl text-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400">
                  <Key className="h-4 w-4" />
                </div>
                <h3 className="text-sm font-semibold text-white">
                  Generate New API Key
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsDialogOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              {errorMessage && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 flex items-start space-x-2 text-xs text-red-300">
                  <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Key Label / Description
                </label>
                <input
                  type="text"
                  placeholder="e.g. prod-webhook, zapier, staging"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  disabled={mutation.isPending}
                  className="w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3.5 py-2 text-xs text-slate-100 placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition"
                  autoFocus
                />
                <p className="mt-1 text-[11px] text-slate-500">
                  Used to identify which integration or service uses this key.
                </p>
              </div>

              <div className="flex items-center justify-end space-x-2.5 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsDialogOpen(false)}
                  disabled={mutation.isPending}
                  className="px-3.5 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={mutation.isPending}
                  className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-xs font-medium text-white shadow-md shadow-blue-500/20 transition cursor-pointer"
                >
                  {mutation.isPending ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Creating...</span>
                    </>
                  ) : (
                    <span>Create Key</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* One-Time Modal */}
      <OneTimeKeyModal
        isOpen={Boolean(newKey)}
        apiKey={newKey ?? ""}
        title="New API Key Generated"
        description="Your new tenant API key is ready. Copy it now, as you won't be able to see it again."
        actionText="Done"
        onClose={() => setNewKey(null)}
      />
    </>
  );
}
