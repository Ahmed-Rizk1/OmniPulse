from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI, status
from fastapi.responses import JSONResponse
import redis.asyncio as redis
from sqlalchemy import text
import structlog

from app.config import settings
from app.modules.tenants.router import router as tenants_router
from app.modules.tickets.router import router as tickets_router
from app.shared.database.session import engine
from app.shared.telemetry.middleware import CorrelationIdMiddleware
from prometheus_client import CONTENT_TYPE_LATEST, generate_latest
from fastapi import Response

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
logger = structlog.get_logger("app.main")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    # Test DB connection on startup
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        logger.info("db_connected", module="main")
    except Exception as exc:
        logger.error(
            "db_connection_error",
            module="main",
            error=str(exc),
        )
        raise

    # Test Redis ping on startup
    try:
        redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True)
        await redis_client.ping()
        await redis_client.aclose()
        logger.info("redis_connected", module="main")
    except Exception as exc:
        logger.error(
            "redis_connection_error",
            module="main",
            error=str(exc),
        )
        raise

    yield

    # Teardown database engine pool
    await engine.dispose()
    logger.info("shutdown", module="main")


app = FastAPI(
    title="OmniPulse API",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(CorrelationIdMiddleware)

app.include_router(tenants_router, prefix="/tenants", tags=["tenants"])
app.include_router(tickets_router, prefix="/webhooks", tags=["tickets"])


@app.get("/metrics", tags=["observability"], summary="Prometheus scrape endpoint")
def metrics_endpoint() -> Response:
    """Returns raw Prometheus metrics exposition text."""
    return Response(
        content=generate_latest(),
        media_type=CONTENT_TYPE_LATEST,
    )



@app.get("/health", status_code=status.HTTP_200_OK)
async def health_check():
    db_status = "disconnected"
    redis_status = "disconnected"

    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception as exc:
        logger.error(
            "db_health_error",
            module="main",
            error=str(exc),
        )

    try:
        redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True)
        await redis_client.ping()
        await redis_client.aclose()
        redis_status = "connected"
    except Exception as exc:
        logger.error(
            "redis_health_error",
            module="main",
            error=str(exc),
        )

    is_healthy = db_status == "connected" and redis_status == "connected"
    status_code = (
        status.HTTP_200_OK if is_healthy else status.HTTP_503_SERVICE_UNAVAILABLE
    )

    return JSONResponse(
        status_code=status_code,
        content={
            "status": "ok" if is_healthy else "degraded",
            "db": db_status,
            "redis": redis_status,
        },
    )
