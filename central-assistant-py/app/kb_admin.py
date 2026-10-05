"""
Knowledge trainers — grant, revoke, list (1-Oct-2026; dev-only matching 5-Oct-2026). The same actions are on the
AI-server page /admin/kb. Run inside the assistant container (it uses the service's own database settings):

  python -m app.kb_admin list [--all]
  python -m app.kb_admin grant  --user <SAILERP dev user id> --module technical --name "Full name" --by "<who grants>" [--note "…"]
  python -m app.kb_admin revoke --user <SAILERP dev user id> --module technical --by "<who>"
  python -m app.kb_admin note   --entry <entry id> --text "…" --by "<who>"
  python -m app.kb_admin rollback-status | rollback-hold --by "<who>" | rollback-release --by "<who>"

Fast rollback to an image WITHOUT knowledge management (5-Oct-2026): such an image searches assistant_chunks by index
set only, so it would serve knowledge rows — published AND private previews — as ordinary manual passages.
rollback-hold moves every knowledge row out of the served index set (to '<index set>#kb-hold') BEFORE traffic is
switched back; rollback-release moves them back after rolling forward. Nothing is deleted or re-embedded.

A trainer trains ONE module for ALL clients and ALL environments. Training happens on DEV only (our own SAILERP, one
login for all modules), so the grant is made on the module's dev instance (picked automatically; --issuer only when a
module has more than one) and matches only logins from it — the same user id on production gets nothing. Grants and
revocations apply on the next request, including screens already open. Revoked grants stay listed (--all).
"""
from __future__ import annotations

import argparse
import asyncio
import json
import sys

from sqlalchemy import text

from . import db, kb
from .config import settings


async def _list(show_all: bool) -> None:
    rows = await kb.list_trainers(include_inactive=show_all)
    if not rows:
        print("no trainers")
    for r in rows:
        if not r["active"]:
            state = f"INACTIVE since {(r['revoked_at'] or '')[:16]} by {r['revoked_by']}"
        else:
            state = "active" if r["effective"] else "active but NOT EFFECTIVE (not a dev instance)"
        print(f"#{r['id']:<4} {r['module']:<10} user={r['user_id']:<24} {r['display_name'] or '':<28} via {r['issuer']:<16} "
              f"granted {(r['granted_at'] or '')[:10]} by {r['granted_by']} · {state}{' · ' + r['note'] if r['note'] else ''}")


HOLD = "#kb-hold"


async def _rollback_counts() -> tuple[int, int]:
    s = settings().assistant_index_set
    async with db.engine().connect() as c:
        served = (await c.execute(text("SELECT count(*) FROM assistant_chunks WHERE index_set=:s AND "
                                       "(kb_state IS NOT NULL OR kb_entry_id IS NOT NULL)"), {"s": s})).scalar_one()
        held = (await c.execute(text("SELECT count(*) FROM assistant_chunks WHERE index_set=:h"), {"h": s + HOLD})).scalar_one()
    return int(served), int(held)


async def _rollback_move(hold: bool, by: str) -> None:
    s = settings().assistant_index_set
    src, dst = (s, s + HOLD) if hold else (s + HOLD, s)
    cond = "AND (kb_state IS NOT NULL OR kb_entry_id IS NOT NULL)" if hold else ""
    async with db.engine().begin() as c:
        r = await c.execute(text(f"UPDATE assistant_chunks SET index_set=:d WHERE index_set=:s {cond}"), {"d": dst, "s": src})
        await c.execute(text("INSERT INTO kb_audit (entry_id, revision, action, actor_id, actor_name, detail) VALUES "
                             "(NULL, NULL, :a, :b, :b, CAST(:d AS jsonb))"),
                        {"a": "rollback hold" if hold else "rollback release", "b": by[:120],
                         "d": json.dumps({"rows": int(r.rowcount or 0), "from": src, "to": dst})})
    print(f"{'held' if hold else 'released'} {r.rowcount} knowledge row(s): {src} -> {dst}")


async def main(argv: list[str]) -> None:
    ap = argparse.ArgumentParser(prog="python -m app.kb_admin", description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    ls = sub.add_parser("list")
    ls.add_argument("--all", action="store_true", help="include revoked grants")
    for name in ("grant", "revoke"):
        p = sub.add_parser(name)
        p.add_argument("--user", required=True, help="SAILERP user id on dev")
        p.add_argument("--module", required=True)
        p.add_argument("--by", required=True)
        if name == "grant":
            p.add_argument("--name", default="")
            p.add_argument("--note", default="")
            p.add_argument("--issuer", default="", help="only if the module has more than one dev instance")
    nt = sub.add_parser("note")
    nt.add_argument("--entry", required=True)
    nt.add_argument("--text", required=True)
    nt.add_argument("--by", required=True)
    sub.add_parser("rollback-status")
    for name in ("rollback-hold", "rollback-release"):
        sub.add_parser(name).add_argument("--by", required=True)
    a = ap.parse_args(argv)
    try:
        if a.cmd == "list":
            await _list(a.all)
        elif a.cmd == "grant":
            try:
                r = await kb.grant_trainer(a.user, a.module, a.name, a.by, a.note, issuer=a.issuer or None)
            except kb.KBError as e:
                sys.exit(e.message)
            print(f"granted: {a.module.lower()} (all clients, all environments) to {a.user}, signing in on {r['issuer']}")
        elif a.cmd == "revoke":
            print(f"revoked {await kb.revoke_trainer(a.user, a.module, a.by)} grant(s)")
        elif a.cmd == "rollback-status":
            served, held = await _rollback_counts()
            print(f"knowledge rows in the served index set: {served} (must be 0 before switching to an older image); held: {held}")
        elif a.cmd in ("rollback-hold", "rollback-release"):
            await _rollback_move(a.cmd == "rollback-hold", a.by)
            served, held = await _rollback_counts()
            print(f"now: served {served}, held {held}")
        else:
            await kb.annotate(a.entry, a.text, a.by)
            print("noted")
    finally:
        await db.engine().dispose()


if __name__ == "__main__":
    asyncio.run(main(sys.argv[1:]))
