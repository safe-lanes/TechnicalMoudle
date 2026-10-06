"""
Knowledge management (owner brief 30-Sep-2026) — knowledge OWNERS publish corrected guidance into the
existing index; nothing here retrains a model or runs a separate training platform.

  Draft → Preview/test → Publish → Edit (new revision) or Retire; rollback re-publishes an earlier revision.

Guarantees, all enforced here on the server:
  * Only TRAINERS may create, preview, publish, roll back or retire — granted per MODULE in the assistant database
    (kb_trainers, managed with `python -m app.kb_admin`), matched on the verified identity's issuer (the registered
    application instance) AND user id. Owner decision 5-Oct-2026: training happens on DEV only (our own SAILERP, one
    login for all modules; trainers have no login on a client's production), so a grant can only be made for — and
    only matches — an instance whose environment is in ASSISTANT_KB_TRAINER_ENVS (default 'dev'); the company is not
    part of the match. A role (even Sail Admin) grants nothing; the same user id on production gets nothing. Grants are
    read on EVERY request, so a revocation also stops an existing session. Chat access stays with the module's policy.
  * Owner decision 1-Oct-2026: trainers are SAIL staff and train the chatbot for ALL clients, on dev, for ALL
    environments (one central assistant). Every entry is therefore product-wide ('global') and applies in every
    environment ('*'); a publish is live for all clients at once. (The company / environment columns stay in the
    data model and the retrieval filter, so a scoped entry can never leak if one is ever written.)
  * Trainers are managed on the AI server: the admin page /admin/kb (admin token, not reachable publicly) or the
    command `python -m app.kb_admin`.
  * A draft is never served: it is not in the chunk table except as a PREVIEW chunk, which only the trainer's
    preview request retrieves (db.retrieval_scope). A preview is never logged as a conversation.
  * Publish embeds FIRST, then swaps the entry's served chunk and its supersedes in ONE transaction.
    A failure anywhere leaves the previously published revision served.
  * Supersedes are stored per published entry; retiring or rolling back rewrites them, so replaced passages come back.
  * Ordinary users can only file a review item (POST /feedback); it never changes the knowledge.
"""
from __future__ import annotations

import hashlib
import json
import secrets
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import text

from . import db, llm
from .config import MODULE_LABELS, settings

KINDS = {"procedure": "Procedure", "faq": "FAQ", "validation": "Validation rules", "scenario": "Scenario explanation",
         "correction": "Correction"}
EVIDENCE = {"manual": "Manual-derived", "code": "Code-verified", "expert": "Expert-confirmed"}
USER_TYPES = ("Office", "Ship")
MAX_BODY = 12000


class KBError(Exception):
    def __init__(self, status: int, message: str) -> None:
        super().__init__(message)
        self.status = status
        self.message = message


@dataclass(frozen=True)
class Session:
    id: str
    user_id: str
    user_name: str | None
    role: str | None
    tenant: str | None
    iss: str | None
    env: str | None = None
    user_type: str | None = None


@dataclass(frozen=True)
class Grant:
    module: str


def _now() -> datetime:
    return datetime.now(UTC)


def _j(v: Any) -> str:
    return json.dumps(v, ensure_ascii=False)


def env_of(iss: str | None) -> str | None:
    """Environment label of a REGISTERED instance ('dev', 'prod', …); None for an unregistered or missing issuer."""
    inst = settings().module_instances.get(iss or "")
    return (inst.get("env") or None) if inst else None


# ── trainers and permissions ─────────────────────────────────────────────────────────────────────────────────
@dataclass(frozen=True)
class Access:
    """What this verified session may do. Pure (unit-tested); the grants come from load_grants()."""
    sess: Session
    grants: dict[str, Grant]

    def grant(self, module: str) -> Grant | None:
        return self.grants.get((module or "").lower())

    def can_write(self, module: str, scope_tenant: str | None, env_scope: str | None = "*") -> bool:
        """Create/preview/publish/roll back/retire: any trainer of the module, for product-wide entries (all clients,
        all environments — the only kind written since 1-Oct-2026)."""
        return self.grant(module) is not None and scope_tenant is None and env_scope == "*"

    def can_read(self, module: str, scope_tenant: str | None, env_scope: str | None = "*") -> bool:
        return self.grant(module) is not None and scope_tenant is None

    def require_write(self, module: str, scope_tenant: str | None, env_scope: str | None = "*") -> None:
        if not self.can_write(module, scope_tenant, env_scope):
            raise KBError(403, "You are not a knowledge trainer for this module.")


def is_trainer_instance(issuer: str | None) -> bool:
    """A registered instance in a training environment (default: dev only)."""
    env = env_of(issuer)
    return env is not None and env.lower() in settings().kb_trainer_envs


async def load_grants(issuer: str | None, user_id: str | None, tenant: str | None = None) -> dict[str, Grant]:
    """Active grants for exactly this issuer + user id; both must be present and the issuer must be a training-environment
    instance — the same user id from production (or any other environment) gets nothing. 6-Oct-2026: a grant that records
    a company (tenant_domain) also requires the login's company to match; a grant without one matches any company."""
    if not issuer or not user_id or not is_trainer_instance(issuer):
        return {}
    async with db.engine().connect() as c:
        rows = (await c.execute(text(
            "SELECT module FROM kb_trainers WHERE issuer=:i AND user_id=:u AND revoked_at IS NULL "
            "AND (tenant_domain IS NULL OR tenant_domain = :t)"),
            {"i": issuer, "u": user_id, "t": tenant or ""})).all()
    return {r.module.lower(): Grant(r.module.lower()) for r in rows}


async def access(sess: Session) -> Access:
    if (sess.user_type or "").lower() == "ship":
        return Access(sess, {})  # knowledge management is shore-only
    return Access(sess, await load_grants(sess.iss, sess.user_id, sess.tenant))


async def require_trainer(sess: Session) -> Access:
    a = await access(sess)
    if not a.grants:
        raise KBError(403, "You are not a knowledge trainer.")
    return a


# ── sessions (the knowledge screen) ──────────────────────────────────────────────────────────────────────────
async def create_session(identity: dict[str, Any], token: str) -> Session:
    """One-time exchange of a VERIFIED signed identity for a server-side session. A token can be exchanged once.
    Only identities issued by a REGISTERED application instance (environment known) and not a ship user may sign in."""
    iss = identity.get("iss") or None
    env = env_of(iss)
    if not env:
        raise KBError(401, "Sign in from the application (an environment registered with the assistant).")
    user_type = str(identity.get("userType") or "") or None
    if (user_type or "").lower() == "ship":
        raise KBError(403, "Knowledge management is available in the office application only.")
    sid = secrets.token_urlsafe(32)
    tsha = hashlib.sha256(token.encode()).hexdigest()
    hours = max(1, settings().assistant_kb_session_hours)
    async with db.engine().begin() as c:
        seen = (await c.execute(text("SELECT 1 FROM kb_sessions WHERE token_sha=:t"), {"t": tsha})).first()
        if seen:
            raise KBError(401, "This sign-in link was already used. Open the knowledge screen again from the application.")
        await c.execute(text(
            "INSERT INTO kb_sessions (id, token_sha, user_id, user_name, role, tenant_domain, iss, env, user_type, expires_at) "
            "VALUES (:id, :t, :u, :n, :r, :tn, :iss, :env, :ut, now() + make_interval(hours => :h))"),
            {"id": sid, "t": tsha, "u": str(identity.get("userId")), "n": identity.get("userName"), "r": identity.get("role"),
             "tn": identity.get("tenantDomain") or None, "iss": iss, "env": env, "ut": user_type, "h": hours})
    return Session(sid, str(identity.get("userId")), identity.get("userName"), identity.get("role"),
                   identity.get("tenantDomain") or None, iss, env, user_type)


async def get_session(sid: str | None) -> Session | None:
    if not sid:
        return None
    async with db.engine().connect() as c:
        r = (await c.execute(text("SELECT * FROM kb_sessions WHERE id=:id AND expires_at > now()"), {"id": sid})).first()
    if not r:
        return None
    m = r._mapping
    return Session(m["id"], m["user_id"], m["user_name"], m["role"], m["tenant_domain"], m["iss"], m.get("env"), m.get("user_type"))


async def end_session(sid: str) -> None:
    async with db.engine().begin() as c:
        await c.execute(text("DELETE FROM kb_sessions WHERE id=:id"), {"id": sid})


async def me(sess: Session) -> dict[str, Any]:
    a = await access(sess)
    return {"userId": sess.user_id, "userName": sess.user_name, "role": sess.role, "company": sess.tenant, "issuer": sess.iss,
            "environment": sess.env, "trainer": bool(a.grants),
            "modules": [{"module": g.module, "label": MODULE_LABELS.get(g.module, g.module.title())}
                        for g in sorted(a.grants.values(), key=lambda x: x.module)],
            "moduleLabels": MODULE_LABELS}


async def eligibility(identity: dict[str, Any]) -> dict[str, Any]:
    """For the chatbot widget: may this signed user open the knowledge screen, and for which modules? (Display only —
    every action is checked again on the server.)"""
    if (str(identity.get("userType") or "")).lower() == "ship":
        return {"trainer": False, "modules": []}
    grants = await load_grants(identity.get("iss"), str(identity.get("userId") or ""), identity.get("tenantDomain"))
    return {"trainer": bool(grants), "modules": sorted(grants)}


# ── rendering: what the index (and so the chatbot) sees ─────────────────────────────────────────────────────
def evidence_labels(evidence: list[dict[str, Any]]) -> list[str]:
    seen = [EVIDENCE[e["cls"]] for e in evidence if e.get("cls") in EVIDENCE]
    return [lbl for lbl in EVIDENCE.values() if lbl in seen]


def applies_line(a: dict[str, Any]) -> str:
    types = [t for t in (a.get("userTypes") or []) if t in USER_TYPES]
    who = " and ".join(types) if types else "Office and Ship"
    parts = [f"Applies to: {who}"]
    if a.get("roles"):
        parts.append("roles: " + ", ".join(str(r) for r in a["roles"]))
    if a.get("conditions"):
        parts.append("conditions: " + str(a["conditions"]).strip())
    if a.get("appVersion"):
        parts.append("application version: " + str(a["appVersion"]).strip())
    if a.get("environment"):
        parts.append("environment: " + str(a["environment"]).strip())
    return "; ".join(parts) + "."


def file_name(module: str, title: str) -> str:
    return f"{module.title()} - Knowledge: {title.strip()}"


def render(entry: dict[str, Any], rev: dict[str, Any], *, preview: bool, published_by: str | None, when: datetime) -> tuple[str, dict[str, Any]]:
    """(chunk text, chunk metadata) for one revision. One chunk per entry, like the KB-pilot entries."""
    module = entry["module"]
    labels = evidence_labels(rev["evidence"])
    status = ("DRAFT PREVIEW — not published" if preview
              else f"published by {published_by or 'the knowledge owner'}, revision {rev['revision']}, {when:%d %b %Y}")
    lines = [f"# {rev['title'].strip()}",
             f"Knowledge entry for the {MODULE_LABELS.get(module, module.title())} module ({KINDS.get(rev['kind'], rev['kind'])}); "
             f"evidence: {', '.join(labels) or 'not stated'}; {status}.",
             applies_line(rev.get("applies_to") or {}), "", rev["body"].strip(), "", "Evidence:"]
    for e in rev["evidence"]:
        if e.get("cls") in EVIDENCE:
            ref = str(e.get("reference") or "").strip()
            note = str(e.get("note") or "").strip()
            lines.append(f"- {EVIDENCE[e['cls']]}: {ref}{' — ' + note if note else ''}")
    body = "\n".join(lines).strip() + "\n"
    fname = file_name(module, rev["title"])
    crumb = f"{fname} > {'Draft preview' if preview else 'Knowledge entry'}, revision {rev['revision']} ({', '.join(labels) or 'no evidence'})"
    meta = {"file": fname, "breadcrumb": crumb, "section_title": rev["title"].strip(), "source_type": "kb-entry", "chunk_index": 0,
            "module": module, "source": "kb-entry", "kb_entry_id": entry["id"], "kb_revision": rev["revision"],
            "kb_evidence": labels, "kb_scope": entry.get("scope_tenant") or "global", "kb_env": entry.get("env_scope"),
            "kb_body_sha": hashlib.sha256(body.encode()).hexdigest()}
    return body, meta


def embed_input(body: str, meta: dict[str, Any]) -> str:
    """Same 'metadata + text' embedding input as the indexer's meta mode, so entries sit in the same space."""
    keys = ["file", "breadcrumb", "section_title", "source_type", "chunk_index"]
    return "\n".join(f"{k}: {meta[k]}" for k in keys if k in meta) + "\n\n" + body


def publish_problems(entry: dict[str, Any], rev: dict[str, Any]) -> list[str]:
    """Why this revision cannot be published (empty = publishable). Pure."""
    out: list[str] = []
    if not rev["title"].strip():
        out.append("Add a title.")
    if len(rev["body"].strip()) < 20:
        out.append("Write the guidance (at least a sentence).")
    if len(rev["body"]) > MAX_BODY:
        out.append(f"The guidance is too long ({len(rev['body'])} characters; the limit is {MAX_BODY}). Split it into two entries.")
    if not any(e.get("cls") in EVIDENCE and str(e.get("reference") or "").strip() for e in rev["evidence"]):
        out.append("Add at least one piece of supporting evidence (manual page, code reference, or expert confirmation).")
    open_ = [p for p in rev["open_points"] if not p.get("resolved")]
    if open_:
        out.append(f"{len(open_)} point(s) still need expert confirmation. Confirm or remove them before publishing.")
    if rev["kind"] not in KINDS:
        out.append("Choose the type of entry.")
    return out


# ── storage helpers ──────────────────────────────────────────────────────────────────────────────────────────
def _entry(m: Any) -> dict[str, Any]:
    d = dict(m)
    for k in ("created_at", "updated_at"):
        if d.get(k) is not None:
            d[k] = d[k].isoformat()
    return d


def _rev(m: Any) -> dict[str, Any]:
    d = dict(m)
    for k in ("created_at", "published_at"):
        if d.get(k) is not None:
            d[k] = d[k].isoformat()
    for k in ("applies_to", "evidence", "open_points", "supersedes"):
        if isinstance(d.get(k), str):
            d[k] = json.loads(d[k])
    return d


async def _load(c: Any, entry_id: str) -> dict[str, Any]:
    r = (await c.execute(text("SELECT * FROM kb_entries WHERE id=:id"), {"id": entry_id})).first()
    if not r:
        raise KBError(404, "Knowledge entry not found.")
    return _entry(r._mapping)


async def _revision(c: Any, entry_id: str, revision: int) -> dict[str, Any]:
    r = (await c.execute(text("SELECT * FROM kb_revisions WHERE entry_id=:e AND revision=:r"), {"e": entry_id, "r": revision})).first()
    if not r:
        raise KBError(404, f"Revision {revision} not found.")
    return _rev(r._mapping)


async def _audit(c: Any, sess: Session, entry_id: str | None, revision: int | None, action: str, detail: dict[str, Any] | None = None) -> None:
    await c.execute(text("INSERT INTO kb_audit (entry_id, revision, action, actor_id, actor_name, detail) VALUES (:e, :r, :a, :u, :n, CAST(:d AS jsonb))"),
                    {"e": entry_id, "r": revision, "a": action, "u": sess.user_id, "n": sess.user_name, "d": _j(detail or {})})


def _clean_revision_input(b: dict[str, Any]) -> dict[str, Any]:
    raw_applies = b.get("appliesTo")
    applies: dict[str, Any] = raw_applies if isinstance(raw_applies, dict) else {}
    ev = [{"cls": str(e.get("cls")), "reference": str(e.get("reference") or "")[:600], "note": str(e.get("note") or "")[:600]}
          for e in (b.get("evidence") or []) if isinstance(e, dict) and e.get("cls") in EVIDENCE]
    ops = [{"text": str(p.get("text") or "")[:600], "resolved": p.get("resolved") is True, "resolution": str(p.get("resolution") or "")[:1200]}
           for p in (b.get("openPoints") or []) if isinstance(p, dict) and str(p.get("text") or "").strip()]
    sup = [{"chunkId": str(x.get("chunkId")), "file": str(x.get("file") or "")[:300], "section": str(x.get("section") or "")[:300]}
           for x in (b.get("supersedes") or []) if isinstance(x, dict) and x.get("chunkId")]
    return {"title": str(b.get("title") or "").strip()[:200], "kind": str(b.get("kind") or "procedure"),
            "body": str(b.get("body") or "")[: MAX_BODY + 2000],
            "applies_to": {"userTypes": [t for t in (applies.get("userTypes") or []) if t in USER_TYPES],
                           "roles": [str(r)[:80] for r in (applies.get("roles") or []) if str(r).strip()][:20],
                           "conditions": str(applies.get("conditions") or "")[:800],
                           "environment": str(applies.get("environment") or "")[:120],
                           "appVersion": str(applies.get("appVersion") or "")[:120]},
            "evidence": ev, "open_points": ops, "supersedes": sup,
            "internal_notes": str(b.get("internalNotes") or "")[:4000], "change_note": str(b.get("changeNote") or "")[:600]}


async def _insert_revision(c: Any, entry_id: str, revision: int, r: dict[str, Any], sess: Session) -> None:
    await c.execute(text(
        "INSERT INTO kb_revisions (entry_id, revision, title, kind, body, applies_to, evidence, open_points, supersedes, internal_notes, "
        "change_note, author, author_name) VALUES (:e, :n, :t, :k, :b, CAST(:a AS jsonb), CAST(:ev AS jsonb), CAST(:op AS jsonb), "
        "CAST(:sp AS jsonb), :inn, :cn, :au, :aun)"),
        {"e": entry_id, "n": revision, "t": r["title"], "k": r["kind"], "b": r["body"], "a": _j(r["applies_to"]), "ev": _j(r["evidence"]),
         "op": _j(r["open_points"]), "sp": _j(r["supersedes"]), "inn": r["internal_notes"], "cn": r["change_note"],
         "au": sess.user_id, "aun": sess.user_name})


# ── entries ──────────────────────────────────────────────────────────────────────────────────────────────────
async def list_entries(sess: Session, module: str | None, status: str | None) -> list[dict[str, Any]]:
    a = await require_trainer(sess)
    mods = [module.lower()] if module else sorted(a.grants)
    async with db.engine().connect() as c:
        rows = (await c.execute(text(
            "SELECT * FROM kb_entries WHERE lower(module) = ANY(CAST(:m AS text[])) AND (:st = '' OR status = :st) "
            "AND scope_tenant IS NULL ORDER BY updated_at DESC"),
            {"m": [m for m in mods if m in a.grants], "st": status or ""})).all()
    return [_entry(r._mapping) | {"writable": a.can_write(r._mapping["module"], r._mapping["scope_tenant"], r._mapping["env_scope"])}
            for r in rows]


async def get_entry(sess: Session, entry_id: str, a: Access | None = None) -> dict[str, Any]:
    a = a or await access(sess)
    async with db.engine().connect() as c:
        e = await _load(c, entry_id)
        if not a.can_read(e["module"], e["scope_tenant"], e["env_scope"]):
            raise KBError(404, "Knowledge entry not found.")
        revs = [_rev(r._mapping) for r in (await c.execute(text("SELECT * FROM kb_revisions WHERE entry_id=:e ORDER BY revision DESC"), {"e": entry_id})).all()]
        audit = [dict(r._mapping) | {"at": r._mapping["at"].isoformat()} for r in
                 (await c.execute(text("SELECT action, revision, actor_name, actor_id, at, detail FROM kb_audit WHERE entry_id=:e ORDER BY id DESC LIMIT 50"), {"e": entry_id})).all()]
    e["writable"] = a.can_write(e["module"], e["scope_tenant"], e["env_scope"])
    return {"entry": e, "revisions": revs, "audit": audit}


async def _writable_entry(c: Any, sess: Session, entry_id: str) -> tuple[dict[str, Any], Access]:
    """Load an entry and check — on THIS request, from the current grants — that the session may change it."""
    a = await access(sess)
    e = await _load(c, entry_id)
    if not a.grant(e["module"]):  # e.g. a revoked trainer whose session is still open
        raise KBError(403, "You are not (or no longer) a knowledge trainer for this module.")
    if not a.can_read(e["module"], e["scope_tenant"], e["env_scope"]):
        raise KBError(404, "Knowledge entry not found.")
    a.require_write(e["module"], e["scope_tenant"], e["env_scope"])
    return e, a


async def create_entry(sess: Session, b: dict[str, Any]) -> dict[str, Any]:
    module = str(b.get("module") or "").lower()
    scope_tenant: str | None = None  # all clients (owner decision 1-Oct-2026)
    env_scope = "*"                  # all environments: trained on dev, served everywhere
    a = await access(sess)
    a.require_write(module, scope_tenant, env_scope)
    r = _clean_revision_input(b)
    if not r["title"]:
        raise KBError(400, "Add a title.")
    eid = str(uuid.uuid4())
    async with db.engine().begin() as c:
        await _write_guard(c)
        await c.execute(text("INSERT INTO kb_entries (id, module, kind, title, scope_tenant, env_scope, status, draft_revision, created_by, "
                             "created_by_name) VALUES (:id, :m, :k, :t, :s, :env, 'draft', 1, :u, :n)"),
                        {"id": eid, "m": module, "k": r["kind"], "t": r["title"], "s": scope_tenant, "env": env_scope,
                         "u": sess.user_id, "n": sess.user_name})
        await _insert_revision(c, eid, 1, r, sess)
        await _audit(c, sess, eid, 1, "created", {"reviewItem": b.get("reviewItemId"), "environment": env_scope})
        if b.get("reviewItemId"):  # only a report of this module (the trainer's module)
            await c.execute(text("UPDATE kb_review_items SET status='linked', entry_id=:e, updated_at=now() WHERE id=:id AND lower(module)=:m"),
                            {"e": eid, "id": str(b["reviewItemId"]), "m": module})
    return await get_entry(sess, eid, a)


async def save_draft(sess: Session, entry_id: str, b: dict[str, Any]) -> dict[str, Any]:
    """Save the draft. Editing a published or retired entry starts a NEW draft revision; the served revision is untouched."""
    r = _clean_revision_input(b)
    async with db.engine().begin() as c:
        await _write_guard(c)
        e, _a = await _writable_entry(c, sess, entry_id)
        if e["draft_revision"]:
            n = e["draft_revision"]
            await c.execute(text(
                "UPDATE kb_revisions SET title=:t, kind=:k, body=:b, applies_to=CAST(:a AS jsonb), evidence=CAST(:ev AS jsonb), "
                "open_points=CAST(:op AS jsonb), supersedes=CAST(:sp AS jsonb), internal_notes=:inn, change_note=:cn, author=:au, author_name=:aun, "
                "created_at=now() WHERE entry_id=:e AND revision=:n AND published_at IS NULL"),
                {"e": entry_id, "n": n, "t": r["title"], "k": r["kind"], "b": r["body"], "a": _j(r["applies_to"]), "ev": _j(r["evidence"]),
                 "op": _j(r["open_points"]), "sp": _j(r["supersedes"]), "inn": r["internal_notes"], "cn": r["change_note"],
                 "au": sess.user_id, "aun": sess.user_name})
        else:
            n = int((await c.execute(text("SELECT coalesce(max(revision), 0) + 1 FROM kb_revisions WHERE entry_id=:e"), {"e": entry_id})).scalar_one())
            await _insert_revision(c, entry_id, n, r, sess)
        await c.execute(text("UPDATE kb_entries SET draft_revision=:n, title=CASE WHEN status='draft' THEN :t ELSE title END, "
                             "kind=CASE WHEN status='draft' THEN :k ELSE kind END, updated_at=now() WHERE id=:e"),
                        {"n": n, "t": r["title"] or e["title"], "k": r["kind"], "e": entry_id})
        await _audit(c, sess, entry_id, n, "draft saved")
    return await get_entry(sess, entry_id)


async def _prepare_chunk(entry: dict[str, Any], rev: dict[str, Any], *, preview: bool, published_by: str | None) -> tuple[str, dict[str, Any], str]:
    body, meta = render(entry, rev, preview=preview, published_by=published_by, when=_now())
    vec = await llm.embed(embed_input(body, meta), None)  # outside any transaction — a failure changes nothing
    meta["embed_model"] = settings().embed_model
    return body, meta, "[" + ",".join(f"{x:.8f}" for x in vec) + "]"


# ── write block for a safe fast rollback (6-Oct-2026) ─────────────────────────────────────────────────────────
# Every knowledge write takes the SHARED lock and checks the flag inside its own transaction; set_write_block takes the
# EXCLUSIVE lock, so it waits until writes already inside a transaction have committed, and every later write is refused.
WRITE_LOCK_KEY = 724600501


async def _write_guard(c: Any) -> None:
    await c.execute(text("SELECT pg_advisory_xact_lock_shared(:k)"), {"k": WRITE_LOCK_KEY})
    r = (await c.execute(text("SELECT writes_blocked FROM kb_maintenance WHERE id = 1"))).first()
    if r and r.writes_blocked:
        raise KBError(503, "Knowledge changes are paused for maintenance. Nothing was saved — please try again later.")


async def set_write_block(blocked: bool, by: str, reason: str = "", wait_seconds: int = 120) -> dict[str, Any]:
    """Pause (or resume) all knowledge writes. Pausing waits — up to wait_seconds — for writes already in progress."""
    t0 = _now()
    async with db.engine().begin() as c:
        await c.execute(text(f"SET LOCAL lock_timeout = '{int(wait_seconds)}s'"))
        await c.execute(text("SELECT pg_advisory_xact_lock(:k)"), {"k": WRITE_LOCK_KEY})
        await c.execute(text("UPDATE kb_maintenance SET writes_blocked=:b, reason=:r, changed_by=:by, changed_at=now() WHERE id = 1"),
                        {"b": blocked, "r": (reason or "")[:300], "by": (by or "admin")[:120]})
        await c.execute(text("INSERT INTO kb_audit (entry_id, revision, action, actor_id, actor_name, detail) VALUES "
                             "(NULL, NULL, :a, :by, :by, CAST(:d AS jsonb))"),
                        {"a": "knowledge writes paused" if blocked else "knowledge writes resumed", "by": (by or "admin")[:120],
                         "d": _j({"reason": reason or ""})})
    return {"blocked": blocked, "waitedSeconds": round((_now() - t0).total_seconds(), 2)}


async def write_block_state(c: Any | None = None) -> bool:
    if c is not None:
        r = (await c.execute(text("SELECT writes_blocked FROM kb_maintenance WHERE id = 1"))).first()
        return bool(r and r.writes_blocked)
    async with db.engine().connect() as cc:
        return await write_block_state(cc)


async def _write_chunk(c: Any, entry: dict[str, Any], body: str, meta: dict[str, Any], vec: str, state: str) -> None:
    cid = f"kb:{entry['id']}:{state}"
    await c.execute(text("DELETE FROM assistant_chunks WHERE index_set=:s AND id=:id"), {"s": settings().assistant_index_set, "id": cid})
    await c.execute(text(
        "INSERT INTO assistant_chunks (index_set, id, module, file, section_title, breadcrumb, page_number, chunk_index, content, metadata, "
        "embedding, tenant_domain, kb_entry_id, kb_state, kb_env) VALUES (:s, :id, :m, :f, :st, :bc, NULL, 0, :ct, CAST(:md AS jsonb), "
        "CAST(:v AS vector), :tn, :e, :state, :env)"),
        {"s": settings().assistant_index_set, "id": cid, "m": entry["module"], "f": meta["file"], "st": meta["section_title"],
         "bc": meta["breadcrumb"], "ct": body, "md": _j(meta), "v": vec, "tn": entry.get("scope_tenant"), "e": entry["id"], "state": state,
         "env": entry.get("env_scope")})


async def _draft_rev(c: Any, e: dict[str, Any]) -> dict[str, Any]:
    if not e["draft_revision"]:
        raise KBError(409, "There is no draft to test or publish. Edit the entry first.")
    return await _revision(c, e["id"], e["draft_revision"])


async def prepare_preview(sess: Session, entry_id: str) -> dict[str, Any]:
    async with db.engine().connect() as c:
        e, _a = await _writable_entry(c, sess, entry_id)
        rev = await _draft_rev(c, e)
    body, meta, vec = await _prepare_chunk(e, rev, preview=True, published_by=None)
    async with db.engine().begin() as c:
        await _write_guard(c)
        await _write_chunk(c, e, body, meta, vec, "preview")
        await _audit(c, sess, entry_id, rev["revision"], "preview prepared")
    return {"revision": rev["revision"], "text": body, "supersedes": rev["supersedes"]}


async def preview_ask(sess: Session, entry_id: str, question: str) -> dict[str, Any]:
    """Ask the chatbot with THIS draft in place of the published entry — only for this trainer's request.

    1-Oct-2026: the SAME answering path as the widget — the tool loop, with the widget's model, instructions and settings,
    and the trainer's own company and environment — limited to documentation search (knowledge entries are documentation;
    live-data tools need the user's short-lived token, which a knowledge-screen session does not hold). The draft is
    retrievable only inside this request (RetrievalScope), and the test is not stored as a conversation."""
    from . import chat  # local import: chat imports retrieval/agent
    if not question.strip():
        raise KBError(400, "Type a question to test.")
    async with db.engine().connect() as c:
        e, _a = await _writable_entry(c, sess, entry_id)
        rev = await _draft_rev(c, e)
        body, meta = render(e, rev, preview=True, published_by=None, when=_now())
        cur = (await c.execute(text("SELECT metadata->>'kb_body_sha' FROM assistant_chunks WHERE index_set=:s AND id=:id"),
                               {"s": settings().assistant_index_set, "id": f"kb:{entry_id}:preview"})).scalar_one_or_none()
    if cur != meta["kb_body_sha"]:  # the preview is missing or older than the draft → prepare it now
        await prepare_preview(sess, entry_id)
    scope = db.RetrievalScope(tenant=sess.tenant, env=sess.env, preview_entries=(entry_id,),
                              preview_supersedes=tuple(x["chunkId"] for x in rev["supersedes"]))
    identity = {"userId": sess.user_id, "userName": sess.user_name, "role": sess.role or "Sail Admin", "tenantDomain": sess.tenant,
                "iss": sess.iss}
    instance = settings().module_instances.get(sess.iss or "")
    seen: list[str] = []
    tok = db.retrieval_seen.set(seen)
    try:
        status, out = await chat.handle_chat({"message": question, "context": {"module": e["module"]}}, identity, "", instance, scope,
                                             preview=True)
    finally:
        db.retrieval_seen.reset(tok)
    return {"status": status, "response": out.get("response"), "gate": out.get("gate"), "toolsUsed": out.get("toolsUsed") or [],
            "path": "chatbot answer path (tool loop, documentation search)", "draftRetrieved": entry_id in seen,
            "revision": rev["revision"]}


async def _validate_supersedes(c: Any, e: dict[str, Any], rev: dict[str, Any]) -> list[str]:
    ids = [x["chunkId"] for x in rev["supersedes"]]
    if not ids:
        return []
    rows = (await c.execute(text("SELECT id FROM assistant_chunks WHERE index_set=:s AND id = ANY(CAST(:ids AS text[])) AND kb_state IS NULL "
                                 "AND lower(module)=:m"), {"s": settings().assistant_index_set, "ids": ids, "m": e["module"]})).all()
    found = {r[0] for r in rows}
    missing = [i for i in ids if i not in found]
    if missing:
        raise KBError(409, f"{len(missing)} superseded passage(s) are no longer in the index or belong to another module. Remove them and pick again.")
    return ids


async def publish(sess: Session, entry_id: str, change_note: str | None = None, *, revision: int | None = None) -> dict[str, Any]:
    """Publish the draft (or, for a rollback, a given revision). Embed first; swap in one transaction."""
    async with db.engine().connect() as c:
        e, a = await _writable_entry(c, sess, entry_id)
        rev = await _revision(c, entry_id, revision) if revision else await _draft_rev(c, e)
        problems = publish_problems(e, rev)
        if problems:
            raise KBError(409, "Not published: " + " ".join(problems))
    try:
        body, meta, vec = await _prepare_chunk(e, rev, preview=False, published_by=sess.user_name or sess.user_id)
    except KBError:
        raise
    except Exception as ex:  # embedding / provider failure: nothing was changed
        raise KBError(502, f"Not published: the entry could not be prepared for the index ({type(ex).__name__}). "
                           "The previously published version is still in use.") from ex
    try:
        async with db.engine().begin() as c:
            await _write_guard(c)
            ids = await _validate_supersedes(c, e, rev)
            await _write_chunk(c, e, body, meta, vec, "published")
            await c.execute(text("DELETE FROM assistant_chunks WHERE index_set=:s AND id=:id"),
                            {"s": settings().assistant_index_set, "id": f"kb:{entry_id}:preview"})
            await c.execute(text("DELETE FROM kb_supersedes WHERE entry_id=:e"), {"e": entry_id})
            for cid in ids:
                await c.execute(text("INSERT INTO kb_supersedes (entry_id, index_set, chunk_id, tenant_domain, env_scope) "
                                     "VALUES (:e, :s, :c, :t, :env)"),
                                {"e": entry_id, "s": settings().assistant_index_set, "c": cid, "t": e["scope_tenant"], "env": e["env_scope"]})
            await c.execute(text("UPDATE kb_revisions SET published_at=now(), published_by=:u, published_by_name=:n, "
                                 "change_note=CASE WHEN :cn <> '' THEN :cn ELSE change_note END WHERE entry_id=:e AND revision=:r"),
                            {"u": sess.user_id, "n": sess.user_name, "cn": (change_note or "")[:600], "e": entry_id, "r": rev["revision"]})
            await c.execute(text("UPDATE kb_entries SET status='published', published_revision=:r, draft_revision=NULL, title=:t, kind=:k, "
                                 "updated_at=now() WHERE id=:e"), {"r": rev["revision"], "t": rev["title"], "k": rev["kind"], "e": entry_id})
            served = int((await c.execute(text("SELECT count(*) FROM assistant_chunks WHERE index_set=:s AND kb_entry_id=:e AND kb_state='published'"),
                                          {"s": settings().assistant_index_set, "e": entry_id})).scalar_one())
            if served != 1:
                raise KBError(500, "Publish check failed; nothing was changed.")
            await _audit(c, sess, entry_id, rev["revision"], "published" if not revision else "rolled back",
                         {"supersedes": ids, "evidence": meta["kb_evidence"], "scope": meta["kb_scope"], "environment": e["env_scope"]})
    except KBError:
        raise
    except Exception as ex:
        raise KBError(500, f"Not published: the index update failed ({type(ex).__name__}); the previously published version is still in use.") from ex
    return await get_entry(sess, entry_id, a)


async def rollback(sess: Session, entry_id: str, target: int) -> dict[str, Any]:
    """Re-publish an earlier revision as a NEW revision (history stays linear); any open draft is kept in history.
    The earlier revision's supersedes come back with it (publish rewrites them from the revision)."""
    async with db.engine().begin() as c:
        await _write_guard(c)
        e, _a = await _writable_entry(c, sess, entry_id)
        old = await _revision(c, entry_id, target)
        if not old["published_at"]:
            raise KBError(409, "Only a revision that was published can be restored.")
        n = int((await c.execute(text("SELECT coalesce(max(revision), 0) + 1 FROM kb_revisions WHERE entry_id=:e"), {"e": entry_id})).scalar_one())
        copy = {k: old[k] for k in ("title", "kind", "body", "applies_to", "evidence", "open_points", "supersedes", "internal_notes")}
        copy["change_note"] = f"Rollback to revision {target}"
        await _insert_revision(c, entry_id, n, copy, sess)
        await c.execute(text("UPDATE kb_entries SET draft_revision=NULL, updated_at=now() WHERE id=:e"), {"e": entry_id})
    return await publish(sess, entry_id, f"Rollback to revision {target}", revision=n)


async def retire(sess: Session, entry_id: str, reason: str | None = None) -> dict[str, Any]:
    """Stop serving the entry; the passages it superseded are served again. The history stays."""
    async with db.engine().begin() as c:
        await _write_guard(c)
        e, a = await _writable_entry(c, sess, entry_id)
        await c.execute(text("DELETE FROM assistant_chunks WHERE index_set=:s AND kb_entry_id=:e"), {"s": settings().assistant_index_set, "e": entry_id})
        await c.execute(text("DELETE FROM kb_supersedes WHERE entry_id=:e"), {"e": entry_id})
        await c.execute(text("UPDATE kb_entries SET status='retired', updated_at=now() WHERE id=:e"), {"e": entry_id})
        await _audit(c, sess, entry_id, e["published_revision"], "retired", {"reason": (reason or "")[:300]})
    return await get_entry(sess, entry_id, a)


async def search_passages(sess: Session, module: str, q: str) -> list[dict[str, Any]]:
    """Manual passages an entry may supersede (document chunks of the served set, this module)."""
    a = await access(sess)
    if not a.grant(module):
        raise KBError(403, "You are not a knowledge trainer for this module.")
    words = [w for w in q.split() if len(w) > 2][:6]
    if not words:
        return []
    cond = " AND ".join(f"(content ILIKE :w{i} OR section_title ILIKE :w{i})" for i in range(len(words)))
    params: dict[str, Any] = {f"w{i}": f"%{w}%" for i, w in enumerate(words)}
    params |= {"s": settings().assistant_index_set, "m": module.lower()}
    async with db.engine().connect() as c:
        rows = (await c.execute(text(f"SELECT id, file, breadcrumb, section_title, left(content, 400) AS snippet FROM assistant_chunks "
                                     f"WHERE index_set=:s AND lower(module)=:m AND kb_state IS NULL AND {cond} ORDER BY file, id LIMIT 25"), params)).all()
    from .retrieval import manual_of, section_of
    return [{"chunkId": r.id, "file": manual_of({"file": r.file}), "section": section_of({"breadcrumb": r.breadcrumb}), "snippet": r.snippet} for r in rows]


# ── review items (feedback from chat users) ────────────────────────────────────────────────────────────────
async def create_review_item(identity: dict[str, Any], b: dict[str, Any]) -> dict[str, Any]:
    q = str(b.get("question") or "").strip()
    if not q:
        raise KBError(400, "question is required")
    rid = str(uuid.uuid4())
    async with db.engine().begin() as c:
        await c.execute(text(
            "INSERT INTO kb_review_items (id, module, tenant_domain, iss, env, question, answer, citations, note, reporter_id, reporter_name) "
            "VALUES (:id, :m, :t, :iss, :env, :q, :a, CAST(:c AS jsonb), :n, :u, :un)"),
            {"id": rid, "m": str(b.get("module") or "technical").lower()[:40], "t": identity.get("tenantDomain") or None,
             "iss": identity.get("iss") or None, "env": env_of(identity.get("iss")),
             "q": q[:2000], "a": str(b.get("answer") or "")[:12000], "c": _j(b.get("citations") if isinstance(b.get("citations"), list) else []),
             "n": str(b.get("note") or "")[:2000], "u": str(identity.get("userId")), "un": identity.get("userName")})
    return {"ok": True, "id": rid}


def review_visible(a: Access, module: str, tenant: str | None, env: str | None) -> bool:
    """A report reaches every trainer of its module (trainers train for all clients and all environments)."""
    return a.grant(module) is not None


async def list_review_items(sess: Session, module: str | None, status: str | None) -> list[dict[str, Any]]:
    a = await require_trainer(sess)
    mods = [module.lower()] if module else sorted(a.grants)
    async with db.engine().connect() as c:
        rows = (await c.execute(text(
            "SELECT * FROM kb_review_items WHERE lower(module) = ANY(CAST(:m AS text[])) AND (:st = '' OR status = :st) "
            "ORDER BY created_at DESC LIMIT 500"), {"m": [m for m in mods if m in a.grants], "st": status or ""})).all()
    out = []
    for r in rows:
        d = dict(r._mapping)
        if not review_visible(a, d["module"], d["tenant_domain"], d.get("env")):
            continue
        d["created_at"] = d["created_at"].isoformat()
        d["updated_at"] = d["updated_at"].isoformat()
        out.append(d)
    return out[:200]


async def update_review_item(sess: Session, item_id: str, b: dict[str, Any]) -> dict[str, Any]:
    a = await require_trainer(sess)
    status = str(b.get("status") or "")
    if status not in ("new", "linked", "closed"):
        raise KBError(400, "status must be new, linked or closed")
    async with db.engine().begin() as c:
        r = (await c.execute(text("SELECT module, tenant_domain, env FROM kb_review_items WHERE id=:id"), {"id": item_id})).first()
        if not r or not review_visible(a, r.module, r.tenant_domain, r.env):
            raise KBError(404, "Review item not found.")
        await c.execute(text("UPDATE kb_review_items SET status=:s, entry_id=coalesce(:e, entry_id), resolution=:res, updated_at=now() WHERE id=:id"),
                        {"s": status, "e": b.get("entryId"), "res": str(b.get("resolution") or "")[:2000], "id": item_id})
        await _audit(c, sess, b.get("entryId"), None, f"review item {status}", {"reviewItem": item_id})
    return {"ok": True}


async def annotate(entry_id: str, note: str, by: str) -> None:
    """Administrative note on an entry's history (kb_admin): recorded in the audit trail, nothing else changes."""
    async with db.engine().begin() as c:
        await _load(c, entry_id)
        await c.execute(text("INSERT INTO kb_audit (entry_id, revision, action, actor_id, actor_name, detail) "
                             "VALUES (:e, NULL, 'note', :u, :n, CAST(:d AS jsonb))"),
                        {"e": entry_id, "u": by, "n": by, "d": _j({"note": note[:1000]})})


# ── trainer administration (AI server only: /admin/kb page and `python -m app.kb_admin`) ────────────────────
async def list_trainers(include_inactive: bool = True) -> list[dict[str, Any]]:
    async with db.engine().connect() as c:
        rows = (await c.execute(text("SELECT * FROM kb_trainers " + ("" if include_inactive else "WHERE revoked_at IS NULL ") +
                                     "ORDER BY (revoked_at IS NOT NULL), module, display_name, granted_at DESC"))).all()
    out = []
    for r in rows:
        d = dict(r._mapping)
        for k in ("granted_at", "revoked_at"):
            d[k] = d[k].isoformat() if d.get(k) else None
        d["active"] = d["revoked_at"] is None
        d["effective"] = d["active"] and is_trainer_instance(d["issuer"])  # an old non-dev grant matches nobody
        d["moduleLabel"] = MODULE_LABELS.get(d["module"], d["module"].title())
        out.append(d)
    return out


def trainer_instances(module: str | None = None) -> list[str]:
    """Registered training-environment (dev) instances, optionally of one module — where trainers sign in."""
    return sorted(i for i, e in settings().module_instances.items()
                  if is_trainer_instance(i) and (module is None or str(e.get("module") or "").lower() == module))


def resolve_trainer_instance(module: str, issuer: str | None = None) -> str:
    """The dev instance a grant for `module` is made on. Given an issuer it must be a dev instance OF that module;
    without one, the module's only dev instance is used."""
    choices = trainer_instances(module)
    if issuer:
        if issuer not in choices:
            raise KBError(400, f"'{issuer}' is not a connected {'/'.join(sorted(settings().kb_trainer_envs))} instance of the "
                               f"{MODULE_LABELS.get(module, module)} module — trainers are added for the training environment only.")
        return issuer
    if not choices:
        raise KBError(400, f"The {MODULE_LABELS.get(module, module)} module's dev environment is not connected to the assistant yet.")
    if len(choices) > 1:
        raise KBError(400, f"More than one dev instance of {MODULE_LABELS.get(module, module)} is connected; choose one: {', '.join(choices)}.")
    return choices[0]


async def grant_trainer(user_id: str, module: str, name: str, by: str, note: str = "", issuer: str | None = None,
                        company: str | None = None) -> dict[str, Any]:
    """Make a person (their VERIFIED SAILERP dev user id, as the signed login carries it — not a display name) a trainer
    of one module (all clients, all environments). `company`, when given, must also match the login's company. Re-granting
    replaces the active grant; the history keeps both."""
    module = (module or "").lower().strip()
    user_id, by = (user_id or "").strip(), (by or "").strip()
    if module not in MODULE_LABELS:
        raise KBError(400, f"Unknown module '{module}'.")
    if not user_id or not by:
        raise KBError(400, "User id and 'granted by' are required.")
    iss = resolve_trainer_instance(module, (issuer or "").strip() or None)
    async with db.engine().begin() as c:
        await c.execute(text("UPDATE kb_trainers SET revoked_at=now(), revoked_by=:b WHERE issuer=:i AND user_id=:u "
                             "AND module=:m AND revoked_at IS NULL"), {"b": by, "i": iss, "u": user_id, "m": module})
        row = (await c.execute(text("INSERT INTO kb_trainers (issuer, tenant_domain, user_id, module, publish_scope, share_envs, display_name, "
                                    "note, granted_by) VALUES (:i, :co, :u, :m, 'global', true, :n, :note, :b) RETURNING id"),
                               {"i": iss, "co": (company or "").strip() or None, "u": user_id, "m": module, "n": (name or "").strip()[:120],
                                "note": (note or "")[:300], "b": by})).first()
    return {"ok": True, "id": row.id if row else None, "issuer": iss}


async def revoke_trainer(user_id: str, module: str, by: str) -> int:
    """Revoke a person's active grant(s) for one module (any dev instance). Returns how many were revoked."""
    async with db.engine().begin() as c:
        r = await c.execute(text("UPDATE kb_trainers SET revoked_at=now(), revoked_by=:b WHERE user_id=:u AND module=:m "
                                 "AND revoked_at IS NULL"), {"b": (by or "admin")[:120], "u": (user_id or "").strip(),
                                                             "m": (module or "").lower().strip()})
    return int(r.rowcount or 0)


async def deactivate_trainer(trainer_id: int, by: str) -> dict[str, Any]:
    """Revoke one grant; takes effect on the trainer's next request, including an already-open screen."""
    async with db.engine().begin() as c:
        r = await c.execute(text("UPDATE kb_trainers SET revoked_at=now(), revoked_by=:b WHERE id=:id AND revoked_at IS NULL"),
                            {"b": (by or "admin")[:120], "id": trainer_id})
    if not r.rowcount:
        raise KBError(404, "No active trainer grant with that id.")
    return {"ok": True}


async def reactivate_trainer(trainer_id: int, by: str) -> dict[str, Any]:
    async with db.engine().connect() as c:
        r = (await c.execute(text("SELECT * FROM kb_trainers WHERE id=:id"), {"id": trainer_id})).first()
    if not r:
        raise KBError(404, "Trainer grant not found.")
    return await grant_trainer(r.user_id, r.module, r.display_name or "", by, r.note or "", issuer=r.issuer, company=r.tenant_domain)


async def chatbot_users(q: str, limit: int = 20) -> list[dict[str, Any]]:
    """People who have used the chatbot (from the conversation log) — the picker for 'Add trainer'."""
    like = f"%{(q or '').strip()}%"
    async with db.engine().connect() as c:
        rows = (await c.execute(text(
            "SELECT user_id, max(user_name) AS user_name, max(tenant_domain) AS tenant_domain, max(ts) AS last_seen "
            "FROM assistant_conversations WHERE user_id IS NOT NULL AND user_id <> '' AND (user_id ILIKE :q OR "
            "coalesce(user_name, '') ILIKE :q) GROUP BY user_id ORDER BY max(ts) DESC LIMIT :n"),
            {"q": like, "n": limit})).all()
    return [{"userId": r.user_id, "name": r.user_name, "company": r.tenant_domain,
             "lastSeen": r.last_seen.isoformat() if r.last_seen else None} for r in rows]
