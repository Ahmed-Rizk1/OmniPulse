import uuid
from sqlalchemy.ext.asyncio import AsyncSession
import structlog

from app.modules.tickets.models import Ticket
from app.modules.tickets.schemas import TicketOut, TicketWebhookPayload
from app.shared.database.rls import set_tenant_context

logger = structlog.get_logger("app.modules.tickets")


async def ingest_ticket(
    payload: TicketWebhookPayload,
    tenant_id: uuid.UUID,
    db: AsyncSession,
) -> TicketOut:
    """Ingests and persists a new ticket within the tenant's RLS boundary."""
    await set_tenant_context(db, tenant_id)

    ticket = Ticket(
        id=uuid.uuid4(),
        tenant_id=tenant_id,
        subject=payload.subject,
        body=payload.body,
        source=payload.source,
        status="pending",
    )
    db.add(ticket)
    await db.commit()
    await db.refresh(ticket)

    logger.info(
        "ticket_ingested",
        ticket_id=str(ticket.id),
        tenant_id=str(tenant_id),
        source=ticket.source,
    )

    return TicketOut(
        ticket_id=ticket.id,
        tenant_id=ticket.tenant_id,
        subject=ticket.subject,
        status=ticket.status,
        created_at=ticket.created_at,
    )
