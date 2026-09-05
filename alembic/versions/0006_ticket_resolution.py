"""0006_ticket_resolution

Revision ID: 0006_ticket_resolution
Revises: 0005_ticket_triage
Create Date: 2026-09-05 20:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "0006_ticket_resolution"
down_revision: Union[str, None] = "0005_ticket_triage"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Ensure resolution column exists on tickets table
    op.execute("ALTER TABLE tickets ADD COLUMN IF NOT EXISTS resolution TEXT;")

    # 2. Add resolution_metadata JSON column
    op.execute("ALTER TABLE tickets ADD COLUMN IF NOT EXISTS resolution_metadata JSONB;")

    # 3. Create HNSW vector index for pgvector cosine distance operations
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_tickets_embedding_hnsw
        ON tickets USING hnsw (embedding vector_cosine_ops)
        WITH (m = 16, ef_construction = 64);
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_tickets_embedding_hnsw;")
    op.execute("ALTER TABLE tickets DROP COLUMN IF EXISTS resolution_metadata;")
