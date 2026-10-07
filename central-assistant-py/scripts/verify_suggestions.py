"""TRACKED pilot harness (7-Oct-2026): every starter question in app/suggestions_catalog.json, asked on a PILOT assistant.

For each module: GET /suggestions?module=<m> must return only that module's catalog questions; then each served question
is asked through POST /chat with context.module=<m> and must come back gate=answer with a citation from the catalog's
own manual file (same module). A question that fails is reported FAIL — remove it from the catalog before release.

The identity is a MOCK identity signed with a PILOT-ONLY instance key read from an env file (never printed):
  KEY_ENV   env file holding ASSISTANT_IDENTITY_SIGNING_KEY (default local-test-env/.env.shore.example)
  ISSUER    registered pilot issuer for that key (default technical-pilotlocal)
  ASSISTANT pilot assistant base URL (default http://127.0.0.1:18061 — an SSH tunnel to the test container)
Usage: python central-assistant-py/scripts/verify_suggestions.py [module ...]
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
KEY_ENV = Path(os.environ.get("KEY_ENV", "C:/Users/GhaziAnwer/TechnicalMoudle/local-test-env/.env.shore.example"))
ISSUER = os.environ.get("ISSUER", "technical-pilotlocal")
ASSISTANT = os.environ.get("ASSISTANT", "http://127.0.0.1:18061").rstrip("/")
LABELS = {"technical": "Technical", "crewing": "Crewing", "audit": "Audit", "safety": "Safety", "incident": "Incident"}


def signing_key() -> str:
    for line in KEY_ENV.read_text(encoding="utf-8").splitlines():
        if line.startswith("ASSISTANT_IDENTITY_SIGNING_KEY="):
            return line.split("=", 1)[1].split(" #")[0].strip().strip('"')
    raise SystemExit(f"no ASSISTANT_IDENTITY_SIGNING_KEY in {KEY_ENV}")


def b64(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode().rstrip("=")


def token(key: str) -> str:
    now = int(time.time())
    payload = {"userId": "widget-verify", "userName": "Widget Verify (MOCK)", "role": "Sail Admin",
               "tenantDomain": "widget-test-verify", "iss": ISSUER, "iat": now, "exp": now + 60}
    body = b64(json.dumps(payload, separators=(",", ":")).encode())
    return f"{body}.{b64(hmac.new(key.encode(), body.encode(), hashlib.sha256).digest())}"


def call(method: str, path: str, key: str, body: dict | None = None) -> tuple[int, dict]:
    req = urllib.request.Request(f"{ASSISTANT}{path}", method=method, data=json.dumps(body).encode() if body else None,
                                 headers={"x-assistant-identity": token(key), "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=90) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, {"error": e.read().decode()[:200]}


def main() -> int:
    key = signing_key()
    catalog = {m: v for m, v in json.loads((ROOT / "app/suggestions_catalog.json").read_text(encoding="utf-8")).items()
               if not m.startswith("_")}
    modules = sys.argv[1:] or list(catalog)
    fails = 0
    for m in modules:
        st, sug = call("GET", f"/suggestions?module={urllib.parse.quote(m)}", key)
        served = sug.get("questions", []) if st == 200 else []
        expected = [i["question"] for i in catalog[m]][:6]
        ok = st == 200 and sug.get("module") == m and served and set(served) <= set(expected)
        print(f"{'PASS' if ok else 'FAIL'}  suggestions {m}: HTTP {st}, {len(served)} served of {len(catalog[m])} in catalog")
        fails += 0 if ok else 1
        for q in served:
            entry = next(i for i in catalog[m] if i["question"] == q)
            stem = re.sub(r"\.(pdf|docx|html|md)$", "", entry["file"], flags=re.I)
            st, r = call("POST", "/chat", key, {"message": q, "conversationHistory": [], "context": {"module": m}})
            cites = r.get("citations") or []
            own = [c for c in cites if c.get("module") == LABELS[m]]
            from_file = [c for c in own if c.get("manual") == stem]
            ok = st == 200 and r.get("gate") == "answer" and bool(from_file)
            fails += 0 if ok else 1
            print(f"  {'PASS' if ok else 'FAIL'}  [{m}] {q}  -> gate={r.get('gate')} cites={len(cites)} own-module={len(own)} "
                  f"from-catalog-manual={len(from_file)} first={(cites[0]['manual'] + ' | ' + cites[0]['section'])[:90] if cites else '-'}")
    st, r = call("GET", "/suggestions?module=hr", key)
    ok = st == 200 and r.get("questions") == []
    fails += 0 if ok else 1
    print(f"{'PASS' if ok else 'FAIL'}  unknown module 'hr' -> {r}")
    print(f"\n{'ALL PASS' if not fails else f'{fails} FAILED'}")
    return 1 if fails else 0


if __name__ == "__main__":
    raise SystemExit(main())
