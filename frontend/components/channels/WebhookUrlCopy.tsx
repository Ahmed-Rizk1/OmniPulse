"use client";

import React, { useState, useEffect } from "react";
import { Copy, Check } from "lucide-react";

interface WebhookUrlCopyProps {
  urlPath: string;
}

export function WebhookUrlCopy({ urlPath }: WebhookUrlCopyProps) {
  const [copied, setCopied] = useState(false);
  const [fullUrl, setFullUrl] = useState(urlPath);

  useEffect(() => {
    if (typeof window !== "undefined") {
      if (urlPath.startsWith("http://") || urlPath.startsWith("https://")) {
        setFullUrl(urlPath);
      } else {
        const origin = window.location.origin;
        setFullUrl(`${origin}${urlPath.startsWith("/") ? "" : "/"}${urlPath}`);
      }
    }
  }, [urlPath]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  return (
    <div className="flex items-center space-x-2 rounded-xl border border-slate-800 bg-slate-950 p-2 text-xs font-mono">
      <span className="flex-1 truncate text-slate-300 select-all px-2">
        {fullUrl}
      </span>
      <button
        type="button"
        onClick={handleCopy}
        className="relative inline-flex items-center space-x-1.5 rounded-lg bg-slate-800/80 px-2.5 py-1.5 text-[11px] font-medium text-slate-300 hover:bg-slate-700 hover:text-white transition cursor-pointer shrink-0 border border-slate-700/60"
        title="Copy webhook URL"
      >
        {copied ? (
          <>
            <Check className="h-3.5 w-3.5 text-emerald-400" />
            <span className="text-emerald-400">Copied!</span>
          </>
        ) : (
          <>
            <Copy className="h-3.5 w-3.5 text-slate-400" />
            <span>Copy</span>
          </>
        )}
      </button>
    </div>
  );
}
