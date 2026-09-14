"""
Pre-chunk cleanup of LlamaParse page markdown (owner decisions 14-Sep-2026).

Every removal is LOGGED (page, rule, text) in CleanReport.removed and the raw parse is kept
in the parse store, so cleanup is reversible and auditable — the eye-check is a one-time
review; the log is the durable artefact. Rules are content checks, not page-level
assumptions; when in doubt a line is KEPT (owner rule: never strip real instruction).

  cover        page 1: only its image/logo/photo lines and "Page 1 of N" go; any real text
               (title, revision identifier, dates) STAYS — a cover is not assumed empty
  toc          only the "Contents" heading and lines shaped like TOC entries (dotted leaders,
               "1.2.3 Title …… 7") go; anything else on that page stays
  header       the repeated per-page H1 (the manual title, e.g. "# TECHNICAL USER MANUAL")
               is removed because it makes every page start a new section named after the
               manual; the LAST REAL HEADING is carried forward onto pages that continue a
               section, so section context is restored, not lost
  footer       "Page X of Y"
  figure zone  between the last bullet/heading/note before a "Figure N" caption and the
               caption, plus tables/mermaid/images/content-free callouts attached after it:
               tables and mermaid go; images and the caption go; text goes ONLY if it is a
               content-free screenshot annotation ("1. Click here to …", "This screen is
               seen upon …", short labels). Notes and full sentences in the zone STAY
  callout tbl  a table whose cells are only "Figure N" / "Click here …" annotations
  struck       <s>/<del>/~~text~~ is REMOVED with its content (obsolete text must not
               reappear as current) and logged
  inline       <u> <b> <i> <mark> tags and "(Ref. Figure N)" tails are stripped (formatting)
"""
from __future__ import annotations

import re
from collections import Counter
from dataclasses import dataclass, field

IMG_LINE_RE = re.compile(r"^\s*(!\[[^\]]*\]\([^)]*\)|(photograph|logo|screenshot|screenshot_from_computer|image|icon|illustration|picture|diagram)\s*:.*|screenshot of .*|[\w-]+\s+logo|\*?(blue|green|dark|light)\s+\w+\s+(texture|surface|background)\*?)\s*$", re.I)
FIGURE_CAPTION_RE = re.compile(r"^\s*(#{1,6}\s*)?(<u>|\*\*|\*|_)?\s*figure\s*\d+[a-z]?\s*(\.|:)?\s*(</u>|\*\*|\*|_)?\s*$", re.I)
REF_FIGURE_RE = re.compile(r"\s*\(?\s*(<u>)?\s*(\*)?\s*(ref\.?|see)\s*(figures?|fig\.?)\s*[\d, ]+[a-z]?\s*(\*)?\s*(</u>)?\s*\)?\.?", re.I)
PAGE_OF_RE = re.compile(r"^\s*[*_]*\s*page\s+\d+\s+of\s+\d+\s*[*_]*\s*$", re.I)
TOC_TITLE_RE = re.compile(r"^\s*#{0,6}\s*(\*\*)?(table of )?contents(\*\*)?\s*$", re.I)
TOC_ENTRY_RE = re.compile(r"(\.{3,}|…)\s*\**\s*\d+\s*\**\s*$|^\s*(\*\s*)?(\*\*)?\d+(\.\d+)*\.?(\*\*)?\s+(\*\*)?[^\n]{3,90}?(\*\*)?\s+\**\d{1,3}\**\s*$")
CALLOUT_RE = re.compile(r"^\s*(\*\*|<b>)?\s*(\d+[.)]\s*)?(click here|click on|select|tap|press|choose|enter|this screen is|from here|here (you|the user)|users? can)\b.*$", re.I)
CALLOUT_NOISE_RE = re.compile(
    r"^\s*(\*\*|<b>)?\s*("
    r"(\d+[.)]\s*)?click\s+here(\s+to\s+[\w' -]{0,40})?\.?"
    r"|(\d+[.)]\s*)?(click|select|tap)\s+(on\s+)?[\w' \-&]{0,40}\.?"
    r"|this screen (is seen|appears|is displayed)[^.]{0,60}\.?"
    r"|from here[^.]{0,60}\.?"
    r"|(the )?screen below[^.]{0,60}\.?"
    r"|\w[\w' /&:.-]{0,32}"
    r")\s*(\*\*|</b>)?\s*$", re.I)
NOTE_RE = re.compile(r"^\s*(\*\*|<b>)?\s*(note|important|tip|remember|warning|📌|☞|\(i\)|!!)\b", re.I)
HEADING_RE = re.compile(r"^\s*#{1,6}\s+")
BULLET_RE = re.compile(r"^\s*([*\-•]|\d+[.)])\s+")
INLINE_TAG_RE = re.compile(r"</?(u|b|i|mark|strong|em|sup|sub|br|span)(\s[^>]*)?/?>", re.I)
STRUCK_RE = re.compile(r"<(s|del|strike)>(.*?)</\1>|~~([^~\n]{1,200})~~", re.S | re.I)
REVISION_RE = re.compile(r"\b(rev(ision)?\.?\s*(no\.?|number)?\s*[:#]?\s*[\w.-]+|R\d{1,2}\b|\d{1,2}[./-]\d{1,2}[./-]\d{2,4})", re.I)


@dataclass
class Removal:
    page: int
    rule: str
    text: str


@dataclass
class CleanReport:
    cover_dropped: bool = False          # kept for compatibility: True when page 1's decorative lines were removed
    toc_pages: list[int] = field(default_factory=list)
    header_lines: int = 0
    footer_lines: int = 0
    figure_zones: int = 0
    tables_removed: int = 0
    tables_kept: int = 0
    mermaid_removed: int = 0
    caption_lines: int = 0
    callout_lines: int = 0
    image_lines: int = 0
    struck_spans: int = 0
    carried_headings: int = 0
    removed: list[Removal] = field(default_factory=list)

    def log(self, page: int, rule: str, text: str) -> None:
        self.removed.append(Removal(page, rule, text.strip()[:400]))

    def as_dict(self) -> dict:
        d = {k: v for k, v in self.__dict__.items() if k != "removed"}
        d["removed"] = [r.__dict__ for r in self.removed]
        return d


def _norm_heading(ln: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[*_`]+", "", ln.strip())).lower()


def _blocks(md: str) -> list[tuple[str, str]]:
    """Split page markdown into (kind, text) blocks: 'table', 'mermaid', 'line'. Nested tables respected."""
    out: list[tuple[str, str]] = []
    i, lines = 0, md.splitlines()
    while i < len(lines):
        ln = lines[i]
        low = ln.strip().lower()
        if low.startswith("<table"):
            j, depth = i, 0
            while j < len(lines):
                depth += lines[j].lower().count("<table") - lines[j].lower().count("</table>")
                if depth <= 0:
                    break
                j += 1
            out.append(("table", "\n".join(lines[i:j + 1])))
            i = j + 1
        elif low.startswith("```mermaid"):
            j = i + 1
            while j < len(lines) and not lines[j].strip().startswith("```"):
                j += 1
            out.append(("mermaid", "\n".join(lines[i:j + 1])))
            i = j + 1
        else:
            out.append(("line", ln))
            i += 1
    return out


def _table_cells(t: str) -> list[str]:
    cells = [re.sub(r"<[^>]+>", "", c).strip() for c in re.findall(r"<t[hd][^>]*>(.*?)</t[hd]>", t, re.S | re.I)]
    return [c for c in cells if c]


def _table_is_callout(t: str) -> bool:
    cells = _table_cells(t)
    if not cells:
        return True
    if any(FIGURE_CAPTION_RE.match(c) for c in cells):
        return True
    return len(cells) <= 2 and all(CALLOUT_RE.match(c) for c in cells)


def _table_is_toc(t: str) -> bool:
    cells = _table_cells(t)
    return bool(cells) and (any(TOC_TITLE_RE.match(c) for c in cells) or sum(1 for c in cells if TOC_ENTRY_RE.search(c)) >= max(3, len(cells) // 2))


def _zone_line_is_noise(s: str) -> bool:
    if NOTE_RE.match(s) or BULLET_RE.match(s) or HEADING_RE.match(s):
        return False
    return bool(CALLOUT_NOISE_RE.match(s))


def _is_cover_page(md: str) -> bool:
    lines = [ln for ln in md.splitlines() if ln.strip()]
    if not lines or len(lines) > 8:
        return False
    imgs = sum(1 for ln in lines if IMG_LINE_RE.match(ln))
    titles = sum(1 for ln in lines if HEADING_RE.match(ln))
    others = len(lines) - imgs - titles - sum(1 for ln in lines if PAGE_OF_RE.match(ln))
    return (imgs >= 1 and others <= 1) or (titles >= 1 and others == 0)


def _is_toc_page(md: str) -> bool:
    flat = re.sub(r"<[^>]+>", "\n", md)
    lines = [ln for ln in flat.splitlines() if ln.strip()]
    if not lines:
        return False
    if any(TOC_TITLE_RE.match(ln) for ln in lines[:8]):
        return True
    entries = sum(1 for ln in lines if TOC_ENTRY_RE.search(ln))
    return entries >= 5 and entries / len(lines) >= 0.4


def detect_header_line(pages: dict[int, str]) -> str | None:
    """The most common first-line heading across pages, if on ≥ 40 % of them (the repeated manual title)."""
    c: Counter[str] = Counter()
    for md in pages.values():
        first = next((_norm_heading(ln) for ln in md.splitlines() if ln.strip()), None)
        if first and HEADING_RE.match(first):
            c[first] += 1
    if not c:
        return None
    line, cnt = c.most_common(1)[0]
    return line if cnt >= max(2, 0.4 * len(pages)) else None


def _strip_struck(s: str, page: int, rep: CleanReport) -> str:
    def repl(m: re.Match[str]) -> str:
        rep.struck_spans += 1
        rep.log(page, "struck-through", m.group(2) or m.group(3) or "")
        return ""
    return STRUCK_RE.sub(repl, s)


def clean_page(pn: int, md: str, header_line: str | None, rep: CleanReport, *, cover: bool, toc: bool) -> str:
    blocks = _blocks(md)
    n = len(blocks)
    caption_idx = [k for k, (kind, t) in enumerate(blocks) if kind == "line" and FIGURE_CAPTION_RE.match(t)]
    in_zone = [False] * n
    for c in caption_idx:
        s = c
        while s - 1 >= 0 and not (blocks[s - 1][0] == "line" and (BULLET_RE.match(blocks[s - 1][1]) or HEADING_RE.match(blocks[s - 1][1]) or NOTE_RE.match(blocks[s - 1][1]))):
            s -= 1
        e = c
        while e + 1 < n:
            kind, t = blocks[e + 1]
            if kind in ("table", "mermaid") or (kind == "line" and (not t.strip() or IMG_LINE_RE.match(t) or _zone_line_is_noise(t) or FIGURE_CAPTION_RE.match(t))):
                e += 1
            else:
                break
        for k in range(s, e + 1):
            in_zone[k] = True
        rep.figure_zones += 1
    out: list[str] = []
    for k, (kind, t) in enumerate(blocks):
        if kind == "table":
            if toc and _table_is_toc(t):
                rep.log(pn, "toc-table", _table_cells(t)[0] if _table_cells(t) else t)
                continue
            if in_zone[k]:
                rep.tables_removed += 1
                rep.log(pn, "figure-zone-table", " | ".join(_table_cells(t)[:8]))
                continue
            if _table_is_callout(t):
                rep.tables_removed += 1
                rep.log(pn, "callout-table", " | ".join(_table_cells(t)[:8]))
                continue
            rep.tables_kept += 1
            out.append(_strip_struck(t, pn, rep))
            continue
        if kind == "mermaid":
            rep.mermaid_removed += 1
            rep.log(pn, "mermaid", t)
            continue
        s = t.rstrip()
        if not s.strip():
            out.append("")
            continue
        if header_line and _norm_heading(s) == header_line:
            rep.header_lines += 1
            rep.log(pn, "page-header", s)
            continue
        if PAGE_OF_RE.match(s):
            rep.footer_lines += 1
            rep.log(pn, "page-footer", s)
            continue
        if toc and (TOC_TITLE_RE.match(s) or TOC_ENTRY_RE.search(s)):
            rep.log(pn, "toc-entry", s)
            continue
        if cover and (IMG_LINE_RE.match(s)):
            rep.image_lines += 1
            rep.log(pn, "cover-image", s)
            continue
        if FIGURE_CAPTION_RE.match(s):
            rep.caption_lines += 1
            rep.log(pn, "figure-caption", s)
            continue
        if IMG_LINE_RE.match(s):
            rep.image_lines += 1
            rep.log(pn, "image-line", s)
            continue
        if in_zone[k] and _zone_line_is_noise(s):
            rep.callout_lines += 1
            rep.log(pn, "figure-zone-callout", s)
            continue
        s = _strip_struck(s, pn, rep)
        s = REF_FIGURE_RE.sub("", s)
        s = INLINE_TAG_RE.sub("", s)
        out.append(s)
    text = "\n".join(out)
    return re.sub(r"\n{3,}", "\n\n", text).strip()


def clean_pages(pages: dict[int, str]) -> tuple[dict[int, str], CleanReport]:
    """Returns cleaned pages keyed by ORIGINAL page number (pages that end up empty are omitted)."""
    rep = CleanReport()
    header = detect_header_line(pages)
    out: dict[int, str] = {}
    first = min(pages) if pages else 0
    last_heading: str | None = None
    for pn in sorted(pages):
        md = pages[pn]
        cover = pn == first and _is_cover_page(md)
        toc = _is_toc_page(md)
        if cover:
            rep.cover_dropped = True
        if toc:
            rep.toc_pages.append(pn)
        cleaned = clean_page(pn, md, header, rep, cover=cover, toc=toc)
        if not cleaned.strip():
            continue
        # carry the last real heading onto a continuation page so its chunks keep their section
        first_line = next((ln for ln in cleaned.splitlines() if ln.strip()), "")
        if last_heading and not HEADING_RE.match(first_line) and not toc and not cover:
            cleaned = f"{last_heading}\n\n{cleaned}"
            rep.carried_headings += 1
        for ln in cleaned.splitlines():
            if HEADING_RE.match(ln) and not FIGURE_CAPTION_RE.match(ln):
                last_heading = ln.strip()
        out[pn] = cleaned
    return out, rep
