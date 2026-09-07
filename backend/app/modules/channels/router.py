import uuid
from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
import structlog

from app.modules.channels.schemas import (
    ChannelsStatusOut,
    PatchResponse,
    WhatsAppPatchRequest,
)
from app.modules.channels.service import (
    get_channels_status,
    update_whatsapp_verify_token,
)
from app.shared.database.session import get_db

logger = structlog.get_logger("app.modules.channels.router")

router = APIRouter()


def _parse_tenant_id(x_tenant_id: str) -> uuid.UUID:
    try:
        return uuid.UUID(x_tenant_id)
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid X-Tenant-Id header: must be a valid UUID",
        )


@router.get(
    "",
    response_model=ChannelsStatusOut,
    status_code=status.HTTP_200_OK,
    summary="Get inbound channels status and webhook endpoints",
)
async def get_channels(
    x_tenant_id: str = Header(..., alias="X-Tenant-Id"),
    db: AsyncSession = Depends(get_db),
) -> ChannelsStatusOut:
    tenant_id = _parse_tenant_id(x_tenant_id)
    return await get_channels_status(tenant_id, db)


@router.patch(
    "/whatsapp",
    response_model=PatchResponse,
    status_code=status.HTTP_200_OK,
    summary="Update WhatsApp verify token",
)
async def patch_whatsapp(
    payload: WhatsAppPatchRequest,
    x_tenant_id: str = Header(..., alias="X-Tenant-Id"),
    db: AsyncSession = Depends(get_db),
) -> PatchResponse:
    tenant_id = _parse_tenant_id(x_tenant_id)
    success = await update_whatsapp_verify_token(tenant_id, payload.verify_token, db)
    return PatchResponse(success=success)
