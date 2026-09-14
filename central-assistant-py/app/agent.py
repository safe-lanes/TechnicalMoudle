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
    partial: bool = False
    tools_used: list[str] = field(default_factory=list)


# ── module manifests (Data API discovery) ─────────────────────────────────────────
_manifest_cache: dict[str, dict[str, Any]] = {}


async def manifest_for(module: str) -> dict[str, Any] | None:
    api = settings().module_apis.get(module)
    if not api:
        return None
    cached = _manifest_cache.get(module)
    if cached and time.monotonic() - cached["at"] < settings().manifest_ttl_ms / 1000.0:
        return cached
    try:
        r = await llm.module_client().get(f"{api['url']}/assistant/manifest", headers={"x-service-secret": api["secret"]}, timeout=8.0)
        if r.status_code != 200:
            raise RuntimeError(f"manifest HTTP {r.status_code}")
        j = r.json()
        if j.get("apiVersion") != 1:
            raise RuntimeError(f"unsupported manifest apiVersion {j.get('apiVersion')}")
        entry = {"at": time.monotonic(), "apiVersion": 1, "tools": j.get("tools") or []}
        _manifest_cache[module] = entry
        return entry
    except Exception as e:
        print(f"[assistant] manifest({module}) failed: {e}")
        return cached  # last-known-good if we ever had one


async def execute_module_tool(module: str, tool: str, args: dict[str, Any], identity_token: str, request_id: str) -> dict[str, Any]:
    api = settings().module_apis.get(module)
    if not api:
        return {"ok": False, "error": f"no data API configured for module {module}"}
    try:
        r = await llm.module_client().post(
            f"{api['url']}/assistant/execute",
            headers={"Content-Type": "application/json", "x-service-secret": api["secret"],
                     "x-assistant-identity": identity_token},  # forwarded unmodified (§5.6)
            content=json.dumps({"tool": tool, "args": args, "requestId": request_id}),
            timeout=settings().tool_timeout_ms / 1000.0 + 1.0,  # the hard cut is wait_for in call_tool
        )
        if r.status_code == 401:
            return {"ok": False, "error": "module rejected the forwarded identity"}
        if r.status_code != 200:
            return {"ok": False, "error": f"module API HTTP {r.status_code}"}
        return r.json()
    except Exception as e:
        return {"ok": False, "error": f"{module}/{tool} failed: {e}"}


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
                    execute_module_tool(deps.ui_module, name, args, deps.identity_token, f"{int(deps.started_at)}-{len(deps.tools_used)}"),
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
    return ModelSettings(temperature=0.2, timeout=settings().llm_timeout_ms / 1000.0)


def _usage(result: Any) -> dict[str, int] | None:
    try:
        u = result.usage()
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
# v2 = the cross-reference hard rule, measured 9/12 (3-run majority) on the live index. Wording is
# hashed at import so /health shows what is actually running; bump the label on any change.
PROMPT_VERSION = "v2-xref-hardrule-2026-09-14"

TOOL_LOOP_INSTRUCTIONS = (
    "You are the SAIL Maritime PMS assistant for the {module} module. "
    "For LIVE DATA questions (work orders, spares, running hours, defects, fleet...) call the module data tools. "
    "For HOW-TO questions call search_module_docs and answer ONLY from the excerpts it returns, ending with a \"Source:\" line "
    "naming manual and section; if it reports the topic is not documented, say so plainly — never guess. "
    "HARD RULE — cross-references: an excerpt containing '(Cross-reference resolved: the steps for A are the same as section X …, page N. They are:)' "
    "means the question about A IS covered: answer with those steps and state they are the same as section X (page N); never say 'not covered' then. "
    "If a tool returns an error or a permission refusal, relay it politely and do not retry the same call. "
    "Answer in short plain language; numbered steps for how-tos."
)
PARTIAL_NOTE = "\n\n(Note: answered from partial data — some lookups did not complete in time.)"


async def run_tool_loop(message: str, ui_module: str, identity_token: str, masker: Masker | None, manifest_tools: list[dict[str, Any]]) -> LoopResult:
    deps = Deps(masker=masker, ui_module=ui_module, identity_token=identity_token, started_at=time.monotonic())
    token = current_masker.set(masker)
    try:
        agent: Agent[Deps, str] = Agent(_model(), deps_type=Deps, instructions=TOOL_LOOP_INSTRUCTIONS.format(module=ui_module),
                                        toolsets=[ManifestToolset(manifest_tools)], model_settings=_model_settings(), retries=0)
        result = await agent.run(message, deps=deps)
    finally:
        current_masker.reset(token)
    text = masker.unmask_text(result.output) if masker else result.output
    if deps.partial:
        text = f"{text}{PARTIAL_NOTE}"
    return LoopResult(text=text, tools_used=deps.tools_used, usage=_usage(result), partial=deps.partial)


async def answer_docs(system: str, user: str, masker: Masker | None) -> tuple[str, dict[str, int] | None]:
    """Docs-only answer (no tools) through the SAME masking choke point."""
    token = current_masker.set(masker)
    try:
        agent: Agent[None, str] = Agent(_model(), instructions=system, model_settings=_model_settings(), retries=0)
        result = await agent.run(user)
    finally:
        current_masker.reset(token)
    text = masker.unmask_text(result.output) if masker else result.output
    return text, _usage(result)
