from typing import Any
from uuid import UUID
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import structlog

from app.modules.tickets.models import Ticket
from app.shared.database.rls import set_tenant_context

logger = structlog.get_logger("app.shared.ai.rag")

TIER2_RAG_SYSTEM_PROMPT = """You are an enterprise Tier 2 support resolution assistant.
Your task is to draft a comprehensive, accurate, and grounded resolution for a customer support ticket using ONLY the provided tenant knowledge context (previously resolved tickets and official policies).

You MUST output ONLY a valid JSON object matching this exact schema:
{
  "resolution_text": "<Detailed, polite, and helpful resolution grounded in the retrieved context>",
  "confidence": <float between 0.0 and 1.0>,
  "cited_sources": ["<list of ticket IDs or source identifiers from the context>"],
  "status": "resolved_tier2" | "escalated_human"
}

Rules:
1. Ground your answer strictly in the provided Context Solutions. Do NOT fabricate policies or facts not supported by the context.
2. If the context contains a clear solution or policy matching the user's issue, provide a complete resolution, set confidence >= 0.85, and status="resolved_tier2". List the source ID(s) in "cited_sources".
3. If the context does not contain sufficient or relevant information to resolve the issue, or if the confidence is below 0.70, set status="escalated_human" and explain that human escalation is needed.
4. Always maintain a professional, empathetic enterprise support tone.
"""


def build_tier2_rag_prompt(subject: str, body: str, contexts: list[dict[str, Any]]) -> str:
    """Builds a grounded prompt combining ticket information with retrieved tenant context."""
    if not contexts:
        context_str = "(No matching tenant knowledge context found)"
    else:
        snippets = []
        for idx, ctx in enumerate(contexts, 1):
            snippets.append(
                f"--- Context Solution #{idx} [Ticket ID: {ctx.get('ticket_id', 'N/A')}] (Cosine Similarity: {ctx.get('similarity', 0.0):.3f}) ---\n"
                f"Subject: {ctx.get('subject', '')}\n"
                f"Problem Details: {ctx.get('body', '')}\n"
                f"Resolution Applied: {ctx.get('resolution', '')}"
            )
        context_str = "\n\n".join(snippets)

    return (
        f"Customer Ticket Issue:\n"
        f"Subject: {subject.strip()}\n"
        f"Body: {body.strip()}\n\n"
        f"Retrieved Tenant Knowledge Context:\n{context_str}\n\n"
        f"Draft a grounded, professional resolution for the customer ticket using the retrieved context."
    )


async def retrieve_similar_context(
    session: AsyncSession,
    tenant_id: UUID,
    query_vector: list[float],
    limit: int = 3,
    threshold: float = 0.6,
) -> list[dict[str, Any]]:
    """Performs cosine similarity search using pgvector (<=>) against resolved tickets.

    Strictly enforces PostgreSQL session-level Row-Level Security (RLS) via set_tenant_context
    so no cross-tenant knowledge data can ever be accessed or leaked.
    """
    if not query_vector:
        return []

    # Enforce RLS tenant context prior to execution
    await set_tenant_context(session, tenant_id)

    # Cosine distance: Ticket.embedding <=> query_vector
    # Cosine similarity = 1 - cosine_distance
    distance_expr = Ticket.embedding.cosine_distance(query_vector)
    similarity_expr = (1.0 - distance_expr).label("similarity")

    stmt = (
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
            (1.0 - distance_expr) >= threshold,
        )
        .order_by(distance_expr.asc())
        .limit(limit)
    )

    res = await session.execute(stmt)
    rows = res.all()

    results: list[dict[str, Any]] = []
    for row in rows:
        results.append(
            {
                "ticket_id": str(row.id),
                "tenant_id": str(row.tenant_id),
                "subject": row.subject,
                "body": row.body,
                "resolution": row.resolution,
                "similarity": float(row.similarity) if row.similarity is not None else 0.0,
            }
        )

    logger.info(
        "rag_context_retrieved",
        tenant_id=str(tenant_id),
        matches_count=len(results),
        threshold=threshold,
        limit=limit,
    )
    return results
