from datetime import datetime, timedelta, timezone
import uuid
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import structlog

from app.modules.channels.models import ChannelConfig
from app.modules.channels.schemas import (
    ChannelsStatusOut,
    EmailChannelInfo,
    WhatsAppChannelInfo,
)
from app.modules.tickets.models import Ticket
from app.shared.database.rls import set_tenant_context

logger = structlog.get_logger("app.modules.channels.service")


async def get_channels_status(
    tenant_id: uuid.UUID,
    db: AsyncSession,
) -> ChannelsStatusOut:
    """Returns the live connection status of inbound channels for the tenant."""
    await set_tenant_context(db, tenant_id)

    seven_days_ago = datetime.now(timezone.utc) - timedelta(days=7)

    # 1. Check email tickets in last 7 days
    stmt_email = select(Ticket.id).where(
        Ticket.tenant_id == tenant_id,
        Ticket.source == "email",
        Ticket.created_at >= seven_days_ago,
    ).limit(1)
    res_email = await db.execute(stmt_email)
    has_recent_email = res_email.scalar_one_or_none() is not None

    email_status = "connected" if has_recent_email else "ready"

    # 2. Check whatsapp tickets in last 7 days
    stmt_wa = select(Ticket.id).where(
        Ticket.tenant_id == tenant_id,
        Ticket.source == "whatsapp",
        Ticket.created_at >= seven_days_ago,
    ).limit(1)
    res_wa = await db.execute(stmt_wa)
    has_recent_wa = res_wa.scalar_one_or_none() is not None

    # 3. Check WhatsApp verify token in channel_configs
    stmt_cfg = select(ChannelConfig).where(
        ChannelConfig.tenant_id == tenant_id,
        ChannelConfig.channel_type == "whatsapp",
    )
    res_cfg = await db.execute(stmt_cfg)
    wa_config = res_cfg.scalar_one_or_none()
    has_verify_token = bool(wa_config and wa_config.verify_token)

    whatsapp_status = "connected" if has_recent_wa else "not_connected"

    return ChannelsStatusOut(
        email=EmailChannelInfo(
            status=email_status,
            webhook_url="/api/webhooks/tickets?source=email",
        ),
        whatsapp=WhatsAppChannelInfo(
            status=whatsapp_status,
            webhook_url="/api/webhooks/tickets?source=whatsapp",
            verify_token_set=has_verify_token,
        ),
    )


async def update_whatsapp_verify_token(
    tenant_id: uuid.UUID,
    verify_token: str,
    db: AsyncSession,
) -> bool:
    """Upserts WhatsApp verify token for the tenant."""
    await set_tenant_context(db, tenant_id)

    stmt = select(ChannelConfig).where(
        ChannelConfig.tenant_id == tenant_id,
        ChannelConfig.channel_type == "whatsapp",
    )
    res = await db.execute(stmt)
    config = res.scalar_one_or_none()

    if config:
        config.verify_token = verify_token
        config.updated_at = datetime.now(timezone.utc)
    else:
        config = ChannelConfig(
            id=uuid.uuid4(),
            tenant_id=tenant_id,
            channel_type="whatsapp",
            verify_token=verify_token,
            is_active=True,
        )
        db.add(config)

    await db.commit()
    logger.info(
        "whatsapp_verify_token_updated",
        tenant_id=str(tenant_id),
    )
    return True
