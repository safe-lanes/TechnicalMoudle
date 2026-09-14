"""
Cross-reference resolution at index time (owner decision 14-Sep-2026).

45 manual sections contain only a pointer like
  "* Refer to the 'Spares' sub-sub-module for the filter process and apply the same steps."
They retrieve (their heading matches the question) but cannot answer. The target is always a
named sibling section of the SAME manual, so we append the target's text to the pointer
section before chunking.

Resolution, per pointer section S (title like "1.1.8.2 HOW TO APPLY FILTER"):
  1. parse the referenced name X from "refer to the '<X>' (sub-)module|tab|section"
  2. find the heading H whose title matches X (normalised: case, quotes, dashes, spaces)
  3. among headings numbered UNDER H (number prefix), pick the one whose title (minus its number)
     is closest to S's title (difflib ratio ≥ 0.6, tie → highest ratio); fall back to the
     process keyword (filter/export/edit/delete/create/view/review) if no title match
  4. if the target is itself a pointer, follow it (max depth 3); a cycle or a dead end is
     reported as UNRESOLVED and the section is left as it is (never guessed)
  5. append: "\n\n(Steps from '<target title>':)\n<target body>" to S — S keeps its own text

Works on the cleaned per-page markdown: the document-level heading tree is built across
pages; the appended text is inserted on the page that holds S.
"""
from __future__ import annotations

import difflib
import re
from dataclasses import dataclass, field

HEADING_RE = re.compile(r"^(#{1,6})\s+(.*?)\s*$", re.M)
NUM_RE = re.compile(r"^\s*((?:\d+\.)*\d+)\.?\s*(.*)$")
XREF_RE = re.compile(r"refer\s+to\s+(?:the\s+)?[\"'‘’“”<u>]*\s*([^'\"‘’“”<>]{2,60}?)\s*[\"'‘’“”</u>]*\s*(sub-?sub-?module|sub-?module|module|tab|section|sub-?menu)", re.I)
PROCESS_WORDS = ["filter", "export", "edit", "delete", "create", "view", "review", "add", "update", "apply", "track", "open", "close"]


def norm(s: str) -> str:
    s = re.sub(r"<[^>]+>", "", s)
    s = re.sub(r"[*_`]+", "", s)
    s = s.replace("—", "-").replace("–", "-")
    s = re.sub(r"[^a-z0-9]+", " ", s.lower())
    return re.sub(r"\s+", " ", s).strip()


def _plain(title: str) -> str:
    return re.sub(r"<[^>]+>", "", re.sub(r"[*_`]+", "", title)).strip()


def title_words(title: str) -> str:
    """Heading title without its section number, normalised ('1.1.7.2 HOW TO APPLY FILTER' → 'how to apply filter')."""
    m = NUM_RE.match(_plain(title))
    return norm(m.group(2) if m else title)


def number_of(title: str) -> str:
    m = NUM_RE.match(_plain(title))
    return m.group(1) if m else ""


@dataclass
class Section:
    page: int
    level: int
    title: str
    body: str
    start: int  # char offset of heading line within the page
    end: int    # char offset where the section body ends within the page


@dataclass
class XrefReport:
    resolved: list[tuple[str, str]] = field(default_factory=list)      # (pointer title, target title)
    unresolved: list[tuple[str, str]] = field(default_factory=list)    # (pointer title, reason)
    chained: list[tuple[str, str]] = field(default_factory=list)       # (pointer title, chain)


def sections_of(pages: dict[int, str]) -> list[Section]:
    out: list[Section] = []
    for pn in sorted(pages):
        md = pages[pn]
        heads = list(HEADING_RE.finditer(md))
        for i, h in enumerate(heads):
            start = h.start()
            body_start = h.end()
            end = heads[i + 1].start() if i + 1 < len(heads) else len(md)
            out.append(Section(page=pn, level=len(h.group(1)), title=h.group(2).strip(), body=md[body_start:end].strip(), start=start, end=end))
    return out


def is_pointer(body: str) -> str | None:
    """Return the referenced name if the body is ONLY a cross-reference, else None."""
    b = norm(body)
    if not b or len(b) > 220:
        return None
    m = XREF_RE.search(re.sub(r"<[^>]+>", "", body))
    return m.group(1).strip() if m else None


def _children(sections: list[Section], container: Section) -> list[Section]:
    cnum = number_of(container.title)
    if cnum:
        return [s for s in sections if s is not container and number_of(s.title).startswith(cnum + ".")]
    return [s for s in sections if s is not container and s.level > container.level]


def find_container(sections: list[Section], name: str, pointer: Section | None = None) -> Section | None:
    """The section the pointer refers to by name. Prefers: exact title match > substring match;
    containers (headings with numbered children) over leaves; never the pointer's own ancestor."""
    want = norm(name)
    pnum = number_of(pointer.title) if pointer else ""
    best, best_score = None, 0.0
    for s in sections:
        t = title_words(s.title)
        if not t or s is pointer:
            continue
        snum = number_of(s.title)
        if pnum and snum and pnum.startswith(snum + "."):
            continue  # the pointer's own ancestor cannot be its target
        if t == want:
            score = 1.0
        elif want in t or (t in want and len(t) >= 4):
            score = 0.9
        else:
            score = difflib.SequenceMatcher(None, t, want).ratio()
        if _children(sections, s):
            score += 0.05
        if score > best_score:
            best, best_score = s, score
    return best if best_score >= 0.75 else None


def find_target(sections: list[Section], container: Section, pointer: Section) -> Section | None:
    cands = [s for s in _children(sections, container) if s is not pointer]
    if not cands:
        # a leaf was named (e.g. "the 'Management' tab" = a dashboard section): use the
        # sibling "How to …" sections that follow it, up to the next non-how-to sibling
        cnum = number_of(container.title)
        parent = cnum.rsplit(".", 1)[0] if "." in cnum else ""
        sibs = [s for s in sections if s is not container and s is not pointer and number_of(s.title).startswith(parent + ".") and number_of(s.title).count(".") == cnum.count(".")]
        after = [s for s in sibs if number_of(s.title) > cnum]
        for s in after:
            if not title_words(s.title).startswith("how to"):
                break
            cands.append(s)
    if not cands:
        return None
    want = title_words(pointer.title)
    scored = sorted(((difflib.SequenceMatcher(None, title_words(s.title), want).ratio(), s) for s in cands), key=lambda x: -x[0])
    if scored and scored[0][0] >= 0.6:
        return scored[0][1]
    words = [w for w in PROCESS_WORDS if w in want.split()]
    for w in words:
        for s in cands:
            if w in title_words(s.title).split():
                return s
    return None


def resolve_xrefs(pages: dict[int, str], max_depth: int = 3) -> tuple[dict[int, str], XrefReport]:
    rep = XrefReport()
    sections = sections_of(pages)
    inserts: dict[tuple[int, int], str] = {}  # (page, end offset) -> text to append
    for s in sections:
        name = is_pointer(s.body)
        if not name:
            continue
        chain = [s.title]
        cur, target, depth, reason = s, None, 0, ""
        while depth < max_depth:
            container = find_container(sections, name, cur)
            if container is None:
                reason = f"no section named '{name}'"
                break
            t = find_target(sections, container, cur)
            if t is None:
                reason = f"no matching sub-section under '{container.title}'"
                break
            if t.title in chain:
                reason = "cycle"
                break
            chain.append(t.title)
            nxt = is_pointer(t.body)
            if nxt:
                name, cur, depth = nxt, t, depth + 1
                continue
            target = t
            break
        if target is None:
            rep.unresolved.append((s.title, reason or f"chain deeper than {max_depth}"))
            continue
        if len(chain) > 2:
            rep.chained.append((s.title, " → ".join(chain)))
        rep.resolved.append((s.title, target.title))
        inserts[(s.page, s.end)] = f"\n\n(Steps from '{title_words(target.title).title()}':)\n{target.body}\n"
    out = dict(pages)
    for (pn, off), text in sorted(inserts.items(), key=lambda kv: (kv[0][0], -kv[0][1])):
        md = out[pn]
        out[pn] = md[:off].rstrip() + text + md[off:]
    return out, rep
