"use client";

import React, { useState } from "react";
import { Key, Copy, Check, AlertTriangle, ShieldCheck } from "lucide-react";

interface OneTimeKeyModalProps {
  isOpen: boolean;
  apiKey: string;
  title?: string;
  description?: string;
  onClose: () => void;
  actionText?: string;
  onAction?: () => void;
}

export function OneTimeKeyModal({
  isOpen,
  apiKey,
  title = "API Key Generated",
  description = "Please copy and securely store this API key now. For security reasons, it will never be displayed again.",
  onClose,
  actionText = "I have saved my key",
  onAction,
}: OneTimeKeyModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(apiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error("Failed to copy key to clipboard:", err);
    }
  };

  const handleDone = () => {
    if (onAction) {
      onAction();
    } else {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl text-slate-100">
        {/* Header */}
        <div className="flex items-start space-x-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
            <Key className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-white tracking-tight">
              {title}
            </h3>
            <p className="mt-1 text-sm text-slate-400 leading-relaxed">
              {description}
            </p>
          </div>
        </div>

        {/* Warning Banner */}
        <div className="mt-5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 flex items-start space-x-3 text-amber-200 text-xs leading-relaxed">
          <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-amber-300">Important: </span>
            This secret key is only shown once. If you lose it, you will need to revoke it and generate a new key.
          </div>
        </div>

        {/* API Key Box */}
        <div className="mt-5">
          <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">
            Your Secret API Key
          </label>
          <div className="flex items-center space-x-2 rounded-xl border border-slate-700/80 bg-slate-950/90 p-2.5">
            <code className="flex-1 font-mono text-xs text-emerald-400 break-all select-all px-2">
              {apiKey}
            </code>
            <button
              type="button"
              onClick={handleCopy}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                copied
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                  : "bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
              }`}
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5 text-slate-300" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="mt-6 flex items-center justify-end space-x-3 pt-4 border-t border-slate-800">
          <button
            type="button"
            onClick={handleDone}
            className="flex items-center space-x-2 rounded-xl bg-blue-600 hover:bg-blue-500 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-blue-500/20 transition active:scale-[0.98]"
          >
            <ShieldCheck className="h-4 w-4" />
            <span>{actionText}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
