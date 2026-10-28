"""
Per-conversation state (21-Oct-2026 masking memory; 28-Oct-2026 Astra round 3: ownership + query state + full discard).

Problem (PROVEN on the pilot, round 1): a follow-up turn replays the earlier answers as history, but the Masker of the NEW
request only knows the names registered in THIS request. The first model call of a follow-up carried the previous
answer's crew and vessel names unmasked (68 hits in run 1).

What is kept, keyed by issuer + company + user + conversationId (all four must match):
  * the (value, kind) pairs the masker learned in the conversation (names → tokens on the wire);
  * the last VALIDATED live-data query (query_guard: filters cannot be dropped or added silently on follow-ups);
  * an ownership index conversationId → key, so a conversation id presented by ANOTHER issuer/company/user is detected.

FAIL CLOSED (round 3): when a request carries history but the state for this exact key is missing — container restart,
expiry, a new or reused conversation id, another user/company/issuer — BOTH the earlier user questions and the earlier
assistant answers are discarded before any model call; the user is told, and the model is told to ask for a restatement
when the question depends on the lost context. Round 2 only withheld the assistant answers and kept the user turns.
A conversation id owned by another identity is never adopted: nothing is remembered under it for the new identity.
In-process, bounded, expiring. Lost on restart by design of the trial; the fail-closed rule makes that safe.
"""
from __future__ import annotations

import time
from collections import OrderedDict
from typing import Any

from .masking import Masker

_TTL_S = 4 * 3600
_MAX_CONVERSATIONS = 2000
_MAX_VALUES = 2000
Key = tuple[str, str, str, str]
_store: "OrderedDict[Key, tuple[float, list[tuple[str, str]]]]" = OrderedDict()
_queries: dict[Key, tuple[float, dict[str, Any]]] = {}
_owner: dict[str, Key] = {}

WITHHELD = ("[Earlier assistant answer not shown: masking memory for this conversation is unavailable. "
            "If the user refers to it, ask them to repeat the request or re-run the query from their questions.]")

# round 3: the visible notice appended to the answer, per reason, and the note the model receives instead of the history
USER_NOTICE = {
    "other": ("(Earlier messages were not used: this conversation belongs to a different session or user. "
              "Please start a new conversation, or restate your question in full.)"),
    "unverified": ("(Earlier messages of this conversation were not used: they could not be verified for this session, "
                   "for example after a service restart. If your question referred to them, please restate it in full.)"),
}
MODEL_NOTE = ("[Session note] The earlier turns of this conversation were discarded by the server because they could not "
              "be verified for this session. Answer only the current message. If it depends on earlier context (for "
              "example 'them', 'those', 'same', 'show more', 'the expired ones'), do not guess — ask the user to restate "
              "the question in full.\n\n")


def _key(iss: str, tenant: str, user_id: str, conversation_id: str) -> Key:
    return (iss or "-", tenant, user_id, conversation_id)


def _expired(ts: float) -> bool:
    return time.monotonic() - ts > _TTL_S


def ownership(iss: str, tenant: str, user_id: str, conversation_id: str | None) -> str:
    """'mine' = this exact identity holds the conversation; 'other' = another identity holds it; 'unknown' = no record."""
    if not conversation_id:
        return "unknown"
    k = _key(iss, tenant, user_id, str(conversation_id))
    held = _owner.get(str(conversation_id))
    if held is None:
        return "unknown"
    hit = _store.get(held)
    if not hit or _expired(hit[0]):
        _store.pop(held, None)
        _queries.pop(held, None)
        _owner.pop(str(conversation_id), None)
        return "unknown"
    return "mine" if held == k else "other"


def recall(masker: Masker, iss: str, tenant: str, user_id: str, conversation_id: str | None) -> int | None:
    """Register remembered values; returns how many, or None when NO record exists for this exact key (a miss)."""
    if not conversation_id:
        return None
    k = _key(iss, tenant, user_id, str(conversation_id))
    hit = _store.get(k)
    if not hit or _expired(hit[0]):
        _store.pop(k, None)
        _queries.pop(k, None)   # a miss also forgets any query state (never inherit filters across a lost session)
        return None
    for value, kind in hit[1]:
        masker.register(value, kind)
    return len(hit[1])


def remember(masker: Masker, iss: str, tenant: str, user_id: str, conversation_id: str | None) -> None:
    """Record this turn (even with zero names, so the next turn of this conversation is a hit, not a miss).
    Never adopts a conversation id that another identity holds."""
    if not conversation_id:
        return
    cid = str(conversation_id)
    k = _key(iss, tenant, user_id, cid)
    if ownership(iss, tenant, user_id, cid) == "other":
        return
    _store[k] = (time.monotonic(), masker.entries()[-_MAX_VALUES:])
    _store.move_to_end(k)
    _owner[cid] = k
    while len(_store) > _MAX_CONVERSATIONS:
        old, _ = _store.popitem(last=False)
        _queries.pop(old, None)
        if _owner.get(old[3]) == old:
            _owner.pop(old[3], None)


def get_query_state(iss: str, tenant: str, user_id: str, conversation_id: str | None) -> dict[str, Any] | None:
    if not conversation_id:
        return None
    k = _key(iss, tenant, user_id, str(conversation_id))
    hit = _queries.get(k)
    if not hit or _expired(hit[0]):
        _queries.pop(k, None)
        return None
    return hit[1]


def set_query_state(iss: str, tenant: str, user_id: str, conversation_id: str | None, state: dict[str, Any] | None) -> None:
    if not conversation_id:
        return
    k = _key(iss, tenant, user_id, str(conversation_id))
    if ownership(iss, tenant, user_id, str(conversation_id)) == "other":
        return
    if state is None:
        _queries.pop(k, None)
    else:
        _queries[k] = (time.monotonic(), state)


def withhold_assistant_turns(raw_history: Any) -> Any:
    """Round-2 behaviour (kept for tests/reference): assistant answers replaced by WITHHELD, user questions kept."""
    if not isinstance(raw_history, list):
        return raw_history
    out = []
    for m in raw_history:
        if isinstance(m, dict) and str(m.get("role")) == "assistant":
            out.append({**m, "content": WITHHELD})
        else:
            out.append(m)
    return out


def clear() -> None:
    """Tests only: simulate a container restart."""
    _store.clear()
    _queries.clear()
    _owner.clear()
