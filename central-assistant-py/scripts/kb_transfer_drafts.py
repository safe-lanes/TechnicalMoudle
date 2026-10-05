"""TRACKED (5-Oct-2026): carry the knowledge pilot's useful entries into the official assistant as UNPUBLISHED drafts.

Owner brief 5-Oct-2026: pilot test accounts, reports and published demo content are NOT transferred; the five useful
Technical entries may be, as clearly attributed, unpublished drafts for Jeevan to review.

Run inside an assistant container (it uses that service's DATABASE_URL and index set):
  export  (in the PILOT container):  python scripts/kb_transfer_drafts.py export --out /out/kb-drafts.json
  import  (in the TARGET container): python scripts/kb_transfer_drafts.py import --in /out/kb-drafts.json [--dry-run]

Each entry's LATEST revision (the draft if there is one) becomes revision 1 of a new draft entry: never published,
attributed to development (not to Jeevan), with the pilot origin in the change note and the audit trail. Replaced
manual passages must exist in the target's index set, otherwise the import refuses (nothing is written). Re-running
is a no-op: an entry whose title already exists in the module is skipped.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import sys
import uuid
from typing import Any

from sqlalchemy import text

from app import db
from app.config import settings

TITLES = [
    "Deleting a job",
    "Deactivating a component",
    "Running Hours (RH) counter types",
    "Running Hours (RH) validations when updating RH",
    "Updating the running hours of one component (Gear icon)",
]
AUTHOR_ID = "development"
AUTHOR_NAME = "SAIL development (prepared for Jeevan's review)"
REV_COLS = ("title", "kind", "body", "applies_to", "evidence", "open_points", "supersedes", "internal_notes")


async def export(out: str) -> None:
    rows: list[dict[str, Any]] = []
    async with db.engine().connect() as c:
        for t in TITLES:
            e = (await c.execute(text("SELECT * FROM kb_entries WHERE module='technical' AND title=:t ORDER BY created_at LIMIT 1"),
                                 {"t": t})).first()
            if not e:
                sys.exit(f"not found in the source: {t!r}")
            rev = e.draft_revision or e.published_revision
            r = (await c.execute(text("SELECT * FROM kb_revisions WHERE entry_id=:e AND revision=:r"), {"e": e.id, "r": rev})).first()
            assert r is not None
            rows.append({"source_entry": e.id, "source_revision": rev, "module": e.module,
                         **{k: getattr(r, k) for k in REV_COLS}})
    with open(out, "w", encoding="utf-8") as f:
        json.dump(rows, f, ensure_ascii=False, indent=1)
    for x in rows:
        print(f"exported {x['title']!r} (pilot entry {x['source_entry'][:8]} rev {x['source_revision']})")


async def do_import(path: str, dry_run: bool) -> None:
    rows = json.load(open(path, encoding="utf-8"))
    index_set = settings().assistant_index_set
    async with db.engine().begin() as c:
        missing = []
        for x in rows:
            for s in x["supersedes"] or []:
                ok = (await c.execute(text("SELECT 1 FROM assistant_chunks WHERE index_set=:s AND id=:id AND kb_state IS NULL"),
                                      {"s": index_set, "id": s.get("chunkId")})).first()
                if not ok:
                    missing.append(f"{x['title']}: {s.get('chunkId')} ({s.get('section')})")
        if missing:
            sys.exit("refused — replaced passages not in index set " + index_set + ":\n  " + "\n  ".join(missing))
        for x in rows:
            if (await c.execute(text("SELECT 1 FROM kb_entries WHERE module=:m AND title=:t"), {"m": x["module"], "t": x["title"]})).first():
                print(f"skipped (already present): {x['title']!r}")
                continue
            eid = str(uuid.uuid4())
            note = (f"Imported 5-Oct-2026 from the knowledge pilot (pilot entry {x['source_entry']}, revision "
                    f"{x['source_revision']}). Prepared by development from the application code and pilot tests; NOT yet "
                    "reviewed or confirmed by Jeevan. Unpublished draft.")
            if dry_run:
                print(f"would import {x['title']!r} as draft {eid[:8]}")
                continue
            await c.execute(text("INSERT INTO kb_entries (id, module, kind, title, scope_tenant, status, published_revision, draft_revision, "
                                 "created_by, created_by_name, env_scope) VALUES (:id, :m, :k, :t, NULL, 'draft', NULL, 1, :a, :an, '*')"),
                            {"id": eid, "m": x["module"], "k": x["kind"], "t": x["title"], "a": AUTHOR_ID, "an": AUTHOR_NAME})
            await c.execute(text("INSERT INTO kb_revisions (entry_id, revision, title, kind, body, applies_to, evidence, open_points, "
                                 "supersedes, internal_notes, change_note, author, author_name) VALUES (:e, 1, :t, :k, :b, "
                                 "CAST(:ap AS jsonb), CAST(:ev AS jsonb), CAST(:op AS jsonb), CAST(:su AS jsonb), :inn, :cn, :a, :an)"),
                            {"e": eid, "t": x["title"], "k": x["kind"], "b": x["body"], "ap": json.dumps(x["applies_to"]),
                             "ev": json.dumps(x["evidence"]), "op": json.dumps(x["open_points"]), "su": json.dumps(x["supersedes"]),
                             "inn": x["internal_notes"], "cn": note, "a": AUTHOR_ID, "an": AUTHOR_NAME})
            await c.execute(text("INSERT INTO kb_audit (entry_id, revision, action, actor_id, actor_name, detail) "
                                 "VALUES (:e, 1, 'imported as draft', :a, :an, CAST(:d AS jsonb))"),
                            {"e": eid, "a": AUTHOR_ID, "an": AUTHOR_NAME,
                             "d": json.dumps({"from": "knowledge pilot", "sourceEntry": x["source_entry"], "sourceRevision": x["source_revision"]})})
            print(f"imported {x['title']!r} as unpublished draft {eid[:8]}")
        if dry_run:
            raise SystemExit(0)


async def main() -> None:
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    e = sub.add_parser("export")
    e.add_argument("--out", required=True)
    i = sub.add_parser("import")
    i.add_argument("--in", dest="path", required=True)
    i.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()
    try:
        await (export(a.out) if a.cmd == "export" else do_import(a.path, a.dry_run))
    finally:
        await db.engine().dispose()


if __name__ == "__main__":
    asyncio.run(main())
