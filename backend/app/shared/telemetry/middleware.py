import time
import uuid
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
import structlog
from structlog.contextvars import bind_contextvars, clear_contextvars

from app.shared.telemetry.metrics import (
    http_request_duration_seconds,
    http_requests_total,
)

logger = structlog.get_logger("app.telemetry.middleware")


class CorrelationIdMiddleware(BaseHTTPMiddleware):
    """Middleware that assigns and propagates X-Correlation-Id headers,

    binds correlation and tenant context to structlog, and instruments Prometheus HTTP metrics.
    """

    async def dispatch(self, request: Request, call_next) -> Response:
        clear_contextvars()

        correlation_id = request.headers.get("X-Correlation-Id")
        if not correlation_id or not correlation_id.strip():
            correlation_id = str(uuid.uuid4())
        else:
            correlation_id = correlation_id.strip()

        tenant_id = request.headers.get("X-Tenant-Id", "anonymous").strip()

        bind_contextvars(
            correlation_id=correlation_id,
            tenant_id=tenant_id,
        )

        start_time = time.perf_counter()
        endpoint = request.url.path

        try:
            response = await call_next(request)
            duration = time.perf_counter() - start_time
            status_code = str(response.status_code)

            http_requests_total.labels(
                method=request.method,
                endpoint=endpoint,
                status=status_code,
            ).inc()

            http_request_duration_seconds.labels(
                method=request.method,
                endpoint=endpoint,
            ).observe(duration)

            response.headers["X-Correlation-Id"] = correlation_id
            return response

        except Exception as exc:
            duration = time.perf_counter() - start_time
            http_requests_total.labels(
                method=request.method,
                endpoint=endpoint,
                status="500",
            ).inc()

            http_request_duration_seconds.labels(
                method=request.method,
                endpoint=endpoint,
            ).observe(duration)
            raise exc
