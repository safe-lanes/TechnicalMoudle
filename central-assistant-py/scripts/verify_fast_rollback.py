"""TRACKED (5-Oct-2026): FAST ROLLBACK safety — the previous image (no knowledge management) running on the MIGRATED
database while knowledge content exists. Run inside the RELEASE image on the AI server against a SCRATCH copy, with:
  V7_URL  the previous image (e.g. sail-assistant-py:v7-r2) serving the scratch DB
  V8_URL  the release image serving the same scratch DB
  python scripts/verify_fast_rollback.py

Creates (real embeddings) a PUBLISHED entry and a DRAFT with a private preview, then asks both services as an ORDINARY
user (documentation-only identity): before the hold (the plain fast rollback), after `kb_admin rollback-hold`, and
after `kb_admin rollback-release`. Exit 0 = the corrected procedure is safe."""
from __future__ import annotations

import asyncio
import json
import os
import subprocess
import sys
import time
import urllib.request
from typing import Any

from sqlalchemy import text

from app import db, kb
from app.config import settings
from app.identity import sign_identity

V7, V8 = os.environ["V7_URL"], os.environ["V8_URL"]
RUN = time.strftime("%H%M%S")
SESS = kb.Session("script-fast-rollback", "devtest-tech-1", "DEV TEST Technical trainer 1", "Sail Admin", "pilot",
                  "technical-pilotlocal", "dev", "Office")
P_TITLE, D_TITLE = f"Resetting the Kappa-4 gauge {RUN}", f"Servicing the Lambda-5 valve {RUN}"
P_Q, D_Q = f"How do I reset the Kappa-4 gauge {RUN}?", f"How do I service the Lambda-5 valve {RUN}?"
results: list[tuple[str, bool]] = []


def rec(name: str, ok: bool, got: Any = "") -> None:
    results.append((name, ok))
    print(("PASS  " if ok else "FAIL  ") + name + (f"  -> {str(got)[:260]}" if got != "" else ""))


def entry(title: str, body: str) -> dict[str, Any]:
    return {"module": "technical", "kind": "procedure", "scope": "global", "title": title, "body": body,
            "appliesTo": {"userTypes": ["Office"]}, "evidence": [{"cls": "expert", "reference": "rollback test", "note": "synthetic"}],
            "openPoints": [], "supersedes": []}


async def ask(base: str, q: str, route_only: bool = True) -> dict[str, Any]:
    tok = sign_identity({"userId": "rollback-ordinary-user", "userName": "Ordinary user", "role": "Sail Admin",
                         "tenantDomain": "smoke-suite-tenant"}, settings().identity_signing_key, 60)
    req = urllib.request.Request(f"{base}/chat", method="POST", headers={"x-assistant-identity": tok, "content-type": "application/json"},
                                 data=json.dumps({"message": q, "routeOnly": route_only, "context": {"module": "technical"}}).encode())

    def call() -> dict[str, Any]:
        with urllib.request.urlopen(req, timeout=120) as r:
            return dict(json.loads(r.read()))
    return await asyncio.to_thread(call)


def cited(reply: dict[str, Any], title: str) -> bool:
    return any(title in f"{c.get('manual', '')} {c.get('section', '')}" for c in reply.get("citations") or [])


def admin(*args: str) -> str:
    return subprocess.run([sys.executable, "-m", "app.kb_admin", *args], capture_output=True, text=True).stdout.strip()


async def kb_rows() -> dict[str, int]:
    async with db.engine().connect() as c:
        rows = (await c.execute(text("SELECT index_set, coalesce(kb_state, 'manual') AS k, count(*) AS n FROM assistant_chunks "
                                     "WHERE index_set LIKE :s GROUP BY 1, 2"), {"s": settings().assistant_index_set + "%"})).all()
    return {f"{r.index_set}/{r.k}": int(r.n) for r in rows}


async def main() -> int:
    p = await kb.create_entry(SESS, entry(P_TITLE, f"To reset the Kappa-4 gauge {RUN}, press and hold the amber ZERO key "
                                                   "for 5 seconds until the needle returns to the stop pin."))
    await kb.publish(SESS, p["entry"]["id"], "published (rollback test)")
    d = await kb.create_entry(SESS, entry(D_TITLE, f"PRIVATE DRAFT — to service the Lambda-5 valve {RUN}, close the bypass, "
                                                   "turn the purple handle three times and record it."))
    await kb.prepare_preview(SESS, d["entry"]["id"])  # the row a 'Test draft' leaves behind
    print("rows:", await kb_rows())

    # 1. the plain fast rollback: previous image on the migrated DB, knowledge rows still in the served index set
    r_p, r_d = await ask(V7, P_Q), await ask(V7, D_Q)
    full = await ask(V7, D_Q, route_only=False)
    plain = {"draft retrieved": cited(r_d, D_TITLE), "draft text in the answer": "purple handle" in str(full.get("response")),
             "published entry retrieved": cited(r_p, P_TITLE)}
    unsafe_plain = plain["draft retrieved"] or plain["draft text in the answer"]
    print(f"FINDING  plain fast rollback (previous image, knowledge rows left in place): {plain}")
    print(f"         answer to the draft question: {str(full.get('response'))[:300]!r}")
    print(f"         citations: {[c.get('manual') for c in r_d.get('citations') or []][:4]}")

    # 2. corrected procedure: hold BEFORE switching
    print(admin("writes-block", "--by", "rollback test", "--reason", "fast rollback test"))
    print(admin("rollback-hold", "--by", "rollback test"))
    print("rows:", await kb_rows())
    r_p, r_d = await ask(V7, P_Q), await ask(V7, D_Q)
    rec("after HOLD — previous image retrieves neither the draft nor the published entry",
        not cited(r_d, D_TITLE) and not cited(r_p, P_TITLE), [c.get("manual") for c in (r_d.get("citations") or []) + (r_p.get("citations") or [])][:4])
    full = await ask(V7, D_Q, route_only=False)
    rec("after HOLD — previous image's answer has no draft text", "purple handle" not in str(full.get("response")), str(full.get("response"))[:160])
    man = await ask(V7, "How do I complete a work order?")
    rec("after HOLD — manuals still answer normally on the previous image", bool(man.get("citations")) and man.get("gate") == "answer",
        man.get("gate"))
    st = admin("rollback-status")
    rec("rollback-status reports SAFE (0 served, writes blocked)", "served index set: 0;" in st and "SAFE to switch" in st, st)

    # 3. roll forward: release, the release image serves the published entry again; the draft stays private
    print(admin("rollback-release", "--by", "rollback test"))
    print(admin("writes-unblock", "--by", "rollback test"))
    print("rows:", await kb_rows())
    r_p, r_d = await ask(V8, P_Q), await ask(V8, D_Q)
    rec("after RELEASE — release image serves the published entry again", cited(r_p, P_TITLE))
    rec("after RELEASE — release image still keeps the draft private", not cited(r_d, D_TITLE))

    # clean-up (test content only)
    await kb.retire(SESS, p["entry"]["id"], "rollback test")
    passed = sum(1 for _, ok in results if ok)
    print(f"\nplain fast rollback: {'UNSAFE — drafts reachable' if unsafe_plain else 'no draft reached'}")
    print(f"{passed}/{len(results)} passed (run {RUN})")
    await db.engine().dispose()
    return 0 if passed == len(results) else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
