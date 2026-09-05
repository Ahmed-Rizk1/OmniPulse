import asyncio
import os
import signal
import socket
import sys
import uuid
from datetime import datetime, timezone
import redis
import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.modules.tenants.models import Tenant
from app.modules.tickets.models import Ticket
from app.shared.database.rls import set_tenant_context
from app.shared.database.session import AsyncSessionLocal, engine
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

        # Transition ticket status from 'pending' to 'processing'
        ticket.status = "processing"
        ticket.updated_at = datetime.now(timezone.utc)
        await session.commit()

        logger.info(
            "ticket_processed",
            ticket_id=ticket_id_str,
            tenant_id=tenant_id_str,
            new_status="processing",
            msg_id=msg_id,
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
