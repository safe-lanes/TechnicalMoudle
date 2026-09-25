"""
POST /chat orchestration — the Node handleChat, gate order unchanged (every gate
before any LLM cost):

  identity (done by the route: 401) → rate limit → resolve pair (first sight: register
  ON + notify) → disabled: clean "not enabled", ZERO LLM → known redirect (§X, zero LLM)
  → tool loop (module has a Data API) | docs path (embed → route → answer)
  → fire-and-forget log row.

Masking fail-closed: any masking error refuses the request BEFORE anything leaves.
"""
from __future__ import annotations

import asyncio
import time
from typing import Any

from . import agent, db, llm, notify, retrieval
from .config import MODULE_LABELS, settings
from .masking import Masker

RATE_MSG = "You're sending requests too quickly — please wait a moment and try again."
NOT_DOC_MSG = "That isn't covered in the module documentation I have. Please rephrase, or contact support if you believe it should be documented."
MASK_ERR_MSG = "The assistant could not process your request safely right now. Please try again in a moment."
GENERIC_ERR = {"response": "I'm having trouble answering right now. Please try again in a moment.", "gate": "error", "citations": []}


def _fire(coro: Any) -> None:
    t = asyncio.create_task(coro)
    t.add_done_callback(lambda f: f.exception() and print(f"[assistant] background task failed (non-fatal): {f.exception()}"))


async def handle_chat(body: dict[str, Any], identity: dict[str, Any], identity_token: str,
                      instance: dict[str, Any] | None = None) -> tuple[int, dict[str, Any]]:
    s = settings()
    started = time.monotonic()
    message = str(body.get("message") or "").strip()
    if not message:
        return 400, {"error": "Message is required"}
    ctx = body.get("context") or {}
    ui_module = str(ctx.get("module") or "technical").lower()
    tenant = str(identity.get("tenantDomain") or "single-tenant")

    masking_on = s.masking_enabled and tenant not in s.masking_disabled_tenants
    masker = Masker() if masking_on else None
    if masker:
        if identity.get("userName"):
            masker.register(identity["userName"], "PERSON")
        if ctx.get("vesselName"):
            masker.register(ctx["vesselName"], "VESSEL")
    log_masked = masking_on and tenant in s.masked_only_log_tenants

    def for_log(t: str | None) -> str | None:
        return masker.mask_text(t) if (log_masked and masker and t is not None) else t

    def log(gate: str, answer: str | None, *, module: str | None = None, citations: list[Any] | None = None,
            confidence: float | None = None, usage: dict[str, int] | None = None, model: str | None = None,
            tools_used: list[str] | None = None) -> None:
        _fire(db.log_conversation(db.ConversationRow(
            tenant_domain=tenant, tuid=identity.get("tuid"), user_id=str(identity.get("userId")), user_name=identity.get("userName"),
            user_role=identity.get("role"), module=module or ui_module, gate=gate, question=for_log(message) or "",
            answer=for_log(answer), citations=citations or [], confidence=confidence, tools_used=tools_used or [],
            tokens_in=(usage or {}).get("prompt_tokens"), tokens_out=(usage or {}).get("completion_tokens"),
            latency_ms=int((time.monotonic() - started) * 1000), model=model, conversation_id=body.get("conversationId"))))

    # ── rate limit (before any store or LLM work) ──
    if not await db.rate_check(str(identity.get("userId")), s.chatbot_rate_window_ms, s.chatbot_rate_max):
        log("rate_limited", RATE_MSG)
        return 200, {"response": RATE_MSG, "gate": "rate_limited", "citations": []}

    # ── client×module pair: self-register default ON; fail-closed once off (ZERO LLM) ──
    pair, is_new = await db.resolve_pair(tenant, identity.get("tuid"), ui_module)
    if is_new:
        _fire(notify.notify_new_pair(pair))
    if not pair.get("enabled"):
        msg = f"The assistant isn't enabled for {MODULE_LABELS.get(ui_module, ui_module)} in your organization. Please contact your administrator."
        log("disabled", msg)
        return 200, {"response": msg, "gate": "disabled", "citations": []}

    # ── known redirects (§X): purchasing / noon report — by design, zero LLM ──
    rd = retrieval.known_redirect(message)
    if rd is not None and body.get("routeOnly") is not True:
        log("redirect", rd.message, module=rd.label.lower().replace(" ", "_"))
        return 200, {"response": rd.message, "gate": "redirect", "module": rd.label, "citations": []}

    try:
        # ── Stage 3: module with a Data API → tool loop (data tools + search_module_docs) ──
        # 24-Sep-2026: live data ONLY for a token whose issuer is a registered instance of the module the widget
        # says it is embedded in; any other token (no issuer, other module) gets documentation answers only.
        live = instance if (instance and instance["module"] == ui_module) else None
        manifest = None if body.get("routeOnly") is True else await agent.manifest_for(live)
        if manifest is not None:
            # the selected vessel travels as context in the message text (masked on the wire); the log keeps the
            # user's own question. Authorisation stays with the module's Data API.
            # the widget's earlier turns ride along as history (masked on the wire like everything else) so
            # follow-ups ('readable format', 'more') refer to the previous answer instead of restarting.
            r = await agent.run_tool_loop(agent.vessel_context_prefix(ctx) + message, ui_module, identity_token, masker, manifest["tools"],
                                          history=agent.build_history(body.get("conversationHistory")), instance=live)
            if masker and masker.warnings:
                print("[assistant] unmask warnings:", masker.warnings)
            log("answer", r.text, module=ui_module, usage=r.usage, model=s.chat_model, tools_used=r.tools_used)
            return 200, {"response": r.text, "gate": "answer", "module": MODULE_LABELS.get(ui_module, ui_module),
                         "toolsUsed": r.tools_used, "partial": r.partial, "usage": r.usage}

        # ── Stage 1 docs path ──
        # Step 4 (owner brief 15-Sep-2026): the same one embedding call; routing may consult the question's own words and
        # the originating module (ASSISTANT_ROUTE_INTENT), excerpt selection may fuse a lexical ranking inside the routed
        # module (ASSISTANT_HYBRID). Both default off = served behaviour. Neither touches identity, tenant or vessel checks.
        history = agent.build_history(body.get("conversationHistory"))
        query = message
        emb = await llm.embed(query, masker)
        hits = await retrieval.retrieve(emb)
        terms = await retrieval.title_terms() if s.assistant_route_intent.lower() == "on" else None
        routed = retrieval.route(hits, query, ui_module, terms)
        if history and routed.gate != "answer" and agent.last_user_turn(history):
            # 23-Sep-2026 follow-ups: 'explain step 2' retrieves nothing on its own words. With the widget's history
            # present and no answerable route, retry ONCE with the previous user question prepended. Without history
            # (every regression suite, the API contract examples) this block never runs — the served path is unchanged.
            query = f"{agent.last_user_turn(history)}\n{message}"
            emb = await llm.embed(query, masker)
            hits = await retrieval.retrieve(emb)
            routed = retrieval.route(hits, query, ui_module, terms)
            reasons_prefix = ["follow-up: retrieved with the previous question"]
        else:
            reasons_prefix = []
        hybrid = s.assistant_hybrid.lower()
        reasons: list[str] = list(reasons_prefix)
        if routed.gate == "answer" and hybrid in ("on", "rescue") and routed.module:
            vec = [h for h in hits if h.module == routed.module and h.distance <= s.route_sim_floor]
            lex = [h for h in await db.search_lexical(emb, masker.mask_text(query) if masker else query, routed.module, s.route_top_k) if h.distance <= s.route_sim_floor]
            if hybrid == "rescue":
                # r7: served selection kept; the lexical leader takes the last slot only if it earns it on relevance
                # (score per content word) AND does not displace materially nearer evidence.
                n_terms = len(retrieval.content_terms(masker.mask_text(query) if masker else query))
                routed.hits, rescued, dropped = retrieval.guarded_lexical_rescue(
                    vec, lex, s.answer_chunks, n_terms, s.assistant_rescue_lex_per_term, s.assistant_rescue_max_penalty)
                if rescued is not None:
                    reasons.append(f"lexical rescue: {str(rescued.meta.get('section_title'))[:40]}")
            else:                    # r5: convex score fusion (measured, superseded — kept for reproducibility)
                routed.hits = retrieval.score_fuse(vec, lex, s.answer_chunks, s.assistant_hybrid_alpha, s.route_sim_floor)
        if routed.gate == "answer" and routed.module and s.assistant_second_opinion_gap > 0:
            # r8: a close module decision widens the evidence by one chunk from the runner-up module (documentation
            # scope only; identity, tenant and vessel checks are untouched).
            routed.hits, second, _dropped2 = retrieval.second_opinion(
                hits, routed.module, list(routed.hits), s.assistant_second_opinion_gap, s.route_sim_floor)
            if second is not None:
                reasons.append(f"second opinion: {second.module} {str(second.meta.get('section_title'))[:34]}")
        if routed.gate == "answer" and routed.module and s.assistant_cross_module_gap > 0:
            # r9: nearest chunk of each other module within the gap, APPENDED — nothing selected is removed.
            routed.hits, appended = retrieval.cross_module_append(
                hits, routed.module, list(routed.hits), s.assistant_cross_module_gap,
                s.assistant_cross_module_slots, s.route_sim_floor)
            for a in appended:
                reasons.append(f"cross-module: {a.module} {str(a.meta.get('section_title'))[:34]}")
        if routed.gate == "not_documented":
            log("not_documented", NOT_DOC_MSG, confidence=routed.confidence)
            return 200, {"response": NOT_DOC_MSG, "gate": "not_documented", "module": None, "citations": [], "confidence": routed.confidence}
        if routed.gate == "clarify":
            msg = f"Your question could relate to more than one module — is this about {' or '.join(routed.candidates)}?"
            log("clarify", msg, confidence=routed.confidence)
            return 200, {"response": msg, "gate": "clarify", "module": None, "candidates": routed.candidates, "citations": [], "confidence": routed.confidence}
        if reasons:
            routed.reason = getattr(routed, "reason", "vector routing") + " | " + " | ".join(reasons)  # type: ignore[attr-defined]
        citations = retrieval.citations_of(routed)
        label = MODULE_LABELS.get(routed.module or "", routed.module)
        if body.get("routeOnly") is True:
            log("route_only", None, module=routed.module, citations=citations, confidence=routed.confidence)
            return 200, {"gate": "answer", "module": label, "confidence": round(routed.confidence, 4), "citations": citations, "routeOnly": True,
                         "routing": getattr(routed, "reason", "vector routing")}
        system, user = retrieval.docs_prompt(message, routed)
        if history:
            # follow-up in a conversation: 'step 2' / 'that' point at the assistant's previous answer (in the history),
            # not at whichever excerpt happens to be numbered. Excerpts still supply every detail (PROVEN needed on the
            # pilot: without this line 'explain step 2' explained step 2 of a different procedure).
            system += (" This message is a follow-up in an ongoing conversation whose earlier turns are provided as history; "
                       "references such as 'step 2' or 'that' point to YOUR previous answer — explain that item, using the excerpts "
                       "for the details, and say plainly if the excerpts do not cover it. Never switch to a different procedure.")
        text, usage = await agent.answer_docs(system, user, masker, history=history)
        if masker and masker.warnings:
            print("[assistant] unmask warnings:", masker.warnings)
        log("answer", text, module=routed.module, citations=citations, confidence=routed.confidence, usage=usage, model=s.chat_model)
        return 200, {"response": text, "gate": "answer", "module": label, "citations": citations, "confidence": round(routed.confidence, 4), "usage": usage,
                     "routing": getattr(routed, "reason", "vector routing")}
    except Exception as e:
        if "mask" in str(e).lower():
            log("masking_error", MASK_ERR_MSG)
            print(f"[assistant] MASKING fail-closed (request refused, nothing sent to LLM): {e}")
            return 200, {"response": MASK_ERR_MSG, "gate": "masking_error", "citations": []}
        raise
