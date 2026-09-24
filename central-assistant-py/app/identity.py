"""
Signed forwarded identity — §5.3 of CHATBOT-CENTRAL-SERVICE-PLAN.md. Python port of
central-assistant/identity.mjs, BYTE-COMPATIBLE on the wire with the Node implementation
and with the module-side TS twin (server/modules/assistant-api/identityToken.ts):

  token   = b64url(JSON payload) + "." + b64url(HMAC-SHA256(payloadB64, key))
  payload = { userId, userName, role, vesselId?, tenantDomain, tuid?, iat, exp }

TTL is short (60 s) — a per-request assertion, not a session. Verification allows a
bounded clock-skew leeway BOTH ways (PROVEN 62 s skew between our own hosts): expiry
gets grace; a token future-dated beyond the leeway is rejected (anti-pre-mint).

The service only VERIFIES. Production minting is module-side and must source the role
from the module's real forwarded identity (req.rbac) — never a mock fallback.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time
from dataclasses import dataclass
from typing import Any


def _b64url_encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def _b64url_decode(s: str) -> bytes:
    pad = "=" * (-len(s) % 4)
    return base64.urlsafe_b64decode(s + pad)


def sign_identity(identity: dict[str, Any], key: str, ttl_sec: int = 60) -> str:
    """Test/tooling mint — same bytes Node's signIdentity produces for the same input."""
    if not key:
        raise ValueError("signing key required")
    now = int(time.time())
    payload = {**identity, "iat": now, "exp": now + ttl_sec}
    # Node: JSON.stringify → no spaces, key order as inserted. Python json.dumps with
    # separators=(",", ":") and ensure_ascii=False matches for the plain-ASCII payloads used.
    body = _b64url_encode(json.dumps(payload, separators=(",", ":"), ensure_ascii=False).encode("utf-8"))
    mac = hmac.new(key.encode("utf-8"), body.encode("ascii"), hashlib.sha256).digest()
    return f"{body}.{_b64url_encode(mac)}"


@dataclass(frozen=True)
class Verified:
    ok: bool
    identity: dict[str, Any] | None = None
    reason: str | None = None  # missing | malformed | bad-signature | expired | future-dated


def verify_identity(token: str | None, key: str, clock_leeway_sec: int = 90) -> Verified:
    if not token or not isinstance(token, str):
        return Verified(False, reason="missing")
    dot = token.rfind(".")
    if dot <= 0:
        return Verified(False, reason="malformed")
    body, mac = token[:dot], token[dot + 1:]
    expected = hmac.new(key.encode("utf-8"), body.encode("ascii"), hashlib.sha256).digest()
    try:
        given = _b64url_decode(mac)
    except Exception:
        return Verified(False, reason="malformed")
    if len(given) != len(expected) or not hmac.compare_digest(given, expected):
        return Verified(False, reason="bad-signature")
    try:
        identity = json.loads(_b64url_decode(body).decode("utf-8"))
    except Exception:
        return Verified(False, reason="malformed")
    if not isinstance(identity, dict):
        return Verified(False, reason="malformed")
    now = int(time.time())
    exp = identity.get("exp")
    iat = identity.get("iat")
    if not isinstance(exp, (int, float)) or exp + clock_leeway_sec < now:
        return Verified(False, reason="expired")
    if isinstance(iat, (int, float)) and iat - clock_leeway_sec > now:
        return Verified(False, reason="future-dated")
    if not identity.get("userId") or not identity.get("role"):
        return Verified(False, reason="malformed")
    return Verified(True, identity=identity)
