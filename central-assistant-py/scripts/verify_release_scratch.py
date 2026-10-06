"""TRACKED (6-Oct-2026): the two RELEASE CHECKS, on a scratch copy of the live database with the final image.
Run inside the release image on the AI server, with V8_URL = the release image serving the scratch DB and V7_URL = the
previous image serving the SAME scratch DB (started only for step B, see the runner):
  phase=A  python scripts/verify_release_scratch.py   account-authenticated Test draft / Publish refused during the block
  phase=B  python scripts/verify_release_scratch.py   (after the runner starts the old image) old image on 0013 after hold

Uses one throwaway account (kbrel-*) with a password generated inside the run (never printed); removes it at the end."""
from __future__ import annotations

import asyncio
import json
import os
import secrets
import sys
import time
import urllib.error
import urllib.request
from typing import Any

from sqlalchemy import text

from app import db, kb, kb_admin
from app.config import settings
from app.identity import sign_identity

V8 = os.environ["V8_URL"]
V7 = os.environ.get("V7_URL", "")
PHASE = os.environ.get("phase", "A")
STATE = os.environ.get("STATE_FILE", "/tmp/release-scratch-state.json")  # shared between the phase A and B runs
results: list[tuple[str, bool]] = []


def rec(name: str, ok: bool, got: Any = "") -> None:
    results.append((name, ok))
    print(("PASS  " if ok else "FAIL  ") + name + (f"  -> {str(got)[:220]}" if got != "" else ""))


def http(base: str, method: str, path: str, body: Any = None, cookie: str = "", headers: dict[str, str] | None = None) -> tuple[int, Any, str]:
    h = {"content-type": "application/json", "x-kb-request": "1", **(headers or {})}
    if cookie:
        h["cookie"] = cookie
    req = urllib.request.Request(base + path, method=method, headers=h, data=json.dumps(body).encode() if body is not None else None)
    try:
        with urllib.request.urlopen(req, timeout=180) as r:
            return r.status, json.loads(r.read() or b"{}"), (r.headers.get("set-cookie") or "").split(";")[0]
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read() or b"{}"), ""
        except Exception:
            return e.code, {}, ""


def docs_chat(base: str, q: str) -> dict[str, Any]:
    tok = sign_identity({"userId": "release-check", "userName": "Release check", "role": "Sail Admin", "tenantDomain": "release-check"},
                        settings().identity_signing_key, 60)
    s, b, _ = http(base, "POST", "/chat", {"message": q, "context": {"module": "technical"}}, headers={"x-assistant-identity": tok})
    return b if s == 200 else {"status": s, **(b or {})}


def cites(reply: dict[str, Any], title: str) -> bool:
    return any(title in f"{c.get('manual', '')} {c.get('section', '')}" for c in reply.get("citations") or [])


async def served() -> int:
    async with db.engine().connect() as c:
        return int((await c.execute(text("SELECT count(*) FROM assistant_chunks WHERE index_set=:s AND kb_state IS NOT NULL"),
                                    {"s": settings().assistant_index_set})).scalar_one())


async def phase_a() -> None:
    run = time.strftime("%H%M%S")
    user, pw = f"kbrel-{run}", secrets.token_urlsafe(18)
    await kb.create_account(user, "RELEASE CHECK PMS trainer", ["technical"], pw, "release check")
    s, b, cookie = http(V8, "POST", "/kb/api/login", {"username": user, "password": pw})
    rec("A. trainer ACCOUNT signs in over HTTP (final image)", s == 200 and bool(cookie) and b.get("account") is True, s)
    title = f"Release check gauge {run}"
    body = {"module": "technical", "kind": "procedure", "title": title,
            "body": f"Release check {run}: to zero the release gauge press the white ZERO key for 4 seconds and note it in the remarks.",
            "appliesTo": {"userTypes": ["Office"]}, "evidence": [{"cls": "expert", "reference": "release check", "note": "synthetic"}],
            "openPoints": [], "supersedes": []}
    s, b, _ = http(V8, "POST", "/kb/api/entries", body, cookie)
    eid = b.get("entry", {}).get("id", "")
    rec("A. account creates a draft while writes are open", s == 200 and bool(eid), s)
    base = await served()
    await kb.set_write_block(True, "release check", "release check")
    s1, b1, _ = http(V8, "POST", f"/kb/api/entries/{eid}/preview/ask", {"question": f"How do I zero the release gauge {run}?"}, cookie)
    s2, b2, _ = http(V8, "POST", f"/kb/api/entries/{eid}/publish", {"changeNote": "x"}, cookie)
    s3, b3, _ = http(V8, "PUT", f"/kb/api/entries/{eid}/draft", body, cookie)
    rec("A. during the write block: account Test draft refused (503)", s1 == 503, f"{s1} {b1.get('error')}")
    rec("A. during the write block: account Publish refused (503)", s2 == 503, f"{s2} {b2.get('error')}")
    rec("A. during the write block: account Save draft refused (503)", s3 == 503, s3)
    rec("A. nothing was written to the served index while blocked", await served() == base, f"{base} -> {await served()}")
    await kb.set_write_block(False, "release check")
    s, b, _ = http(V8, "POST", f"/kb/api/entries/{eid}/publish", {"changeNote": "release check"}, cookie)
    rec("A. after unblocking, the account publishes normally", s == 200 and b["entry"]["status"] == "published", s)
    s, b, _ = http(V8, "POST", f"/kb/api/entries/{eid}/preview/ask", {"question": f"How do I zero the release gauge {run}?"}, cookie)
    # (the entry is now published; Test draft needs a draft — create one so a PREVIEW row exists for phase B)
    http(V8, "PUT", f"/kb/api/entries/{eid}/draft", {**body, "body": body["body"] + " (revision 2 draft: hold 6 seconds)"}, cookie)
    s, b, _ = http(V8, "POST", f"/kb/api/entries/{eid}/preview/ask", {"question": f"How do I zero the release gauge {run}?"}, cookie)
    rec("A. account Test draft works after unblocking (private preview row present)", s == 200 and b.get("draftRetrieved") is True, s)
    r8 = docs_chat(V8, f"How do I zero the release gauge {run}?")
    rec("A. release image serves the PUBLISHED entry to an ordinary user", cites(r8, title), [c.get("manual") for c in r8.get("citations") or []][:3])
    # hold for phase B (the runner starts the old image next)
    await kb.set_write_block(True, "release check", "release check: hold before old image")
    await kb_admin._rollback_move(True, "release check")
    json.dump({"user": user, "eid": eid, "title": title, "run": run}, open(STATE, "w"))
    rec("A. block + hold done: 0 knowledge rows in the served index", await served() == 0, await served())


async def phase_b() -> None:
    st = json.load(open(STATE))
    async with db.engine().connect() as c:
        ver = (await c.execute(text("SELECT version_num FROM alembic_version"))).scalar_one()
    rec("B. scratch database is at migration 0013", ver == "0013", ver)
    s, h, _ = http(V7, "GET", "/health")
    rec("B. old image (v7-r2) is healthy on the 0013 database", s == 200 and h.get("ok") is True and h["prompt"]["combined"] == "b31c3f9c6c1fe2e4",
        f"{s} {h.get('prompt', {}).get('combined')}")
    r = docs_chat(V7, f"How do I zero the release gauge {st['run']}?")
    leak = "white ZERO key" in str(r.get("response")) or "6 seconds" in str(r.get("response"))
    rec("B. old image retrieves NO knowledge (published or draft) after the hold", not cites(r, st["title"]) and not leak,
        [c.get("manual") for c in r.get("citations") or []][:3])
    m = docs_chat(V7, "How do I complete a work order?")
    rec("B. old image still answers a normal documentation question from the manuals", m.get("gate") == "answer" and bool(m.get("citations")),
        m.get("gate"))
    await kb_admin._rollback_move(False, "release check")
    await kb.set_write_block(False, "release check")
    r8 = docs_chat(V8, f"How do I zero the release gauge {st['run']}?")
    rec("B. roll forward (release + unblock): release image serves the published entry again", cites(r8, st["title"]))
    async with db.engine().begin() as c:  # clean up the throwaway account
        await c.execute(text("DELETE FROM kb_sessions WHERE account_id IN (SELECT id FROM kb_accounts WHERE username=:u)"), {"u": st["user"]})
        await c.execute(text("DELETE FROM kb_accounts WHERE username=:u"), {"u": st["user"]})


async def main() -> int:
    try:
        await (phase_a() if PHASE == "A" else phase_b())
    finally:
        await db.engine().dispose()
    passed = sum(1 for _, ok in results if ok)
    print(f"\nphase {PHASE}: {passed}/{len(results)} passed")
    return 0 if passed == len(results) else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
