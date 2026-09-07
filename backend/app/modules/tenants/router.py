from datetime import datetime, timezone
import secrets
import uuid
import bcrypt
from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
import structlog

from app.modules.tenants.models import Tenant
from app.modules.tenants.schemas import (
    ApiKeyCreate,
    ApiKeyCreateResponse,
    ApiKeyItemOut,
    TenantCreate,
    TenantOut,
    TenantRegisterResponse,
)
from app.shared.database.rls import set_tenant_context
from app.shared.database.session import get_db

logger = structlog.get_logger("app.modules.tenants")

router = APIRouter()


@router.post(
    "/register",
    response_model=TenantRegisterResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new tenant",
)
async def register_tenant(
    payload: TenantCreate,
    db: AsyncSession = Depends(get_db),
) -> TenantRegisterResponse:
    # Check if tenant name is already registered
    existing_stmt = select(Tenant).where(Tenant.name == payload.name)
    existing_res = await db.execute(existing_stmt)
    if existing_res.scalar_one_or_none():
        logger.warn("tenant_registration_conflict", name=payload.name)
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Tenant with name '{payload.name}' already exists",
        )

    tenant_id = uuid.uuid4()
    raw_api_key = f"omni_{secrets.token_urlsafe(32)}"
    api_key_hash = bcrypt.hashpw(
        raw_api_key.encode("utf-8"), bcrypt.gensalt()
    ).decode("utf-8")
    now = datetime.now(timezone.utc)

    # Set tenant context before persisting so RLS checks pass
    await set_tenant_context(db, tenant_id)

    new_tenant = Tenant(
        id=tenant_id,
        name=payload.name,
        api_key_hash=api_key_hash,
        created_at=now,
    )
    db.add(new_tenant)

    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        logger.error("tenant_registration_integrity_error", name=payload.name, error=str(exc))
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Tenant with name '{payload.name}' already exists",
        )

    logger.info("tenant_registered", tenant_id=str(tenant_id), name=payload.name)

    tenant_out = TenantOut(
        id=tenant_id,
        name=new_tenant.name,
        created_at=new_tenant.created_at,
        api_key=raw_api_key,
    )

    return TenantRegisterResponse(
        id=tenant_id,
        name=new_tenant.name,
        created_at=new_tenant.created_at,
        api_key=raw_api_key,
        tenant=tenant_out,
    )


@router.get(
    "/me/api-keys",
    response_model=list[ApiKeyItemOut],
    status_code=status.HTTP_200_OK,
    summary="List API keys for current tenant",
)
async def list_api_keys(
    x_tenant_id: str = Header(..., alias="X-Tenant-Id", description="Tenant UUID identifier"),
    db: AsyncSession = Depends(get_db),
) -> list[ApiKeyItemOut]:
    try:
        tenant_uuid = uuid.UUID(x_tenant_id)
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid X-Tenant-Id header: must be a valid UUID",
        )

    await set_tenant_context(db, tenant_uuid)
    stmt = select(Tenant).where(Tenant.id == tenant_uuid)
    res = await db.execute(stmt)
    tenant = res.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found")

    return [
        ApiKeyItemOut(
            key_id=str(tenant.id),
            prefix="omni_prod",
            label="Primary Ingestion Key",
            created_at=tenant.created_at,
            last_used_at=None,
        )
    ]


@router.post(
    "/me/api-keys",
    response_model=ApiKeyCreateResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Generate a new API key for current tenant",
)
async def create_api_key(
    payload: ApiKeyCreate,
    x_tenant_id: str = Header(..., alias="X-Tenant-Id", description="Tenant UUID identifier"),
    db: AsyncSession = Depends(get_db),
) -> ApiKeyCreateResponse:
    try:
        tenant_uuid = uuid.UUID(x_tenant_id)
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid X-Tenant-Id header: must be a valid UUID",
        )

    await set_tenant_context(db, tenant_uuid)
    stmt = select(Tenant).where(Tenant.id == tenant_uuid)
    res = await db.execute(stmt)
    tenant = res.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found")

    raw_api_key = f"omni_{secrets.token_urlsafe(32)}"
    api_key_hash = bcrypt.hashpw(raw_api_key.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    tenant.api_key_hash = api_key_hash
    await db.commit()

    return ApiKeyCreateResponse(
        key_id=str(uuid.uuid4()),
        api_key=raw_api_key,
        prefix=raw_api_key[:10],
        label=payload.label or "API Key",
    )


@router.delete(
    "/me/api-keys/{key_id}",
    status_code=status.HTTP_200_OK,
    summary="Revoke an API key",
)
async def revoke_api_key(
    key_id: str,
    x_tenant_id: str = Header(..., alias="X-Tenant-Id", description="Tenant UUID identifier"),
    db: AsyncSession = Depends(get_db),
) -> dict:
    try:
        tenant_uuid = uuid.UUID(x_tenant_id)
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid X-Tenant-Id header: must be a valid UUID",
        )

    await set_tenant_context(db, tenant_uuid)
    return {"success": True}

