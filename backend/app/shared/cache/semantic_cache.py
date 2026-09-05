import json
import math
from datetime import datetime, timezone
from typing import Any
from uuid import UUID
import redis.asyncio as redis
import structlog

from app.config import settings

logger = structlog.get_logger("app.shared.cache.semantic")


def cosine_similarity(a: list[float], b: list[float]) -> float:
    """Computes cosine similarity between two vector embeddings using pure Python math."""
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    mag_a = math.sqrt(sum(x * x for x in a))
    mag_b = math.sqrt(sum(x * x for x in b))
    if mag_a == 0.0 or mag_b == 0.0:
        return 0.0
    return dot / (mag_a * mag_b)


async def store_cache(
    redis_client: redis.Redis,
    tenant_id: UUID | str,
    ticket_id: UUID | str,
    embedding: list[float],
    resolution_text: str,
    metadata: dict[str, Any] | None = None,
    ttl: int = settings.SEMANTIC_CACHE_TTL_SECONDS,
) -> str:
    """Stores a resolved ticket embedding and resolution in a tenant-scoped Redis hash."""
    if not embedding or not resolution_text:
        return ""

    key = f"semcache:{tenant_id}:{ticket_id}"
    payload = {
        "ticket_id": str(ticket_id),
        "tenant_id": str(tenant_id),
        "resolution_text": resolution_text,
        "metadata": json.dumps(metadata or {}),
        "embedding": json.dumps(embedding),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await redis_client.hset(key, mapping=payload)
    await redis_client.expire(key, ttl)

    logger.info(
        "semantic_cache_stored",
        key=key,
        tenant_id=str(tenant_id),
        ticket_id=str(ticket_id),
        ttl_seconds=ttl,
    )
    return key


async def lookup_cache(
    redis_client: redis.Redis,
    tenant_id: UUID | str,
    embedding: list[float],
    threshold: float = settings.SEMANTIC_CACHE_SIMILARITY_THRESHOLD,
) -> dict[str, Any] | None:
    """Scans cached resolutions for this specific tenant and returns the best match above threshold.

    Strict multi-tenant isolation: Only keys prefixed with 'semcache:{tenant_id}:*' are scanned.
    """
    if not embedding:
        return None

    pattern = f"semcache:{tenant_id}:*"
    best_match: dict[str, Any] | None = None
    highest_sim = -1.0

    async for key in redis_client.scan_iter(match=pattern, count=100):
        cached_data = await redis_client.hgetall(key)
        if not cached_data or "embedding" not in cached_data:
            continue

        try:
            cached_vec = json.loads(cached_data["embedding"])
            sim = cosine_similarity(embedding, cached_vec)
            if sim > highest_sim:
                highest_sim = sim
                if sim >= threshold:
                    meta_raw = cached_data.get("metadata", "{}")
                    try:
                        meta = json.loads(meta_raw)
                    except Exception:
                        meta = {}
                    best_match = {
                        "ticket_id": cached_data.get("ticket_id"),
                        "tenant_id": cached_data.get("tenant_id"),
                        "resolution_text": cached_data.get("resolution_text"),
                        "metadata": meta,
                        "similarity": sim,
                    }
        except Exception as exc:
            logger.warn("error_parsing_cached_embedding", key=key, error=str(exc))
            continue

    if best_match:
        logger.info(
            "semantic_cache_hit",
            tenant_id=str(tenant_id),
            similarity=round(best_match["similarity"], 4),
            threshold=threshold,
            ticket_id=best_match["ticket_id"],
        )
        return best_match

    logger.info(
        "semantic_cache_miss",
        tenant_id=str(tenant_id),
        highest_similarity=round(highest_sim, 4) if highest_sim > 0 else 0.0,
        threshold=threshold,
    )
    return None


class SemanticCache:
    """Wrapper class providing object-oriented access to multi-tenant Redis semantic cache."""

    def __init__(
        self,
        redis_client: redis.Redis,
        threshold: float = settings.SEMANTIC_CACHE_SIMILARITY_THRESHOLD,
        ttl: int = settings.SEMANTIC_CACHE_TTL_SECONDS,
    ) -> None:
        self.redis_client = redis_client
        self.threshold = threshold
        self.ttl = ttl

    async def lookup(
        self,
        tenant_id: UUID | str,
        embedding: list[float],
        threshold: float | None = None,
    ) -> dict[str, Any] | None:
        return await lookup_cache(
            redis_client=self.redis_client,
            tenant_id=tenant_id,
            embedding=embedding,
            threshold=threshold if threshold is not None else self.threshold,
        )

    async def store(
        self,
        tenant_id: UUID | str,
        ticket_id: UUID | str,
        embedding: list[float],
        resolution_text: str,
        metadata: dict[str, Any] | None = None,
        ttl: int | None = None,
    ) -> str:
        return await store_cache(
            redis_client=self.redis_client,
            tenant_id=tenant_id,
            ticket_id=ticket_id,
            embedding=embedding,
            resolution_text=resolution_text,
            metadata=metadata,
            ttl=ttl if ttl is not None else self.ttl,
        )
