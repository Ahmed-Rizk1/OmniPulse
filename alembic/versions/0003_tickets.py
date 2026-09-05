"""0003_tickets

Revision ID: 0003_tickets
Revises: 0002_tenants_rls
Create Date: 2026-09-05 17:40:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "0003_tickets"
down_revision: Union[str, None] = "0002_tenants_rls"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create tickets table
    op.create_table(
        "tickets",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column(
            "tenant_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("subject", sa.String(length=255), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("source", sa.String(length=50), server_default="api", nullable=False),
        sa.Column("status", sa.String(length=50), server_default="pending", nullable=False),
        sa.Column("category", sa.String(length=100), nullable=True),
        sa.Column("confidence", sa.Float(), nullable=True),
        sa.Column("resolution", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("NOW()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("NOW()"),
            nullable=False,
        ),
    )

    # 2. Indexes
    op.create_index("ix_tickets_tenant_id", "tickets", ["tenant_id"])
    op.create_index("ix_tickets_status", "tickets", ["status"])
    op.create_index("idx_tickets_tenant_status", "tickets", ["tenant_id", "status"])

    # 3. Enable and force Row-Level Security
    op.execute("ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE tickets FORCE ROW LEVEL SECURITY;")

    # 4. Create tenant isolation policy
    op.execute(
        """
        CREATE POLICY tenant_isolation ON tickets
        FOR ALL
        USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
        WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
        """
    )

    # 5. Grant table permissions to application roles
    op.execute("GRANT ALL ON TABLE tickets TO authenticated, service_role, anon;")


def downgrade() -> None:
    op.execute("DROP POLICY IF EXISTS tenant_isolation ON tickets;")
    op.drop_index("idx_tickets_tenant_status", table_name="tickets")
    op.drop_index("ix_tickets_status", table_name="tickets")
    op.drop_index("ix_tickets_tenant_id", table_name="tickets")
    op.drop_table("tickets")
