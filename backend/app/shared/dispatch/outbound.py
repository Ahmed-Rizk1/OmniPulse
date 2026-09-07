import asyncio
from email.message import EmailMessage
import html
import os
import smtplib
from uuid import UUID

import httpx
import structlog

from app.config import settings

logger = structlog.get_logger("app.shared.dispatch.outbound")


def _get_setting(key: str, default: str | None = None) -> str | None:
    """Retrieve setting from app.config.settings or os.environ."""
    val = getattr(settings, key, None)
    if val is None:
        val = os.environ.get(key, default)
    return str(val).strip() if val is not None else None


class OutboundDispatcher:
    """Dispatches ticket resolution responses back to customers across communication channels."""

    @classmethod
    async def dispatch_resolution(
        cls,
        tenant_id: UUID,
        ticket_id: UUID,
        recipient: str,
        channel: str,
        subject: str,
        resolution_text: str,
    ) -> None:
        norm_channel = (channel or "api").strip().lower()

        if norm_channel == "email":
            await cls._dispatch_email(
                tenant_id=tenant_id,
                ticket_id=ticket_id,
                recipient=recipient,
                subject=subject,
                resolution_text=resolution_text,
            )
        elif norm_channel in ("whatsapp", "wa"):
            await cls._dispatch_whatsapp(
                tenant_id=tenant_id,
                ticket_id=ticket_id,
                recipient=recipient,
                subject=subject,
                resolution_text=resolution_text,
            )
        else:
            await cls._dispatch_webhook_fallback(
                tenant_id=tenant_id,
                ticket_id=ticket_id,
                recipient=recipient,
                channel=norm_channel,
                subject=subject,
                resolution_text=resolution_text,
            )

    @classmethod
    async def _dispatch_email(
        cls,
        tenant_id: UUID,
        ticket_id: UUID,
        recipient: str,
        subject: str,
        resolution_text: str,
    ) -> None:
        smtp_host = _get_setting("SMTP_HOST")
        smtp_port = _get_setting("SMTP_PORT", "587")
        smtp_user = _get_setting("SMTP_USER")
        smtp_password = _get_setting("SMTP_PASSWORD")

        has_credentials = bool(smtp_host and smtp_user and smtp_password)

        plain_text = (
            f"Hello,\n\n"
            f"Regarding your ticket '{subject}' (ID: {ticket_id}):\n\n"
            f"{resolution_text}\n\n"
            f"---\n"
            f"Best regards,\n"
            f"Customer Support Team\n"
            f"OmniPulse Platform"
        )

        escaped_text = html.escape(resolution_text).replace("\n", "<br/>")
        escaped_subject = html.escape(subject)
        html_content = (
            f"<!DOCTYPE html>"
            f"<html><head><meta charset='utf-8'>"
            f"<style>"
            f"body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; "
            f"line-height: 1.6; color: #1e293b; background-color: #f8fafc; margin: 0; padding: 24px; }}"
            f".card {{ max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; "
            f"border: 1px solid #e2e8f0; overflow: hidden; }}"
            f".header {{ background: #0f172a; color: #ffffff; padding: 18px 24px; font-size: 15px; font-weight: 600; }}"
            f".body {{ padding: 24px; font-size: 14px; }}"
            f".footer {{ padding: 14px 24px; background: #f1f5f9; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; }}"
            f"</style></head><body>"
            f"<div class='card'>"
            f"<div class='header'>Resolution: {escaped_subject}</div>"
            f"<div class='body'><p>{escaped_text}</p></div>"
            f"<div class='footer'>Ticket ID: {ticket_id} &bull; OmniPulse Multi-Tenant Support</div>"
            f"</div></body></html>"
        )

        if has_credentials:
            try:
                def _send_smtp() -> None:
                    msg = EmailMessage()
                    msg["Subject"] = f"Re: {subject}"
                    msg["From"] = smtp_user
                    msg["To"] = recipient
                    msg.set_content(plain_text)
                    msg.add_alternative(html_content, subtype="html")

                    port = int(smtp_port) if smtp_port else 587
                    if port == 465:
                        with smtplib.SMTP_SSL(smtp_host, port, timeout=10) as server:
                            server.login(smtp_user, smtp_password)
                            server.send_message(msg)
                    else:
                        with smtplib.SMTP(smtp_host, port, timeout=10) as server:
                            server.starttls()
                            server.login(smtp_user, smtp_password)
                            server.send_message(msg)

                await asyncio.to_thread(_send_smtp)
            except Exception as exc:
                logger.error(
                    "outbound_email_send_failed",
                    tenant_id=str(tenant_id),
                    ticket_id=str(ticket_id),
                    recipient=recipient,
                    error=str(exc),
                )
                raise

        logger.info(
            "outbound_email_dispatched",
            tenant_id=str(tenant_id),
            ticket_id=str(ticket_id),
            recipient=recipient,
            channel="email",
            subject=subject,
            live_sent=has_credentials,
        )

    @classmethod
    async def _dispatch_whatsapp(
        cls,
        tenant_id: UUID,
        ticket_id: UUID,
        recipient: str,
        subject: str,
        resolution_text: str,
    ) -> None:
        meta_token = _get_setting("META_WHATSAPP_TOKEN")
        meta_phone_id = _get_setting("META_PHONE_NUMBER_ID")

        has_credentials = bool(meta_token and meta_phone_id)

        if has_credentials:
            url = f"https://graph.facebook.com/v20.0/{meta_phone_id}/messages"
            headers = {
                "Authorization": f"Bearer {meta_token}",
                "Content-Type": "application/json",
            }
            body = {
                "messaging_product": "whatsapp",
                "recipient_type": "individual",
                "to": recipient,
                "type": "text",
                "text": {
                    "preview_url": False,
                    "body": f"*{subject}*\n\n{resolution_text}",
                },
            }
            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    resp = await client.post(url, headers=headers, json=body)
                    resp.raise_for_status()
            except Exception as exc:
                logger.error(
                    "outbound_whatsapp_send_failed",
                    tenant_id=str(tenant_id),
                    ticket_id=str(ticket_id),
                    recipient=recipient,
                    error=str(exc),
                )
                raise

        logger.info(
            "outbound_whatsapp_dispatched",
            tenant_id=str(tenant_id),
            ticket_id=str(ticket_id),
            recipient=recipient,
            channel="whatsapp",
            subject=subject,
            live_sent=has_credentials,
        )

    @classmethod
    async def _dispatch_webhook_fallback(
        cls,
        tenant_id: UUID,
        ticket_id: UUID,
        recipient: str,
        channel: str,
        subject: str,
        resolution_text: str,
    ) -> None:
        logger.info(
            "outbound_webhook_dispatched",
            tenant_id=str(tenant_id),
            ticket_id=str(ticket_id),
            recipient=recipient,
            channel=channel,
            subject=subject,
            resolution_text=resolution_text,
        )
