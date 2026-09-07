from typing import Any
from uuid import UUID
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import structlog

from app.modules.tickets.models import Ticket
from app.shared.database.rls import set_tenant_context

logger = structlog.get_logger("app.shared.ai.rag")

TIER2_RAG_SYSTEM_PROMPT = """You are an enterprise Tier 2 customer support resolution assistant.
Your task is to draft a direct, professional, and empathetic support resolution reply addressed to the customer using ONLY the provided tenant knowledge base context.

You MUST output ONLY a valid JSON object matching this exact schema:
{
  "resolution_text": "<A direct, professional support reply addressed to the customer, e.g. 'Hello, thank you for reaching out...'>",
  "confidence": <float between 0.0 and 1.0>,
  "cited_sources": ["<list of document titles, chunk IDs, or ticket IDs cited from context>"],
  "status": "resolved_tier2" | "escalated_human"
}

Rules:
1. Do NOT summarize the user's issue in 'resolution_text'. You must write the actual response addressed to the customer.
2. Ground your resolution strictly on the provided '=== RETRIEVED KNOWLEDGE BASE CONTEXT ==='. Do NOT fabricate candidate details, facts, or policies not supported by the context.
3. If the context contains relevant information to answer or resolve the customer's request, provide a comprehensive, polite response, set confidence >= 0.85, status="resolved_tier2", and list the cited source(s) in "cited_sources".
4. If the context does not contain sufficient or relevant information, or if confidence is below 0.70, set status="escalated_human", confidence <= 0.60, and politely explain in resolution_text that their request is being routed to a human specialist.
5. Always maintain a professional, empathetic enterprise support tone.
"""


def build_tier2_rag_prompt(subject: str, body: str, contexts: list[dict[str, Any]]) -> str:
    """Builds a grounded prompt combining ticket information with retrieved tenant context."""
    if not contexts:
        context_str = "(No matching tenant knowledge context found)"
    else:
        snippets = []
        for idx, ctx in enumerate(contexts, 1):
            if ctx.get("is_document"):
                snippets.append(
                    f"--- Source Document #{idx} [{ctx.get('title', 'Knowledge Base Document')}] (Cosine Similarity: {ctx.get('similarity', 0.0):.3f}) ---\n"
                    f"{ctx.get('content', '').strip()}"
                )
            else:
                snippets.append(
                    f"--- Previously Resolved Ticket #{idx} [Ticket ID: {ctx.get('ticket_id', 'N/A')}] (Cosine Similarity: {ctx.get('similarity', 0.0):.3f}) ---\n"
                    f"Subject: {ctx.get('subject', '')}\n"
                    f"Problem Details: {ctx.get('body', '')}\n"
                    f"Resolution Applied: {ctx.get('resolution', '')}"
                )
        context_str = "\n\n".join(snippets)

    return (
        f"Customer Support Ticket:\n"
        f"Subject: {subject.strip()}\n"
        f"Body:\n{body.strip()}\n\n"
        f"=== RETRIEVED KNOWLEDGE BASE CONTEXT ===\n"
        f"{context_str}\n"
        f"========================================\n\n"
        f"Instructions:\n"
        f"Draft a direct, professional support reply addressed to the customer (e.g., 'Hello, thank you for reaching out...').\n"
        f"Ground your reply strictly on the retrieved knowledge base context above. Do not summarize the ticket — write the actual resolution message to the customer."
    )


async def retrieve_similar_context(
    session: AsyncSession,
    tenant_id: UUID,
    query_vector: list[float],
    limit: int = 3,
    threshold: float = 0.55,
) -> list[dict[str, Any]]:
    """Performs cosine similarity search using pgvector (<=>) against resolved tickets and document chunks.

    Strictly enforces PostgreSQL session-level Row-Level Security (RLS) via set_tenant_context
    and explicit tenant_id filters so no cross-tenant knowledge data can ever be accessed or leaked.
    Allows relevant documents through with distance <= 0.45 (similarity >= 0.55).
    """
    if not query_vector:
        return []

    # Enforce RLS tenant context prior to execution
    await set_tenant_context(session, tenant_id)

    results: list[dict[str, Any]] = []
    max_distance = 1.0 - threshold

    # 1. Query Knowledge Base Document Chunks
    try:
        from app.modules.knowledge.models import DocumentChunk, SourceDocument

        chunk_dist = DocumentChunk.embedding.cosine_distance(query_vector)
        chunk_sim = (1.0 - chunk_dist).label("similarity")

        chunk_stmt = (
            select(
                DocumentChunk.id,
                DocumentChunk.document_id,
                DocumentChunk.content,
                SourceDocument.title,
                chunk_sim,
            )
            .join(SourceDocument, DocumentChunk.document_id == SourceDocument.id)
            .where(
                DocumentChunk.tenant_id == tenant_id,
                SourceDocument.tenant_id == tenant_id,
                DocumentChunk.embedding.isnot(None),
                chunk_dist <= max_distance,
            )
            .order_by(chunk_dist.asc())
            .limit(limit)
        )
        chunk_res = await session.execute(chunk_stmt)
        for row in chunk_res.all():
            results.append(
                {
                    "is_document": True,
                    "chunk_id": str(row.id),
                    "document_id": str(row.document_id),
                    "title": row.title,
                    "content": row.content,
                    "similarity": float(row.similarity) if row.similarity is not None else 0.0,
                    "source": "grounded_rag",
                    "tier": "Tier 2",
                }
            )
    except Exception as exc:
        logger.warn("knowledge_chunks_retrieval_skip", error=str(exc))

    # 2. Query Resolved Tickets
    try:
        distance_expr = Ticket.embedding.cosine_distance(query_vector)
        similarity_expr = (1.0 - distance_expr).label("similarity")

        ticket_stmt = (
            select(
                Ticket.id,
                Ticket.tenant_id,
                Ticket.subject,
                Ticket.body,
                Ticket.resolution,
                similarity_expr,
            )
            .where(
                Ticket.tenant_id == tenant_id,
                Ticket.status.in_(["resolved_tier1", "resolved_tier2"]),
                Ticket.resolution.isnot(None),
                Ticket.embedding.isnot(None),
                distance_expr <= max_distance,
            )
            .order_by(distance_expr.asc())
            .limit(limit)
        )

        res = await session.execute(ticket_stmt)
        for row in res.all():
            results.append(
                {
                    "is_document": False,
                    "ticket_id": str(row.id),
                    "tenant_id": str(row.tenant_id),
                    "subject": row.subject,
                    "body": row.body,
                    "resolution": row.resolution,
                    "similarity": float(row.similarity) if row.similarity is not None else 0.0,
                    "source": "grounded_rag",
                    "tier": "Tier 2",
                }
            )
    except Exception as exc:
        logger.warn("ticket_context_retrieval_skip", error=str(exc))

    # Sort combined results by similarity descending, take top `limit`
    results.sort(key=lambda x: x.get("similarity", 0.0), reverse=True)
    top_results = results[:limit]

    logger.info(
        "rag_context_retrieved",
        tenant_id=str(tenant_id),
        matches_count=len(top_results),
        threshold=threshold,
        limit=limit,
    )
    return top_results
