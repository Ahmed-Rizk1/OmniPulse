"""0005_ticket_triage

Revision ID: 0005_ticket_triage
Revises: 0004_ticket_embeddings
Create Date: 2026-09-05 19:45:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "0005_ticket_triage"
down_revision: Union[str, None] = "0004_ticket_embeddings"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add triage fields to tickets table
    op.add_column(
        "tickets",
        sa.Column("priority", sa.String(length=50), nullable=True),
    )
    op.add_column(
        "tickets",
        sa.Column("summary", sa.Text(), nullable=True),
    )
    op.add_column(
        "tickets",
        sa.Column("triage_metadata", sa.JSON(), nullable=True),
    )

    # 2. Add index for ticket priority queries
    op.create_index("ix_tickets_priority", "tickets", ["priority"])


def downgrade() -> None:
    op.drop_index("ix_tickets_priority", table_name="tickets")
    op.drop_column("tickets", "triage_metadata")
    op.drop_column("tickets", "summary")
    op.drop_column("tickets", "priority")
