"""TRACKED (6-Oct-2026): trainer ACCOUNTS — own login on the training page. Targeted test against a running assistant
(the isolated pilot), from a container on the AI server that shares the pilot's database settings:
  KB_URL=http://127.0.0.1:8047 python scripts/verify_kb_accounts.py

Creates throwaway TEST accounts (kbtest-*) with passwords generated inside this run (never printed), checks them over
HTTP, then deletes them and retires what they published. Exit 0 = every check passed."""
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

from app import db, kb

BASE = os.environ.get("KB_URL", "http://127.0.0.1:8047")
RUN = time.strftime("%H%M%S")
results: list[tuple[str, bool]] = []


def rec(name: str, ok: bool, got: Any = "") -> None:
    results.append((name, ok))
    print(("PASS  " if ok else "FAIL  ") + name + (f"  -> {str(got)[:220]}" if got != "" else ""))


class Client:
    def __init__(self) -> None:
        self.cookie = ""

    def call(self, method: str, path: str, body: Any = None, header: bool = True) -> tuple[int, Any]:
        h = {"content-type": "application/json"}
        if header:
            h["x-kb-request"] = "1"
        if self.cookie:
            h["cookie"] = self.cookie
        req = urllib.request.Request(BASE + path, method=method, headers=h, data=json.dumps(body).encode() if body is not None else None)
        try:
            with urllib.request.urlopen(req, timeout=180) as r:
                sc = r.headers.get("set-cookie")
                if sc:
                    self.cookie = sc.split(";")[0]
                return r.status, json.loads(r.read() or b"{}")
        except urllib.error.HTTPError as e:
            try:
                return e.code, json.loads(e.read() or b"{}")
            except Exception:
                return e.code, {}

    async def acall(self, *a: Any, **k: Any) -> tuple[int, Any]:
        return await asyncio.to_thread(self.call, *a, **k)


def entry(module: str, title: str) -> dict[str, Any]:
    return {"module": module, "kind": "procedure", "title": f"{title} {RUN}",
            "body": f"Account test {title} {RUN}: open the panel, press the yellow CHECK key twice and note it in the remarks.",
            "appliesTo": {"userTypes": ["Office"]}, "evidence": [{"cls": "expert", "reference": "account test", "note": "synthetic"}],
            "openPoints": [], "supersedes": []}


async def main() -> int:
    pw = {k: secrets.token_urlsafe(18) for k in ("tech", "crew", "auds")}
    users = {"tech": f"kbtest-tech-{RUN}", "crew": f"kbtest-crew-{RUN}", "auds": f"kbtest-auds-{RUN}"}
    await kb.create_account(users["tech"], "TEST PMS trainer", ["technical"], pw["tech"], "account test")
    await kb.create_account(users["crew"], "TEST Crewing trainer", ["crewing"], pw["crew"], "account test")
    await kb.create_account(users["auds"], "TEST Audit & Safety trainer", ["audit_safety"], pw["auds"], "account test")

    t, c, a = Client(), Client(), Client()
    s, b = await t.acall("POST", "/kb/api/login", {"username": users["tech"], "password": pw["tech"]}, header=False)
    rec("login without the x-kb-request header is refused (403)", s == 403, s)
    s, b = await t.acall("POST", "/kb/api/login", {"username": users["tech"], "password": "wrong-" + pw["tech"]})
    rec("wrong password → 401 with a generic message", s == 401 and "Wrong user id or password" in str(b.get("error")), b.get("error"))
    s, b = await t.acall("POST", "/kb/api/login", {"username": "nobody-" + RUN, "password": "x" * 20})
    rec("unknown user → the SAME generic 401", s == 401 and "Wrong user id or password" in str(b.get("error")), b.get("error"))
    s, b = await t.acall("POST", "/kb/api/login", {"username": users["tech"].upper(), "password": pw["tech"]})
    rec("PMS trainer signs in (user id not case-sensitive)", s == 200 and b.get("trainer") is True and b.get("account") is True, s)
    rec("PMS trainer sees only Technical (PMS)", [g["label"] for g in b.get("groups", [])] == ["Technical (PMS)"], b.get("groups"))
    await c.acall("POST", "/kb/api/login", {"username": users["crew"], "password": pw["crew"]})
    s, b = await a.acall("POST", "/kb/api/login", {"username": users["auds"], "password": pw["auds"]})
    g = b.get("groups", [])
    rec("Audit & Safety trainer sees ONE module 'Audit & Safety' with its parts audit / incident / safety",
        [x["label"] for x in g] == ["Audit & Safety"] and sorted(m["module"] for m in g[0]["modules"]) == ["audit", "incident", "safety"], g)
    s, b = await c.acall("GET", "/kb/api/me")
    rec("Crewing trainer sees only Crewing", [x["label"] for x in b.get("groups", [])] == ["Crewing"], b.get("groups"))

    # server-side module enforcement
    s, b = await t.acall("POST", "/kb/api/entries", entry("crewing", "tech-in-crewing"))
    rec("PMS trainer cannot create a Crewing entry (403)", s == 403, f"{s} {b.get('error')}")
    s, b = await t.acall("POST", "/kb/api/entries", entry("safety", "tech-in-safety"))
    rec("PMS trainer cannot create a Safety entry (403)", s == 403, s)
    s, b = await a.acall("POST", "/kb/api/entries", entry("technical", "auds-in-tech"))
    rec("Audit & Safety trainer cannot create a Technical entry (403)", s == 403, s)
    s, b = await a.acall("POST", "/kb/api/entries", entry("safety", "auds-safety"))
    rec("Audit & Safety trainer creates a Safety-part draft", s == 200 and b["entry"]["status"] == "draft", s)
    s, b = await c.acall("GET", "/kb/api/entries?module=technical")
    rec("Crewing trainer cannot list Technical entries", s == 403 or (s == 200 and not b), f"{s} {len(b) if isinstance(b, list) else b}")

    # the existing workflow, unchanged, with an account session
    s, b = await t.acall("POST", "/kb/api/entries", entry("technical", "tech-flow"))
    eid = b.get("entry", {}).get("id", "")
    rec("PMS trainer creates a Technical draft", s == 200 and bool(eid), s)
    s, b = await t.acall("POST", f"/kb/api/entries/{eid}/preview/ask", {"question": f"How do I use the yellow CHECK key {RUN}?"})
    rec("Test draft works with an account session (private, chatbot answer path)",
        s == 200 and b.get("draftRetrieved") is True and "search_module_docs" in (b.get("toolsUsed") or []), f"{s} {b.get('toolsUsed')}")
    s, b = await t.acall("POST", f"/kb/api/entries/{eid}/publish", {"changeNote": "account test"})
    rec("Publish works with an account session (no approver)", s == 200 and b["entry"]["status"] == "published", f"{s} {b.get('error')}")
    hist = (await t.acall("GET", f"/kb/api/entries/{eid}"))[1]
    rec("history records the account as author/publisher", any("TEST PMS trainer" in str(x.get("actor_name")) for x in hist.get("audit", [])),
        [x.get("actor_name") for x in hist.get("audit", [])][:3])

    # disable ends an OPEN session at once; enable lets the person sign in again
    r = await kb.set_account_active(users["tech"], False, "account test")
    s, b = await t.acall("GET", "/kb/api/me")
    rec("disable → the open session is refused at once (401)", s == 401 and r["sessionsEnded"] >= 1, f"{s} ended {r['sessionsEnded']}")
    s, b = await t.acall("POST", "/kb/api/login", {"username": users["tech"], "password": pw["tech"]})
    rec("a disabled account cannot sign in", s == 401, s)
    await kb.set_account_active(users["tech"], True, "account test")
    s, b = await t.acall("POST", "/kb/api/login", {"username": users["tech"], "password": pw["tech"]})
    rec("enable → signs in again", s == 200, s)

    # reset ends the open session; the old password stops working
    new = secrets.token_urlsafe(18)
    r = await kb.reset_account_password(users["tech"], new, "account test")
    s, _ = await t.acall("GET", "/kb/api/me")
    rec("password reset → the open session is refused (401)", s == 401 and r["sessionsEnded"] >= 1, s)
    s, _ = await t.acall("POST", "/kb/api/login", {"username": users["tech"], "password": pw["tech"]})
    s2, _ = await t.acall("POST", "/kb/api/login", {"username": users["tech"], "password": new})
    rec("old password refused, new password accepted", s == 401 and s2 == 200, f"{s} / {s2}")

    # lockout after 5 wrong attempts — even the right password is refused while locked
    x = Client()
    for _ in range(5):
        await x.acall("POST", "/kb/api/login", {"username": users["crew"], "password": "wrong-password-xyz"})
    s, _ = await x.acall("POST", "/kb/api/login", {"username": users["crew"], "password": pw["crew"]})
    rec("5 wrong attempts lock the account: the right password is refused", s == 401, s)
    async with db.engine().connect() as cc:
        locked = (await cc.execute(text("SELECT locked_until > now() FROM kb_accounts WHERE username=:u"), {"u": users["crew"]})).scalar_one()
    rec("lock recorded on the account (15 minutes)", locked is True, locked)
    r = await kb.reset_account_password(users["crew"], pw["crew"], "account test")  # reset also clears a lock
    s, _ = await x.acall("POST", "/kb/api/login", {"username": users["crew"], "password": pw["crew"]})
    rec("reset clears the lock", s == 200, s)

    async with db.engine().connect() as cc:
        stored = (await cc.execute(text("SELECT password_hash FROM kb_accounts WHERE username=:u"), {"u": users["auds"]})).scalar_one()
    rec("only a salted scrypt hash is stored (no password text)", stored.startswith("scrypt$") and pw["auds"] not in stored, stored[:7])

    # clean-up: retire what was published, remove the TEST accounts and their sessions
    await t.acall("POST", f"/kb/api/entries/{eid}/retire", {"reason": "account test"})
    async with db.engine().begin() as cc:
        await cc.execute(text("DELETE FROM kb_sessions WHERE account_id IN (SELECT id FROM kb_accounts WHERE username LIKE :p)"), {"p": f"kbtest-%-{RUN}"})
        await cc.execute(text("DELETE FROM kb_accounts WHERE username LIKE :p"), {"p": f"kbtest-%-{RUN}"})
    passed = sum(1 for _, ok in results if ok)
    print(f"\n{passed}/{len(results)} passed (run {RUN})")
    await db.engine().dispose()
    return 0 if passed == len(results) else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
