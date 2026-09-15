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


# ── step 4 (owner brief 15-Sep-2026): intent-aware routing, flag ASSISTANT_ROUTE_INTENT ─────────────
# The question's own words decide the module when they name it: an explicit module name ("in the Safety module", "PMS")
# or a manual / sub-module name ("risk assessment", "near miss", "master review", …) derived from the served corpus's
# document titles — never from test questions. The originating module (context.module, always "technical" from the
# Technical widget) only breaks a clarify tie when it is one of the near candidates; it never overrides an explicit name
# and never bypasses identity: module context is routing only, tenant and vessel permissions are enforced elsewhere.
MODULE_ALIASES = {"technical": "technical", "pms": "technical", "audit": "audit", "safety": "safety", "incident": "incident", "crewing": "crewing"}
_GENERIC_TITLE_WORDS = {"user", "manual", "manuals", "office", "vessel", "specific", "notes", "operational", "for", "sail", "admin", "history", "preparation", "sync", "kb", "pilot"}
_title_terms: dict[str, str] | None = None  # term → module


def _terms_from_title(file: str) -> list[str]:
    """'Safety - Risk Assessment User Manual_Office_R1_30.05.2026.pdf' → ['risk assessment']; single generic words dropped."""
    name = re.sub(r"\.(pdf|docx|md)$", "", file, flags=re.I)
    name = name.split(" - ", 1)[1] if " - " in name else name
    name = re.split(r"\s+(user manual|manual|notes)\b|[_(:]|\bR\d\b", name, flags=re.I)[0]
    name = re.sub(r"[^A-Za-z& ]+", " ", name).strip().lower()
    words = [w for w in name.split() if w not in _GENERIC_TITLE_WORDS and w != "&"]
    term = " ".join(words).strip()
    if not term:
        return []
    if len(words) == 1 and len(term) < 4:   # 'moc', 'sms', 'pms' are fine only as explicit uppercase tokens
        return [term]
    return [term]


async def title_terms() -> dict[str, str]:
    global _title_terms
    if _title_terms is None:
        terms: dict[str, str] = {}
        for module, file in await db.document_titles():
            for t in _terms_from_title(file):
                if t and terms.get(t, module) == module:
                    terms[t] = module
        # a term that maps to more than one module is dropped (ambiguous)
        _title_terms = {t: m for t, m in terms.items() if m in MODULE_LABELS}
    return _title_terms


def explicit_module(message: str, terms: dict[str, str]) -> tuple[str | None, str]:
    """The module the question itself names, and why. Module names/aliases win over manual titles; ties → None."""
    low = " " + re.sub(r"[^a-z0-9&+ ]+", " ", message.lower()) + " "
    named = {m for a, m in MODULE_ALIASES.items() if re.search(rf"\b{re.escape(a)}\b", low)}
    if len(named) == 1:
        return next(iter(named)), "module name in question"
    if len(named) > 1:
        return None, "several module names in question"
    hits = {m for t, m in terms.items() if (len(t) >= 4 and f" {t} " in low) or (len(t) < 4 and re.search(rf"\b{t.upper()}\b", message))}
    if len(hits) == 1:
        return next(iter(hits)), "manual/sub-module name in question"
    return None, ("several manual names" if hits else "no module named")


def route(hits: list[Hit], message: str | None = None, ui_module: str | None = None, terms: dict[str, str] | None = None) -> Routed:
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
    reason = "vector routing"
    if s.assistant_route_intent.lower() == "on" and message is not None:
        named, why = explicit_module(message, terms or {})
        if named and named in best:
            top_module, reason = named, f"explicit: {why}"
            margin = 1.0  # the question named it — no clarification
        elif margin < s.route_margin and ui_module and ui_module.lower() in {m for m, _ in ranked[:3]}:
            top_module, reason = ui_module.lower(), "originating-module context broke a clarify tie"
            margin = s.route_margin
    if margin < s.route_margin:
        return Routed("clarify", candidates=[MODULE_LABELS.get(m, m) for m, _ in ranked[:3]], confidence=margin)
    chosen = [h for h in hits if h.module == top_module and h.distance <= s.route_sim_floor][: s.answer_chunks]
    r = Routed("answer", hits=chosen, module=top_module, confidence=margin)
    r.reason = reason  # type: ignore[attr-defined]
    return r


def rrf_fuse(vector_hits: list[Hit], lexical_hits: list[Hit], k: int, c: int = 60) -> list[Hit]:
    """Step 4 (hybrid excerpt selection, ASSISTANT_HYBRID=on): reciprocal-rank fusion of the two rankings within the routed
    module; identity = (file, breadcrumb, chunk_index). Thresholds unchanged (both inputs already respect the floor)."""
    def key(h: Hit) -> tuple:
        return (str(h.meta.get("file")), str(h.meta.get("breadcrumb")), str(h.meta.get("chunk_index")))
    score: dict[tuple, float] = {}
    keep: dict[tuple, Hit] = {}
    for rank, h in enumerate(vector_hits):
        score[key(h)] = score.get(key(h), 0.0) + 1.0 / (c + rank + 1)
        keep.setdefault(key(h), h)
    for rank, h in enumerate(lexical_hits):
        score[key(h)] = score.get(key(h), 0.0) + 1.0 / (c + rank + 1)
        keep.setdefault(key(h), h)
    order = sorted(score, key=lambda kk: (-score[kk], keep[kk].distance))
    return [keep[kk] for kk in order[:k]]


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
              # v5 (candidate, reviewer + owner 15-Sep-2026; v4 superseded — it fabricated cross-reference statements and narrowed
              # applicability with an 'Applies to' label). The cross-reference hard rule above is verbatim v2; the next sentence only
              # restricts WHEN that statement may be made (frozen case 09 keeps its attribution).
              "That 'same as section X' statement is made ONLY when an excerpt itself contains that resolved cross-reference text; a "
              "plain pointer such as 'Details: <file>' or 'see section X' is a link, not evidence that two procedures share the same "
              "steps — never write '(Cross-reference resolved: …)' or 'the steps are the same as …' on your own. "
              "RULE — coverage: if the question is broad (it names no single method, form or button), first list briefly every method "
              "the excerpts support for it — including methods described separately inside an overview excerpt — then explain each one; "
              "never answer with one method as if it were the only one. If the question names a method, answer that method and note the "
              "other supported methods in one line. "
              "RULE — conditions: explain each method as plain numbered steps with its requirements written directly next to that method "
              "— role, Office or Ship applicability, switches or settings, record state — exactly as the excerpt describing that method "
              "states them; state Office/Ship differences wherever the source makes them; never present a conditional action as "
              "unconditional, never attach a condition to a different action, and never drop a condition because another excerpt about "
              "the same action does not mention it — an omission in one source is not a contradiction. "
              "RULE — sources: excerpts may be published manuals or draft code-derived guidance (marked as such, or citing application code "
              "or a repository revision); neither automatically overrides the other; where two excerpts actually conflict, state both and "
              "name each source; where an excerpt is marked draft, unverified or revision-specific, say so in one clause. "
              "Keep it short and plain; do not use 'Method' / 'Applies to' / 'Requirements' labels. "
              'End with ONE "Source:" list naming, for each method, the manual or guidance and section that supports it.')
    return system, f"Manual excerpts:\n\n{context}\n\nQuestion: {message}"
