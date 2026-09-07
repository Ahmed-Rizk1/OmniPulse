"use client";

import React from "react";
import { KnowledgeDocument } from "@/lib/api";
import { DeleteDocButton } from "./DeleteDocButton";
import {
  FileText,
  AlertTriangle,
  FolderOpen,
  Database,
  Calendar,
  Layers,
} from "lucide-react";

interface KnowledgeBaseTableProps {
  documents: KnowledgeDocument[] | undefined;
  isLoading: boolean;
  error: Error | null;
  tenantId: string;
  token?: string | null;
}

export function KnowledgeBaseTable({
  documents,
  isLoading,
  error,
  tenantId,
  token,
}: KnowledgeBaseTableProps) {
  if (isLoading) {
    return (
      <div className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-6 backdrop-blur">
        <div className="animate-pulse space-y-4">
          <div className="h-5 w-48 rounded bg-slate-800" />
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 w-full rounded-xl bg-slate-800/50" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-5 text-rose-300">
        <div className="flex items-center space-x-2 font-medium text-xs mb-1">
          <AlertTriangle className="h-4 w-4" />
          <span>Error loading knowledge documents</span>
        </div>
        <p className="text-xs text-rose-400">{error.message}</p>
      </div>
    );
  }

  if (!documents || documents.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/30 p-12 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-800/80 text-slate-400 mb-3 border border-slate-700/60">
          <FolderOpen className="h-6 w-6" />
        </div>
        <h3 className="text-sm font-semibold text-slate-200">
          No knowledge documents uploaded yet
        </h3>
        <p className="mt-1 text-xs text-slate-400 max-w-sm mx-auto">
          Upload PDF, DOCX, TXT, or MD support manuals, policies, and FAQs to ground AI resolution suggestions.
        </p>
      </div>
    );
  }

  const getTypeBadgeStyle = (type: string) => {
    switch (type.toUpperCase()) {
      case "PDF":
        return "bg-rose-500/10 text-rose-400 border-rose-500/30";
      case "DOCX":
        return "bg-blue-500/10 text-blue-400 border-blue-500/30";
      case "TXT":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
      case "MD":
        return "bg-purple-500/10 text-purple-400 border-purple-500/30";
      default:
        return "bg-slate-500/10 text-slate-400 border-slate-500/30";
    }
  };

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toISOString().split("T")[0];
    } catch {
      return isoString;
    }
  };

  return (
    <div className="rounded-2xl border border-slate-800/80 bg-slate-900/40 backdrop-blur overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="border-b border-slate-800 bg-slate-950/60 text-[11px] uppercase tracking-wider text-slate-400">
            <tr>
              <th className="px-5 py-3 font-semibold">Title</th>
              <th className="px-4 py-3 font-semibold">Type</th>
              <th className="px-4 py-3 font-semibold">Chunks Count</th>
              <th className="px-4 py-3 font-semibold">Uploaded Date</th>
              <th className="px-4 py-3 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-medium">
            {documents.map((doc) => (
              <tr
                key={doc.doc_id}
                className="hover:bg-slate-800/30 transition duration-150"
              >
                {/* Title */}
                <td className="px-5 py-3.5">
                  <div className="flex items-center space-x-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800/80 border border-slate-700/60 text-blue-400 shrink-0">
                      <FileText className="h-4 w-4" />
                    </div>
                    <span className="font-semibold text-white truncate max-w-xs md:max-w-md">
                      {doc.title}
                    </span>
                  </div>
                </td>

                {/* Type Badge */}
                <td className="px-4 py-3.5">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold border ${getTypeBadgeStyle(
                      doc.file_type
                    )}`}
                  >
                    {doc.file_type.toUpperCase()}
                  </span>
                </td>

                {/* Chunks Count */}
                <td className="px-4 py-3.5 font-mono">
                  <div className="inline-flex items-center space-x-1.5 text-slate-300">
                    <Database className="h-3.5 w-3.5 text-blue-400" />
                    <span>{doc.chunk_count} vectors</span>
                  </div>
                </td>

                {/* Uploaded Date */}
                <td className="px-4 py-3.5 text-slate-400">
                  <div className="inline-flex items-center space-x-1.5 font-mono">
                    <Calendar className="h-3.5 w-3.5 text-slate-500" />
                    <span>{formatDate(doc.created_at)}</span>
                  </div>
                </td>

                {/* Actions */}
                <td className="px-4 py-3.5 text-right">
                  <DeleteDocButton
                    docId={doc.doc_id}
                    docTitle={doc.title}
                    tenantId={tenantId}
                    token={token}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
