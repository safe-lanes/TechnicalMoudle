"""TRACKED (1-Oct-2026): publish failure safety on the knowledge pilot — run INSIDE a pilot container (it uses the
service's own code and database settings; never against production):

  docker run --rm --network host --env-file kbpilot.env -v <repo>/central-assistant-py/scripts:/app/scripts -w /app \
      sail-assistant-py:<pilot image> python scripts/verify_kb_publish_failure.py

1. Publish revision 1 (real embedding) of a test entry that supersedes one manual passage → snapshot what is served:
   the entry row, its searchable chunk (content + embedding + environment) and its supersede rows.
2. Save revision 2 (different text, no supersede).
3. Embedding service fails during publish (simulated: llm.embed raises)        → refused (502), snapshot unchanged.
4. Failure INSIDE the swap transaction, after the new chunk and supersedes were written (simulated: the audit write
   raises)                                                                          → refused (500), snapshot unchanged.
5. Instrument check: a real publish of revision 2 DOES change the snapshot (the comparison can see a change).
6. Rollback to revision 1 restores revision 1's text AND its supersede; retire removes everything (clean-up).
Test account: devtest-tech-1 (DEV TEST Technical trainer 1, company 'pilot', environment 'dev')."""
from __future__ import annotations

import asyncio
import hashlib
import sys
import time
from typing import Any

from sqlalchemy import text

from app import db, kb, llm
from app.config import settings

SESS = kb.Session("script-publish-failure", "devtest-tech-1", "DEV TEST Technical trainer 1", "Sail Admin", "pilot", "technical-dev", "dev", "Office")
results: list[tuple[str, bool]] = []


def rec(name: str, ok: bool, got: Any = "") -> None:
    results.append((name, ok))
    print(("PASS  " if ok else "FAIL  ") + name + (f"  -> {str(got)[:200]}" if got != "" else ""))


async def snapshot(eid: str) -> dict[str, Any]:
    async with db.engine().connect() as c:
        e = (await c.execute(text("SELECT status, published_revision FROM kb_entries WHERE id=:e"), {"e": eid})).first()
        ch = (await c.execute(text("SELECT id, md5(content) AS c, md5(embedding::text) AS v, kb_env, kb_state, tenant_domain, "
                                   "(content LIKE '%Revision one text%') AS rev1_text FROM assistant_chunks "
                                   "WHERE index_set=:s AND kb_entry_id=:e AND kb_state='published'"),
                              {"s": settings().assistant_index_set, "e": eid})).all()
        sup = (await c.execute(text("SELECT chunk_id, tenant_domain, env_scope FROM kb_supersedes WHERE entry_id=:e ORDER BY chunk_id"), {"e": eid})).all()
    return {"entry": tuple(e) if e else None, "chunks": [tuple(r) for r in ch], "supersedes": [tuple(r) for r in sup]}


def body(text_: str, sup: list[dict[str, str]]) -> dict[str, Any]:
    return {"module": "technical", "kind": "procedure", "scope": "global", "title": f"Publish-failure test {RUN}", "body": text_,
            "appliesTo": {"userTypes": ["Office"]}, "evidence": [{"cls": "expert", "reference": "test", "note": "synthetic"}],
            "openPoints": [], "supersedes": sup}


RUN = time.strftime("%H%M%S")


async def main() -> int:
    async with db.engine().connect() as c:
        p = (await c.execute(text("SELECT id, file, breadcrumb FROM assistant_chunks WHERE index_set=:s AND kb_state IS NULL AND module='technical' "
                                  "ORDER BY id LIMIT 1"), {"s": settings().assistant_index_set})).first()
    sup = [{"chunkId": p.id, "file": p.file, "section": p.breadcrumb}]
    d = await kb.create_entry(SESS, body("Revision one text: hold the RESET key for 7 seconds before restarting the unit.", sup))
    eid = d["entry"]["id"]
    await kb.publish(SESS, eid, "rev 1")
    s1 = await snapshot(eid)
    rec("revision 1 published: one served chunk, one supersede, environment dev",
        s1["entry"] == ("published", 1) and len(s1["chunks"]) == 1 and s1["chunks"][0][3] == "dev" and len(s1["supersedes"]) == 1, s1)
    await kb.save_draft(SESS, eid, body("Revision two text: hold the RESET key for 9 seconds before restarting the unit.", []))

    real_embed = llm.embed

    async def failing_embed(*_a: Any, **_k: Any) -> list[float]:
        raise RuntimeError("simulated embedding-service outage")
    llm.embed = failing_embed  # type: ignore[assignment]
    try:
        await kb.publish(SESS, eid, "rev 2 attempt")
        rec("embedding failure refuses the publish", False, "publish succeeded")
    except kb.KBError as ex:
        rec("embedding failure refuses the publish (502, says the previous version is still in use)",
            ex.status == 502 and "still in use" in ex.message, f"{ex.status} {ex.message}")
    finally:
        llm.embed = real_embed  # type: ignore[assignment]
    rec("after the embedding failure: revision, searchable chunk (content+embedding) and supersedes UNCHANGED", await snapshot(eid) == s1)

    real_audit = kb._audit

    async def failing_audit(c: Any, sess: Any, entry_id: Any, revision: Any, action: str, detail: Any = None) -> None:
        if action == "published":
            raise RuntimeError("simulated failure inside the swap transaction")
        await real_audit(c, sess, entry_id, revision, action, detail)
    kb._audit = failing_audit  # type: ignore[assignment]
    try:
        await kb.publish(SESS, eid, "rev 2 attempt")
        rec("in-transaction failure refuses the publish", False, "publish succeeded")
    except kb.KBError as ex:
        rec("failure inside the transaction (after the new chunk was written) refuses the publish (500)", ex.status == 500, f"{ex.status} {ex.message}")
    finally:
        kb._audit = real_audit  # type: ignore[assignment]
    rec("after the in-transaction failure: everything rolled back, revision 1 still served UNCHANGED", await snapshot(eid) == s1)

    await kb.publish(SESS, eid, "rev 2")
    s2 = await snapshot(eid)
    rec("instrument check: a real publish of revision 2 DOES change the snapshot (text changed, supersede removed)",
        s2 != s1 and s2["entry"] == ("published", 2) and s2["chunks"][0][1] != s1["chunks"][0][1] and s2["supersedes"] == [], s2)
    await kb.rollback(SESS, eid, 1)
    s3 = await snapshot(eid)
    # the served chunk carries its own revision number and date, so it is compared on the guidance text, not byte for byte
    rec("rollback to revision 1 restores revision 1's guidance text and its supersede (as revision 3)",
        s3["entry"] == ("published", 3) and s3["chunks"][0][6] is True and s3["supersedes"] == s1["supersedes"], s3)
    await kb.retire(SESS, eid, "test clean-up")
    s4 = await snapshot(eid)
    rec("retire removes the served chunk and the supersede", s4["chunks"] == [] and s4["supersedes"] == [] and s4["entry"][0] == "retired", s4)
    async with db.engine().begin() as c:  # remove the synthetic test entry completely (it never served real users)
        for t in ("kb_audit", "kb_revisions", "kb_supersedes"):
            await c.execute(text(f"DELETE FROM {t} WHERE entry_id=:e"), {"e": eid})
        await c.execute(text("DELETE FROM assistant_chunks WHERE kb_entry_id=:e"), {"e": eid})
        await c.execute(text("DELETE FROM kb_entries WHERE id=:e"), {"e": eid})
    await db.engine().dispose()
    passed = sum(ok for _, ok in results)
    print(f"\n{passed}/{len(results)} passed (entry {eid}, chunk digest {hashlib.sha256(str(s1).encode()).hexdigest()[:12]})")
    return 0 if passed == len(results) else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
