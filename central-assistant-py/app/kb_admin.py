"""
Knowledge trainers — grant, revoke, list (1-Oct-2026). Run inside the assistant container (it uses the service's own
database settings):

  python -m app.kb_admin list [--all]
  python -m app.kb_admin grant  --issuer technical-prod --tenant <company domain> --user <SAILERP user id> --module technical
                                --scope company|global [--share-envs] --name "Full name" --by "<who grants>" [--note "…"]
  python -m app.kb_admin revoke --issuer technical-prod --tenant <company domain> --user <SAILERP user id> --module technical --by "<who>"
  python -m app.kb_admin note   --entry <entry id> --text "…" --by "<who>"

A grant is matched on ALL of issuer (the registered application instance the trainer signs in through — it fixes the
environment), company (tenant domain) and user id, for ONE module. 'global' scope = may publish product-wide guidance;
'company' = only the trainer's own company. --share-envs = may publish guidance explicitly shared by all environments.
Grants and revocations apply on the next request — including sessions already open. Revoked grants stay listed (--all).
"""
from __future__ import annotations

import argparse
import asyncio
import sys

from sqlalchemy import text

from . import db, kb
from .config import MODULE_LABELS, settings


async def _list(show_all: bool) -> None:
    async with db.engine().connect() as c:
        rows = (await c.execute(text("SELECT * FROM kb_trainers " + ("" if show_all else "WHERE revoked_at IS NULL ") +
                                     "ORDER BY module, issuer, tenant_domain, user_id, granted_at"))).all()
    if not rows:
        print("no trainers")
    for r in rows:
        state = f"REVOKED {r.revoked_at:%Y-%m-%d %H:%M} by {r.revoked_by}" if r.revoked_at else "active"
        print(f"{r.module:<10} {r.publish_scope:<7} share_envs={'yes' if r.share_envs else 'no ':<3} issuer={r.issuer:<16} "
              f"company={r.tenant_domain:<12} user={r.user_id:<24} {r.display_name or '':<24} granted {r.granted_at:%Y-%m-%d} by "
              f"{r.granted_by} · {state}{' · ' + r.note if r.note else ''}")


async def _grant(a: argparse.Namespace) -> None:
    module = a.module.lower()
    if module not in MODULE_LABELS:
        sys.exit(f"unknown module '{a.module}' (one of: {', '.join(MODULE_LABELS)})")
    if a.issuer not in settings().module_instances:
        sys.exit(f"issuer '{a.issuer}' is not a registered instance (registered: {', '.join(settings().module_instances) or 'none'})")
    async with db.engine().begin() as c:
        cur = (await c.execute(text("SELECT id FROM kb_trainers WHERE issuer=:i AND tenant_domain=:t AND user_id=:u AND module=:m "
                                    "AND revoked_at IS NULL"), {"i": a.issuer, "t": a.tenant, "u": a.user, "m": module})).first()
        if cur:  # changing scope = revoke the old grant and add the new one, so the history shows both
            await c.execute(text("UPDATE kb_trainers SET revoked_at=now(), revoked_by=:b WHERE id=:id"), {"b": a.by, "id": cur.id})
        await c.execute(text("INSERT INTO kb_trainers (issuer, tenant_domain, user_id, module, publish_scope, share_envs, display_name, "
                             "note, granted_by) VALUES (:i, :t, :u, :m, :s, :se, :n, :note, :b)"),
                        {"i": a.issuer, "t": a.tenant, "u": a.user, "m": module, "s": a.scope, "se": a.share_envs,
                         "n": a.name, "note": a.note or "", "b": a.by})
    print(f"granted: {module} ({a.scope}{', shared environments' if a.share_envs else ''}) to {a.user} @ {a.tenant} via {a.issuer}")


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
            p.add_argument("--scope", required=True, choices=["company", "global"])
            p.add_argument("--share-envs", action="store_true")
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
            await _grant(a)
        elif a.cmd == "revoke":
            await _revoke(a)
        else:
            await kb.annotate(a.entry, a.text, a.by)
            print("noted")
    finally:
        await db.engine().dispose()


if __name__ == "__main__":
    asyncio.run(main(sys.argv[1:]))
