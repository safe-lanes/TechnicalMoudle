"""
The LLM loop on Pydantic AI (owner GO 11-Sep after the §S.1 spike). The four loop
guarantees live in documented hooks, exactly as the spike proved:

  G1  per-tool budget      ManifestToolset.call_tool  → asyncio.wait_for(TOOL_TIMEOUT);
                           a timeout is returned to the model AS DATA, the run continues
  G2  soft deadline        ManifestToolset.get_tools  → publishes NO tools past the deadline
                           (or the iteration cap) so the model must answer from what it has;
                           MaskingModel adds the "answer now" instruction; result is labelled partial
  G3  masking choke point  MaskingModel.request       → every message part + every tool schema
                           is masked immediately before the provider adapter serialises it
  G4  un-mask tool args    ManifestToolset.call_tool  → tokens → real values BEFORE execution

Module tools come from each module's /assistant/manifest (fetched lazily, cached, last-
known-good on failure). The caller's SIGNED identity token is FORWARDED UNMODIFIED to
/assistant/execute (§5.6) — the central service never re-mints or upgrades an identity.
"""
from __future__ import annotations

import asyncio
import contextvars
import dataclasses
import json
import time
from dataclasses import dataclass, field
from typing import Any

from pydantic_ai import Agent, RunContext
from pydantic_ai.messages import (
    ModelMessage,
    ModelRequest,
    ModelResponse,
    RetryPromptPart,
    SystemPromptPart,
    TextPart,
    ToolCallPart,
    ToolReturnPart,
    UserPromptPart,
)
from pydantic_ai.models import ModelRequestParameters
from pydantic_ai.models.openai import OpenAIChatModelSettings
from pydantic_ai.models.wrapper import WrapperModel
from pydantic_ai.settings import ModelSettings
from pydantic_ai.tools import ToolDefinition
from pydantic_ai.toolsets import AbstractToolset
from pydantic_ai.toolsets.abstract import ToolsetTool
from pydantic_core import SchemaValidator, core_schema

from . import llm
from .config import settings
from .masking import Masker
from .retrieval import search_docs_tool

# The masker of the request currently being served — read by the model wrapper, which has
# no RunContext on the non-streaming path. asyncio copies the context into each task, so
# concurrent requests never see each other's masker.
current_masker: contextvars.ContextVar[Masker | None] = contextvars.ContextVar("current_masker", default=None)


@dataclass
class Deps:
    masker: Masker | None
    ui_module: str
    identity_token: str
    started_at: float
    instance: dict[str, Any] | None = None   # the token issuer's REGISTERED instance (url/secret) — the only callback target
    partial: bool = False
    tools_used: list[str] = field(default_factory=list)


# ── module manifests (Data API discovery) ─────────────────────────────────────────
_manifest_cache: dict[str, dict[str, Any]] = {}


async def manifest_for(instance: dict[str, Any] | None) -> dict[str, Any] | None:
    """Tool manifest of a REGISTERED module instance (24-Sep-2026: keyed by the issuer id, never by module
    alone, so a dev and a production instance of the same module never share a cache entry)."""
    if not instance:
        return None
    key = instance["iss"]
    cached = _manifest_cache.get(key)
    if cached and time.monotonic() - cached["at"] < settings().manifest_ttl_ms / 1000.0:
        return cached
    try:
        r = await llm.module_client().get(f"{instance['url']}/assistant/manifest", headers={"x-service-secret": instance["secret"]}, timeout=8.0)
        if 300 <= r.status_code < 400:
            raise RuntimeError(f"manifest redirect ({r.status_code}) refused — the registered URL must answer directly")
        if r.status_code != 200:
            raise RuntimeError(f"manifest HTTP {r.status_code}")
        j = r.json()
        if j.get("apiVersion") != 1:
            raise RuntimeError(f"unsupported manifest apiVersion {j.get('apiVersion')}")
        if str(j.get("module") or "").lower() != instance["module"]:
            raise RuntimeError(f"manifest module '{j.get('module')}' does not match the registration '{instance['module']}'")
        entry = {"at": time.monotonic(), "apiVersion": 1, "tools": j.get("tools") or []}
        _manifest_cache[key] = entry
        return entry
    except Exception as e:
        print(f"[assistant] manifest({key}) failed: {e}")
        return cached  # last-known-good if we ever had one


async def execute_module_tool(instance: dict[str, Any] | None, tool: str, args: dict[str, Any], identity_token: str, request_id: str) -> dict[str, Any]:
    """Call ONE registered instance's /assistant/execute with THAT instance's secret; the user's token is forwarded
    only there (24-Sep-2026). Redirects are never followed and are reported as failures."""
    if not instance:
        return {"ok": False, "error": "no registered data API for this token's issuer"}
    try:
        r = await llm.module_client().post(
            f"{instance['url']}/assistant/execute",
            headers={"Content-Type": "application/json", "x-service-secret": instance["secret"],
                     "x-assistant-identity": identity_token},  # forwarded unmodified (§5.6), to the issuer only
            content=json.dumps({"tool": tool, "args": args, "requestId": request_id}),
            timeout=settings().tool_timeout_ms / 1000.0 + 1.0,  # the hard cut is wait_for in call_tool
        )
        if 300 <= r.status_code < 400:
            return {"ok": False, "error": "module API redirected — refused (the registered URL must answer directly)"}
        if r.status_code == 401:
            return {"ok": False, "error": "module rejected the forwarded identity"}
        if r.status_code != 200:
            return {"ok": False, "error": f"module API HTTP {r.status_code}"}
        return r.json()
    except Exception as e:
        return {"ok": False, "error": f"{instance['iss']}/{tool} failed: {e}"}


SEARCH_DOCS_TOOL = ToolDefinition(
    name="search_module_docs",
    description=("Search the official SAIL user manuals for how-to/procedural information. Use for any question about "
                 "HOW to do something in the application. Returns manual excerpts with manual name and section for "
                 "citation, or reports that the topic is not documented."),
    parameters_json_schema={"type": "object", "properties": {"query": {"type": "string", "description": "The how-to question or topic to look up"}},
                            "required": ["query"]},
)


class ManifestToolset(AbstractToolset[Deps]):
    """search_module_docs + the module's manifest tools, executed over the Data API."""

    id = "manifest"  # type: ignore[assignment]

    def __init__(self, manifest_tools: list[dict[str, Any]]):
        self._defs = [SEARCH_DOCS_TOOL] + [
            ToolDefinition(name=t["name"], description=t.get("description") or "", parameters_json_schema=t.get("parameters") or {"type": "object", "properties": {}})
            for t in manifest_tools
        ]

    async def get_tools(self, ctx: RunContext[Deps]) -> dict[str, ToolsetTool[Deps]]:
        s = settings()
        past_deadline = time.monotonic() - ctx.deps.started_at > s.soft_deadline_ms / 1000.0
        past_cap = getattr(ctx, "run_step", 0) > s.max_tool_iterations
        if past_deadline or past_cap:
            ctx.deps.partial = True  # G2: no more tools — answer from what was gathered
            return {}
        v = SchemaValidator(core_schema.any_schema())
        return {d.name: ToolsetTool(toolset=self, tool_def=d, max_retries=0, args_validator=v, args_validator_func=None) for d in self._defs}

    async def call_tool(self, name: str, tool_args: dict[str, Any], ctx: RunContext[Deps], tool: ToolsetTool[Deps]) -> Any:
        deps = ctx.deps
        s = settings()
        deps.tools_used.append(name)
        args = deps.masker.unmask_json(tool_args) if deps.masker else tool_args  # G4
        if name == "search_module_docs":
            result: Any = await search_docs_tool(str(args.get("query") or ""), deps.masker)
        else:
            try:
                out = await asyncio.wait_for(
                    execute_module_tool(deps.instance, name, args, deps.identity_token, f"{int(deps.started_at)}-{len(deps.tools_used)}"),
                    timeout=s.tool_timeout_ms / 1000.0)
            except TimeoutError:
                out = {"ok": False, "error": f"{deps.ui_module}/{name} timed out"}  # G1: timeout as data
            if out.get("ok") is False and "timed out" in str(out.get("error") or ""):
                deps.partial = True
            result = out.get("data") if out.get("ok") else {"error": out.get("error")}
        if deps.masker:
            deps.masker.learn_from_json(result)   # learn identifiers from REAL data …
            result = deps.masker.mask_json(result)  # … then the result rejoins history masked (G3)
        return _truncate(result)


def _truncate(result: Any, limit: int = 24000) -> Any:
    s = json.dumps(result)
    return result if len(s) <= limit else {"truncated": True, "content": s[:limit]}


class MaskingModel(WrapperModel):
    """ONE outbound choke point (G3): every message part and every tool schema is masked
    here, immediately before the provider adapter serialises the request."""

    @staticmethod
    def _mask_messages(m: Masker, messages: list[ModelMessage]) -> list[ModelMessage]:
        out: list[ModelMessage] = []
        for msg in messages:
            if isinstance(msg, ModelRequest):
                parts: list[Any] = []
                for p in msg.parts:
                    if isinstance(p, (SystemPromptPart, UserPromptPart, RetryPromptPart)) and isinstance(p.content, str):
                        parts.append(dataclasses.replace(p, content=m.mask_text(p.content)))
                    elif isinstance(p, ToolReturnPart):
                        parts.append(dataclasses.replace(p, content=m.mask_json(p.content)))
                    else:
                        parts.append(p)
                instr = getattr(msg, "instructions", None)
                out.append(dataclasses.replace(msg, parts=parts, instructions=m.mask_text(instr) if isinstance(instr, str) else instr))
            elif isinstance(msg, ModelResponse):
                rparts: list[Any] = []
                for rp in msg.parts:
                    if isinstance(rp, TextPart):
                        rparts.append(dataclasses.replace(rp, content=m.mask_text(rp.content)))
                    elif isinstance(rp, ToolCallPart):
                        rparts.append(dataclasses.replace(rp, args=m.mask_json(rp.args)))
                    else:
                        rparts.append(rp)
                out.append(dataclasses.replace(msg, parts=rparts))
            else:
                out.append(msg)
        return out

    def _prepare(self, messages: list[ModelMessage], params: ModelRequestParameters) -> tuple[list[ModelMessage], ModelRequestParameters]:
        m = current_masker.get()
        if m is None:
            return messages, params
        masked = self._mask_messages(m, messages)
        tools = [dataclasses.replace(t, description=m.mask_text(t.description) if t.description else t.description,
                                     parameters_json_schema=m.mask_json(t.parameters_json_schema)) for t in params.function_tools]
        return masked, dataclasses.replace(params, function_tools=tools)

    async def request(self, messages: list[ModelMessage], model_settings: ModelSettings | None, model_request_parameters: ModelRequestParameters) -> ModelResponse:
        messages, model_request_parameters = self._prepare(messages, model_request_parameters)
        return await self.wrapped.request(messages, model_settings, model_request_parameters)

    async def request_stream(self, messages, model_settings, model_request_parameters, run_context=None):  # type: ignore[override]
        messages, model_request_parameters = self._prepare(messages, model_request_parameters)
        async with self.wrapped.request_stream(messages, model_settings, model_request_parameters, run_context) as s:
            yield s


def _model() -> MaskingModel:
    return MaskingModel(llm.chat_model())


def _model_settings() -> ModelSettings:
    """Served sampling settings. CHAT_TEMPERATURE (default "0.2") — set to "default" to send NO temperature: gpt-5.6-luna
    rejects any non-default value (owner decision 1, 15-Sep-2026); the value in force is shown in /health."""
    s = settings()
    t = s.chat_temperature.strip().lower()
    if t in ("", "default", "none"):
        return ModelSettings(timeout=s.llm_timeout_ms / 1000.0)
    return ModelSettings(temperature=float(t), timeout=s.llm_timeout_ms / 1000.0)


def _tool_loop_settings() -> ModelSettings:
    """The tool loop's settings = the served settings + an explicit reasoning effort.

    23-Sep-2026 (pilot, PROVEN): with a module Data API configured, every answer failed with OpenAI 400
    "Function tools with reasoning_effort are not supported for gpt-5.6-luna in /v1/chat/completions …
    set reasoning_effort to 'none'". The request never named an effort — the model's default applied.
    pydantic-ai 2.42 sends OpenAIChatModelSettings.openai_reasoning_effort as `reasoning_effort`.
    Only the tool loop uses this; answer_docs() (no function tools) keeps _model_settings() unchanged."""
    base = _model_settings()
    effort = settings().assistant_tool_reasoning_effort.strip().lower()
    if not effort:
        return base
    return OpenAIChatModelSettings(**base, openai_reasoning_effort=effort)  # type: ignore[typeddict-item]


def _usage(result: Any) -> dict[str, int] | None:
    """Token usage of the run. FIX 15-Sep-2026: in pydantic-ai 2.42 `AgentRunResult.usage` is a PROPERTY, so the former
    `result.usage()` raised TypeError and every conversation row logged tokens as None (found while recording the
    gpt-5.6-luna replay). Handles both shapes."""
    try:
        u = result.usage
        u = u() if callable(u) else u
        return {"prompt_tokens": int(u.input_tokens or 0), "completion_tokens": int(u.output_tokens or 0)}
    except Exception:
        return None


@dataclass
class LoopResult:
    text: str
    tools_used: list[str]
    usage: dict[str, int] | None
    partial: bool


# Answer-prompt version record (owner rule 14-Sep-2026: deploy the EXACT wording that was measured).
# v2 = the cross-reference hard rule (deployed 14-Sep-2026 with the repaired index).
# v3 = v2 + the conditions rule (owner decision 14-Sep, follow-up 1) — measured run H: regressed frozen case 09; SUPERSEDED.
# v4 = v2 + coverage / conditions / sources rules + a labelled per-method format — replayed 15-Sep on captured contexts: better
#      coverage and per-job switch, but fabricated cross-reference statements and 'Applies to: Office' narrowing; SUPERSEDED.
# v5 = v2 + the same three rules in plain form (brief list of supported methods incl. those nested in an overview; numbered
#      explanations with requirements next to the action; explicit Office/Ship differences; no labels; one final source list)
#      + the cross-reference statement restricted to excerpts that contain the resolved text. CANDIDATE ONLY (reviewer + owner
#      15-Sep) until measured on all suites and approved. Wording is hashed at import so /health shows what is running.
def _prompt_version() -> str:
    from .config import settings
    return "v6-evidence-rules-2026-09-18" if settings().assistant_docs_prompt.lower() == "v6" else "v5-plain-coverage-2026-09-15"


class _PV(str):
    """PROMPT_VERSION stays a string for every existing reader, but reflects the configured prompt."""
    def __new__(cls):
        return super().__new__(cls, _prompt_version())


PROMPT_VERSION = _PV()

TOOL_LOOP_INSTRUCTIONS = (
    "You are the SAIL Maritime PMS assistant for the {module} module. "
    "For LIVE DATA questions (work orders, spares, running hours, defects, fleet...) call the module data tools. "
    "For HOW-TO questions call search_module_docs and answer ONLY from the excerpts it returns, ending with a \"Source:\" line "
    "naming manual and section; if it reports the topic is not documented, say so plainly — never guess. "
    "HARD RULE — cross-references: an excerpt containing '(Cross-reference resolved: the steps for A are the same as section X …, page N. They are:)' "
    "means the question about A IS covered: answer with those steps and state they are the same as section X (page N); never say 'not covered' then. "
    "That statement is made ONLY when an excerpt itself contains the resolved cross-reference text; a plain pointer ('Details: <file>', "
    "'see section X') is a link, not evidence of identical steps — never write '(Cross-reference resolved: …)' or 'the steps are the same as …' on your own. "
    "RULE — coverage: if a how-to question is broad (it names no single method, form or button), first list briefly every method the excerpts "
    "support — including methods described separately inside an overview excerpt — then explain each; never answer with one method as if it "
    "were the only one; if the question names a method, answer it and note the other supported methods in one line. "
    "RULE — conditions: explain each method as plain numbered steps with its requirements written directly next to it — role, Office or Ship "
    "applicability, switches or settings, record state — exactly as the excerpt describing that method states them; state Office/Ship "
    "differences wherever the source makes them; never present a conditional action as unconditional, never attach a condition to a different "
    "action, and never drop a condition because another excerpt about the same action does not mention it — an omission in one source is not a contradiction. "
    "RULE — sources: excerpts may be published manuals or draft code-derived guidance (marked as such, or citing application code or a "
    "repository revision); neither automatically overrides the other; where two excerpts actually conflict, state both and name each source; "
    "where an excerpt is marked draft, unverified or revision-specific, say so in one clause. No 'Method' / 'Applies to' / 'Requirements' labels. "
    "If a tool returns an error or a permission refusal, relay it politely and do not retry the same call. "
    "RULE — vessel: the message may start with an [App context] line naming the vessel the user has selected; use that vesselId "
    "for vessel-specific tools unless the user explicitly names a different vessel. NEVER guess, invent or derive a vessel ID — "
    "if no vessel is known, ask the user which vessel. The selection is context only: access is decided by the tools, and a tool "
    "refusal or an 'unknown vessel' error must be relayed as such, never reported as zero records. "
    "RULE — follow-ups: earlier turns of this conversation are provided as history. A short follow-up ('readable format', "
    "'more', 'sort by age', 'and the due ones?') refers to the previous answer: reformat, continue or extend it directly — "
    "never ask what the user wants when the history makes it clear; call a tool again only when new data is needed. "
    "RULE — options: whenever you offer the user a choice of what to ask, include documentation how-to questions (for example "
    "'How do I complete a work order?', 'How do I update running hours?') beside the live-data options. "
    "RULE — running hours: a work order with no calendar due date is due by running hours — say so and quote its due and "
    "current running hours (e.g. '0 of 500 h') instead of 'date not specified'. Never invent a calendar date and never say a job "
    "has reached its due hours unless currentRH is at or above dueRH. When currentRH is below dueRH the job is Due because the "
    "remaining hours are within the vessel's running-hours lead time — state it that way, quoting rhStatusBasis / rhLeadTimeHours; "
    "give no other reason. A reading of 0 h, or one unchanged for a long time, needs confirmation on board — say that; never call it wrong. "
    "RULE — due in a period ('due this week/month'): report the calendar-dated jobs due within the period (calendarDue) as due in "
    "that period; list the currently Due running-hours jobs (runningHoursDue) separately, stating that their calendar due date "
    "cannot be determined from the available hours — never count them in the period figure and never leave them out. "
    "When a summary figure (for example the oldest overdue) is not among the listed rows, name the work order it comes "
    "from and its priority, and say the list is sorted by priority first. "
    "RULE — fresh data: for any request for data (counts, lists, status), call the tool again even if the history holds a "
    "similar figure; reuse the history only to reformat, explain or continue the same result. "
    "RULE — vessel change: if the [App context] vessel of the current message differs from the vessel earlier answers were "
    "about, never reuse those figures — call the tools for the current vessel. Refer to a vessel by its name, never print its ID. "
    "RULE — more: when the user asks for more rows of a list, call the list tool again with the next offset (offset = rows already shown); "
    "when a tool returns fewer than the total, say how many remain. "
    "Answer in short plain language; numbered steps for how-tos."
)


def last_user_turn(history: list[ModelMessage]) -> str:
    """The most recent user text in a built history ('' when none) — the docs path prepends it to a short follow-up
    ('explain step 2') whose own words retrieve nothing."""
    for m in reversed(history):
        if isinstance(m, ModelRequest):
            for p in m.parts:
                if isinstance(p, UserPromptPart) and isinstance(p.content, str):
                    return p.content
    return ""


def build_history(raw: Any, limit: int | None = None) -> list[ModelMessage]:
    """The widget's conversationHistory ([{role, content}, …]) as Pydantic AI message history for the tool loop.

    23-Sep-2026 (pilot, PROVEN): the widget always sent the history and the service dropped it, so 'give that in a
    readable format' was answered with 'what would you like?'. Only the last `assistant_history_messages` messages
    are kept, each capped in length; unknown roles and empty texts are skipped. Every part goes through the same
    masking choke point as the live message (G3, MaskingModel.request), so nothing here bypasses masking."""
    n = settings().assistant_history_messages if limit is None else limit
    if n <= 0 or not isinstance(raw, list):
        return []
    out: list[ModelMessage] = []
    for item in raw[-n:]:
        if not isinstance(item, dict):
            continue
        role = str(item.get("role") or "").lower()
        text = str(item.get("content") or "").strip()[:4000]
        if not text:
            continue
        if role == "user":
            out.append(ModelRequest(parts=[UserPromptPart(content=text)]))
        elif role == "assistant":
            out.append(ModelResponse(parts=[TextPart(content=text)]))
    # history must start with a request and alternate sensibly; drop a leading assistant turn
    while out and isinstance(out[0], ModelResponse):
        out.pop(0)
    return out


def vessel_context_prefix(ctx: dict[str, Any] | None) -> str:
    """The widget's vessel selection, handed to the tool loop as CONTEXT (never as authorisation).

    23-Sep-2026 (pilot, PROVEN): with the vesselId only in the request body, the model asked for an id, or guessed one
    and got zeros. The id and name go into the message text so the existing masking choke point carries them: the
    UUID becomes [ID_n] and the registered name [VESSEL_n] on the wire, and unmask_json() restores the real id in the
    tool arguments — the same path the user-typed id took. Access is still decided by the module's Data API."""
    ctx = ctx or {}
    vid = str(ctx.get("vesselId") or "").strip()
    if not vid:
        return ""
    name = str(ctx.get("vesselName") or "").strip()
    who = f"{name} (vesselId {vid})" if name else f"vesselId {vid}"
    return (f"[App context] Selected vessel: {who}. Use this vesselId for vessel-specific tools unless the user names a "
            f"different vessel; never guess a vessel ID.\n\nUser question: ")
PARTIAL_NOTE = "\n\n(Note: answered from partial data — some lookups did not complete in time.)"


async def run_tool_loop(message: str, ui_module: str, identity_token: str, masker: Masker | None, manifest_tools: list[dict[str, Any]],
                        history: list[ModelMessage] | None = None, instance: dict[str, Any] | None = None) -> LoopResult:
    deps = Deps(masker=masker, ui_module=ui_module, identity_token=identity_token, started_at=time.monotonic(), instance=instance)
    token = current_masker.set(masker)
    try:
        agent: Agent[Deps, str] = Agent(_model(), deps_type=Deps, instructions=TOOL_LOOP_INSTRUCTIONS.format(module=ui_module),
                                        toolsets=[ManifestToolset(manifest_tools)], model_settings=_tool_loop_settings(), retries=0)
        result = await agent.run(message, deps=deps, message_history=history or None)
    finally:
        current_masker.reset(token)
    text = masker.unmask_text(result.output) if masker else result.output
    if deps.partial:
        text = f"{text}{PARTIAL_NOTE}"
    return LoopResult(text=text, tools_used=deps.tools_used, usage=_usage(result), partial=deps.partial)


async def answer_docs(system: str, user: str, masker: Masker | None, history: list[ModelMessage] | None = None) -> tuple[str, dict[str, int] | None]:
    """Docs-only answer (no tools) through the SAME masking choke point. `history` (the widget's earlier turns, bounded
    by build_history) lets a follow-up such as 'explain step 2' refer to the previous answer; without it the path is
    byte-for-byte the served one."""
    token = current_masker.set(masker)
    try:
        agent: Agent[None, str] = Agent(_model(), instructions=system, model_settings=_model_settings(), retries=0)
        result = await agent.run(user, message_history=history or None)
    finally:
        current_masker.reset(token)
    text = masker.unmask_text(result.output) if masker else result.output
    return text, _usage(result)
