from uuid import UUID
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


async def set_tenant_context(session: AsyncSession, tenant_id: str | UUID) -> None:
    """Sets PostgreSQL session-level variable app.current_tenant_id for RLS isolation.

    Switches to 'authenticated' role to enforce Row-Level Security without BYPASSRLS,
    and sets transaction-scoped app.current_tenant_id.
    """
    valid_uuid = UUID(str(tenant_id))
    await session.execute(text("SET LOCAL ROLE authenticated;"))
    await session.execute(text(f"SET LOCAL app.current_tenant_id = '{valid_uuid}';"))
