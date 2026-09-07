"use client";

import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchKnowledgeDocuments, KnowledgeDocument } from "@/lib/api";
import { useTenant } from "@/components/shared/TenantProvider";
import { KnowledgeBaseTable } from "@/components/knowledge/KnowledgeBaseTable";
import { UploadDocButton } from "@/components/knowledge/UploadDocButton";
import { FolderOpen, Search, Sparkles, BookOpen } from "lucide-react";
import Link from "next/link";

export default function KnowledgeBasePage() {
  const { tenantId, token } = useTenant();
  const [searchQuery, setSearchQuery] = useState("");

  const { data: documents, isLoading, error } = useQuery<KnowledgeDocument[]>({
    queryKey: ["knowledge-documents", tenantId],
    queryFn: () => fetchKnowledgeDocuments(tenantId!, token),
    enabled: Boolean(tenantId),
    staleTime: 60_000,
  });

  const filteredDocuments = useMemo(() => {
    if (!documents) return [];
    if (!searchQuery.trim()) return documents;
    const q = searchQuery.toLowerCase();
    return documents.filter((doc) => doc.title.toLowerCase().includes(q));
  }, [documents, searchQuery]);

  if (!tenantId) {
    return null;
  }

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-200 max-w-6xl mx-auto">
      {/* Top Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center space-x-2 text-xs text-blue-400 font-medium mb-1">
            <Link href="/settings/api-keys" className="hover:underline text-slate-400">
              Settings
            </Link>
            <span className="text-slate-600">/</span>
            <span className="flex items-center space-x-1">
              <BookOpen className="h-3 w-3" />
              <span>Knowledge Base</span>
            </span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white">
            Knowledge Base Documents
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            Upload enterprise policies, manuals, and FAQs. Documents are chunked and embedded via Gemini into pgvector for AI cockpit RAG retrieval.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <UploadDocButton tenantId={tenantId} token={token} />
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search documents by title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-slate-800 bg-slate-900/60 pl-9 pr-4 py-2 text-xs text-slate-100 placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition"
          />
        </div>

        <div className="flex items-center space-x-2 text-xs text-slate-400">
          <Sparkles className="h-3.5 w-3.5 text-blue-400" />
          <span>pgvector Cosine Search Active</span>
        </div>
      </div>

      {/* Knowledge Documents Table */}
      <section>
        <KnowledgeBaseTable
          documents={filteredDocuments}
          isLoading={isLoading}
          error={error as Error | null}
          tenantId={tenantId}
          token={token}
        />
      </section>
    </div>
  );
}
