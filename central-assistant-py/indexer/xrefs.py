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
import json
import re
from pathlib import Path
from dataclasses import dataclass, field

# Resolver version — part of the build key and of every reproducibility record. Bump on ANY
# change to the matching rules, the settings below or the label wording.
XREF_VERSION = "2026-09-14.4"  # .3: chained resolutions name the intermediate pointer(s); .4: target body includes its next-page continuation
XREF_SETTINGS = {"title_match_min_ratio": 0.6, "max_chain_depth": 3, "process_words": "fallback",
                 "label": "(Cross-reference resolved: the steps for <parent › section> are the same as section <n> '<title>' under <parent>, page <p>. They are:)"}

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
    """Document-level heading tree. Text at the top of a page BEFORE its first heading (or a whole
    page without headings) is the continuation of the previous page's last section — e.g. Crewing
    1.2.1.5 'How to export crew details' starts on p19 and its final step ("Click the 'Export'
    button…") is the first paragraph of p20. It is appended to that section's body (the body is
    what a resolved cross-reference copies); start/end offsets stay on the heading's own page."""
    out: list[Section] = []
    for pn in sorted(pages):
        md = pages[pn]
        heads = list(HEADING_RE.finditer(md))
        lead = md[:heads[0].start()].strip() if heads else md.strip()
        if lead and out:
            out[-1].body = (out[-1].body + "\n\n" + lead).strip()
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


def _parent_title(sections: list[Section], s: Section) -> str:
    """Title of the heading whose number is the prefix of s (e.g. '1.1.8 STORES' for '1.1.8.2 …')."""
    num = number_of(s.title)
    parent = num.rsplit(".", 1)[0] if "." in num else ""
    for c in sections:
        if parent and number_of(c.title) == parent:
            return title_words(c.title).title()
    return ""


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


_FACTS: dict | None = None


def facts_for(dest_parent: str) -> dict:
    """Verified, code-backed facts about the DESTINATION screen, or {} when none exist.

    A destination with no entry gets no generated field list and no screen claim — see xref_facts.json.
    The Crewing screens are not in any repository available to us, so they are deliberately absent and
    their field lists are left unresolved rather than invented."""
    global _FACTS
    if _FACTS is None:
        p = Path(__file__).with_name("xref_facts.json")
        _FACTS = json.loads(p.read_text(encoding="utf-8")) if p.exists() else {}
    return _FACTS.get(norm(dest_parent), {}) if dest_parent else {}


def label_captions(body: str, src_parent: str) -> str:
    """A pasted figure caption describes the SOURCE screen, not the destination. Mark it as such and
    leave the caption text itself intact — captions sometimes carry the only statement of a step."""
    def mark(m: re.Match) -> str:
        return f"{m.group(1)}[illustration of the {src_parent} screen] {m.group(2)}"
    return re.sub(r"(?mi)^(\s*(?:screenshot(?:_from_computer)?|screen shot)\s*:\s*)(.*)$", mark, body)


def render_resolved(dest_parent: str, dest_title: str, src_citation: str, src_parent: str,
                    body: str) -> str:
    """Three clearly separated parts, so adapted guidance never masquerades as a verbatim quote:

      1. WHAT APPLIES HERE — destination screen and record, from this manual's own section heading,
         plus any fact VERIFIED against the product code (xref_facts.json). Labelled as adapted.
      2. NOT ESTABLISHED — named explicitly rather than papered over.
      3. QUOTED VERBATIM — the source section's text, unedited, with its citation, and with figure
         captions marked as illustrations of the source screen.

    Rewriting the source's nouns was rejected: the quote would no longer be what the manual says and a
    citation to it would be false. Equally, a bare "apply these steps here" was rejected — it leaves a
    wrong field list in front of the reader and asks them to reinterpret it."""
    f = facts_for(dest_parent)
    where = dest_parent or "this sub-module"
    out = [f"\n\n(Cross-reference resolved. Two separate parts follow: guidance adapted for {where}, "
           f"then the source text quoted verbatim.)\n",
           f"**Applies to: {where} › {dest_title}.** The procedure is the same as {src_citation}."]

    if f.get("screen"):
        out.append(f"Carry it out on the **{f['screen']}** screen — {where} is its own screen "
                   f"({f.get('own_screen_evidence', 'verified in the product code')}).")
    # Only state the fact that belongs to the action this section documents. An export section does
    # not need the filter list, and saying it anyway buries the part that matters.
    act = norm(dest_title)
    relevant = {"filters": "filter" in act, "edit": "edit" in act or "update" in act,
                "export": "export" in act or "download" in act,
                "creation": "create" in act or "new" in act}
    if f.get("filters") and relevant["filters"]:
        out.append(f"Verified filters on this screen: **{', '.join(f['filters'])}**."
                   + (f" The quoted steps also name {', '.join(f['not_present'])}, which "
                      f"**do not exist here**." if f.get("not_present") else ""))
    for key in ("edit", "export", "creation"):
        if f.get(key) and relevant[key]:
            out.append(f"{f[key]}.")

    # An unresolved note may be scoped to one action: {"when": "filter", "text": "..."}. A plain
    # string always shows. Without this, the Certificates filter caveat appeared on an EDIT section.
    unresolved = []
    for u in f.get("unresolved", []):
        if isinstance(u, dict):
            if relevant.get(u.get("when", ""), True):
                unresolved.append(u["text"])
        else:
            unresolved.append(u)
    if not f:
        unresolved.append(
            f"No verified description of the {where} screen is available, so the screen names, record "
            f"types, field lists and figures in the quoted steps below describe {src_parent} and have "
            f"NOT been confirmed for {where}. Treat the sequence of actions as the transferable part.")
    if unresolved:
        out.append("**Not established:** " + " ".join(unresolved))

    out.append(f"\n**Quoted verbatim from {src_citation} — its wording, screen names and figures "
               f"refer to {src_parent}:**\n")
    return "\n".join(out) + "\n" + label_captions(body, src_parent) + "\n"


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
        # Honest attribution, stated for BOTH sides: which section the steps apply to (the
        # pointer, named with its parent sub-module) and where they actually come from (the
        # target section + page), so an answer can say "for Stores, same as Spares (1.1.7.7, p.47)".
        here = _parent_title(sections, s)
        src = f"section {number_of(target.title)} '{title_words(target.title).title()}'" + (f" under {_parent_title(sections, target)}" if _parent_title(sections, target) else "") + (f", page {target.page}" if target.page else "")
        via = ""
        if len(chain) > 2:  # the manual's own chain of pointers, stated so the reader can verify it
            via = " (reached via " + ", ".join(f"section {number_of(t)}" for t in chain[1:-1]) + ", which itself refers onward)"
        inserts[(s.page, s.end)] = render_resolved(
            dest_parent=here, dest_title=title_words(s.title).title(), src_citation=src + via,
            src_parent=_parent_title(sections, target) or target.title, body=target.body)
    out = dict(pages)
    for (pn, off), text in sorted(inserts.items(), key=lambda kv: (kv[0][0], -kv[0][1])):
        md = out[pn]
        out[pn] = md[:off].rstrip() + text + md[off:]
    return out, rep
