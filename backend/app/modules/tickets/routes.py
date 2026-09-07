"""Re-export ticket router components for compatibility with routes.py naming."""

from app.modules.tickets.router import (
    api_router,
    apply_reply,
    get_ticket,
    get_ticket_counts,
    get_ticket_events,
    list_tickets,
    router,
    update_ticket_status,
    webhook_tickets,
)

__all__ = [
    "router",
    "api_router",
    "webhook_tickets",
    "get_ticket_counts",
    "list_tickets",
    "get_ticket",
    "update_ticket_status",
    "apply_reply",
    "get_ticket_events",
]
