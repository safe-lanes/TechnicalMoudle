"""TRACKED (6-Oct-2026): the knowledge WRITE BLOCK that makes the fast rollback safe — one targeted concurrency test.
Run inside the release image on a SCRATCH copy of the migrated database (it changes knowledge data):
  python scripts/verify_rollback_write_block.py

Embeddings are replaced by a stored vector (the test is about database writes, not about answers) so the timing is
controlled: one publish is held INSIDE its write transaction, another is held in its preparation step (before the
transaction). Exit 0 = every check passed."""
from __future__ import annotations

import asyncio
import sys
import time
from typing import Any

from sqlalchemy import text

from app import db, kb, kb_admin, llm
from app.config import settings

RUN = time.strftime("%H%M%S")
SESS = kb.Session("script-write-block", "devtest-tech-1", "DEV TEST Technical trainer 1", "Sail Admin", "pilot",
                  "technical-pilotlocal", "dev", "Office")
results: list[tuple[str, bool]] = []


def rec(name: str, ok: bool, got: Any = "") -> None:
    results.append((name, ok))
    print(("PASS  " if ok else "FAIL  ") + name + (f"  -> {str(got)[:240]}" if got != "" else ""))


def entry(title: str) -> dict[str, Any]:
    return {"module": "technical", "kind": "procedure", "scope": "global", "title": f"{title} {RUN}",
            "body": f"Write-block test {title} {RUN}: press the grey TEST key once and record it in the remarks.",
            "appliesTo": {"userTypes": ["Office"]}, "evidence": [{"cls": "expert", "reference": "write-block test", "note": "synthetic"}],
            "openPoints": [], "supersedes": []}


async def served() -> int:
    async with db.engine().connect() as c:
        return int((await c.execute(text("SELECT count(*) FROM assistant_chunks WHERE index_set=:s AND kb_state IS NOT NULL"),
                                    {"s": settings().assistant_index_set})).scalar_one())


async def refused(coro: Any) -> tuple[bool, str]:
    try:
        await coro
        return False, "succeeded"
    except kb.KBError as e:
        return e.status == 503, f"{e.status} {e.message}"


async def main() -> int:
    async with db.engine().connect() as c:
        raw = (await c.execute(text("SELECT embedding::text FROM assistant_chunks WHERE index_set=:s AND kb_state IS NULL LIMIT 1"),
                               {"s": settings().assistant_index_set})).scalar_one()
    vec = [float(x) for x in raw.strip("[]").split(",")]
    slow_embed = {"on": False}

    async def fake_embed(*_a: Any, **_k: Any) -> list[float]:
        if slow_embed["on"]:
            await asyncio.sleep(3)
        return vec
    llm.embed = fake_embed  # type: ignore[assignment]

    await kb.set_write_block(False, "write-block test")
    ids = {}
    for t in ("P1", "P2", "P3", "D"):
        ids[t] = (await kb.create_entry(SESS, entry(t)))["entry"]["id"]
    base = await served()

    # A. a publish already INSIDE its write transaction when the block is requested: the block waits; the write commits
    real_write = kb._write_chunk

    async def slow_write(*a: Any, **k: Any) -> None:
        await asyncio.sleep(4)
        await real_write(*a, **k)
    kb._write_chunk = slow_write  # type: ignore[assignment]
    pub = asyncio.create_task(kb.publish(SESS, ids["P1"], "write-block test"))
    await asyncio.sleep(0.8)
    t0 = time.monotonic()
    blk = await kb.set_write_block(True, "write-block test", "test")
    waited = time.monotonic() - t0
    try:
        await pub
        ok_pub = True
    except Exception as e:  # noqa: BLE001
        ok_pub = False
        print("   publish error:", e)
    kb._write_chunk = real_write  # type: ignore[assignment]
    rec("A. block WAITS for a write already in its transaction (drain)", waited >= 2.5, f"waited {waited:.1f} s ({blk})")
    rec("A. that in-progress publish commits normally", ok_pub and await served() == base + 1, f"served {await served()}")

    # B. every knowledge write is refused while blocked
    for name, coro in [("publish", kb.publish(SESS, ids["P2"], "x")), ("Test draft (preview)", kb.prepare_preview(SESS, ids["D"])),
                       ("create", kb.create_entry(SESS, entry("late"))), ("save draft", kb.save_draft(SESS, ids["D"], entry("D2"))),
                       ("retire", kb.retire(SESS, ids["P1"], "x")), ("restore", kb.rollback(SESS, ids["P1"], 1))]:
        ok, got = await refused(coro)
        rec(f"B. {name} refused while blocked (503)", ok, got)
    rec("B. nothing new was written while blocked", await served() == base + 1, f"served {await served()}")

    # C. hold while blocked → 0 served; further attempts still refused; status says SAFE
    await kb_admin._rollback_move(True, "write-block test")
    rec("C. hold moves every knowledge row out of the served set", await served() == 0, f"served {await served()}")
    ok, got = await refused(kb.prepare_preview(SESS, ids["D"]))
    rec("C. a Test draft after the hold is refused and adds nothing", ok and await served() == 0, got)
    ok, got = await refused(kb.publish(SESS, ids["P2"], "x"))
    rec("C. a publish after the hold is refused and adds nothing", ok and await served() == 0, got)

    # D. roll forward: release (still blocked), then unblock
    await kb_admin._rollback_move(False, "write-block test")
    rec("D. release brings the rows back while writes stay blocked", await served() == base + 1 and await kb.write_block_state(),
        f"served {await served()}, blocked {await kb.write_block_state()}")
    await kb.set_write_block(False, "write-block test")

    # E. a publish whose PREPARATION (embedding) started before the block reaches its transaction after it → refused
    slow_embed["on"] = True
    late = asyncio.create_task(kb.publish(SESS, ids["P3"], "write-block test"))
    await asyncio.sleep(0.5)
    t0 = time.monotonic()
    await kb.set_write_block(True, "write-block test", "test")
    quick = time.monotonic() - t0
    ok, got = await refused(late)
    slow_embed["on"] = False
    rec("E. block is immediate when no write is inside a transaction", quick < 1.5, f"{quick:.2f} s")
    rec("E. a publish prepared before the block is refused at its transaction", ok and await served() == base + 1, got)

    # F. hold / release refuse unless writes are blocked
    await kb.set_write_block(False, "write-block test")
    try:
        await kb_admin._rollback_move(True, "write-block test")
        rec("F. hold refuses while writes are NOT blocked", False, "hold ran")
    except SystemExit as e:
        rec("F. hold refuses while writes are NOT blocked", "writes-block" in str(e), str(e))

    # G. trainer grant with a recorded company: that company only; a grant without one: any company
    await kb.grant_trainer(f"co-test-{RUN}", "technical", "company test", "write-block test", issuer="technical-pilotlocal", company="co-A")
    a_ok = await kb.load_grants("technical-pilotlocal", f"co-test-{RUN}", "co-A")
    b_no = await kb.load_grants("technical-pilotlocal", f"co-test-{RUN}", "co-B")
    rec("G. grant WITH company matches only that company", bool(a_ok) and not b_no, f"co-A {sorted(a_ok)} · co-B {sorted(b_no)}")
    any_ok = await kb.load_grants("technical-pilotlocal", "devtest-tech-1", "any-company")
    rec("G. grant WITHOUT company matches any company (unchanged behaviour)", bool(any_ok), sorted(any_ok))
    await kb.revoke_trainer(f"co-test-{RUN}", "technical", "write-block test")

    await kb.retire(SESS, ids["P1"], "write-block test")
    passed = sum(1 for _, ok in results if ok)
    print(f"\n{passed}/{len(results)} passed (run {RUN})")
    await db.engine().dispose()
    return 0 if passed == len(results) else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
