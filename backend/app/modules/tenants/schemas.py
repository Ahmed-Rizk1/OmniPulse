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


class TenantAuthRequest(BaseModel):
    tenant_name: str = Field(..., min_length=1, max_length=255)
    api_key: str = Field(..., min_length=1)


class TenantAuthResponse(BaseModel):
    tenant_id: str
    tenant_name: str


class ApiKeyCreate(BaseModel):
    label: str = Field(default="API Key", max_length=100)


class ApiKeyItemOut(BaseModel):
    key_id: str
    prefix: str
    label: str = "Primary Key"
    created_at: datetime
    last_used_at: datetime | None = None


class ApiKeyCreateResponse(BaseModel):
    key_id: str
    api_key: str
    prefix: str
    label: str
