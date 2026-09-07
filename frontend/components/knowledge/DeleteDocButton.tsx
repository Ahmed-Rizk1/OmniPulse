"use client";

import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteKnowledgeDocument, KnowledgeDocument } from "@/lib/api";
import { Trash2, Loader2, AlertCircle } from "lucide-react";

interface DeleteDocButtonProps {
  docId: string;
  docTitle: string;
  tenantId: string;
  token?: string | null;
}

export function DeleteDocButton({
  docId,
  docTitle,
  tenantId,
  token,
}: DeleteDocButtonProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => deleteKnowledgeDocument(docId, tenantId, token),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["knowledge-documents", tenantId] });
      const prevDocs = queryClient.getQueryData<KnowledgeDocument[]>([
        "knowledge-documents",
        tenantId,
      ]);

      if (prevDocs) {
        queryClient.setQueryData<KnowledgeDocument[]>(
          ["knowledge-documents", tenantId],
          prevDocs.filter((d) => d.doc_id !== docId)
        );
      }

      return { prevDocs };
    },
    onError: (_err, _vars, context) => {
      if (context?.prevDocs) {
        queryClient.setQueryData(
          ["knowledge-documents", tenantId],
          context.prevDocs
        );
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge-documents", tenantId] });
      setShowConfirm(false);
    },
  });

  return (
    <>
      <button
        type="button"
        onClick={() => setShowConfirm(true)}
        disabled={mutation.isPending}
        className="rounded-lg p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer disabled:opacity-50"
        title={`Delete ${docTitle}`}
      >
        {mutation.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin text-rose-400" />
        ) : (
          <Trash2 className="h-4 w-4" />
        )}
      </button>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center space-x-3 mb-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30">
                <AlertCircle className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-semibold text-white">Delete Document</h3>
            </div>
            <p className="text-xs text-slate-300 mb-2">
              Are you sure you want to delete <span className="font-semibold text-white">"{docTitle}"</span>?
            </p>
            <p className="text-[11px] text-slate-400 mb-5 leading-relaxed">
              This will permanently delete all associated vector chunks and embeddings. AI RAG resolutions will immediately stop referencing this document.
            </p>
            <div className="flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                disabled={mutation.isPending}
                className="rounded-lg bg-slate-800 px-3.5 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => mutation.mutate()}
                disabled={mutation.isPending}
                className="inline-flex items-center space-x-1.5 rounded-lg bg-rose-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-rose-500 transition shadow-lg shadow-rose-600/20"
              >
                {mutation.isPending ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <span>Confirm Delete</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
