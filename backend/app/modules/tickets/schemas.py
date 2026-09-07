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


class TicketTriageResult(BaseModel):
    category: str = Field(description="Category: billing, technical, account, feature_request, general")
    priority: str = Field(description="Priority: low, medium, high, critical")
    summary: str = Field(description="Concise 1-sentence summary of the ticket", max_length=300)
    suggested_action: str = Field(description="Recommended resolution or dispatch action")
    confidence: float = Field(default=0.9, ge=0.0, le=1.0, description="Confidence score (0.0 - 1.0)")
    reasoning: str | None = Field(default=None, description="Brief rationale for the triage result")
    needs_fallback: bool = Field(default=False, description="True if ticket requires Tier 2 RAG fallback")

    model_config = ConfigDict(extra="ignore")


class TicketResolutionResult(BaseModel):
    resolution_text: str = Field(description="Natural language resolution response draft")
    confidence: float = Field(default=0.85, ge=0.0, le=1.0, description="Confidence score (0.0 - 1.0)")
    cited_sources: list[str] = Field(default_factory=list, description="List of source tickets or knowledge references cited")
    status: Literal["resolved_tier2", "escalated_human"] = Field(
        default="resolved_tier2",
        description="Resulting resolution status",
    )

    model_config = ConfigDict(extra="ignore")


class TicketDetailOut(BaseModel):
    ticket_id: uuid.UUID
    tenant_id: uuid.UUID
    subject: str
    body: str
    source: str
    status: str
    category: str | None = None
    priority: str | None = None
    confidence: float | None = None
    summary: str | None = None
    resolution: str | None = None
    triage_result: TicketTriageResult | None = None
    resolution_result: TicketResolutionResult | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TicketCountsOut(BaseModel):
    all: int = 0
    new: int = 0
    open: int = 0
    pending: int = 0
    resolved: int = 0
    escalated: int = 0


class TicketStatusUpdate(BaseModel):
    status: str



