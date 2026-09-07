"""0007_knowledge_and_channels

Revision ID: 0007_knowledge_and_channels
Revises: 0006_ticket_resolution
Create Date: 2026-09-07 16:30:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "0007_knowledge_and_channels"
down_revision: Union[str, None] = "0006_ticket_resolution"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. source_documents table
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS source_documents (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
            title VARCHAR(255) NOT NULL,
            file_type VARCHAR(50) NOT NULL,
            chunk_count INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        """
    )
    op.execute("CREATE INDEX IF NOT EXISTS idx_source_documents_tenant ON source_documents (tenant_id);")
    op.execute("ALTER TABLE source_documents ENABLE ROW LEVEL SECURITY;")
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_policies WHERE tablename = 'source_documents' AND policyname = 'source_documents_tenant_isolation'
            ) THEN
                CREATE POLICY source_documents_tenant_isolation ON source_documents
                FOR ALL TO authenticated
                USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
            END IF;
        END
        $$;
        """
    )

    # 2. document_chunks table
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS document_chunks (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
            document_id UUID NOT NULL REFERENCES source_documents(id) ON DELETE CASCADE,
            chunk_index INTEGER NOT NULL,
            content TEXT NOT NULL,
            embedding vector(768),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        """
    )
    op.execute("CREATE INDEX IF NOT EXISTS idx_document_chunks_tenant_doc ON document_chunks (tenant_id, document_id);")
    op.execute("ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;")
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_policies WHERE tablename = 'document_chunks' AND policyname = 'document_chunks_tenant_isolation'
            ) THEN
                CREATE POLICY document_chunks_tenant_isolation ON document_chunks
                FOR ALL TO authenticated
                USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
            END IF;
        END
        $$;
        """
    )

    # HNSW index for document chunk embeddings
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding_hnsw
        ON document_chunks USING hnsw (embedding vector_cosine_ops)
        WITH (m = 16, ef_construction = 64);
        """
    )

    # 3. channel_configs table
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS channel_configs (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
            channel_type VARCHAR(50) NOT NULL,
            verify_token VARCHAR(255),
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CONSTRAINT uq_tenant_channel UNIQUE (tenant_id, channel_type)
        );
        """
    )
    op.execute("CREATE INDEX IF NOT EXISTS idx_channel_configs_tenant ON channel_configs (tenant_id);")
    op.execute("ALTER TABLE channel_configs ENABLE ROW LEVEL SECURITY;")
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_policies WHERE tablename = 'channel_configs' AND policyname = 'channel_configs_tenant_isolation'
            ) THEN
                CREATE POLICY channel_configs_tenant_isolation ON channel_configs
                FOR ALL TO authenticated
                USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
            END IF;
        END
        $$;
        """
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS channel_configs CASCADE;")
    op.execute("DROP TABLE IF EXISTS document_chunks CASCADE;")
    op.execute("DROP TABLE IF EXISTS source_documents CASCADE;")
