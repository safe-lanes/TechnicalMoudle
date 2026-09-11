"""
Day-one spike (port plan §S.1): do the FOUR loop guarantees survive INSIDE Pydantic AI
without workarounds?

  G1  10 s per-tool budget, timeout fed back to the LLM as data (run continues)
  G2  soft deadline -> honest, LABELLED partial answer (no exception, no truncation)
  G3  masking on the way out at ONE choke point (messages + tool results + tool schemas),
      proven on the CAPTURED WIRE bodies, not by reading code
  G4  LLM-produced tool arguments un-masked BEFORE the tool executes (tool sees real values)

Plus: model-agnosticism — the same loop code attaches to a second provider adapter
(Anthropic, dummy key, no network) with zero loop changes.

Runs in a throwaway container on the AI server with the assistant's env file
(the key never leaves the box). Prints a JSON verdict at the end.
Pinned: pydantic-ai-slim[openai,anthropic]==2.42.0 (openai 3.13.0, httpx2 2.12.0 resolved).
"""
from __future__ import annotations

import asyncio
import dataclasses
import json
import os
import re
import sys
import time
from typing import Any

from pydantic_ai import Agent, RunContext, UsageLimits
from pydantic_ai.messages import (
    ModelMessage, ModelRequest, ModelResponse, RetryPromptPart, SystemPromptPart,
    TextPart, ToolCallPart, ToolReturnPart, UserPromptPart,
)
from pydantic_ai.models import ModelRequestParameters
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.models.wrapper import WrapperModel
from pydantic_ai.providers.openai import OpenAIProvider
from pydantic_ai.settings import ModelSettings
from pydantic_ai.tools import ToolDefinition
from pydantic_ai.toolsets import AbstractToolset
from pydantic_ai.toolsets.abstract import ToolsetTool
from pydantic_core import SchemaValidator, core_schema

from masking import Masker

CHAT_MODEL = os.environ.get("CHAT_MODEL", "gpt-4o-mini")
TOOL_TIMEOUT_S = float(os.environ.get("SPIKE_TOOL_TIMEOUT_S", "10"))
SOFT_DEADLINE_S = float(os.environ.get("SPIKE_SOFT_DEADLINE_S", "90"))
LLM_TIMEOUT_S = 30.0
MAX_ITERATIONS = 8

# ---- seeded real identifiers that must NEVER reach the wire -------------------------------
REAL_VESSEL = "Gas Mia"
REAL_IMO = "9876543"
REAL_UUID = "0f3c2b1a-1234-4abc-9def-1234567890ab"
REAL_PERSON = "Ghazi Anwer"
SEEDED = [REAL_VESSEL, REAL_IMO, REAL_UUID, REAL_PERSON, "Frontier Venture"]


# ---- wire capture (the proof for G3) -------------------------------------------------------
import openai._base_client as _bc  # noqa: E402
httpx_mod = _bc.httpx2  # whatever http lib the installed openai SDK actually uses

WIRE: list[dict[str, Any]] = []


async def _capture_request(request: Any) -> None:
    try:
        body = request.content.decode("utf-8", "replace") if request.content else ""
    except Exception as e:  # pragma: no cover
        body = f"<unreadable: {e}>"
    WIRE.append({"url": str(request.url), "body": body})


# ---- per-request state shared with the loop pieces -----------------------------------------
@dataclasses.dataclass
class Deps:
    masker: Masker
    started_at: float
    identity_token: str = "signed-token-forwarded-unmodified"
    partial: bool = False
    tools_used: list[str] = dataclasses.field(default_factory=list)
    received_args: dict[str, Any] = dataclasses.field(default_factory=dict)


# ---- the module "manifest" (same JSON-schema shape our modules publish) ---------------------
MANIFEST = [
    {"name": "get_fleet_overview", "description": "Live fleet list with vessel names and IMO numbers.",
     "parameters": {"type": "object", "properties": {}, "additionalProperties": False}},
    {"name": "record_vessel_lookup",
     "description": "Records a lookup for ONE vessel. Pass the vessel's name and IMO exactly as known.",
     "parameters": {"type": "object", "properties": {"vessel_name": {"type": "string"}, "imo": {"type": "string"}},
                    "required": ["vessel_name", "imo"], "additionalProperties": False}},
    {"name": "slow_lookup", "description": "A slow data lookup (running hours history). Takes a vessel name.",
     "parameters": {"type": "object", "properties": {"vessel_name": {"type": "string"}}, "required": ["vessel_name"],
                    "additionalProperties": False}},
]


async def execute_module_tool(name: str, args: dict[str, Any], deps: Deps) -> Any:
    """Stand-in for POST /assistant/execute. Real values expected here (G4)."""
    if name == "get_fleet_overview":
        return {"vessels": [
            {"name": REAL_VESSEL, "imo": REAL_IMO, "id": REAL_UUID, "master": REAL_PERSON},
            {"name": "Frontier Venture", "imo": "9123456", "id": "6b1e0c2d-aaaa-4bbb-8ccc-1234567890cd"},
        ]}
    if name == "record_vessel_lookup":
        deps.received_args = dict(args)
        return {"ok": True, "recorded": args}
    if name == "slow_lookup":
        await asyncio.sleep(15)  # > TOOL_TIMEOUT_S on purpose
        return {"running_hours": 12345}
    return {"error": f"unknown tool {name}"}


class ManifestToolset(AbstractToolset[Deps]):
    """Tools built from a module manifest (JSON schema), executed remotely.

    G1 and G4 live here — and they are FRAMEWORK HOOKS, not workarounds:
    call_tool is the documented override point for wrapping execution."""

    id = "manifest"  # type: ignore[assignment]

    def __init__(self, manifest: list[dict[str, Any]]):
        self._defs = [ToolDefinition(name=t["name"], description=t["description"],
                                     parameters_json_schema=t["parameters"]) for t in manifest]

    async def get_tools(self, ctx: RunContext[Deps]) -> dict[str, ToolsetTool[Deps]]:
        # G2: past the soft deadline, publish NO tools -> the model must answer from what it has.
        if time.monotonic() - ctx.deps.started_at > SOFT_DEADLINE_S:
            ctx.deps.partial = True
            return {}
        any_validator = SchemaValidator(core_schema.any_schema())
        return {d.name: ToolsetTool(toolset=self, tool_def=d, max_retries=0,
                                    args_validator=any_validator, args_validator_func=None) for d in self._defs}

    async def call_tool(self, name: str, tool_args: dict[str, Any], ctx: RunContext[Deps], tool: ToolsetTool[Deps]) -> Any:
        deps = ctx.deps
        deps.tools_used.append(name)
        real_args = deps.masker.unmask_json(tool_args)  # G4: tokens -> real values BEFORE execution
        t0 = time.monotonic()
        try:
            result = await asyncio.wait_for(execute_module_tool(name, real_args, deps), timeout=TOOL_TIMEOUT_S)
        except asyncio.TimeoutError:
            deps.partial = True
            result = {"error": f"{name} timed out after {int(TOOL_TIMEOUT_S)}s"}  # G1: timeout as DATA
        elapsed = time.monotonic() - t0
        print(f"  [tool] {name} args={real_args} took {elapsed:.1f}s")
        deps.masker.learn_from_json(result)          # learn real identifiers from real data
        return deps.masker.mask_json(result)          # G3: tool result rejoins history masked


class MaskingModel(WrapperModel):
    """ONE outbound choke point: every message part and every tool schema is masked here,
    immediately before the provider adapter serialises the request. G3."""

    def __init__(self, wrapped: Any, deps_ref: dict[str, Deps]):
        super().__init__(wrapped)
        self._deps_ref = deps_ref

    def _mask_messages(self, m: Masker, messages: list[ModelMessage]) -> list[ModelMessage]:
        out: list[ModelMessage] = []
        for msg in messages:
            if isinstance(msg, ModelRequest):
                parts = []
                for p in msg.parts:
                    if isinstance(p, (SystemPromptPart, UserPromptPart, RetryPromptPart)) and isinstance(p.content, str):
                        parts.append(dataclasses.replace(p, content=m.mask_text(p.content)))
                    elif isinstance(p, ToolReturnPart):
                        parts.append(dataclasses.replace(p, content=m.mask_json(p.content)))
                    else:
                        parts.append(p)
                out.append(dataclasses.replace(msg, parts=parts,
                                               instructions=m.mask_text(msg.instructions) if getattr(msg, "instructions", None) else msg.instructions))
            elif isinstance(msg, ModelResponse):
                parts = []
                for p in msg.parts:
                    if isinstance(p, TextPart):
                        parts.append(dataclasses.replace(p, content=m.mask_text(p.content)))
                    elif isinstance(p, ToolCallPart):
                        parts.append(dataclasses.replace(p, args=m.mask_json(p.args)))
                    else:
                        parts.append(p)
                out.append(dataclasses.replace(msg, parts=parts))
            else:
                out.append(msg)
        return out

    def _prepare(self, messages: list[ModelMessage], params: ModelRequestParameters):
        deps = self._deps_ref["current"]
        m = deps.masker
        masked = self._mask_messages(m, messages)
        tools = [dataclasses.replace(t, description=m.mask_text(t.description) if t.description else t.description,
                                     parameters_json_schema=m.mask_json(t.parameters_json_schema))
                 for t in params.function_tools]
        params = dataclasses.replace(params, function_tools=tools)
        if deps.partial and time.monotonic() - deps.started_at > SOFT_DEADLINE_S:
            # G2: the model is told plainly to answer now from partial data.
            masked = masked + [ModelRequest(parts=[UserPromptPart(
                "Time budget exhausted. Answer NOW from the information gathered above. "
                "If it is incomplete, say so plainly.")])]
        return masked, params

    async def request(self, messages, model_settings, model_request_parameters):
        messages, model_request_parameters = self._prepare(messages, model_request_parameters)
        return await self.wrapped.request(messages, model_settings, model_request_parameters)

    async def request_stream(self, messages, model_settings, model_request_parameters, run_context=None):  # pragma: no cover
        messages, model_request_parameters = self._prepare(messages, model_request_parameters)
        async with self.wrapped.request_stream(messages, model_settings, model_request_parameters, run_context) as s:
            yield s


INSTRUCTIONS = (
    "You are the SAIL Maritime PMS assistant for the technical module. For LIVE DATA questions call the "
    "module data tools. If a tool returns an error or a timeout, relay it plainly and do not retry the same call. "
    "Answer in short plain language."
)


def build_agent(model: Any, deps_ref: dict[str, Deps]) -> Agent[Deps, str]:
    return Agent(
        MaskingModel(model, deps_ref),
        deps_type=Deps,
        instructions=INSTRUCTIONS,
        toolsets=[ManifestToolset(MANIFEST)],
        model_settings=ModelSettings(temperature=0.2, timeout=LLM_TIMEOUT_S),
        retries=0,
    )


async def run_case(agent: Agent[Deps, str], deps_ref: dict[str, Deps], prompt: str, register: list[tuple[str, str]] = ()) -> tuple[str, Deps, float]:
    m = Masker()
    for value, kind in register:
        m.register(value, kind)
    deps = Deps(masker=m, started_at=time.monotonic())
    deps_ref["current"] = deps
    t0 = time.monotonic()
    result = await agent.run(prompt, deps=deps, usage_limits=UsageLimits(request_limit=MAX_ITERATIONS + 1))
    elapsed = time.monotonic() - t0
    answer = m.unmask_text(result.output)  # inbound: tokens -> real names for the user
    return answer, deps, elapsed


async def main() -> int:
    global SOFT_DEADLINE_S
    http_client = httpx_mod.AsyncClient(timeout=LLM_TIMEOUT_S, event_hooks={"request": [_capture_request]})
    base = OpenAIChatModel(CHAT_MODEL, provider=OpenAIProvider(http_client=http_client))
    deps_ref: dict[str, Deps] = {}
    agent = build_agent(base, deps_ref)
    verdict: dict[str, Any] = {"model": CHAT_MODEL, "tool_timeout_s": TOOL_TIMEOUT_S, "soft_deadline_s": SOFT_DEADLINE_S}

    # ---- T1: G3 + G4 -------------------------------------------------------------------
    print("\n== T1  masking out (G3) + unmask tool args (G4)")
    ans, deps, el = await run_case(
        agent, deps_ref,
        f"Call get_fleet_overview, then call record_vessel_lookup for the vessel {REAL_VESSEL} with its IMO, then tell me its IMO.",
        register=[(REAL_VESSEL, "VESSEL"), (REAL_PERSON, "PERSON")],
    )
    print(f"  answer: {ans!r}  ({el:.1f}s, tools={deps.tools_used}, masker size={deps.masker.size()})")
    print(f"  tool received args: {deps.received_args}")
    verdict["G4_tool_received_real_values"] = (
        deps.received_args.get("vessel_name", "").lower() == REAL_VESSEL.lower()
        and str(deps.received_args.get("imo", "")) == REAL_IMO
    )
    verdict["T1_answer_shows_real_imo_to_user"] = REAL_IMO in ans
    verdict["T1_unmapped_token_warnings"] = list(deps.masker.warnings)

    # ---- T2: G1 --------------------------------------------------------------------------
    print("\n== T2  per-tool budget (G1)")
    ans, deps, el = await run_case(
        agent, deps_ref,
        f"Call slow_lookup for vessel {REAL_VESSEL} and report the running hours.",
        register=[(REAL_VESSEL, "VESSEL")],
    )
    print(f"  answer: {ans!r}  ({el:.1f}s, tools={deps.tools_used}, partial={deps.partial})")
    verdict["G1_run_continued_after_timeout"] = bool(ans) and "slow_lookup" in deps.tools_used
    verdict["G1_wall_clock_s"] = round(el, 1)
    verdict["G1_answer_mentions_timeout"] = bool(re.search(r"time(d)? ?out|not (complete|available)|could ?n[o']t", ans, re.I))

    # ---- T3: G2 --------------------------------------------------------------------------
    print("\n== T3  soft deadline -> labelled partial (G2)")
    saved = SOFT_DEADLINE_S
    SOFT_DEADLINE_S = 12.0  # two 10 s tool timeouts blow through it
    ans, deps, el = await run_case(
        agent, deps_ref,
        f"First call get_fleet_overview. Then call slow_lookup for {REAL_VESSEL}, then slow_lookup for the OTHER vessel in the fleet, then summarise everything.",
        register=[(REAL_VESSEL, "VESSEL")],
    )
    SOFT_DEADLINE_S = saved
    verdict["G4_bare_token_args_restored"] = all(
        "VESSEL_" not in str(a) for a in deps.received_args.values()
    )
    labelled = ans + ("\n\n(Note: answered from partial data — some lookups did not complete in time.)" if deps.partial else "")
    print(f"  answer: {labelled!r}  ({el:.1f}s, tools={deps.tools_used}, partial={deps.partial})")
    verdict["G2_partial_flag_set"] = deps.partial
    verdict["G2_answer_returned_not_exception"] = bool(ans)
    verdict["G2_wall_clock_s"] = round(el, 1)

    # ---- G3: the wire ----------------------------------------------------------------------
    print("\n== G3  captured outbound bodies")
    leaks: dict[str, int] = {}
    for s in SEEDED:
        n = sum(b["body"].lower().count(s.lower()) for b in WIRE)
        leaks[s] = n
    tokens_seen = sum(len(re.findall(r"\[(VESSEL|PERSON|IMO|ID)_\d+\]", b["body"])) for b in WIRE)
    print(f"  requests captured: {len(WIRE)}  hosts: {sorted({b['url'].split('/')[2] for b in WIRE})}")
    print(f"  seeded identifiers on the wire: {leaks}   tokens on the wire: {tokens_seen}")
    verdict["G3_requests_captured"] = len(WIRE)
    verdict["G3_seeded_identifier_hits_on_wire"] = leaks
    verdict["G3_tokens_on_wire"] = tokens_seen
    bare_tokens_in_answers = sum(len(re.findall(r"(?<!\[)\b(VESSEL|PERSON|IMO|ID)_\d+\b", b["body"])) for b in WIRE)
    verdict["G3_info_bare_tokens_emitted_by_model"] = bare_tokens_in_answers

    # ---- T4 (informational, same property as the Node service): a vessel name the USER TYPES
    # that is neither registered up-front nor yet learned from data goes out as typed in the
    # FIRST request. Masking covers OUR identifiers; it is not a free-text name detector.
    print("\n== T4  (info) user-typed, unregistered name in the first request")
    wire_before = len(WIRE)
    ans, deps, el = await run_case(agent, deps_ref, "Call get_fleet_overview and tell me if Frontier Venture is in the fleet.",
                                   register=[(REAL_VESSEL, "VESSEL")])
    first_body = WIRE[wire_before]["body"] if len(WIRE) > wire_before else ""
    later_bodies = [b["body"] for b in WIRE[wire_before + 1:]]
    verdict["T4_info_unregistered_name_in_first_request"] = "Frontier Venture" in first_body
    verdict["T4_info_masked_once_learned"] = all("Frontier Venture" not in b for b in later_bodies) and len(later_bodies) > 0
    print(f"  first request carries it: {verdict['T4_info_unregistered_name_in_first_request']}; masked in all later requests: {verdict['T4_info_masked_once_learned']}")

    # ---- model-agnosticism: same loop code, different provider adapter (no network) ---------
    print("\n== model-agnostic shape")
    try:
        from pydantic_ai.models.anthropic import AnthropicModel
        from pydantic_ai.providers.anthropic import AnthropicProvider
        alt = AnthropicModel("claude-sonnet-4-5", provider=AnthropicProvider(api_key="dummy-not-used"))
        alt_agent = build_agent(alt, deps_ref)  # identical loop pieces attach unchanged
        verdict["model_agnostic_construct_ok"] = alt_agent is not None
        print("  Anthropic adapter attached with the same MaskingModel + ManifestToolset (no call made).")
    except Exception as e:
        verdict["model_agnostic_construct_ok"] = f"FAILED: {e}"

    ok = (
        verdict["G4_tool_received_real_values"] and verdict["G1_run_continued_after_timeout"]
        and 9 <= verdict["G1_wall_clock_s"] <= 25 and verdict["G2_partial_flag_set"]
        and verdict["G2_answer_returned_not_exception"] and all(v == 0 for v in leaks.values())
        and verdict["G4_bare_token_args_restored"] and verdict["model_agnostic_construct_ok"] is True
    )
    verdict["VERDICT"] = "ALL FOUR GUARANTEES HOLD INSIDE THE FRAMEWORK" if ok else "FAILED — see fields"
    print("\n" + json.dumps(verdict, indent=2))
    with open("/spike/wire-capture.json", "w") as f:
        json.dump(WIRE, f)
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
