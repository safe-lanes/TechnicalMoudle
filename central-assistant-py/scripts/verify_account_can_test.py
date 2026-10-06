"""TRACKED (6-Oct-2026): can a trainer ACCOUNT open and privately test its drafts? — checked with that account's
permissions, WITHOUT its password (the real sign-in is done by the trainer in a browser). Run inside the release image
against the service's own database, with SERVICE_URL = that service:
  ACCOUNT=pmstrainer MODULE=technical ENTRY_TITLE="Deleting a job" QUESTION="How do I delete a job?" \\
  SERVICE_URL=http://127.0.0.1:8000 python scripts/verify_account_can_test.py
Nothing is published. The test leaves one private preview row for the tested draft (as any Test draft does)."""
from __future__ import annotations

import asyncio
import json
import os
import sys
import urllib.request
from typing import Any

from sqlalchemy import text

from app import db, kb
from app.config import settings
from app.identity import sign_identity

results: list[tuple[str, bool]] = []


def rec(name: str, ok: bool, got: Any = "") -> None:
    results.append((name, ok))
    print(("PASS  " if ok else "FAIL  ") + name + (f"  -> {str(got)[:220]}" if got != "" else ""))


def docs_chat(base: str, q: str) -> dict[str, Any]:
    tok = sign_identity({"userId": "release-check", "userName": "Release check", "role": "Sail Admin", "tenantDomain": "release-check"},
                        settings().identity_signing_key, 60)
    req = urllib.request.Request(base + "/chat", method="POST", headers={"content-type": "application/json", "x-assistant-identity": tok},
                                 data=json.dumps({"message": q, "context": {"module": "technical"}}).encode())
    with urllib.request.urlopen(req, timeout=180) as r:
        return dict(json.loads(r.read()))


async def main() -> int:
    acct, module, title, q = os.environ["ACCOUNT"], os.environ["MODULE"], os.environ["ENTRY_TITLE"], os.environ["QUESTION"]
    async with db.engine().connect() as c:
        a = (await c.execute(text("SELECT id, modules, active FROM kb_accounts WHERE username=:u"), {"u": acct})).first()
    rec(f"account {acct} exists and is active", bool(a and a.active), a.modules if a else None)
    if not a:
        return 1
    sess = kb.Session("release-check-no-login", "release-check", f"release check (permissions of {acct})", "Trainer", None,
                      kb.ACCOUNT_ISS, "dev", "Office", a.id)
    me = await kb.me(sess)
    rec(f"{acct} is a trainer of exactly its module", me["trainer"] and [m["module"] for m in me["modules"]] == list(a.modules), me["modules"])
    rows = await kb.list_entries(sess, module, None)
    drafts = [e for e in rows if e["status"] == "draft"]
    rec(f"{acct} sees the imported drafts in {module}", len(drafts) >= 5, [e["title"] for e in drafts])
    e = next((x for x in drafts if x["title"] == title), None)
    rec(f"the draft '{title}' opens", e is not None)
    if not e:
        return 1
    full = await kb.get_entry(sess, e["id"])
    rec("it is unpublished (draft revision, nothing served)", full["entry"]["published_revision"] is None and full["entry"]["draft_revision"] == 1)
    other = next(m for m in ("crewing", "audit", "technical") if m not in a.modules)
    try:
        await kb.create_entry(sess, {"module": other, "kind": "procedure", "title": "x", "body": "y" * 40, "appliesTo": {},
                                     "evidence": [], "openPoints": [], "supersedes": []})
        rec(f"{acct} is refused in another module ({other})", False, "created")
    except kb.KBError as ex:
        rec(f"{acct} is refused in another module ({other})", ex.status == 403, ex.status)
    pv = await kb.preview_ask(sess, e["id"], q)
    rec("Test draft answers privately with the draft in place (chatbot answer path)",
        pv.get("status") == 200 and pv.get("draftRetrieved") is True and "search_module_docs" in (pv.get("toolsUsed") or []),
        f"{pv.get('toolsUsed')} {str(pv.get('response'))[:100]}")
    r = docs_chat(os.environ["SERVICE_URL"], q)
    leaked = any(title in f"{c.get('manual', '')} {c.get('section', '')}" for c in r.get("citations") or [])
    rec("an ordinary user's answer to the same question does NOT use the draft", not leaked,
        [c.get("manual") for c in r.get("citations") or []][:3])
    async with db.engine().connect() as c:
        served = (await c.execute(text("SELECT count(*) FROM assistant_chunks WHERE index_set=:s AND kb_state='published'"),
                                  {"s": settings().assistant_index_set})).scalar_one()
    rec("nothing is published", served == 0, served)
    await db.engine().dispose()
    passed = sum(1 for _, ok in results if ok)
    print(f"\n{passed}/{len(results)} passed")
    return 0 if passed == len(results) else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
