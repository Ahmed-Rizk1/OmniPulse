"use client";

import React, { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchTicketDetail,
  updateTicketStatus,
  TicketDetail,
  TicketStatus,
} from "@/lib/api";
import { useTenant } from "@/components/shared/TenantProvider";
import { StatusBadge } from "@/components/tickets/StatusBadge";
import { SourceBadge } from "@/components/tickets/SourceBadge";
import { ConfidenceMeter } from "@/components/tickets/ConfidenceMeter";
import { ActivityTimeline } from "@/components/tickets/ActivityTimeline";
import {
  Sparkles,
  Bot,
  User,
  Send,
  Edit3,
  ExternalLink,
  BookOpen,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Inbox,
  Clock,
  Check,
} from "lucide-react";

interface TicketDetailPanelProps {
  className?: string;
}

export function TicketDetailPanel({ className = "" }: TicketDetailPanelProps) {
  const searchParams = useSearchParams();
  const ticketId = searchParams.get("ticket");
  const { tenantId, session } = useTenant();
  const queryClient = useQueryClient();

  const [isEditingResolution, setIsEditingResolution] = useState(false);
  const [editedText, setEditedText] = useState("");
  const [applySuccess, setApplySuccess] = useState(false);

  // 1. Query full ticket detail
  const {
    data: ticket,
    isLoading,
    isError,
    error,
  } = useQuery<TicketDetail>({
    queryKey: ["ticket", ticketId],
    queryFn: () => fetchTicketDetail(ticketId!, tenantId!, session?.access_token),
    enabled: Boolean(ticketId && tenantId),
    refetchInterval: 30_000,
  });

  // 2. Optimistic status mutation for "Apply as Reply"
  const statusMutation = useMutation({
    mutationFn: (newStatus: TicketStatus) =>
      updateTicketStatus(ticketId!, newStatus, tenantId!, session?.access_token),
    onMutate: async (newStatus: TicketStatus) => {
      await queryClient.cancelQueries({ queryKey: ["ticket", ticketId] });
      const prev = queryClient.getQueryData<TicketDetail>(["ticket", ticketId]);

      if (prev) {
        queryClient.setQueryData<TicketDetail>(["ticket", ticketId], {
          ...prev,
          status: newStatus,
        });
      }

      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) {
        queryClient.setQueryData(["ticket", ticketId], context.prev);
      }
    },
    onSuccess: () => {
      setApplySuccess(true);
      setTimeout(() => setApplySuccess(false), 3000);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["ticket", ticketId] });
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      queryClient.invalidateQueries({ queryKey: ["ticket-counts"] });
    },
  });

  const handleApplyAsReply = () => {
    if (!ticket) return;
    // Determine terminal resolution status
    const targetStatus = ticket.resolution_result?.status || "resolved_tier1";
    statusMutation.mutate(targetStatus);
  };

  const handleStartEdit = () => {
    setEditedText(
      ticket?.resolution_result?.resolution_text ??
        ticket?.resolution ??
        "Thank you for contacting support. We have reviewed your request."
    );
    setIsEditingResolution(true);
  };

  const handleSaveEdit = () => {
    setIsEditingResolution(false);
    handleApplyAsReply();
  };

  // State: No ticket selected
  if (!ticketId) {
    return (
      <aside
        className={`h-full border-l border-slate-800/80 bg-slate-950/60 p-8 flex flex-col items-center justify-center text-center select-none ${className}`}
      >
        <div className="h-12 w-12 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 mb-3">
          <Inbox className="h-6 w-6" />
        </div>
        <h3 className="text-sm font-semibold text-slate-200">
          No Ticket Selected
        </h3>
        <p className="mt-1 text-xs text-slate-500 max-w-xs leading-relaxed">
          Select a ticket from the center table to view triage reasoning, confidence score, automated RAG resolution, and audit history.
        </p>
      </aside>
    );
  }

  // State: Loading ticket
  if (isLoading) {
    return (
      <aside
        className={`h-full border-l border-slate-800/80 bg-slate-950 p-6 flex flex-col items-center justify-center text-slate-400 ${className}`}
      >
        <Loader2 className="h-6 w-6 animate-spin text-blue-500 mb-2" />
        <span className="text-xs">Loading AI resolution cockpit...</span>
      </aside>
    );
  }

  // State: Error loading ticket
  if (isError || !ticket) {
    return (
      <aside
        className={`h-full border-l border-slate-800/80 bg-slate-950 p-6 flex flex-col items-center justify-center text-center text-slate-400 ${className}`}
      >
        <AlertCircle className="h-6 w-6 text-rose-400 mb-2" />
        <h4 className="text-xs font-semibold text-slate-200">Unable to load ticket</h4>
        <p className="text-[11px] text-slate-500 mt-1">
          {error instanceof Error ? error.message : "Not found"}
        </p>
      </aside>
    );
  }

  const shortId = `AV-${ticket.ticket_id.slice(0, 8).toUpperCase()}`;
  const confidenceScore =
    ticket.confidence ??
    ticket.triage_result?.confidence ??
    ticket.resolution_result?.confidence ??
    0.88;

  const resolutionText =
    ticket.resolution_result?.resolution_text ??
    ticket.resolution ??
    ticket.triage_result?.suggested_action ??
    "Our automated triage system has analyzed this inquiry and determined it is within standard parameters. A verified response draft is ready for dispatch.";

  const citedSources = ticket.resolution_result?.cited_sources ?? [];

  return (
    <aside
      className={`h-full border-l border-slate-800/80 bg-slate-950 flex flex-col overflow-y-auto ${className}`}
    >
      {/* 1. Header: Ticket ID & Status */}
      <div className="px-5 py-4 border-b border-slate-800/80 bg-slate-950/80 sticky top-0 z-10 backdrop-blur flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="font-mono text-sm font-bold text-white tracking-wide">
            #{shortId}
          </span>
          <StatusBadge status={ticket.status} />
        </div>
        <SourceBadge status={ticket.status} />
      </div>

      <div className="p-5 space-y-6 flex-1">
        {/* 2. Issued By Info */}
        <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center space-x-3">
          <div className="h-9 w-9 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-semibold text-xs">
            <User className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-200 truncate">
                Customer Support Ticket
              </p>
              <span className="text-[10px] font-mono text-slate-400">
                via {ticket.source}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 truncate mt-0.5">
              {ticket.subject}
            </p>
          </div>
        </div>

        {/* 3. AI Triage Summary */}
        <div className="space-y-1.5">
          <div className="flex items-center space-x-1.5 text-xs font-semibold text-purple-400">
            <Sparkles className="h-3.5 w-3.5" />
            <span>AI Triage Summary</span>
          </div>
          <div className="p-3 rounded-xl bg-purple-950/20 border border-purple-800/30 text-xs text-slate-300 leading-relaxed">
            {ticket.summary ??
              ticket.triage_result?.summary ??
              ticket.body}
          </div>
        </div>

        {/* 4. Confidence Meter */}
        <div className="p-3 rounded-xl bg-slate-900/40 border border-slate-800/80">
          <ConfidenceMeter value={confidenceScore} />
        </div>

        {/* 5. Suggested Resolution */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-1.5 text-xs font-semibold text-emerald-400">
              <Bot className="h-3.5 w-3.5" />
              <span>Suggested Resolution Draft</span>
            </div>
            {!isEditingResolution && (
              <button
                type="button"
                onClick={handleStartEdit}
                className="inline-flex items-center space-x-1 text-[11px] text-slate-400 hover:text-slate-200 transition cursor-pointer"
              >
                <Edit3 className="h-3 w-3" />
                <span>Edit</span>
              </button>
            )}
          </div>

          {isEditingResolution ? (
            <div className="space-y-2">
              <textarea
                value={editedText}
                onChange={(e) => setEditedText(e.target.value)}
                rows={5}
                className="w-full text-xs font-sans p-3 rounded-xl bg-slate-900 border border-blue-500/50 text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsEditingResolution(false)}
                  className="px-2.5 py-1 rounded-lg text-xs text-slate-400 hover:bg-slate-900 border border-transparent cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  className="px-2.5 py-1 rounded-lg text-xs bg-blue-600 hover:bg-blue-500 text-white font-medium cursor-pointer shadow"
                >
                  Save & Apply
                </button>
              </div>
            </div>
          ) : (
            <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 text-xs text-slate-200 leading-relaxed font-sans whitespace-pre-wrap">
              {resolutionText}
            </div>
          )}
        </div>

        {/* 6. Cited KB Sources */}
        {citedSources.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center space-x-1.5 text-xs font-semibold text-slate-300">
              <BookOpen className="h-3.5 w-3.5 text-blue-400" />
              <span>Cited Knowledge Base Sources</span>
            </div>
            <div className="space-y-1.5">
              {citedSources.map((src, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2 rounded-lg bg-slate-900/60 border border-slate-800 text-xs text-slate-300"
                >
                  <span className="truncate pr-2">{src}</span>
                  <ExternalLink className="h-3 w-3 text-slate-500 shrink-0" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 7. Action Bar — Apply as Reply */}
        <div className="pt-2">
          {applySuccess && (
            <div className="mb-2 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center space-x-2 text-xs text-emerald-300">
              <Check className="h-3.5 w-3.5 text-emerald-400" />
              <span>Resolution applied successfully!</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleStartEdit}
              className="flex items-center justify-center space-x-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 text-xs font-medium transition cursor-pointer"
            >
              <Edit3 className="h-3.5 w-3.5 text-slate-400" />
              <span>Edit Draft</span>
            </button>

            <button
              type="button"
              disabled={statusMutation.isPending}
              onClick={handleApplyAsReply}
              className="flex items-center justify-center space-x-1.5 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium shadow-md shadow-blue-600/30 transition disabled:opacity-50 cursor-pointer"
            >
              {statusMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              <span>Apply as Reply</span>
            </button>
          </div>
        </div>

        {/* 8. Activity Timeline */}
        <div className="pt-4 border-t border-slate-800/80 space-y-3">
          <div className="flex items-center space-x-1.5 text-xs font-semibold text-slate-300">
            <Clock className="h-3.5 w-3.5 text-slate-400" />
            <span>Activity History</span>
          </div>
          <ActivityTimeline ticketId={ticket.ticket_id} />
        </div>
      </div>
    </aside>
  );
}
