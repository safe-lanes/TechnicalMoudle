"""
New-pair admin notification (§4.1). DECISION (Ghazi, 10-Sep-2026): durable RECORDS
ONLY — no email transport. The admin console's pairs + notifications lists are the
stated mitigation for default-ON registration.
"""
from __future__ import annotations

from typing import Any

from . import db
from .config import settings


async def notify_new_pair(pair: dict[str, Any]) -> None:
    await db.insert_notification(
        "new_pair",
        {"tenantDomain": pair.get("tenant_domain"), "module": pair.get("module"),
         "firstSeen": str(pair.get("first_seen")), "adminContact": settings().assistant_admin_email},
        True,
        "recorded for admin console (email deliberately not used — 10-Sep-2026 decision)",
    )
