from datetime import datetime, timezone
import re
import uuid
from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
import structlog

from app.modules.tickets.models import Ticket
from app.modules.tickets.schemas import (
    TicketApplyReplyPayload,
    TicketCountsOut,
    TicketDetailOut,
    TicketOut,
    TicketResolutionResult,
    TicketStatusUpdate,
    TicketTriageResult,
    TicketWebhookPayload,
)
from app.modules.tickets.service import ingest_ticket
from app.shared.database.rls import set_tenant_context
from app.shared.database.session import get_db
from app.shared.dispatch.outbound import OutboundDispatcher


logger = structlog.get_logger("app.modules.tickets.router")

router = APIRouter()
api_router = APIRouter()


def _build_ticket_detail(ticket: Ticket) -> TicketDetailOut:
    triage_result = None
    if ticket.category or ticket.priority or ticket.summary:
        triage_result = TicketTriageResult(
            category=ticket.category or "general",
            priority=ticket.priority or "medium",
            summary=ticket.summary or ticket.subject,
            suggested_action=ticket.resolution or "Review ticket",
            confidence=ticket.confidence if ticket.confidence is not None else 0.85,
            reasoning=None,
            needs_fallback=False,
        )
    elif ticket.triage_metadata:
        try:
            triage_result = TicketTriageResult(**ticket.triage_metadata)
        except Exception:
            pass

    resolution_result = None
    if ticket.resolution:
        cited = (
            ticket.resolution_metadata.get("cited_sources")
            if isinstance(ticket.resolution_metadata, dict)
            else []
        ) or []
        res_status = (
            ticket.status
            if ticket.status in ("resolved_tier2", "escalated_human")
            else "resolved_tier2"
        )
        resolution_result = TicketResolutionResult(
            resolution_text=ticket.resolution,
            confidence=ticket.confidence if ticket.confidence is not None else 0.85,
            cited_sources=cited,
            status=res_status,
        )
    elif ticket.resolution_metadata and isinstance(ticket.resolution_metadata, dict):
        try:
            resolution_result = TicketResolutionResult(**ticket.resolution_metadata)
        except Exception:
            pass

    return TicketDetailOut(
        ticket_id=ticket.id,
        tenant_id=ticket.tenant_id,
        subject=ticket.subject,
        body=ticket.body,
        source=ticket.source,
        status=ticket.status,
        category=ticket.category,
        priority=ticket.priority,
        confidence=ticket.confidence,
        summary=ticket.summary,
        resolution=ticket.resolution,
        triage_result=triage_result,
        resolution_result=resolution_result,
        created_at=ticket.created_at,
        updated_at=ticket.updated_at,
    )


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


@api_router.get(
    "/counts",
    response_model=TicketCountsOut,
    status_code=status.HTTP_200_OK,
    summary="Get aggregated ticket counts by view status",
)
async def get_ticket_counts(
    x_tenant_id: str = Header(..., alias="X-Tenant-Id"),
    db: AsyncSession = Depends(get_db),
) -> TicketCountsOut:
    try:
        tenant_uuid = uuid.UUID(x_tenant_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Invalid X-Tenant-Id header")

    await set_tenant_context(db, tenant_uuid)
    stmt = select(Ticket.status).where(Ticket.tenant_id == tenant_uuid)
    result = await db.execute(stmt)
    statuses = [r[0] for r in result.all()]

    all_count = len(statuses)
    new_count = sum(1 for s in statuses if s in ("new", "pending"))
    open_count = sum(1 for s in statuses if s in ("open", "processing"))
    pending_count = sum(1 for s in statuses if s == "pending")
    resolved_count = sum(1 for s in statuses if "resolved" in s)
    escalated_count = sum(1 for s in statuses if "escalated" in s)

    return TicketCountsOut(
        all=all_count,
        new=new_count,
        open=open_count,
        pending=pending_count,
        resolved=resolved_count,
        escalated=escalated_count,
    )


@api_router.get(
    "",
    response_model=list[TicketDetailOut],
    status_code=status.HTTP_200_OK,
    summary="List tickets with filtering and pagination",
)
async def list_tickets(
    view: str | None = Query(None, description="View filter: all, new, open, pending, resolved, escalated"),
    status: str | None = Query(None, description="Status filter"),
    category: str | None = Query(None, description="Category filter"),
    priority: str | None = Query(None, description="Priority filter"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    x_tenant_id: str = Header(..., alias="X-Tenant-Id"),
    db: AsyncSession = Depends(get_db),
) -> list[TicketDetailOut]:
    try:
        tenant_uuid = uuid.UUID(x_tenant_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Invalid X-Tenant-Id header")

    await set_tenant_context(db, tenant_uuid)
    query = select(Ticket).where(Ticket.tenant_id == tenant_uuid)

    active_status = status or view
    if active_status and active_status != "all":
        if active_status == "new":
            query = query.where(Ticket.status.in_(["new", "pending"]))
        elif active_status == "open":
            query = query.where(Ticket.status.in_(["open", "processing"]))
        elif active_status == "resolved":
            query = query.where(Ticket.status.like("resolved%"))
        elif active_status == "escalated":
            query = query.where(Ticket.status.like("escalated%"))
        else:
            query = query.where(Ticket.status == active_status)

    if category:
        query = query.where(Ticket.category == category)
    if priority:
        query = query.where(Ticket.priority == priority)

    query = query.order_by(Ticket.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    tickets = result.scalars().all()

    return [_build_ticket_detail(t) for t in tickets]


@api_router.get(
    "/{ticket_id}",
    response_model=TicketDetailOut,
    status_code=status.HTTP_200_OK,
    summary="Get single ticket detail",
)
async def get_ticket(
    ticket_id: uuid.UUID,
    x_tenant_id: str = Header(..., alias="X-Tenant-Id"),
    db: AsyncSession = Depends(get_db),
) -> TicketDetailOut:
    try:
        tenant_uuid = uuid.UUID(x_tenant_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Invalid X-Tenant-Id header")

    await set_tenant_context(db, tenant_uuid)
    stmt = select(Ticket).where(Ticket.id == ticket_id, Ticket.tenant_id == tenant_uuid)
    res = await db.execute(stmt)
    ticket = res.scalar_one_or_none()
    if not ticket:
        raise HTTPException(status_code=404, detail=f"Ticket '{ticket_id}' not found")

    return _build_ticket_detail(ticket)


def _extract_recipient(ticket: Ticket, override: str | None = None) -> str:
    if override and override.strip():
        return override.strip()

    if ticket.resolution_metadata and isinstance(ticket.resolution_metadata, dict):
        recipient = ticket.resolution_metadata.get("recipient")
        if recipient:
            return str(recipient).strip()

    if ticket.triage_metadata and isinstance(ticket.triage_metadata, dict):
        for key in ("customer_email", "sender", "recipient", "from", "phone_number"):
            val = ticket.triage_metadata.get(key)
            if val:
                return str(val).strip()

    email_match = re.search(r"[\w\.-]+@[\w\.-]+\.\w+", ticket.body)
    if email_match:
        return email_match.group(0)

    source = (ticket.source or "api").lower()
    if source == "email":
        return "customer@example.com"
    elif source in ("whatsapp", "wa"):
        return "+15550100"
    return "customer@api.omnipulse.local"


async def _dispatch_ticket_resolution(
    ticket: Ticket,
    tenant_id: uuid.UUID,
    db: AsyncSession,
    resolution_text: str | None = None,
    recipient: str | None = None,
) -> None:
    final_text = (
        resolution_text
        or ticket.resolution
        or (ticket.triage_metadata or {}).get("suggested_resolution_draft")
        or ticket.subject
    )
    final_recipient = _extract_recipient(ticket, recipient)

    # 1. Dispatch outbound via appropriate channel adapter
    await OutboundDispatcher.dispatch_resolution(
        tenant_id=tenant_id,
        ticket_id=ticket.id,
        recipient=final_recipient,
        channel=ticket.source,
        subject=ticket.subject,
        resolution_text=final_text,
    )

    # 2. Update ticket resolution text if passed
    if resolution_text:
        ticket.resolution = resolution_text

    # 3. Record entry in ticket_events with event type response_dispatched
    meta = dict(ticket.resolution_metadata or {})
    events = list(meta.get("events", []))
    events.append({
        "id": f"evt-{ticket.id}-dispatch-{len(events) + 1}",
        "type": "response_dispatched",
        "message": f"Resolution dispatched to customer via {ticket.source}",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "channel": ticket.source,
        "recipient": final_recipient,
    })
    meta["events"] = events
    meta["recipient"] = final_recipient
    ticket.resolution_metadata = meta


@api_router.patch(
    "/{ticket_id}/status",
    response_model=TicketDetailOut,
    status_code=status.HTTP_200_OK,
    summary="Update ticket status",
)
async def update_ticket_status(
    ticket_id: uuid.UUID,
    payload: TicketStatusUpdate,
    x_tenant_id: str = Header(..., alias="X-Tenant-Id"),
    db: AsyncSession = Depends(get_db),
) -> TicketDetailOut:
    try:
        tenant_uuid = uuid.UUID(x_tenant_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Invalid X-Tenant-Id header")

    await set_tenant_context(db, tenant_uuid)
    stmt = select(Ticket).where(Ticket.id == ticket_id, Ticket.tenant_id == tenant_uuid)
    res = await db.execute(stmt)
    ticket = res.scalar_one_or_none()
    if not ticket:
        raise HTTPException(status_code=404, detail=f"Ticket '{ticket_id}' not found")

    old_status = ticket.status
    ticket.status = payload.status

    # Trigger outbound dispatch on transition to resolved status
    if "resolved" in payload.status.lower() and "resolved" not in (old_status or "").lower():
        await _dispatch_ticket_resolution(
            ticket=ticket,
            tenant_id=tenant_uuid,
            db=db,
        )

    await db.commit()
    await db.refresh(ticket)
    return _build_ticket_detail(ticket)


@api_router.post(
    "/{ticket_id}/apply-reply",
    response_model=TicketDetailOut,
    status_code=status.HTTP_200_OK,
    summary="Apply resolution draft as customer reply and dispatch outbound",
)
async def apply_reply(
    ticket_id: uuid.UUID,
    payload: TicketApplyReplyPayload = TicketApplyReplyPayload(),
    x_tenant_id: str = Header(..., alias="X-Tenant-Id"),
    db: AsyncSession = Depends(get_db),
) -> TicketDetailOut:
    try:
        tenant_uuid = uuid.UUID(x_tenant_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Invalid X-Tenant-Id header")

    await set_tenant_context(db, tenant_uuid)
    stmt = select(Ticket).where(Ticket.id == ticket_id, Ticket.tenant_id == tenant_uuid)
    res = await db.execute(stmt)
    ticket = res.scalar_one_or_none()
    if not ticket:
        raise HTTPException(status_code=404, detail=f"Ticket '{ticket_id}' not found")

    ticket.status = payload.status or "resolved"

    await _dispatch_ticket_resolution(
        ticket=ticket,
        tenant_id=tenant_uuid,
        db=db,
        resolution_text=payload.resolution_text,
        recipient=payload.recipient,
    )

    await db.commit()
    await db.refresh(ticket)
    return _build_ticket_detail(ticket)


@api_router.get(
    "/{ticket_id}/events",
    status_code=status.HTTP_200_OK,
    summary="Get ticket activity events",
)
async def get_ticket_events(
    ticket_id: uuid.UUID,
    x_tenant_id: str = Header(..., alias="X-Tenant-Id"),
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    try:
        tenant_uuid = uuid.UUID(x_tenant_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Invalid X-Tenant-Id header")

    await set_tenant_context(db, tenant_uuid)
    stmt = select(Ticket).where(Ticket.id == ticket_id, Ticket.tenant_id == tenant_uuid)
    res = await db.execute(stmt)
    ticket = res.scalar_one_or_none()
    if not ticket:
        raise HTTPException(status_code=404, detail=f"Ticket '{ticket_id}' not found")

    events = [
        {
            "id": f"evt-{ticket.id}-1",
            "type": "ingested",
            "message": f"Ticket received via {ticket.source}",
            "timestamp": ticket.created_at.isoformat(),
        }
    ]
    if ticket.confidence is not None:
        events.append(
            {
                "id": f"evt-{ticket.id}-2",
                "type": "triaged",
                "message": f"AI Triage completed (Confidence: {int(ticket.confidence * 100)}%)",
                "timestamp": ticket.updated_at.isoformat(),
            }
        )
    if "resolved" in ticket.status or "escalated" in ticket.status:
        events.append(
            {
                "id": f"evt-{ticket.id}-3",
                "type": "status_changed",
                "message": f"Status changed to {ticket.status}",
                "timestamp": ticket.updated_at.isoformat(),
            }
        )

    # Include any stored events from resolution_metadata (e.g. response_dispatched)
    dispatched_found = False
    if ticket.resolution_metadata and isinstance(ticket.resolution_metadata, dict):
        custom_events = ticket.resolution_metadata.get("events", [])
        if isinstance(custom_events, list):
            for evt in custom_events:
                events.append(evt)
                if evt.get("type") == "response_dispatched":
                    dispatched_found = True

    # Ensure response_dispatched event is present if ticket is marked resolved
    if "resolved" in ticket.status and not dispatched_found:
        events.append(
            {
                "id": f"evt-{ticket.id}-dispatched",
                "type": "response_dispatched",
                "message": f"Resolution dispatched to customer via {ticket.source}",
                "timestamp": ticket.updated_at.isoformat(),
            }
        )

    return events


