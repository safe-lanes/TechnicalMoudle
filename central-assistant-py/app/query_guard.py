"""
Server-held query state for the Crewing live-data tools (28-Oct-2026, Astra round 3, PILOT TRIAL; ASSISTANT_QUERY_STATE_GUARD).

Problem (PROVEN in round 2): on a follow-up the model rebuilt the whole filter set from its own "Filters:" sentence and
twice ADDED an unrequested `crewStatus: primary`. Nothing on the server knew what the previous query was.

Rule now: the server keeps the last VALIDATED query of the conversation (the `query` echoed by Crewing after zod
validation and vessel resolution). On a follow-up the model declares `conversation.basis = "previous"` and sends only
what the user changed (plus `conversation.unset` for conditions the user removed). The server
  * RETAINS every filter the model did not mention (a condition cannot be dropped silently);
  * REJECTS an added or changed filter that the user's current message gives no evidence for (a condition cannot be
    added silently — the model is told to ask the user instead);
  * REJECTS an explicit removal without removal words in the message;
  * REJECTS `basis = "new"` on a message that reads as a follow-up ('them', 'same', 'show more', 'only …').
A genuinely new question (`basis = "new"`, no follow-up cue) replaces the state. Presentation keys (mode, unit,
groupBy, sort, limit, offset) are never guarded — 'show them as a list' and 'show more' change only those.

Evidence is matched against the user's CURRENT message only (never the model's text): filter words such as
'expiring', 'primary', 'on board', or the value itself (a vessel or rank name the user typed).
Pure functions; no I/O. The state lives in mask_memory under the same issuer/company/user/conversation key.
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from typing import Any

QUERY_TOOLS = ("crewing_query_assignments", "crewing_query_documents")
PRESENTATION_KEYS = {"mode", "unit", "groupBy", "sort", "limit", "offset"}
SHARED_KEYS = {"vessels", "ranks", "rankGroups"}           # inherited when the follow-up switches tool
FILTER_KEYS: dict[str, set[str]] = {
    "crewing_query_assignments": {"vessels", "ranks", "rankGroups", "nationalities", "crewStatus", "signOnWithin", "signOnFrom",
                                  "signOnTo", "reliefDueWithin", "reliefDueBefore", "hasDocument"},
    "crewing_query_documents": {"documentTypes", "documentNameContains", "expiryState", "expiryWithin", "expiryFrom", "expiryTo",
                                "crewOnBoard", "vessels", "ranks", "rankGroups", "crewIds"},
}
# words in the user's message that justify a change of that filter (None = only the value itself counts)
EVIDENCE: dict[str, str | None] = {
    "crewStatus": r"\b(primary|secondary|second(ary)? assignments?|double|two assignments|both assignments)\b",
    "expiryState": r"expir|valid|laps|current|out of date|overdue|still good",
    "expiryWithin": r"\d+\s*(day|week|month|year)|\b(next|last|within|coming|upcoming|soon|expir|month|week|year)",
    "expiryFrom": r"\d{4}|\b(from|after|since|between|expir)",
    "expiryTo": r"\d{4}|\b(to|until|before|by|between|expir)",
    "documentTypes": r"licen|certif|\bcoc\b|endorse|training|course",
    "documentNameContains": None,
    "vessels": None,
    "ranks": None,
    "rankGroups": r"engineer|officer|rating|deck|engine|cadet|catering|cook|master|bosun|crew",
    "nationalities": None,
    "crewOnBoard": r"on ?board|onboard|ashore|not on|off the vessel|signed off|at home|on leave",
    "signOnWithin": r"sign|join|board",
    "signOnFrom": r"sign|join|board",
    "signOnTo": r"sign|join|board",
    "reliefDueWithin": r"relie|due",
    "reliefDueBefore": r"relie|due",
    "hasDocument": r"licen|certif|document|training|course|expir",
    "crewIds": r".",   # always: produced by crewing_find_crew in the same turn
}
REMOVAL = r"\b(remove|drop|without|regardless|ignore|any|all|every|whole|entire|no longer|instead|clear|reset|everyone|everybody|fleet|across|overall|altogether)\b"
FOLLOWUP = r"(^\s*(and|or|also|but)\b)|\b(them|those|these|same|more|again|too|only|just|instead|what about|how about|the rest|others?|ones?)\b"

CODE_CHANGE = "filter_change_not_requested"
CODE_BASIS = "follow_up_needs_previous_basis"


@dataclass
class Decision:
    effective: dict[str, Any]
    basis: str
    violations: list[dict[str, Any]] = field(default_factory=list)
    inherited: list[str] = field(default_factory=list)

    def refusal(self) -> dict[str, Any]:
        """The tool result handed back to the model instead of running the query (same shape as a Crewing refusal)."""
        if any(v["kind"] == "new_basis_on_follow_up" for v in self.violations):
            return {"ok": False, "code": CODE_BASIS,
                    "error": "This reads as a follow-up to the previous question. Call again with conversation.basis "
                             "'previous' and only the filters the user changed; the server keeps the rest.",
                    "details": {"keptFilters": self.effective}}
        changes = [{k: v for k, v in x.items() if k != "kind"} | {"change": x["kind"]} for x in self.violations]
        return {"ok": False, "code": CODE_CHANGE,
                "error": "The previous question's filters are kept on the server. The user's message does not ask for: "
                         + "; ".join(_describe(x) for x in self.violations) + ". Do not retry with that change — either "
                         "call again without it, or ask the user whether they want it applied.",
                "details": {"changes": changes, "keptFilters": self.effective}}


def _describe(v: dict[str, Any]) -> str:
    if v["kind"] == "unrequested_removal":
        return f"removing the {v['filter']} condition"
    prev = v.get("previous")
    return f"{'changing' if prev is not None else 'adding'} {v['filter']} = {json.dumps(v['value'])}" + (
        f" (was {json.dumps(prev)})" if prev is not None else "")


# ── normalisation ──────────────────────────────────────────────────────────────
def _vessel_name(v: Any) -> str:
    s = v.get("vesselName") if isinstance(v, dict) else v
    s = re.sub(r"^\s*(mv|m/v|mt|m/t|ms)\s+", "", str(s or "").strip(), flags=re.I)
    return re.sub(r"\s+", " ", s).lower()


def _norm(key: str, value: Any) -> Any:
    if key == "vessels" and isinstance(value, list):
        return sorted(_vessel_name(v) for v in value)
    if isinstance(value, list):
        return sorted(json.dumps(v, sort_keys=True).lower() if isinstance(v, (dict, list)) else str(v).strip().lower() for v in value)
    if isinstance(value, dict):
        return json.dumps(value, sort_keys=True).lower()
    return str(value).strip().lower() if not isinstance(value, bool) else value


def same(key: str, a: Any, b: Any) -> bool:
    return _norm(key, a) == _norm(key, b)


def looks_follow_up(text: str) -> bool:
    return bool(re.search(FOLLOWUP, text or "", re.I))


def _value_words(value: Any) -> list[str]:
    """Words (3+ letters) of a filter value, e.g. 'MV Beta Ocean' → ['beta', 'ocean']; nested values flattened."""
    if isinstance(value, dict):
        value = list(value.values())
    if isinstance(value, list):
        out: list[str] = []
        for v in value:
            out += _value_words(v)
        return out
    s = _vessel_name(value) if isinstance(value, str) else str(value)
    return [w for w in re.findall(r"[a-z]{3,}", s.lower()) if w not in ("the", "and", "for")]


def evidence(key: str, value: Any, text: str) -> bool:
    """True when the user's current message asks for this filter value (filter words or the value's own words)."""
    t = (text or "").lower()
    rx = EVIDENCE.get(key)
    if rx and re.search(rx, t, re.I):
        return True
    return any(w in t for w in _value_words(value))


# ── the decision ───────────────────────────────────────────────────────────────
def decide(tool: str, args: dict[str, Any], prev: dict[str, Any] | None, user_text: str) -> Decision:
    """args = the model's (unmasked) tool arguments; prev = {'tool', 'filters'} held for the conversation, or None."""
    keys = FILTER_KEYS.get(tool, set())
    conv = args.get("conversation") if isinstance(args.get("conversation"), dict) else {}
    basis = str(conv.get("basis") or "").lower()
    unset = [k for k in (conv.get("unset") or []) if isinstance(k, str)]
    present = {k: v for k, v in args.items() if k in PRESENTATION_KEYS}
    new_filters = {k: v for k, v in args.items() if k in keys}

    # crewStatus with both values is no filter at all (run 1: the model wrote ['primary','secondary'] on a new question)
    if isinstance(new_filters.get("crewStatus"), list) and {str(x).lower() for x in new_filters["crewStatus"]} >= {"primary", "secondary"}:
        new_filters.pop("crewStatus")

    if not prev or not isinstance(prev.get("filters"), dict):
        return Decision(effective={**present, **new_filters}, basis="new")
    if prev.get("tool") == tool:
        inherited_all = dict(prev["filters"])
    else:
        inherited_all = {k: v for k, v in prev["filters"].items() if k in SHARED_KEYS}
        if prev.get("tool") == "crewing_query_assignments" and tool == "crewing_query_documents":
            # an assignments question is BY DEFINITION about crew on board; 'their certificates' keeps that scope
            inherited_all["crewOnBoard"] = True
    inherited = {k: v for k, v in inherited_all.items() if k in keys}
    if not basis:
        basis = "previous" if (inherited and looks_follow_up(user_text)) else "new"
    if basis == "new":
        if inherited and looks_follow_up(user_text):
            return Decision(effective=inherited, basis="previous", violations=[{"kind": "new_basis_on_follow_up"}])
        return Decision(effective={**present, **new_filters}, basis="new")

    violations: list[dict[str, Any]] = []
    eff = dict(inherited)
    for k in unset:
        if k in eff:
            if not (re.search(REMOVAL, user_text or "", re.I) or evidence(k, eff[k], user_text)):
                violations.append({"kind": "unrequested_removal", "filter": k, "value": eff[k]})
            eff.pop(k)
    for k, v in new_filters.items():
        if k in eff and same(k, eff[k], v):
            continue
        if not evidence(k, v, user_text):
            violations.append({"kind": "unrequested_change", "filter": k, "value": v, "previous": eff.get(k)})
        eff[k] = v
    kept = [k for k in inherited if k in eff and k not in new_filters]
    return Decision(effective={**present, **eff}, basis="previous", violations=violations, inherited=kept)


def state_from_result(tool: str, result: dict[str, Any]) -> dict[str, Any] | None:
    """The validated query Crewing echoed (ok:true results only) → {'tool', 'filters'} in the model's argument form."""
    if not isinstance(result, dict) or result.get("ok") is not True or not isinstance(result.get("query"), dict):
        return None
    q = result["query"]
    filters: dict[str, Any] = {}
    for k in FILTER_KEYS.get(tool, set()):
        if k not in q or q[k] in (None, [], {}, ""):
            continue
        v = q[k]
        if k == "vessels" and isinstance(v, list):
            v = [str(x.get("vesselName") if isinstance(x, dict) else x) for x in v]
        filters[k] = v
    return {"tool": tool, "filters": filters}


CONVERSATION_PARAM = {
    "type": "object",
    "description": "How this call relates to the previous question of the conversation. basis 'previous' (follow-ups such as "
                   "'only engineers', 'same for MV X', 'show more', 'what about the expired ones'): the server KEEPS every "
                   "filter of the previous query and applies only the filters you pass; name any condition the user removed "
                   "in unset. basis 'new': a genuinely new question — the previous filters are dropped.",
    "properties": {
        "basis": {"type": "string", "enum": ["previous", "new"]},
        "unset": {"type": "array", "items": {"type": "string"}, "description": "Filter names the user explicitly removed, e.g. ['vessels']."},
    },
    "required": ["basis"],
    "additionalProperties": False,
}


def with_conversation_param(tool_def: dict[str, Any]) -> dict[str, Any]:
    """A manifest tool definition with the `conversation` parameter added (assistant-side contract; stripped before Crewing)."""
    params = dict(tool_def.get("parameters") or {"type": "object", "properties": {}})
    props = dict(params.get("properties") or {})
    props["conversation"] = CONVERSATION_PARAM
    params["properties"] = props
    return {**tool_def, "parameters": params}
