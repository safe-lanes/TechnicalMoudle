"""
Stage 1 retrieval + §4.2 routing gates — ported unchanged in behaviour:
  not_documented  top distance > SIM_FLOOR
  clarify         best-per-module margin < ROUTE_MARGIN
  answer          top module's hits (<= SIM_FLOOR), ANSWER_CHUNKS of them
plus the port's known-redirect table (§X): questions about modules we deliberately
do not cover get a plain redirect BEFORE any embedding/LLM cost.

Retrieval is vector-only here, with the distance semantics of the Chroma store it
replaces (squared L2) so the calibrated thresholds carry over. The tsvector column
exists for hybrid search but is NOT used for ranking in the port — retrieval-quality
changes (hybrid fusion, reranker) are their own measured step after the port.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any

from . import db
from .config import MODULE_LABELS, settings
from .db import Hit
from .masking import Masker


# ── known redirects (owner decisions 11-Sep: not gaps, by design) ───────────────
@dataclass(frozen=True)
class Redirect:
    pattern: re.Pattern[str]
    label: str
    message: str


REDIRECTS: list[Redirect] = [
    Redirect(re.compile(r"\b(purchase\s+(order|request|requisition)s?|purchasing|requisitions?|procurement|shipskart|supplier\s+quot\w*)\b", re.I),
             "Purchasing",
             "Purchasing is handled in the Shipskart module, which has its own assistant — please ask there."),
    Redirect(re.compile(r"\bnoon[\s-]?reports?\b", re.I),
             "Noon Report",
             "The Noon Report module isn't available in the assistant yet — it will be added when the module goes live."),
]


def known_redirect(message: str) -> Redirect | None:
    for r in REDIRECTS:
        if r.pattern.search(message):
            return r
    return None


# ── routing ──────────────────────────────────────────────────────────────────────
@dataclass
class Routed:
    gate: str                     # answer | clarify | not_documented
    hits: list[Hit] = field(default_factory=list)
    module: str | None = None
    candidates: list[str] = field(default_factory=list)
    confidence: float = 0.0


def module_of(meta: dict[str, Any]) -> str:
    if meta.get("module"):
        return str(meta["module"]).lower()
    prefix = str(meta.get("file") or "").split(" - ")[0].strip().lower()
    return prefix if prefix in MODULE_LABELS else "unknown"


def route(hits: list[Hit]) -> Routed:
    s = settings()
    if not hits or hits[0].distance > s.route_sim_floor:
        return Routed("not_documented", confidence=0.0)
    best: dict[str, float] = {}
    for h in hits:
        if h.distance <= s.route_sim_floor and (h.module not in best or h.distance < best[h.module]):
            best[h.module] = h.distance
    ranked = sorted(best.items(), key=lambda kv: kv[1])
    top_module, top_dist = ranked[0]
    margin = (ranked[1][1] - top_dist) if len(ranked) > 1 else 1.0
    if margin < s.route_margin:
        return Routed("clarify", candidates=[MODULE_LABELS.get(m, m) for m, _ in ranked[:3]], confidence=margin)
    chosen = [h for h in hits if h.module == top_module and h.distance <= s.route_sim_floor][: s.answer_chunks]
    return Routed("answer", hits=chosen, module=top_module, confidence=margin)


def manual_of(meta: dict[str, Any]) -> str:
    return re.sub(r"\.(pdf|docx|html)$", "", str(meta.get("file") or "unknown"), flags=re.I)


def section_of(meta: dict[str, Any]) -> str:
    parts = [p.strip() for p in str(meta.get("breadcrumb") or "").split(">") if p.strip()]
    if len(parts) > 1:
        return " > ".join(parts[1:])
    return parts[0] if parts else "Document"


def citations_of(routed: Routed) -> list[dict[str, Any]]:
    return [{"module": MODULE_LABELS.get(routed.module or "", routed.module), "manual": manual_of(h.meta),
             "section": section_of(h.meta), "distance": round(h.distance, 4)} for h in routed.hits]


async def retrieve(embedding: list[float]) -> list[Hit]:
    hits = await db.search_chunks(embedding, settings().route_top_k)
    for h in hits:
        h.module = module_of(h.meta)
    return hits


async def search_docs_tool(query: str, masker: Masker | None) -> dict[str, Any]:
    """search_module_docs backing for the tool loop — Stage 1 retrieval packaged as a tool."""
    from .llm import embed  # local import: llm imports masking, keep module graph simple
    routed = route(await retrieve(await embed(query, masker)))
    if routed.gate == "not_documented":
        return {"documented": False, "note": "This topic is not covered in the module documentation."}
    if routed.gate == "clarify":
        return {"documented": False, "ambiguous": True, "candidates": routed.candidates,
                "note": "Ambiguous across modules — ask the user which module they mean."}
    return {"documented": True, "module": MODULE_LABELS.get(routed.module or "", routed.module),
            "excerpts": [{"manual": manual_of(h.meta), "section": section_of(h.meta), "text": h.text[:3000]} for h in routed.hits]}


def docs_prompt(message: str, routed: Routed) -> tuple[str, str]:
    """(system, user) for the docs-only answer path — text unchanged from Node's answer()."""
    context = "\n\n---\n\n".join(f"[{i + 1}] ({manual_of(h.meta)} — {section_of(h.meta)})\n{h.text}" for i, h in enumerate(routed.hits))
    label = MODULE_LABELS.get(routed.module or "", routed.module)
    system = ("You are the SAIL Maritime PMS assistant. Answer the user's question using ONLY the manual excerpts provided. "
              f"Rules: if the excerpts do not answer the question, say plainly that it is not covered in the {label} documentation — never guess. "
              "HARD RULE — cross-references: the manuals often say 'Refer to the <other> sub-module and apply the same steps'. When an excerpt "
              "contains '(Cross-reference resolved: the steps for A are the same as section X …, page N. They are:)' followed by steps, then "
              "the question about A IS covered: answer with those steps, and state that they are the same as section X (page N). "
              "Never answer 'not covered' when such a resolved cross-reference is present. "
              # v4 (candidate, owner GO 15-Sep-2026) — coverage, conditions, sources, compact per-method format. The cross-reference
              # hard rule above is verbatim v2 (attribution behaviour must be preserved — frozen case 09).
              "RULE — coverage: if a how-to question is broad (it names no single method, form or button), describe EVERY method the "
              "excerpts support for it, each as its own item — never answer with one method as if it were the only one; if the question "
              "names a method, answer that method and note the other supported methods in one line. "
              "RULE — conditions: keep each action's environment (Office / Ship), role requirement, configuration conditions (switches, "
              "settings, record state) and steps TOGETHER in that action's item, exactly as the excerpt describing that action states them: "
              "never present a conditional action as unconditional, never attach a condition to a different action, and never drop a "
              "condition because another excerpt about the same action does not mention it — an omission in one source is not a contradiction. "
              "RULE — sources: excerpts may be published manuals or draft code-derived guidance (marked as such, or citing application code "
              "or a repository revision); neither automatically overrides the other. Where two excerpts actually conflict, state both and "
              "name each source; where an excerpt is marked draft, unverified or revision-specific, say so in one clause; never present "
              "code-derived guidance as a statement of the manual. "
              "FORMAT for how-to answers, per method: 'Method' — 'Applies to' (Office / Ship / both — only when an excerpt states it, "
              "otherwise omit) — 'Requirements' (role, switch or setting, record state; write 'none stated in the excerpts' only when none "
              "is stated) — 'Steps' (numbered; keep any required cross-reference statement inside the steps of the method it belongs to) "
              "— 'Source' (manual or guidance name and section). Keep it short and plain. "
              'End with a "Source:" line naming the manual and section(s) you used.')
    return system, f"Manual excerpts:\n\n{context}\n\nQuestion: {message}"
