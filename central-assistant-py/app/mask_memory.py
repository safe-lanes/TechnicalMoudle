"""
Per-conversation state (21-Oct-2026 masking memory; 28-Oct-2026 Astra round 3: ownership + query state + full discard).

Problem (PROVEN on the pilot, round 1): a follow-up turn replays the earlier answers as history, but the Masker of the NEW
request only knows the names registered in THIS request. The first model call of a follow-up carried the previous
answer's crew and vessel names unmasked (68 hits in run 1).

What is kept, keyed by issuer + company + user + conversationId + widget module (all five must match; 2-Nov-2026 review
requirement 3: a conversation id reused under ANOTHER module — Audit → Safety — recalls neither names nor the query state
of the first module; the ownership index compares identity only, so that reuse is a plain miss, not "another user"):
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
Key = tuple[str, str, str, str, str]          # (iss, tenant, user, conversationId, module)
Identity = tuple[str, str, str]               # (iss, tenant, user)
_store: "OrderedDict[Key, tuple[float, list[tuple[str, str]]]]" = OrderedDict()
_queries: dict[Key, tuple[float, dict[str, Any]]] = {}
_owner: dict[str, Identity] = {}

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


def _key(iss: str, tenant: str, user_id: str, conversation_id: str, module: str = "") -> Key:
    # `module` is the widget module of the request (2-Nov-2026); "" for callers that predate it (same behaviour as before).
    return (iss or "-", tenant, user_id, conversation_id, str(module or "").lower())


def _expired(ts: float) -> bool:
    return time.monotonic() - ts > _TTL_S


def _live_owner(conversation_id: str) -> Identity | None:
    """The identity holding a conversation id, after dropping the record when every entry under it has expired."""
    held = _owner.get(conversation_id)
    if held is None:
        return None
    keys = [k for k in _store if k[3] == conversation_id and k[:3] == held]
    if any(not _expired(_store[k][0]) for k in keys):
        return held
    for k in keys:
        _store.pop(k, None)
        _queries.pop(k, None)
    _owner.pop(conversation_id, None)
    return None


def ownership(iss: str, tenant: str, user_id: str, conversation_id: str | None, module: str = "") -> str:
    """'mine' = this identity holds the conversation; 'other' = another identity holds it; 'unknown' = no record.
    The module is not part of ownership: the same user switching module keeps the id but gets a MISS in recall()."""
    if not conversation_id:
        return "unknown"
    held = _live_owner(str(conversation_id))
    if held is None:
        return "unknown"
    return "mine" if held == _key(iss, tenant, user_id, str(conversation_id), module)[:3] else "other"


def recall(masker: Masker, iss: str, tenant: str, user_id: str, conversation_id: str | None, module: str = "") -> int | None:
    """Register remembered values; returns how many, or None when NO record exists for this exact key (a miss)."""
    if not conversation_id:
        return None
    k = _key(iss, tenant, user_id, str(conversation_id), module)
    hit = _store.get(k)
    if not hit or _expired(hit[0]):
        _store.pop(k, None)
        _queries.pop(k, None)   # a miss also forgets any query state (never inherit filters across a lost session)
        return None
    for value, kind in hit[1]:
        masker.register(value, kind)
    return len(hit[1])


def remember(masker: Masker, iss: str, tenant: str, user_id: str, conversation_id: str | None, module: str = "") -> None:
    """Record this turn (even with zero names, so the next turn of this conversation is a hit, not a miss).
    Never adopts a conversation id that another identity holds."""
    if not conversation_id:
        return
    cid = str(conversation_id)
    k = _key(iss, tenant, user_id, cid, module)
    if ownership(iss, tenant, user_id, cid, module) == "other":
        return
    _store[k] = (time.monotonic(), masker.entries()[-_MAX_VALUES:])
    _store.move_to_end(k)
    _owner[cid] = k[:3]
    while len(_store) > _MAX_CONVERSATIONS:
        old, _ = _store.popitem(last=False)
        _queries.pop(old, None)
        if _owner.get(old[3]) == old[:3] and not any(key[3] == old[3] for key in _store):
            _owner.pop(old[3], None)


def get_query_state(iss: str, tenant: str, user_id: str, conversation_id: str | None, module: str = "") -> dict[str, Any] | None:
    if not conversation_id:
        return None
    k = _key(iss, tenant, user_id, str(conversation_id), module)
    hit = _queries.get(k)
    if not hit or _expired(hit[0]):
        _queries.pop(k, None)
        return None
    return hit[1]


def set_query_state(iss: str, tenant: str, user_id: str, conversation_id: str | None, state: dict[str, Any] | None,
                    module: str = "") -> None:
    if not conversation_id:
        return
    k = _key(iss, tenant, user_id, str(conversation_id), module)
    if ownership(iss, tenant, user_id, str(conversation_id), module) == "other":
        return
    if state is None:
        _queries.pop(k, None)
    else:
        _queries[k] = (time.monotonic(), state)


def get_query_state_for(key: tuple[str, ...]) -> dict[str, Any] | None:
    """Key form of get_query_state (the 4- or 5-tuple the chat path holds)."""
    return get_query_state(*key[:4], module=key[4] if len(key) > 4 else "")


def set_query_state_for(key: tuple[str, ...], state: dict[str, Any] | None) -> None:
    """Key form of set_query_state."""
    set_query_state(*key[:4], state, module=key[4] if len(key) > 4 else "")


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
