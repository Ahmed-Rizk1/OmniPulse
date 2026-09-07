from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, ConfigDict


class KnowledgeDocumentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    doc_id: UUID
    title: str
    file_type: str
    chunk_count: int
    created_at: datetime


class DocumentUploadOut(BaseModel):
    doc_id: UUID
    title: str
    chunk_count: int


class DeleteDocResponse(BaseModel):
    success: bool
