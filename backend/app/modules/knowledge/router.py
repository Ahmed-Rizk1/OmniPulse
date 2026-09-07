import uuid
from fastapi import APIRouter, Depends, File, Header, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession
import structlog

from app.modules.knowledge.schemas import (
    DeleteDocResponse,
    DocumentUploadOut,
    KnowledgeDocumentOut,
)
from app.modules.knowledge.service import (
    delete_document,
    list_documents,
    upload_and_process_document,
)
from app.shared.database.session import get_db

logger = structlog.get_logger("app.modules.knowledge.router")

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
    "/documents",
    response_model=list[KnowledgeDocumentOut],
    status_code=status.HTTP_200_OK,
    summary="List all knowledge documents for tenant",
)
async def get_documents(
    x_tenant_id: str = Header(..., alias="X-Tenant-Id"),
    db: AsyncSession = Depends(get_db),
) -> list[KnowledgeDocumentOut]:
    tenant_id = _parse_tenant_id(x_tenant_id)
    return await list_documents(tenant_id, db)


@router.post(
    "/documents",
    response_model=DocumentUploadOut,
    status_code=status.HTTP_201_CREATED,
    summary="Upload and vectorize document",
)
async def upload_document(
    file: UploadFile = File(...),
    x_tenant_id: str = Header(..., alias="X-Tenant-Id"),
    db: AsyncSession = Depends(get_db),
) -> DocumentUploadOut:
    tenant_id = _parse_tenant_id(x_tenant_id)
    return await upload_and_process_document(file, tenant_id, db)


@router.delete(
    "/documents/{doc_id}",
    response_model=DeleteDocResponse,
    status_code=status.HTTP_200_OK,
    summary="Delete document and all associated embeddings",
)
async def remove_document(
    doc_id: uuid.UUID,
    x_tenant_id: str = Header(..., alias="X-Tenant-Id"),
    db: AsyncSession = Depends(get_db),
) -> DeleteDocResponse:
    tenant_id = _parse_tenant_id(x_tenant_id)
    success = await delete_document(doc_id, tenant_id, db)
    return DeleteDocResponse(success=success)
