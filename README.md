# OmniPulse

OmniPulse is a multi-tenant, event-driven customer support operations platform designed to automate ticket ingestion, semantic routing, and grounded resolution drafting.

The system combines an asynchronous message-passing pipeline with pgvector similarity search, strict tenant isolation via PostgreSQL Row-Level Security (RLS), and a two-tier resolution engine that routes tickets through low-latency classification before falling back to grounded retrieval-augmented generation (RAG).

---

## Architecture

The platform separates synchronous ingress from compute-heavy inference via a queue-backed consumer pipeline.

```
[ Inbound Channels ]
  - Webhook API (Email, WhatsApp, CRM)
          │
          ▼
[ Fast Ingress Service (FastAPI) ]
  - Payload validation & header tenant verification
  - Persists raw ticket under PostgreSQL RLS
          │
          ▼
[ Redis Streams (tickets:stream) ]
  - Native consumer groups with explicit ACK/NACK semantics
          │
          ▼
[ Asynchronous Worker (app.worker) ]
  - Loads tenant context & generates text embedding (Gemini REST)
          │
          ├─► [ Semantic Cache (Redis) ]
          │     - Cosine similarity >= 0.95
          │     - Sub-second cached resolution if matched
          │
          ├─► [ Tier 1: Fast Triage (Groq) ]
          │     - Low-latency classification & intent scoring
          │     - Resolves if confidence >= threshold (0.85)
          │
          ├─► [ Tier 2: Grounded RAG (pgvector + LLM) ]
          │     - Cosine distance retrieval against tenant documents
          │     - Fallback synthesis if similarity >= 0.60
          │
          └─► [ Human Escalation ]
                - Triggered on low confidence (<0.60) or incident classification
          │
          ▼
[ Outbound Dispatcher ]
  - Non-blocking notification dispatch (Email, WhatsApp)
          │
          ▼
[ PostgreSQL Storage ]
  - Resolution audit trail & state updates under session RLS
```

---

## Core Engineering Decisions

### 1. Session-Level Multi-Tenant Isolation
All core tables (`tenants`, `tickets`, `documents`, `document_chunks`, `ticket_events`) enforce PostgreSQL Row-Level Security (RLS). Every database session executes:

```sql
SET LOCAL app.current_tenant_id = :tenant_id;
```

This condition is evaluated by the database engine on every read, write, and index scan. Vector similarity searches against `document_chunks` inherit this constraint, preventing cross-tenant vector contamination during similarity retrieval.

### 2. Tiered Resolution Pipeline
To control inference cost and latency, incoming tickets pass through a two-stage evaluation:

- **Tier 1 (Fast Triage):** Tickets are first evaluated by a fast inference model (Groq) configured for strict schema output. If intent classification confidence meets or exceeds `0.85`, the ticket is classified or answered immediately without document retrieval.
- **Tier 2 (Grounded RAG):** Inquiries requiring policy or knowledge base references trigger an embedding lookup via Google Gemini (`text-embedding-004`). If matching chunks exceed a cosine similarity threshold of `0.60`, context is injected into a grounded generation prompt.

### 3. Semantic Caching
Before invoking LLM inference, the worker queries a Redis-backed semantic cache containing normalized query embeddings and prior resolutions. If a historical query matches the incoming text with a cosine similarity of `0.95` or higher, the cached resolution is applied instantly, eliminating redundant inference overhead.

### 4. Deterministic Guardrails & Human Escalation
Tickets are automatically routed to human operators (`escalated_human`) when:
- Model classification confidence falls below defined thresholds.
- No relevant knowledge chunks meet the minimum similarity cutoff.
- The triage classifier detects high-severity infrastructure incidents or critical billing issues.

Every state transition is recorded as an immutable entry in the `ticket_events` audit table.

### 5. Non-Blocking Outbound Dispatch
The outbound dispatcher isolates downstream communication adapters (Email, WhatsApp) behind an asynchronous interface. Delivery failures or API latency from third-party notification services do not block the primary consumer loop.

---

## Technology Stack

| Component | Implementation | Rationale |
|---|---|---|
| **Backend Framework** | Python 3.11+ / FastAPI | High-throughput asynchronous I/O and native Pydantic schema validation |
| **Relational Storage** | PostgreSQL + `pgvector` | Unified relational consistency and HNSW vector similarity search with native RLS |
| **ORM & Migrations** | SQLAlchemy (asyncpg) + Alembic | Transactional, fully async database operations and version-controlled migrations |
| **Queue & Streaming** | Redis 7 Streams | Native consumer groups (`XREADGROUP`, `XACK`, `XPENDING`) without Celery overhead |
| **Cache Layer** | Redis 7 | In-memory key-value caching and semantic similarity index |
| **Embeddings** | Google Gemini REST API | Zero-footprint async HTTP inference (`text-embedding-004`, 768 dimensions) |
| **LLM Inference** | Groq API | Low-latency inference for classification and synthesis |
| **Edge Routing** | Nginx (Alpine) | Reverse proxy, static asset delivery, and unified API gateway routing |
| **Observability** | Structured JSON (`structlog`) | Machine-readable log streams with tenant and correlation ID context propagation |

---

## Local Development & Setup

### Prerequisites
- Docker Engine 24.0+ and Docker Compose v2
- A Supabase PostgreSQL instance (or any Postgres 15+ instance with `pgvector` enabled)
- API credentials for Google Gemini (embeddings) and Groq (inference)

### Step 1: Clone Repository
```bash
git clone https://github.com/Ahmed-Rizk1/OmniPulse.git
cd OmniPulse
```

### Step 2: Configure Environment
Copy the configuration template and populate required variables:
```bash
cp .env.example .env
```

Ensure the following variables are configured in `.env`:
- `SUPABASE_DB_URL`: Postgres connection string (connection pooler port 6543 recommended).
- `GEMINI_API_KEY`: API key for embedding generation.
- `GROQ_API_KEY`: API key for triage and resolution inference.

### Step 3: Start Services
Start all containers in detached mode:
```bash
docker compose up --build -d
```

Verify service health:
```bash
docker compose ps
```

The stack provisions:
- `omnipulse_nginx`: Port 80 (Reverse proxy)
- `omnipulse_backend`: Port 8000 (API service)
- `omnipulse_worker`: Background stream processor
- `omnipulse_redis`: Port 6379 (Queue & Cache)
- `omnipulse_frontend`: Internal UI service

### Step 4: Run Database Migrations
Apply Alembic migrations to initialize tables and RLS policies:
```bash
docker compose exec backend alembic upgrade head
```

### Step 5: Verify Connectivity
Run a health check against the Nginx gateway:
```bash
curl -i http://localhost/health
```

Expected output:
```json
{
  "status": "ok",
  "db": "connected",
  "redis": "connected"
}
```

The web workspace is accessible at `http://localhost`.

---

## Core API Endpoints

### Health Check
- `GET /health`: Returns connectivity status for PostgreSQL and Redis.

### Tenant Management
- `POST /tenants/register`: Registers a tenant organization and generates credentials.

### Ingestion Webhooks
- `POST /webhooks/tickets`: Ingests support tickets under the verified tenant context (`X-Tenant-Id` header).
  ```json
  {
    "subject": "Unable to access workspace",
    "body": "Receiving 403 Forbidden error when logging into the dashboard.",
    "source": "email",
    "sender_email": "user@example.com"
  }
  ```

### Knowledge Base
- `POST /knowledge/documents`: Ingests and chunks source policy documents, generating embeddings for vector search.
- `GET /knowledge/documents`: Lists indexed knowledge sources for the active tenant.

---

## Security & Isolation Guarantees

- **No Shared Session State:** Database connections reset tenant context on release back to the connection pool.
- **Fail-Fast Startup:** The backend verifies environment variables on initialization; invalid or missing credentials prevent the service from binding to ports.
- **No Direct Tenant Cross-Talk:** All tenant identifiers are enforced via authenticated headers and validated against stored tenant hashes before execution.
