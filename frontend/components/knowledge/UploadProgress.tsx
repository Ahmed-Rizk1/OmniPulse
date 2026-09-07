"use client";

import React from "react";
import { Loader2, Sparkles, CheckCircle2, FileText } from "lucide-react";

export interface UploadProgressProps {
  fileName: string;
  isUploading: boolean;
  step: "uploading" | "chunking" | "embedding" | "done" | "error";
  errorMessage?: string;
  onClose?: () => void;
}

export function UploadProgress({
  fileName,
  isUploading,
  step,
  errorMessage,
  onClose,
}: UploadProgressProps) {
  if (!isUploading && step !== "error" && step !== "done") {
    return null;
  }

  const steps = [
    { id: "uploading", label: "Uploading document" },
    { id: "chunking", label: "Parsing & chunking text" },
    { id: "embedding", label: "Generating Gemini vector embeddings" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-2xl backdrop-blur-xl">
        <div className="flex items-center space-x-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400">
            {step === "done" ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            ) : step === "error" ? (
              <FileText className="h-5 w-5 text-rose-400" />
            ) : (
              <Sparkles className="h-5 w-5 animate-pulse text-blue-400" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-white truncate">
              {step === "done"
                ? "Vectorization Complete"
                : step === "error"
                ? "Upload Failed"
                : "Vectorizing Knowledge Document"}
            </h3>
            <p className="text-xs text-slate-400 truncate">{fileName}</p>
          </div>
        </div>

        {step === "error" ? (
          <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
            {errorMessage || "An unexpected error occurred during document processing."}
          </div>
        ) : (
          <div className="space-y-3 mb-5">
            {steps.map((s, idx) => {
              const isCurrent = step === s.id;
              const isFinished =
                step === "done" ||
                (step === "embedding" && idx < 2) ||
                (step === "chunking" && idx < 1);

              return (
                <div key={s.id} className="flex items-center space-x-2.5 text-xs">
                  {isFinished ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  ) : isCurrent ? (
                    <Loader2 className="h-4 w-4 text-blue-400 animate-spin shrink-0" />
                  ) : (
                    <div className="h-4 w-4 rounded-full border border-slate-700 bg-slate-800/50 shrink-0" />
                  )}
                  <span
                    className={
                      isFinished
                        ? "text-slate-300 font-medium"
                        : isCurrent
                        ? "text-blue-400 font-medium animate-pulse"
                        : "text-slate-500"
                    }
                  >
                    {s.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {(step === "done" || step === "error") && onClose && (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-slate-800 px-3.5 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
