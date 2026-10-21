"""
Per-conversation masking memory (21-Oct-2026, Crewing live-data PILOT TRIAL; ASSISTANT_MASK_CONVERSATION_MEMORY).

Problem (PROVEN on the pilot before this was written — see the trial report): a follow-up turn replays the earlier
answers as history, but the Masker of the NEW request only knows the names registered in THIS request (user name,
selected vessel, this turn's tool results). The first model call of the follow-up therefore carried the crew and
vessel names of the previous answer unmasked.

Fix: after a turn, keep the (value, kind) pairs the masker learned, keyed by tenant + user + conversationId; at the
start of the next turn of the SAME conversation, register them before any model call. In-process, bounded, expiring.
Limits (stated in the report): lost on container restart; a name the user types that no tool has returned yet is
still sent as typed.
"""
from __future__ import annotations

import time
from collections import OrderedDict

from .masking import Masker

_TTL_S = 4 * 3600
_MAX_CONVERSATIONS = 2000
_MAX_VALUES = 2000
_store: "OrderedDict[tuple[str, str, str], tuple[float, list[tuple[str, str]]]]" = OrderedDict()


def _key(tenant: str, user_id: str, conversation_id: str) -> tuple[str, str, str]:
    return (tenant, user_id, conversation_id)


def recall(masker: Masker, tenant: str, user_id: str, conversation_id: str | None) -> int:
    if not conversation_id:
        return 0
    k = _key(tenant, user_id, str(conversation_id))
    hit = _store.get(k)
    if not hit or time.monotonic() - hit[0] > _TTL_S:
        _store.pop(k, None)
        return 0
    for value, kind in hit[1]:
        masker.register(value, kind)
    return len(hit[1])


def remember(masker: Masker, tenant: str, user_id: str, conversation_id: str | None) -> None:
    if not conversation_id:
        return
    k = _key(tenant, user_id, str(conversation_id))
    _store[k] = (time.monotonic(), masker.entries()[-_MAX_VALUES:])
    _store.move_to_end(k)
    while len(_store) > _MAX_CONVERSATIONS:
        _store.popitem(last=False)
