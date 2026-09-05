from datetime import datetime, timezone
import secrets
import uuid
import bcrypt
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
import structlog

from app.modules.tenants.models import Tenant
from app.modules.tenants.schemas import TenantCreate, TenantOut, TenantRegisterResponse
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
