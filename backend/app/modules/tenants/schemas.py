from datetime import datetime
import uuid
from pydantic import BaseModel, ConfigDict, Field


class TenantCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, description="Tenant organization name")


class TenantOut(BaseModel):
    id: uuid.UUID
    name: str
    created_at: datetime
    api_key: str | None = None

    model_config = ConfigDict(from_attributes=True)


class TenantRegisterResponse(BaseModel):
    id: uuid.UUID
    name: str
    created_at: datetime
    api_key: str
    tenant: TenantOut

    model_config = ConfigDict(from_attributes=True)
