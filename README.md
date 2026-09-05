# OmniPulse — High-Performance Multi-Tenant AI Platform

OmniPulse is an enterprise-grade, multi-tenant AI-assisted ticket-handling SaaS platform designed for high throughput, strict tenant isolation, and low-latency automated ticket processing.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Backend** | Python 3.12 + FastAPI (Async) |
| **Database** | Supabase PostgreSQL (with `pgvector` & Row-Level Security) |
| **Migrations** | SQLAlchemy 2.0 (Async) + Alembic |
| **Queue / Cache** | Redis 7 (Redis Streams + Semantic Caching) |
| **Reverse Proxy** | Nginx (Alpine) |
| **Containerization** | Docker Compose |

---

## Architectural Principles

1. **Strict Multi-Tenancy & Data Isolation**:
   - PostgreSQL Row-Level Security (RLS) is enabled and forced on all tenant-scoped tables (`tenants`, `tickets`, etc.).
   - Every database transaction executes `set_tenant_context()` to enforce session-scoped isolation (`SET LOCAL app.current_tenant_id = :tenant_id`).
   - Cross-tenant data leakage is structurally impossible at the database engine level.

2. **Modular Monolith & Vertical Slices**:
   - Domain logic is organized into self-contained vertical slices (`modules/tenants`, `modules/tickets`, etc.).
   - Reusable infrastructure utilities reside strictly under `shared/` (`shared/database`, `shared/config`).

3. **Production-Ready Observability**:
   - Structured JSON logging via `structlog` without standard output formatting pollution.
   - Comprehensive async health checks verifying PostgreSQL and Redis connectivity.

---

## Implemented Scope (Slices 01 – 03)

- **Slice 01: Foundation & Container Shell**
  - Containerized infrastructure orchestrating `backend`, `redis`, and `nginx`.
  - Fail-fast configuration module powered by `pydantic-settings`.
  - Async SQLAlchemy connection pooling optimized for Supabase transaction pooler.
  - Health check endpoint at `GET /health`.
  - Initial baseline Alembic migration (`0001_baseline`).

- **Slice 02: Multi-Tenant Architecture & Strict PostgreSQL RLS**
  - Tenant registration endpoint (`POST /tenants/register`).
  - Secure API key generation with `bcrypt` password hashing.
  - PostgreSQL Row-Level Security policy (`tenant_isolation`) enforced via `0002_tenants_rls`.

- **Slice 03: Ticket Ingestion Webhook**
  - Support ticket webhook endpoint (`POST /webhooks/tickets`).
  - Payload validation with Pydantic (`TicketWebhookPayload`).
  - Strict header-based tenant verification via `X-Tenant-Id`.
  - Persisted tickets table under tenant RLS via `0003_tickets`.

---

## Quickstart

### 1. Configure Environment Variables
Copy the environment template and populate your Supabase connection string:
```bash
cp .env.example .env
```

### 2. Spin Up Services
Build and start the multi-container stack:
```bash
docker compose up -d --build
```

### 3. Run Database Migrations
Apply Alembic migrations to Supabase PostgreSQL:
```bash
docker compose exec backend alembic upgrade head
```

Verify migration status:
```bash
docker compose exec backend alembic current
```

### 4. Health Verification
Query the health check endpoint through the Nginx reverse proxy:
```bash
curl.exe -i http://localhost/health
```

Expected response (`200 OK`):
```json
{
  "status": "ok",
  "db": "connected",
  "redis": "connected"
}
```

---

## API Endpoints (Current Baseline)

### Health Check
- `GET /health` — Returns status of backend, PostgreSQL pooler, and Redis.

### Tenants
- `POST /tenants/register` — Register a new tenant organization.
  ```json
  {
    "name": "AcmeCorp"
  }
  ```

### Webhooks
- `POST /webhooks/tickets` — Ingest support ticket under tenant context.
  - Header: `X-Tenant-Id: <TENANT_UUID>`
  ```json
  {
    "subject": "Payment failed",
    "body": "Card declined during subscription renewal",
    "source": "api"
  }
  ```
