"""0002_tenants_rls

Revision ID: 0002_tenants_rls
Revises: 0001_baseline
Create Date: 2026-09-05 17:15:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "0002_tenants_rls"
down_revision: Union[str, None] = "0001_baseline"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create tenants table
    op.create_table(
        "tenants",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("name", sa.String(length=255), nullable=False, unique=True),
        sa.Column("api_key_hash", sa.String(length=255), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("NOW()"),
            nullable=False,
        ),
    )
    op.create_index("ix_tenants_name", "tenants", ["name"], unique=True)

    # 2. Enable and force Row-Level Security
    op.execute("ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE tenants FORCE ROW LEVEL SECURITY;")

    # 3. Create tenant isolation policy
    op.execute(
        """
        CREATE POLICY tenant_isolation ON tenants
        FOR ALL
        USING (id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
        WITH CHECK (id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
        """
    )

    # 4. Grant table permissions to application roles
    op.execute("GRANT ALL ON TABLE tenants TO authenticated, service_role, anon;")


def downgrade() -> None:
    op.execute("DROP POLICY IF EXISTS tenant_isolation ON tenants;")
    op.drop_index("ix_tenants_name", table_name="tenants")
    op.drop_table("tenants")
