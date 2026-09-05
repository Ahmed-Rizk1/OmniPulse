import asyncio
import os
import signal
import socket
import sys
import time
import uuid
from datetime import datetime, timezone
import redis
import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.modules.tenants.models import Tenant
from app.modules.tickets.models import Ticket
from app.modules.tickets.prompts import TRIAGE_SYSTEM_PROMPT, triage_user_prompt
from app.modules.tickets.schemas import TicketResolutionResult, TicketTriageResult
from app.shared.ai.embeddings import get_embedding_client
from app.shared.ai.groq import get_groq_provider
from app.shared.ai.rag import (
    TIER2_RAG_SYSTEM_PROMPT,
    build_tier2_rag_prompt,
    retrieve_similar_context,
)
from app.shared.cache.semantic_cache import lookup_cache, store_cache
from app.shared.database.rls import set_tenant_context
from app.shared.database.session import AsyncSessionLocal, engine
from app.shared.telemetry.metrics import (
    semantic_cache_events_total,
    worker_processing_duration_seconds,
    worker_tickets_processed_total,
)
from app.shared.queue.redis_stream import (
    GROUP_TICKETS,
    STREAM_DLQ,
    STREAM_TICKETS,
    get_redis_client,
    init_consumer_group,
)

structlog.configure(
    processors=[
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer(),
    ],
    logger_factory=structlog.PrintLoggerFactory(),
    cache_logger_on_first_use=True,
)
logger = structlog.get_logger("app.worker")


class TicketWorker:
    def __init__(self) -> None:
        hostname = socket.gethostname()
        self.consumer_name = f"worker-{hostname}-{uuid.uuid4().hex[:6]}"
        self.running = True
        self.redis_client = get_redis_client()

    async def process_ticket_event(
        self,
        msg_id: str,
        fields: dict[str, str],
        session: AsyncSession,
    ) -> bool:
        ticket_id_str = fields.get("ticket_id")
        tenant_id_str = fields.get("tenant_id")
        correlation_id = fields.get("correlation_id") or str(uuid.uuid4())

        structlog.contextvars.bind_contextvars(
            correlation_id=correlation_id,
            tenant_id=tenant_id_str or "",
        )

        start_time = time.perf_counter()

        if not ticket_id_str or not tenant_id_str:
            logger.error("malformed_stream_message", msg_id=msg_id, fields=fields)
            return True

        ticket_id = uuid.UUID(ticket_id_str)
        tenant_id = uuid.UUID(tenant_id_str)

        # Enforce PostgreSQL Row-Level Security session context
        await set_tenant_context(session, tenant_id)

        stmt = select(Ticket).where(Ticket.id == ticket_id)
        res = await session.execute(stmt)
        ticket = res.scalar_one_or_none()

        if not ticket:
            logger.warn("ticket_not_found_for_event", ticket_id=ticket_id_str, tenant_id=tenant_id_str)
            return True

        # 1. Generate text embedding via Gemini client
        try:
            embedding_client = get_embedding_client()
            content_to_embed = f"{ticket.subject}\n{ticket.body}"
            embedding = await embedding_client.embed_text(content_to_embed)
            ticket.embedding = embedding
            logger.info("ticket_embedded", ticket_id=ticket_id_str, dimensions=len(embedding))
        except Exception as emb_exc:
            logger.error("ticket_embedding_failed", ticket_id=ticket_id_str, error=str(emb_exc))

        # 2. Check Semantic Cache (Redis Cosine >= 0.95)
        if ticket.embedding:
            try:
                cached_hit = await lookup_cache(
                    redis_client=self.redis_client,
                    tenant_id=tenant_id,
                    embedding=ticket.embedding,
                    threshold=settings.SEMANTIC_CACHE_SIMILARITY_THRESHOLD,
                )
                if cached_hit:
                    duration_s = time.perf_counter() - start_time
                    semantic_cache_events_total.labels(tenant_id=tenant_id_str, result="hit").inc()
                    worker_tickets_processed_total.labels(tenant_id=tenant_id_str, status="resolved_cached").inc()
                    worker_processing_duration_seconds.labels(stage="total").observe(duration_s)

                    ticket.status = "resolved_cached"
                    ticket.resolution = cached_hit["resolution_text"]
                    ticket.resolution_metadata = {
                        "cached_from_ticket_id": cached_hit["ticket_id"],
                        "similarity": cached_hit["similarity"],
                        "source": "semantic_cache",
                    }
                    ticket.updated_at = datetime.now(timezone.utc)
                    await session.commit()
                    logger.info(
                        "ticket_resolved_from_cache",
                        ticket_id=ticket_id_str,
                        tenant_id=tenant_id_str,
                        cached_ticket_id=cached_hit["ticket_id"],
                        similarity=cached_hit["similarity"],
                        msg_id=msg_id,
                        correlation_id=correlation_id,
                        duration_ms=round(duration_s * 1000, 2),
                    )
                    return True
                else:
                    semantic_cache_events_total.labels(tenant_id=tenant_id_str, result="miss").inc()
            except Exception as cache_exc:
                logger.warn("semantic_cache_lookup_failed", ticket_id=ticket_id_str, error=str(cache_exc))

        # 3. Execute Fast Triage Tier 1 via Groq
        try:
            llm_provider = get_groq_provider()
            user_prompt = triage_user_prompt(ticket.subject, ticket.body)
            triage_result: TicketTriageResult = await llm_provider.complete_json(
                system_prompt=TRIAGE_SYSTEM_PROMPT,
                user_prompt=user_prompt,
                response_schema=TicketTriageResult,
            )

            ticket.category = triage_result.category.lower()
            ticket.priority = triage_result.priority.lower()
            ticket.summary = triage_result.summary
            ticket.confidence = triage_result.confidence
            ticket.triage_metadata = triage_result.model_dump()

            if triage_result.confidence >= settings.TRIAGE_CONFIDENCE_THRESHOLD and not triage_result.needs_fallback:
                ticket.status = "resolved_tier1"
            else:
                ticket.status = "needs_fallback"

            logger.info(
                "ticket_triaged",
                ticket_id=ticket_id_str,
                tenant_id=tenant_id_str,
                category=ticket.category,
                priority=ticket.priority,
                confidence=ticket.confidence,
                status=ticket.status,
            )

        except Exception as triage_exc:
            logger.error("ticket_triage_failed", ticket_id=ticket_id_str, error=str(triage_exc))
            ticket.status = "failed"
            ticket.triage_metadata = {"error": str(triage_exc)}

        # 3. Tier 2 Resolution Engine: RAG Fallback
        if ticket.status == "needs_fallback":
            logger.info("tier2_rag_fallback_triggered", ticket_id=ticket_id_str, tenant_id=tenant_id_str)
            try:
                contexts: list[dict] = []
                if ticket.embedding:
                    contexts = await retrieve_similar_context(
                        session=session,
                        tenant_id=tenant_id,
                        query_vector=ticket.embedding,
                        limit=settings.RAG_TOP_K,
                        threshold=settings.RAG_SIMILARITY_THRESHOLD,
                    )

                if contexts:
                    logger.info(
                        "tier2_rag_contexts_found",
                        ticket_id=ticket_id_str,
                        count=len(contexts),
                    )
                    rag_prompt = build_tier2_rag_prompt(ticket.subject, ticket.body, contexts)
                    tier2_llm = get_groq_provider(model=settings.TIER2_MODEL)
                    resolution_result: TicketResolutionResult = await tier2_llm.complete_json(
                        system_prompt=TIER2_RAG_SYSTEM_PROMPT,
                        user_prompt=rag_prompt,
                        response_schema=TicketResolutionResult,
                    )

                    ticket.resolution = resolution_result.resolution_text
                    ticket.resolution_metadata = resolution_result.model_dump()
                    ticket.status = resolution_result.status

                    logger.info(
                        "tier2_rag_resolution_completed",
                        ticket_id=ticket_id_str,
                        status=ticket.status,
                        confidence=resolution_result.confidence,
                        cited_sources=resolution_result.cited_sources,
                    )
                else:
                    logger.info(
                        "tier2_rag_no_context_found",
                        ticket_id=ticket_id_str,
                        tenant_id=tenant_id_str,
                    )
                    ticket.status = "escalated_human"
                    ticket.resolution = "No tenant knowledge base found matching this request. Escalated to human support."
                    ticket.resolution_metadata = {
                        "reason": "no_matching_context_found",
                        "status": "escalated_human",
                        "confidence": 0.0,
                        "cited_sources": [],
                    }
            except Exception as rag_exc:
                logger.error("tier2_rag_resolution_failed", ticket_id=ticket_id_str, error=str(rag_exc))
                ticket.status = "escalated_human"
                ticket.resolution = f"Resolution failed due to internal error: {rag_exc}"
                ticket.resolution_metadata = {"error": str(rag_exc), "status": "escalated_human"}

        # If resolved by Tier 1 and resolution is missing, populate with summary
        if ticket.status == "resolved_tier1" and not ticket.resolution:
            ticket.resolution = ticket.summary or "Resolved via Tier 1 automated triage."

        # 5. Store resolved tickets in Semantic Cache for fast retrieval
        if ticket.embedding and ticket.resolution and ticket.status in ("resolved_tier1", "resolved_tier2"):
            try:
                await store_cache(
                    redis_client=self.redis_client,
                    tenant_id=tenant_id,
                    ticket_id=ticket.id,
                    embedding=ticket.embedding,
                    resolution_text=ticket.resolution,
                    metadata=ticket.resolution_metadata or ticket.triage_metadata,
                    ttl=settings.SEMANTIC_CACHE_TTL_SECONDS,
                )
            except Exception as cache_store_exc:
                logger.warn("semantic_cache_store_failed", ticket_id=ticket_id_str, error=str(cache_store_exc))

        duration_s = time.perf_counter() - start_time
        worker_tickets_processed_total.labels(tenant_id=tenant_id_str, status=ticket.status).inc()
        worker_processing_duration_seconds.labels(stage="total").observe(duration_s)

        ticket.updated_at = datetime.now(timezone.utc)
        await session.commit()

        logger.info(
            "ticket_processed",
            ticket_id=ticket_id_str,
            tenant_id=tenant_id_str,
            final_status=ticket.status,
            msg_id=msg_id,
            correlation_id=correlation_id,
            duration_ms=round(duration_s * 1000, 2),
        )
        return True

    async def reap_pending(self) -> None:
        """Reaps unacknowledged pending messages older than 30s using XPENDING and XCLAIM."""
        try:
            pending_entries = await self.redis_client.xpending_range(
                STREAM_TICKETS, GROUP_TICKETS, min="-", max="+", count=50
            )
            for entry in pending_entries:
                msg_id = entry.get("message_id")
                idle_ms = entry.get("time_since_delivered", 0)
                delivery_count = entry.get("times_delivered", 1)

                if idle_ms >= 30000:
                    if delivery_count >= 3:
                        logger.warn(
                            "moving_to_dlq_max_retries",
                            msg_id=msg_id,
                            delivery_count=delivery_count,
                            idle_ms=idle_ms,
                        )
                        claimed = await self.redis_client.xclaim(
                            STREAM_TICKETS,
                            GROUP_TICKETS,
                            self.consumer_name,
                            min_idle_time=30000,
                            message_ids=[msg_id],
                        )
                        for c_id, c_fields in claimed:
                            payload = {**c_fields, "dlq_reason": "max_delivery_attempts_exceeded"}
                            await self.redis_client.xadd(STREAM_DLQ, payload)
                        await self.redis_client.xack(STREAM_TICKETS, GROUP_TICKETS, msg_id)
                    else:
                        logger.info("claiming_idle_pending_message", msg_id=msg_id, idle_ms=idle_ms)
                        claimed = await self.redis_client.xclaim(
                            STREAM_TICKETS,
                            GROUP_TICKETS,
                            self.consumer_name,
                            min_idle_time=30000,
                            message_ids=[msg_id],
                        )
                        for c_id, c_fields in claimed:
                            async with AsyncSessionLocal() as session:
                                try:
                                    success = await self.process_ticket_event(c_id, c_fields, session)
                                    if success:
                                        await self.redis_client.xack(STREAM_TICKETS, GROUP_TICKETS, c_id)
                                except Exception as exc:
                                    logger.error("claimed_process_event_failed", msg_id=c_id, error=str(exc))
        except Exception as exc:
            logger.error("reap_pending_failed", error=str(exc))

    async def reaper_loop(self) -> None:
        while self.running:
            try:
                await asyncio.sleep(10)
                if not self.running:
                    break
                await self.reap_pending()
            except asyncio.CancelledError:
                break
            except Exception as exc:
                logger.error("reaper_loop_error", error=str(exc))

    async def start(self) -> None:
        logger.info("worker_starting", consumer_name=self.consumer_name, stream=STREAM_TICKETS, group=GROUP_TICKETS)
        await init_consumer_group(self.redis_client, STREAM_TICKETS, GROUP_TICKETS)
        logger.info("worker_ready", consumer_name=self.consumer_name)

        reaper_task = asyncio.create_task(self.reaper_loop())

        try:
            while self.running:
                try:
                    # Read new messages delivered to this consumer group
                    entries = await self.redis_client.xreadgroup(
                        groupname=GROUP_TICKETS,
                        consumername=self.consumer_name,
                        streams={STREAM_TICKETS: ">"},
                        count=10,
                        block=2000,
                    )

                    if not entries:
                        continue

                    for stream_name, messages in entries:
                        for msg_id, fields in messages:
                            async with AsyncSessionLocal() as session:
                                try:
                                    success = await self.process_ticket_event(msg_id, fields, session)
                                    if success:
                                        await self.redis_client.xack(STREAM_TICKETS, GROUP_TICKETS, msg_id)
                                except Exception as exc:
                                    logger.error(
                                        "process_event_failed",
                                        msg_id=msg_id,
                                        error=str(exc),
                                    )

                except (redis.exceptions.TimeoutError, asyncio.TimeoutError):
                    # Normal idle polling timeout when no new messages in stream
                    continue
                except asyncio.CancelledError:
                    break
                except Exception as exc:
                    if self.running:
                        logger.error("worker_loop_error", error=str(exc))
                        await asyncio.sleep(1)
        finally:
            reaper_task.cancel()
            try:
                await reaper_task
            except asyncio.CancelledError:
                pass

        await self.shutdown()

    async def shutdown(self) -> None:
        logger.info("worker_shutting_down", consumer_name=self.consumer_name)
        await self.redis_client.aclose()
        await engine.dispose()
        logger.info("worker_stopped", consumer_name=self.consumer_name)

    def stop(self) -> None:
        self.running = False


async def main() -> None:
    worker = TicketWorker()
    loop = asyncio.get_running_loop()

    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, worker.stop)
        except NotImplementedError:
            pass

    try:
        await worker.start()
    except (KeyboardInterrupt, asyncio.CancelledError):
        worker.stop()
        await worker.shutdown()


if __name__ == "__main__":
    asyncio.run(main())
