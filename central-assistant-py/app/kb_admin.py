"""
Knowledge trainers — grant, revoke, list (1-Oct-2026). The same actions are on the AI-server page /admin/kb.
Run inside the assistant container (it uses the service's own database settings):

  python -m app.kb_admin list [--all]
  python -m app.kb_admin grant  --issuer technical-dev --tenant <login company domain> --user <SAILERP user id> --module technical
                                --name "Full name" --by "<who grants>" [--note "…"]
  python -m app.kb_admin revoke --issuer technical-dev --tenant <login company domain> --user <SAILERP user id> --module technical --by "<who>"
  python -m app.kb_admin note   --entry <entry id> --text "…" --by "<who>"

A trainer trains ONE module for ALL clients and ALL environments (owner decision 1-Oct-2026). The grant is matched on
issuer (the application the trainer signs in through), company (login domain) and user id — all three — so the same
user id from another company or environment gets nothing. Grants and revocations apply on the next request, including
screens already open. Revoked grants stay listed (--all).
"""
from __future__ import annotations

import argparse
import asyncio
import sys

from sqlalchemy import text

from . import db, kb


async def _list(show_all: bool) -> None:
    rows = await kb.list_trainers(include_inactive=show_all)
    if not rows:
        print("no trainers")
    for r in rows:
        state = "active" if r["active"] else f"INACTIVE since {(r['revoked_at'] or '')[:16]} by {r['revoked_by']}"
        print(f"#{r['id']:<4} {r['module']:<10} issuer={r['issuer']:<16} company={r['tenant_domain']:<12} user={r['user_id']:<24} "
              f"{r['display_name'] or '':<28} granted {(r['granted_at'] or '')[:10]} by {r['granted_by']} · {state}"
              f"{' · ' + r['note'] if r['note'] else ''}")


async def _revoke(a: argparse.Namespace) -> None:
    async with db.engine().begin() as c:
        r = await c.execute(text("UPDATE kb_trainers SET revoked_at=now(), revoked_by=:b WHERE issuer=:i AND tenant_domain=:t AND user_id=:u "
                                 "AND module=:m AND revoked_at IS NULL"),
                            {"b": a.by, "i": a.issuer, "t": a.tenant, "u": a.user, "m": a.module.lower()})
    print(f"revoked {r.rowcount} grant(s)")


async def main(argv: list[str]) -> None:
    ap = argparse.ArgumentParser(prog="python -m app.kb_admin", description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    ls = sub.add_parser("list")
    ls.add_argument("--all", action="store_true", help="include revoked grants")
    for name in ("grant", "revoke"):
        p = sub.add_parser(name)
        p.add_argument("--issuer", required=True)
        p.add_argument("--tenant", required=True)
        p.add_argument("--user", required=True)
        p.add_argument("--module", required=True)
        p.add_argument("--by", required=True)
        if name == "grant":
            p.add_argument("--name", default="")
            p.add_argument("--note", default="")
    nt = sub.add_parser("note")
    nt.add_argument("--entry", required=True)
    nt.add_argument("--text", required=True)
    nt.add_argument("--by", required=True)
    a = ap.parse_args(argv)
    try:
        if a.cmd == "list":
            await _list(a.all)
        elif a.cmd == "grant":
            try:
                await kb.grant_trainer(a.issuer, a.tenant, a.user, a.module, a.name, a.by, a.note)
            except kb.KBError as e:
                sys.exit(e.message)
            print(f"granted: {a.module.lower()} (all clients, all environments) to {a.user} @ {a.tenant} via {a.issuer}")
        elif a.cmd == "revoke":
            await _revoke(a)
        else:
            await kb.annotate(a.entry, a.text, a.by)
            print("noted")
    finally:
        await db.engine().dispose()


if __name__ == "__main__":
    asyncio.run(main(sys.argv[1:]))
