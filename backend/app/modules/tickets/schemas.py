from datetime import datetime
from typing import Literal
import uuid
from pydantic import BaseModel, ConfigDict, Field


class TicketWebhookPayload(BaseModel):
    subject: str = Field(..., min_length=1, max_length=255, description="Summary or subject of the support ticket")
    body: str = Field(..., min_length=1, description="Full content or description of the ticket issue")
    source: Literal["email", "chat", "api", "web"] = Field(
        default="api",
        description="Ingestion source of the ticket",
    )


class TicketOut(BaseModel):
    ticket_id: uuid.UUID
    tenant_id: uuid.UUID
    subject: str
    status: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
