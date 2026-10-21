"""
Per-conversation masking memory (21-Oct-2026, Crewing live-data PILOT TRIAL; ASSISTANT_MASK_CONVERSATION_MEMORY).

Problem (PROVEN on the pilot): a follow-up turn replays the earlier answers as history, but the Masker of the NEW
request only knows the names registered in THIS request. The first model call of a follow-up carried the previous
answer's crew and vessel names unmasked (68 hits in run 1).

Fix:
  * after every answered turn, keep the (value, kind) pairs the masker learned, keyed by
    issuer + company + user + conversationId (all four must match to recall them);
  * FAIL CLOSED: if a request carries history but no memory record exists for that exact key (container restart,
    expiry, another user/company/issuer, a forged or reused conversationId), the earlier ASSISTANT answers are
    withheld from the model — replaced by a placeholder — instead of being replayed unmasked. The user's own earlier
    questions are kept (they are the user's typed text, already visible to the provider when first asked).
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
_store: "OrderedDict[tuple[str, str, str, str], tuple[float, list[tuple[str, str]]]]" = OrderedDict()

WITHHELD = ("[Earlier assistant answer not shown: masking memory for this conversation is unavailable. "
            "If the user refers to it, ask them to repeat the request or re-run the query from their questions.]")


def _key(iss: str, tenant: str, user_id: str, conversation_id: str) -> tuple[str, str, str, str]:
    return (iss or "-", tenant, user_id, conversation_id)


def recall(masker: Masker, iss: str, tenant: str, user_id: str, conversation_id: str | None) -> int | None:
    """Register remembered values; returns how many, or None when NO record exists for this exact key (a miss)."""
    if not conversation_id:
        return None
    k = _key(iss, tenant, user_id, str(conversation_id))
    hit = _store.get(k)
    if not hit or time.monotonic() - hit[0] > _TTL_S:
        _store.pop(k, None)
        return None
    for value, kind in hit[1]:
        masker.register(value, kind)
    return len(hit[1])


def remember(masker: Masker, iss: str, tenant: str, user_id: str, conversation_id: str | None) -> None:
    """Record this turn (even with zero names, so the next turn of this conversation is a hit, not a miss)."""
    if not conversation_id:
        return
    k = _key(iss, tenant, user_id, str(conversation_id))
    _store[k] = (time.monotonic(), masker.entries()[-_MAX_VALUES:])
    _store.move_to_end(k)
    while len(_store) > _MAX_CONVERSATIONS:
        _store.popitem(last=False)


def withhold_assistant_turns(raw_history: Any) -> Any:
    """The widget history with every assistant answer replaced by WITHHELD (user questions kept)."""
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
