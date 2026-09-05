from datetime import datetime, timezone
from typing import Any
from uuid import UUID
import redis.asyncio as redis
from redis.exceptions import ResponseError
import structlog

from app.config import settings

logger = structlog.get_logger("app.shared.queue")

STREAM_TICKETS = "tickets:stream"
GROUP_TICKETS = "ticket_workers"
STREAM_DLQ = "tickets:dlq"


def get_redis_client() -> redis.Redis:
    """Returns an async Redis client configured from application settings."""
    return redis.from_url(settings.REDIS_URL, decode_responses=True)


async def init_consumer_group(
    redis_client: redis.Redis,
    stream: str = STREAM_TICKETS,
    group: str = GROUP_TICKETS,
) -> None:
    """Initializes a Redis stream consumer group idempotently."""
    try:
        await redis_client.xgroup_create(stream, group, id="$", mkstream=True)
        logger.info("consumer_group_created", stream=stream, group=group)
    except ResponseError as exc:
        if "BUSYGROUP" in str(exc):
            logger.info("consumer_group_already_exists", stream=stream, group=group)
        else:
            logger.error("consumer_group_create_failed", stream=stream, group=group, error=str(exc))
            raise


async def publish_ticket_event(
    redis_client: redis.Redis,
    ticket_id: str | UUID,
    tenant_id: str | UUID,
    event_type: str = "ticket.received",
    stream: str = STREAM_TICKETS,
    correlation_id: str | None = None,
) -> str:
    """Appends an event to the Redis stream."""
    payload: dict[str, Any] = {
        "event_type": event_type,
        "ticket_id": str(ticket_id),
        "tenant_id": str(tenant_id),
        "correlation_id": correlation_id or "",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    msg_id = await redis_client.xadd(stream, payload)
    logger.info(
        "stream_event_published",
        stream=stream,
        message_id=msg_id,
        ticket_id=str(ticket_id),
        tenant_id=str(tenant_id),
        correlation_id=correlation_id or "",
    )
    return msg_id

