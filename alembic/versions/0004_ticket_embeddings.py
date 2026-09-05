"""0004_ticket_embeddings

Revision ID: 0004_ticket_embeddings
Revises: 0003_tickets
Create Date: 2026-09-05 19:15:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from pgvector.sqlalchemy import Vector


# revision identifiers, used by Alembic.
revision: str = "0004_ticket_embeddings"
down_revision: Union[str, None] = "0003_tickets"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Ensure the pgvector extension is enabled
    op.execute("CREATE EXTENSION IF NOT EXISTS vector;")

    # 2. Add embedding column to tickets table
    op.add_column(
        "tickets",
        sa.Column("embedding", Vector(768), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("tickets", "embedding")
