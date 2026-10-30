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

QUERY_TOOLS = ("crewing_query_assignments", "crewing_query_documents",
               # Part B (30-Oct-2026)
               "crewing_query_availability", "crewing_query_relief_due", "crewing_query_rest_hours", "crewing_query_rotation_approvals",
               "crewing_query_manning", "crewing_query_appraisals")
PRESENTATION_KEYS = {"mode", "unit", "groupBy", "sort", "limit", "offset"}
SHARED_KEYS = {"vessels", "ranks", "rankGroups"}           # inherited when the follow-up switches tool
FILTER_KEYS: dict[str, set[str]] = {
    "crewing_query_assignments": {"vessels", "ranks", "rankGroups", "nationalities", "crewStatus", "signOnWithin", "signOnFrom",
                                  "signOnTo", "reliefDueWithin", "reliefDueBefore", "hasDocument"},
    "crewing_query_documents": {"documentTypes", "documentNameContains", "expiryState", "expiryWithin", "expiryFrom", "expiryTo",
                                "crewOnBoard", "vessels", "ranks", "rankGroups", "crewIds"},
    "crewing_query_availability": {"availableBy", "availableWithin", "ranks", "rankGroups", "nationalities", "crewStatus", "vessels", "includeNotForHire", "crewIds"},
    "crewing_query_relief_due": {"dueWithin", "dueState", "vessels", "ranks", "rankGroups", "crewIds"},
    "crewing_query_rest_hours": {"months", "lastMonths", "vessels", "ranks", "rankGroups", "crewIds", "opa", "violationsOnly"},
    "crewing_query_rotation_approvals": {"status", "vessels", "forMe"},
    "crewing_query_manning": {"state", "vessels", "ranks", "rankGroups"},
    "crewing_query_appraisals": {"statusClass", "vessels", "ranks", "rankGroups", "crewIds", "appraisalDateWithin", "appraisalDateFrom",
                                 "appraisalDateTo", "includeScores", "own"},
}
# words in the user's message that justify a change of that filter (None = only the value itself counts)
EVIDENCE: dict[str, str | None] = {
    "crewStatus": r"\b(primary|secondary|second(ary)? assignments?|double|two assignments|both assignments)\b",
    # Part B (30-Oct-2026)
    "crewStatusAvailability": r"\b(on ?board|on ?leave|ashore|at home|currently sailing|sailing)\b",   # the availability tool's crewStatus values
    "availableBy": r"\d{4}|\b(by|before|until|on or before|available|join)\b",
    "availableWithin": r"\d+\s*(day|week|month|year)|\b(next|within|coming|upcoming|this|available|join|month|week)\b",
    "includeNotForHire": r"not for (re)?hire|nfr|rehire|do not rehire|blacklist",
    "dueWithin": r"\d+\s*(day|week|month|year)|\b(next|within|coming|upcoming|this|due|relie|month|week)\b",
    "dueState": r"overdue|due|past|late|relie",
    "months": r"\d{4}|\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*|\b(month|last|this|previous)\b",
    "lastMonths": r"\d+\s*month|\b(last|past|previous|recent)\b.*month",
    "opa": r"\bopa\b|oil pollution",
    "violationsOnly": r"violat|all crew|everyone|every record|without violation|no violation|clean",
    "status": r"draft|proposed|waiting|pending|approv|all plans|every plan",
    "forMe": r"\b(me|my|mine|myself|i am|i'm|for me|assigned to me)\b",
    "state": r"vacan|filled|open position|empty|unfilled|manning|short",
    "statusClass": r"draft|pending|completed|reviewed|submitted|finished|done|all appraisals|every appraisal",
    "appraisalDateWithin": r"\d+\s*(day|week|month|year)|\b(last|past|recent|this|within|since)\b",
    "appraisalDateFrom": r"\d{4}|\b(from|after|since|between)\b",
    "appraisalDateTo": r"\d{4}|\b(to|until|before|by|between)\b",
    "includeScores": r"score|rating|grade|mark|result|how did .* do|perform",
    "own": r"\b(my|mine|myself|me|i\b|own)\b",
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
CODE_IDS = "invalid_crew_ids"


@dataclass
class Decision:
    effective: dict[str, Any]
    basis: str
    violations: list[dict[str, Any]] = field(default_factory=list)
    inherited: list[str] = field(default_factory=list)
    not_carried: list[str] = field(default_factory=list)   # previous filters with no equivalent on this tool
    kept_filters: dict[str, Any] = field(default_factory=dict)   # the previous question's filters as they stand (no refused change)

    def refusal(self) -> dict[str, Any]:
        """The tool result handed back to the model instead of running the query (same shape as a Crewing refusal).
        28-Oct-2026 review: the wording must say the truth — a refused filter was NOT part of the previous question; the
        model introduced it. The model is told what to tell the user."""
        if any(v["kind"] == "invalid_crew_ids" for v in self.violations):
            return {"ok": False, "code": CODE_IDS,
                    "error": "crewIds must be the crewId values returned by crewing_find_crew (UUIDs) — never a placeholder. "
                             "Call crewing_find_crew first, or query without crewIds.",
                    "details": {"rejected": self.violations[0]["value"]}}
        if any(v["kind"] == "new_basis_on_follow_up" for v in self.violations):
            return {"ok": False, "code": CODE_BASIS,
                    "error": "This reads as a follow-up to the previous question. Call again with conversation.basis "
                             "'previous' and only the filters the user changed; the server keeps the rest.",
                    "details": {"keptFilters": self.kept_filters}}
        facts = " ".join(_describe(x) for x in self.violations)
        kept = ", ".join(f"{k} = {json.dumps(v, ensure_ascii=False)}" for k, v in self.kept_filters.items()) or "none"
        return {"ok": False, "code": CODE_CHANGE,
                "error": f"Not run. {facts} The previous question's filters are unchanged: {kept}. Tell the user exactly this: "
                         "which filters are kept, and that the condition above was NOT applied because they did not ask for it — "
                         "then ask whether they want it. Never say that it was part of the previous question. Do not retry it on your own.",
                "details": {"notApplied": [{k: v for k, v in x.items() if k != "kind"} | {"change": x["kind"]} for x in self.violations],
                            "keptFilters": self.kept_filters}}


def _describe(v: dict[str, Any]) -> str:
    if v["kind"] == "unrequested_new_filter":
        return (f"{v['filter']} = {json.dumps(v['value'], ensure_ascii=False)} is not asked for in the user's question (no word such as "
                f"'primary' or 'secondary'); it would narrow the answer.")
    if v["kind"] == "unrequested_removal":
        return f"Removing the {v['filter']} condition ({json.dumps(v['value'], ensure_ascii=False)}) was not asked for in the user's message."
    prev = v.get("previous")
    if prev is None:
        return (f"{v['filter']} = {json.dumps(v['value'], ensure_ascii=False)} was NOT part of the previous question; it would be a NEW condition that "
                f"the user's message does not ask for.")
    return (f"{v['filter']} would change from {json.dumps(prev, ensure_ascii=False)} (previous question) to {json.dumps(v['value'], ensure_ascii=False)}; the user's "
            f"message does not ask for that change.")


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
    # the availability tool reuses the key crewStatus with the values on_leave / on_board: their evidence is different words
    if key == "crewStatus" and any(str(v).lower() in ("on_leave", "on_board") for v in (value if isinstance(value, list) else [value])):
        rx = EVIDENCE["crewStatusAvailability"]
    if rx and re.search(rx, t, re.I):
        return True
    return any(w in t for w in _value_words(value))


def _both_kinds_unless_licences_alone(filters: dict[str, Any], user_text: str) -> None:
    """Drop a licence-only documentTypes (top level or inside hasDocument) when the user's words also say certificate(s) /
    document(s) — unless they said 'certificate of competency' (= a licence). Mutates in place."""
    text = user_text or ""
    both = bool(re.search(r"certif|document", text, re.I)) and not re.search(r"certificates? of competenc|\bcoc\b", text, re.I)
    if not both:
        return
    for holder in (filters, filters.get("hasDocument") if isinstance(filters.get("hasDocument"), dict) else None):
        if holder is None:
            continue
        dt = holder.get("documentTypes")
        if isinstance(dt, list) and [str(x).lower() for x in dt] == ["licence"]:
            holder.pop("documentTypes")


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

    # Sahil A2 (29-Oct-2026): "certificates" / "licence or certificate" mean BOTH kinds. A licence-only filter stands only when
    # the user's own words name licences / CoCs alone (v2 runs 1-2: the model set ['licence'] for "a licence or certificate").
    _both_kinds_unless_licences_alone(new_filters, user_text)

    # crewIds come only from crewing_find_crew (UUIDs); a placeholder such as "<ids>" would silently give 0 results (run 3)
    bad_ids = [x for x in (new_filters.get("crewIds") or []) if not re.fullmatch(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}", str(x), re.I)]
    if bad_ids:
        return Decision(effective={**present, **new_filters}, basis=basis or "new",
                        violations=[{"kind": "invalid_crew_ids", "filter": "crewIds", "value": bad_ids}])

    # the narrowing "primary assignments only" is never implied by a question: without the user's word it is refused
    # even on a first question (review probe V01, 28-Oct: the model added it to "how many engineers are on board …")
    status_viol = ([{"kind": "unrequested_new_filter", "filter": "crewStatus", "value": new_filters["crewStatus"]}]
                   if "crewStatus" in new_filters and not evidence("crewStatus", new_filters["crewStatus"], user_text) else [])
    if not prev or not isinstance(prev.get("filters"), dict):
        return Decision(effective={**present, **_consistent(new_filters)}, basis="new", violations=status_viol)
    inherited_all, not_carried = translate(prev.get("tool") or "", tool, prev["filters"])
    inherited = {k: v for k, v in inherited_all.items() if k in keys}
    if not basis:
        basis = "previous" if (inherited and looks_follow_up(user_text)) else "new"
    if basis == "new":
        if inherited and looks_follow_up(user_text):
            return Decision(effective=inherited, basis="previous", violations=[{"kind": "new_basis_on_follow_up"}])
        return Decision(effective={**present, **_consistent(new_filters)}, basis="new", violations=status_viol)

    violations: list[dict[str, Any]] = []
    eff = dict(inherited)
    for k in unset:
        if k in eff:
            if not (re.search(REMOVAL, user_text or "", re.I) or evidence(k, eff[k], user_text)):
                violations.append({"kind": "unrequested_removal", "filter": k, "value": eff[k]})
            eff.pop(k)
    kept_filters = dict(inherited)
    for k, v in new_filters.items():
        if k in eff and same(k, eff[k], v):
            continue
        if not evidence(k, v, user_text):
            violations.append({"kind": "unrequested_change", "filter": k, "value": v, "previous": eff.get(k)})
        eff[k] = v
    eff = _consistent(eff)
    kept = [k for k in inherited if k in eff and k not in new_filters]
    return Decision(effective={**present, **eff}, basis="previous", violations=violations, inherited=kept, not_carried=not_carried,
                    kept_filters=kept_filters)


# ── pagination line (28-Oct-2026 review item 1) ─────────────────────────────────
UNIT_WORDS = {"people": "matching crew members", "assignments": "matching assignments", "documents": "matching documents"}


def paging_summary(result: dict[str, Any]) -> dict[str, Any] | None:
    """The server's own paging facts of a list-mode result (None for count/group/refusals)."""
    if not isinstance(result, dict) or result.get("ok") is not True or result.get("mode") != "list":
        return None
    try:
        return {"total": int(result.get("total") or 0), "returned": int(result.get("returned") or 0),
                "offset": int(result.get("offset") or 0), "unit": str(result.get("unit") or "records"),
                "more": result.get("nextOffset") is not None}
    except (TypeError, ValueError):
        return None


def paging_line(p: dict[str, Any]) -> str:
    """'Showing 5 of 8 matching crew members (records 1–5; 3 more available).' — built from the server's totals,
    never from the model's text."""
    unit = UNIT_WORDS.get(p["unit"], f"matching {p['unit']}")
    total, returned, offset = p["total"], p["returned"], p["offset"]
    if total == 0:
        return f"Showing 0 {unit}."
    if offset == 0 and returned >= total:
        return f"Showing all {total} {unit}."
    first, last = offset + 1, offset + returned
    rest = total - last
    tail = f"{rest} more available" if rest > 0 and p.get("more") else "end of list"
    return f"Showing {returned} of {total} {unit} (records {first}–{last}; {tail})."


# ── expired / upcoming line (29-Oct-2026, Sahil A4: expired documents are listed WITH the expiring ones) ───────────────
def breakdown_line(result: dict[str, Any]) -> str | None:
    """'Of these, 3 documents (3 people) have already expired and 15 documents (12 people) expire by 2026-12-31.' — built
    from the server's `breakdown` and `expiryWindow`, never from the model's text. None when the result carries no breakdown
    (no expiry condition, refusal, non-crewing tool)."""
    if not isinstance(result, dict) or result.get("ok") is not True:
        return None
    b = result.get("breakdown")
    if not isinstance(b, dict) or "expired" not in b or "upcoming" not in b:
        return None
    win = result.get("expiryWindow") if isinstance(result.get("expiryWindow"), dict) else {}
    as_of = str(result.get("asOf") or "")

    def part(d: Any, verb: str) -> str:
        d = d if isinstance(d, dict) else {}
        try:
            docs, people = d.get("documents"), int(d.get("people") or 0)
        except (TypeError, ValueError):
            return f"0 {verb}"
        if docs is None:
            return f"{people} {'person' if people == 1 else 'people'} {verb}"
        return f"{int(docs)} {'document' if int(docs) == 1 else 'documents'} ({people} {'person' if people == 1 else 'people'}) {verb}"

    expired = part(b["expired"], f"already expired as of {as_of}" if as_of else "already expired")
    to = str(win.get("to") or "")
    upcoming = part(b["upcoming"], f"expire by {to}" if to else "have not expired yet")
    return f"Of these, {expired}; {upcoming}."


# ── rank-configuration line (29-Oct-2026, Sahil A5: groups come from Rank Administration; gaps are reported, never guessed) ──
def rank_config_line(result: dict[str, Any]) -> str | None:
    """'Not counted in any rank group: 2 crew on board whose ranks have no category in Rank Administration (Deck Cadet,
    Gas Engineer).' — from the server's rankConfig report; None when no group was involved or nothing is unclassified."""
    if not isinstance(result, dict) or result.get("ok") is not True:
        return None
    rc = result.get("rankConfig")
    if not isinstance(rc, dict):
        return None
    u = rc.get("unclassifiedOnBoard") if isinstance(rc.get("unclassifiedOnBoard"), dict) else rc.get("unclassifiedInResult")
    if not isinstance(u, dict):
        return None
    try:
        people = int(u.get("people") or 0)
    except (TypeError, ValueError):
        return None
    if people <= 0:
        return None
    ranks = [str(r) for r in (u.get("ranks") or []) if r]
    where = "on board" if "unclassifiedOnBoard" in rc else "in this result"
    names = f" ({', '.join(sorted(ranks))})" if ranks else ""
    return (f"Not counted in any rank group: {people} crew {where} whose {'rank has' if people == 1 else 'ranks have'} no category "
            f"in Rank Administration{names}.")


# ── cross-tool translation and consistency ─────────────────────────────────────
DOC_KEYS = ("documentTypes", "documentNameContains", "expiryState", "expiryWithin")   # = the hasDocument sub-keys


def translate(prev_tool: str, tool: str, filters: dict[str, Any]) -> tuple[dict[str, Any], list[str]]:
    """The previous filters expressed in the new tool's vocabulary, plus the previous filters that have no equivalent.
    assignments.hasDocument{…} ⇄ documents.{documentTypes, documentNameContains, expiryState, expiryWithin};
    an assignments question is by definition about crew on board → documents.crewOnBoard true."""
    if prev_tool == tool or not prev_tool:
        return dict(filters), []
    out: dict[str, Any] = {k: v for k, v in filters.items() if k in SHARED_KEYS}
    lost: list[str] = []
    if prev_tool == "crewing_query_assignments" and tool == "crewing_query_documents":
        out["crewOnBoard"] = True
        hd = filters.get("hasDocument") if isinstance(filters.get("hasDocument"), dict) else {}
        for k in DOC_KEYS:
            if k in hd and hd[k] not in (None, "", [], {}):
                out[k] = hd[k]
        lost = [k for k in filters if k not in SHARED_KEYS and k != "hasDocument"]
    elif prev_tool == "crewing_query_documents" and tool == "crewing_query_assignments":
        hd = {k: filters[k] for k in DOC_KEYS if k in filters and filters[k] not in (None, "", [], {})}
        if hd and hd.get("expiryState") != "any" or len(hd) > 1 or (hd and "expiryState" not in hd):
            out["hasDocument"] = hd
        lost = [k for k in filters if k not in SHARED_KEYS and k not in DOC_KEYS and not (k == "crewOnBoard" and filters[k] is True)]
    else:
        lost = [k for k in filters if k not in SHARED_KEYS]
    return out, lost


def _consistent(filters: dict[str, Any]) -> dict[str, Any]:
    """A document cannot be both expired and expiring in a FUTURE window (run 3: 'the expired ones' kept the 60-day window
    and found nothing). When expiryState becomes 'expired', a 'next' window is dropped; the model is told via query."""
    f = dict(filters)
    win = f.get("expiryWithin")
    if f.get("expiryState") == "expired" and isinstance(win, dict) and win.get("direction") == "next":
        f.pop("expiryWithin")
    hd = f.get("hasDocument")
    if isinstance(hd, dict):
        hd = dict(hd)
        w = hd.get("expiryWithin")
        if hd.get("expiryState") == "expired" and isinstance(w, dict) and w.get("direction") == "next":
            hd.pop("expiryWithin")
        f["hasDocument"] = hd
    return f


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
