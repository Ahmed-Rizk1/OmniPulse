from prometheus_client import Counter, Gauge, Histogram

# HTTP metrics
http_requests_total = Counter(
    "http_requests_total",
    "Total HTTP requests received by endpoint, method, and status code",
    ["method", "endpoint", "status"],
)

http_request_duration_seconds = Histogram(
    "http_request_duration_seconds",
    "HTTP request latency in seconds",
    ["method", "endpoint"],
    buckets=(0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0),
)

# Ticket Ingestion & Processing Metrics
tickets_ingested_total = Counter(
    "tickets_ingested_total",
    "Total customer support tickets ingested via webhook",
    ["tenant_id", "source"],
)

worker_tickets_processed_total = Counter(
    "worker_tickets_processed_total",
    "Total tickets processed by background workers by final status",
    ["tenant_id", "status"],
)

worker_processing_duration_seconds = Histogram(
    "worker_processing_duration_seconds",
    "Duration of ticket processing stages in background worker",
    ["stage"],
    buckets=(0.05, 0.1, 0.25, 0.5, 1.0, 2.0, 5.0, 10.0),
)

# Semantic Cache Metrics
semantic_cache_events_total = Counter(
    "semantic_cache_events_total",
    "Count of semantic cache lookup events (hit vs miss)",
    ["tenant_id", "result"],
)

queue_lag_total = Gauge(
    "queue_lag_total",
    "Estimated number of pending messages waiting in Redis Stream",
    ["stream"],
)
