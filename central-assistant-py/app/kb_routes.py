"""
HTTP surface of knowledge management (owner brief 30-Sep-2026).

  GET  /kb                      the knowledge screen (one page, all modules)
  POST /kb/api/session          one-time exchange: verified signed identity → server-side session (HttpOnly cookie)
  *    /kb/api/...              trainer operations; the session decides who you are, the trainer grants (kb_trainers,
                                read on every request) decide what you may do
  GET  /kb/eligibility          any signed user: may I open the knowledge screen, for which modules? (display only)
  POST /feedback                any signed user: report an answer → a review item for the module's trainers (never changes the KB)

Identity is the module's SIGNED identity token (same verification as /chat). The browser never states a role or a
company: both come from the verified token captured in the session. Changes require the x-kb-request header, which
a cross-site form cannot send (CORS does not allow it), on top of the SameSite=Strict cookie.
"""
from __future__ import annotations

from pathlib import Path
from typing import Any

from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse, JSONResponse

from . import kb
from .config import MODULE_LABELS, settings
from .identity import peek_issuer, verify_identity

router = APIRouter()
COOKIE = "kb_session"
_UI = Path(__file__).with_name("kb_ui.html")


def _verify(token: str | None) -> tuple[dict[str, Any] | None, str | None]:
    s = settings()
    iss = peek_issuer(token)
    instance = s.module_instances.get(iss) if iss else None
    if iss and not instance:
        return None, "unknown-issuer"
    v = verify_identity(token, instance["signingKey"] if instance else s.identity_signing_key, s.identity_clock_leeway_sec)
    if not v.ok or v.identity is None:
        return None, v.reason
    ident = dict(v.identity)
    ident["iss"] = iss  # only a VERIFIED issuer is kept
    return ident, None


async def _body(request: Request) -> dict[str, Any]:
    try:
        j = await request.json()
        return j if isinstance(j, dict) else {}
    except Exception:
        return {}


def _err(e: kb.KBError) -> JSONResponse:
    return JSONResponse({"error": e.message}, status_code=e.status)


async def _session(request: Request, *, change: bool) -> kb.Session:
    if change and request.headers.get("x-kb-request") != "1":
        raise kb.KBError(403, "Request refused (missing x-kb-request header).")
    sess = await kb.get_session(request.cookies.get(COOKIE))
    if not sess:
        raise kb.KBError(401, "Your session has ended. Please sign in again.")
    return sess


@router.get("/kb", response_class=HTMLResponse)
async def kb_page() -> HTMLResponse:
    return HTMLResponse(_UI.read_text(encoding="utf-8"), headers={"Cache-Control": "no-store", "X-Frame-Options": "DENY",
                                                                  "Referrer-Policy": "no-referrer"})


@router.post("/kb/api/session")
async def kb_session(request: Request) -> Any:
    b = await _body(request)
    token = str(b.get("token") or "")
    ident, why = _verify(token)
    if not ident:
        return JSONResponse({"error": f"Sign-in refused ({why}). Open the knowledge screen again from the application."}, status_code=401)
    try:
        sess = await kb.create_session(ident, token)
    except kb.KBError as e:
        return _err(e)
    secure = request.headers.get("x-forwarded-proto", request.url.scheme) == "https"
    res = JSONResponse(await kb.me(sess))
    res.set_cookie(COOKIE, sess.id, httponly=True, samesite="strict", secure=secure, max_age=settings().assistant_kb_session_hours * 3600, path="/")
    return res


@router.post("/kb/api/login")
async def kb_login(request: Request) -> Any:
    """Trainer-account sign-in (6-Oct-2026): user id + password; the account's modules are read on every request."""
    if request.headers.get("x-kb-request") != "1":
        return JSONResponse({"error": "Request refused (missing x-kb-request header)."}, status_code=403)
    b = await _body(request)
    try:
        sess = await kb.login(str(b.get("username") or ""), str(b.get("password") or ""))
    except kb.KBError as e:
        return _err(e)
    secure = request.headers.get("x-forwarded-proto", request.url.scheme) == "https"
    res = JSONResponse(await kb.me(sess))
    res.set_cookie(COOKIE, sess.id, httponly=True, samesite="strict", secure=secure, max_age=settings().assistant_kb_session_hours * 3600, path="/")
    return res


@router.post("/kb/api/logout")
async def kb_logout(request: Request) -> Any:
    sid = request.cookies.get(COOKIE)
    if sid:
        await kb.end_session(sid)
    res = JSONResponse({"ok": True})
    res.delete_cookie(COOKIE, path="/")
    return res


def _wrap(fn):  # type: ignore[no-untyped-def]
    async def run(request: Request, change: bool, *a: Any) -> Any:
        try:
            sess = await _session(request, change=change)
            return JSONResponse(await fn(sess, *a))
        except kb.KBError as e:
            return _err(e)
    return run


@router.get("/kb/api/me")
async def kb_me(request: Request) -> Any:
    try:
        return JSONResponse(await kb.me(await _session(request, change=False)))
    except kb.KBError as e:
        return _err(e)


@router.get("/kb/api/entries")
async def kb_list(request: Request) -> Any:
    q = request.query_params
    return await _wrap(lambda s: kb.list_entries(s, q.get("module"), q.get("status")))(request, False)


@router.post("/kb/api/entries")
async def kb_create(request: Request) -> Any:
    b = await _body(request)
    return await _wrap(lambda s: kb.create_entry(s, b))(request, True)


@router.get("/kb/api/entries/{entry_id}")
async def kb_get(request: Request, entry_id: str) -> Any:
    return await _wrap(lambda s: kb.get_entry(s, entry_id))(request, False)


@router.put("/kb/api/entries/{entry_id}/draft")
async def kb_draft(request: Request, entry_id: str) -> Any:
    b = await _body(request)
    return await _wrap(lambda s: kb.save_draft(s, entry_id, b))(request, True)


@router.post("/kb/api/entries/{entry_id}/preview")
async def kb_preview(request: Request, entry_id: str) -> Any:
    return await _wrap(lambda s: kb.prepare_preview(s, entry_id))(request, True)


@router.post("/kb/api/entries/{entry_id}/preview/ask")
async def kb_preview_ask(request: Request, entry_id: str) -> Any:
    b = await _body(request)
    return await _wrap(lambda s: kb.preview_ask(s, entry_id, str(b.get("question") or "")))(request, True)


@router.post("/kb/api/entries/{entry_id}/publish")
async def kb_publish(request: Request, entry_id: str) -> Any:
    b = await _body(request)
    return await _wrap(lambda s: kb.publish(s, entry_id, str(b.get("changeNote") or "")))(request, True)


@router.post("/kb/api/entries/{entry_id}/rollback")
async def kb_rollback(request: Request, entry_id: str) -> Any:
    b = await _body(request)
    try:
        target = int(str(b.get("revision")))
    except (TypeError, ValueError):
        return JSONResponse({"error": "revision is required"}, status_code=400)
    return await _wrap(lambda s: kb.rollback(s, entry_id, target))(request, True)


@router.post("/kb/api/entries/{entry_id}/retire")
async def kb_retire(request: Request, entry_id: str) -> Any:
    b = await _body(request)
    return await _wrap(lambda s: kb.retire(s, entry_id, str(b.get("reason") or "")))(request, True)


@router.get("/kb/api/passages")
async def kb_passages(request: Request) -> Any:
    q = request.query_params
    return await _wrap(lambda s: kb.search_passages(s, q.get("module") or "technical", q.get("q") or ""))(request, False)


@router.get("/kb/api/review-items")
async def kb_reviews(request: Request) -> Any:
    q = request.query_params
    return await _wrap(lambda s: kb.list_review_items(s, q.get("module"), q.get("status")))(request, False)


@router.post("/kb/api/review-items/{item_id}")
async def kb_review_update(request: Request, item_id: str) -> Any:
    b = await _body(request)
    return await _wrap(lambda s: kb.update_review_item(s, item_id, b))(request, True)


# ── trainer administration (1-Oct-2026): AI-server only — /admin/* is denied publicly by nginx (tunnel only) and every
# API call needs the service's admin token (x-admin-token), exactly like the existing /admin endpoints.
_ADMIN_UI = Path(__file__).with_name("kb_admin_ui.html")


def _admin_ok(request: Request) -> bool:
    tok = settings().admin_token
    return bool(tok) and request.headers.get("x-admin-token") == tok


def _admin(fn):  # type: ignore[no-untyped-def]
    async def run(request: Request) -> Any:
        if not _admin_ok(request):
            return JSONResponse({"error": "admin token required"}, status_code=401)
        try:
            return JSONResponse(await fn(request), headers={"Cache-Control": "no-store"})
        except kb.KBError as e:
            return _err(e)
    return run


@router.get("/admin/kb", response_class=HTMLResponse)
async def admin_kb_page() -> HTMLResponse:
    return HTMLResponse(_ADMIN_UI.read_text(encoding="utf-8"), headers={"Cache-Control": "no-store", "X-Frame-Options": "DENY",
                                                                        "Referrer-Policy": "no-referrer"})


@router.get("/admin/kb/api/trainers")
async def admin_trainers(request: Request) -> Any:
    async def f(_r: Request) -> Any:
        mods = settings().module_instances
        return {"trainers": await kb.list_trainers(),
                "trainingEnvs": sorted(settings().kb_trainer_envs),
                "modules": [{"module": k, "label": v, "instances": kb.trainer_instances(k)} for k, v in MODULE_LABELS.items()],
                "instances": [{"issuer": k, "env": v.get("env"), "module": v.get("module")} for k, v in mods.items()]}
    return await _admin(f)(request)


@router.post("/admin/kb/api/trainers")
async def admin_grant(request: Request) -> Any:
    async def f(r: Request) -> Any:
        b = await _body(r)
        return await kb.grant_trainer(str(b.get("userId") or ""), str(b.get("module") or ""), str(b.get("name") or ""),
                                      str(b.get("by") or ""), str(b.get("note") or ""), issuer=str(b.get("issuer") or "") or None,
                                      company=str(b.get("company") or "") or None)
    return await _admin(f)(request)


@router.post("/admin/kb/api/trainers/{trainer_id}/deactivate")
async def admin_deactivate(request: Request, trainer_id: int) -> Any:
    async def f(r: Request) -> Any:
        return await kb.deactivate_trainer(trainer_id, str((await _body(r)).get("by") or "admin page"))
    return await _admin(f)(request)


@router.post("/admin/kb/api/trainers/{trainer_id}/reactivate")
async def admin_reactivate(request: Request, trainer_id: int) -> Any:
    async def f(r: Request) -> Any:
        return await kb.reactivate_trainer(trainer_id, str((await _body(r)).get("by") or "admin page"))
    return await _admin(f)(request)


@router.get("/admin/kb/api/accounts")
async def admin_accounts(request: Request) -> Any:
    async def f(_r: Request) -> Any:
        return {"accounts": await kb.list_accounts(),
                "groups": [{"group": k, "label": v[0], "modules": v[1]} for k, v in kb.TRAINING_GROUPS.items()]}
    return await _admin(f)(request)


@router.post("/admin/kb/api/accounts/{username}/{action}")
async def admin_account_action(request: Request, username: str, action: str) -> Any:
    """disable / enable (passwords are set and reset with `python -m app.kb_admin`, never shown on a page)."""
    async def f(r: Request) -> Any:
        if action not in ("disable", "enable"):
            raise kb.KBError(404, "Unknown action.")
        return await kb.set_account_active(username, action == "enable", str((await _body(r)).get("by") or "admin page"))
    return await _admin(f)(request)


@router.get("/admin/kb/api/users")
async def admin_users(request: Request) -> Any:
    async def f(r: Request) -> Any:
        return {"users": await kb.chatbot_users(r.query_params.get("q") or "")}
    return await _admin(f)(request)


@router.get("/kb/eligibility")
async def kb_eligibility(request: Request) -> Any:
    ident, why = _verify(request.headers.get("x-assistant-identity"))
    if not ident:
        return JSONResponse({"error": f"identity rejected: {why}"}, status_code=401)
    return JSONResponse(await kb.eligibility(ident), headers={"Cache-Control": "no-store"})


@router.post("/feedback")
async def feedback(request: Request) -> Any:
    ident, why = _verify(request.headers.get("x-assistant-identity"))
    if not ident:
        return JSONResponse({"error": f"identity rejected: {why}"}, status_code=401)
    try:
        return JSONResponse(await kb.create_review_item(ident, await _body(request)))
    except kb.KBError as e:
        return _err(e)
