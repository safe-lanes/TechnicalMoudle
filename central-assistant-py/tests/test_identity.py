"""Identity token — wire compatibility with the Node/TS implementations and the
skew rules (expired beyond leeway, future-dated beyond leeway, malformed, tampered)."""
import base64
import json
import time

from app.identity import sign_identity, verify_identity

KEY = "unit-test-key"
IDN = {"userId": "u1", "userName": "Unit Test", "role": "Sail Admin", "tenantDomain": "t1"}


def test_round_trip():
    v = verify_identity(sign_identity(IDN, KEY, 60), KEY)
    assert v.ok and v.identity["userId"] == "u1" and v.identity["role"] == "Sail Admin"


def test_missing_and_malformed():
    assert verify_identity(None, KEY).reason == "missing"
    assert verify_identity("", KEY).reason == "missing"
    assert verify_identity("nodot", KEY).reason == "malformed"


def test_tampered_signature_and_wrong_key():
    good = sign_identity(IDN, KEY, 60)
    dot = good.rfind(".")
    tampered = good[: dot - 3] + "AAA" + good[dot:]
    assert verify_identity(tampered, KEY).reason == "bad-signature"
    assert verify_identity(sign_identity(IDN, "other-key", 60), KEY).reason == "bad-signature"


def test_expired_beyond_leeway_rejected_but_within_leeway_accepted():
    assert verify_identity(sign_identity(IDN, KEY, -300), KEY).reason == "expired"
    assert verify_identity(sign_identity(IDN, KEY, -30), KEY).ok  # 90 s leeway


def test_future_dated_beyond_leeway_rejected():
    now = int(time.time())
    payload = {**IDN, "iat": now + 600, "exp": now + 660}
    body = base64.urlsafe_b64encode(json.dumps(payload, separators=(",", ":")).encode()).decode().rstrip("=")
    import hashlib
    import hmac
    mac = base64.urlsafe_b64encode(hmac.new(KEY.encode(), body.encode(), hashlib.sha256).digest()).decode().rstrip("=")
    assert verify_identity(f"{body}.{mac}", KEY).reason == "future-dated"


def test_node_minted_token_verifies_here():
    """A token minted by the Node implementation (identity.mjs, same key, same payload
    shape) must verify byte-for-byte. Fixture generated with:
       IDENTITY_SIGNING_KEY=unit-test-key node mint-token.mjs '{"userId":"u1","role":"Sail Admin"}' 3153600000
    (a 100-year TTL so the fixture never expires)."""
    node_token = NODE_FIXTURE
    v = verify_identity(node_token, KEY)
    assert v.ok, v.reason
    assert v.identity["userId"] == "u1"


NODE_FIXTURE = (
    "eyJ1c2VySWQiOiJ1MSIsInVzZXJOYW1lIjoiVW5pdCBUZXN0Iiwicm9sZSI6IlNhaWwgQWRtaW4iLCJ0ZW5hbnREb21haW4iOiJ0MSIsImlhdCI6MTc4OTExNzA4MCwiZXhwIjo0OTQyNzE3MDgwfQ"
    ".zeSU6jo1cFmbmgHqqVTJF7CEA-Me2jjRXvQbfIOHLa4"
)
