from pydantic import BaseModel, Field


class EmailChannelInfo(BaseModel):
    status: str = Field(description="Channel status: connected | ready")
    webhook_url: str = Field(description="Ingestion webhook endpoint")


class WhatsAppChannelInfo(BaseModel):
    status: str = Field(description="Channel status: connected | not_connected")
    webhook_url: str = Field(description="WhatsApp webhook endpoint")
    verify_token_set: bool = Field(default=False, description="Whether verify token is configured")


class ChannelsStatusOut(BaseModel):
    email: EmailChannelInfo
    whatsapp: WhatsAppChannelInfo


class WhatsAppPatchRequest(BaseModel):
    verify_token: str = Field(..., min_length=1, max_length=255)


class PatchResponse(BaseModel):
    success: bool
