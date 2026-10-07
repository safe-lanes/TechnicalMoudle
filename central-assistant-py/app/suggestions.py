"""
Starter questions for the shared chat widget (GET /suggestions, 7-Oct-2026).

A module's starter questions come only from its own published manuals: every question in suggestions_catalog.json names
the manual file and section that answers it, and is served only while that exact passage is in the served index set
(published manuals, company-wide — never a knowledge draft, never another module's manual). If nothing qualifies the list
is empty and the widget hides the suggestions instead of showing generic ones. The module comes from the widget's
configured module id (the request), never from the page address.
"""
from __future__ import annotations

import json
import time
from functools import lru_cache
from pathlib import Path
from typing import Any

from . import db
from .config import MODULE_LABELS

MAX_QUESTIONS = 6
_SECTIONS_TTL_SEC = 300.0
_sections_cache: dict[str, tuple[float, set[tuple[str, str]]]] = {}


@lru_cache(maxsize=1)
def catalog() -> dict[str, list[dict[str, str]]]:
    raw = json.loads((Path(__file__).with_name("suggestions_catalog.json")).read_text(encoding="utf-8"))
    out: dict[str, list[dict[str, str]]] = {}
    for module, items in raw.items():
        if module.startswith("_") or not isinstance(items, list):
            continue
        out[module.lower()] = [
            {"question": str(i["question"]).strip(), "file": str(i["file"]), "section": str(i["section"])}
            for i in items
            if isinstance(i, dict) and str(i.get("question") or "").strip() and i.get("file") and i.get("section")
        ]
    return out


async def _sections(module: str) -> set[tuple[str, str]]:
    hit = _sections_cache.get(module)
    if hit and time.monotonic() - hit[0] < _SECTIONS_TTL_SEC:
        return hit[1]
    present = await db.manual_sections(module)
    _sections_cache[module] = (time.monotonic(), present)
    return present


def clear_cache() -> None:
    _sections_cache.clear()


async def for_module(module: str | None, identity: dict[str, Any], limit: int = MAX_QUESTIONS) -> list[str]:
    """The starter questions for one module, for this verified identity. Unknown module, a client×module pair switched off,
    or no question whose source passage is published → []."""
    m = str(module or "").strip().lower()
    if m not in MODULE_LABELS:
        return []
    tenant = str(identity.get("tenantDomain") or "single-tenant")
    if not await db.pair_enabled(tenant, m):
        return []
    present = await _sections(m)
    questions = [i["question"] for i in catalog().get(m, []) if (i["file"], i["section"]) in present]
    return questions[: max(0, min(limit, MAX_QUESTIONS))]
