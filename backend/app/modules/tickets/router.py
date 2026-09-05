import uuid
from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
import structlog

from app.modules.tickets.schemas import TicketOut, TicketWebhookPayload
from app.modules.tickets.service import ingest_ticket
from app.shared.database.session import get_db

logger = structlog.get_logger("app.modules.tickets.router")

router = APIRouter()


@router.post(
    "/tickets",
    response_model=TicketOut,
    status_code=status.HTTP_200_OK,
    summary="Ingest support ticket via webhook",
)
async def webhook_tickets(
    payload: TicketWebhookPayload,
    x_tenant_id: str = Header(..., alias="X-Tenant-Id", description="Tenant UUID identifier"),
    db: AsyncSession = Depends(get_db),
) -> TicketOut:
    try:
        tenant_id = uuid.UUID(x_tenant_id)
    except (ValueError, TypeError):
        logger.warn("invalid_tenant_id_header", header=x_tenant_id)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid X-Tenant-Id header: must be a valid UUID",
        )

    try:
        ticket_out = await ingest_ticket(payload, tenant_id, db)
        return ticket_out
    except IntegrityError as exc:
        logger.error(
            "ticket_ingestion_integrity_error",
            tenant_id=str(tenant_id),
            error=str(exc),
        )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Tenant '{tenant_id}' does not exist or database constraint failed",
        )
