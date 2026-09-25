"""
READ-ONLY analysis of LlamaParse outputs (cached result.json files) to characterise the
noise we intend to strip before chunking — and to count cross-reference-only sections.

  python indexer/analyze_parse_noise.py <cache_dir> [--show FILE]

Reports per manual: cover page signals, TOC pages, repeated header/footer lines (lines
present on >=60% of pages), callout-like trailing lines (short imperative "Click ..."
lines at page end), image-description lines ("photograph:", "logo:", "screenshot:"),
and sections whose body is only a cross-reference ("refer to ...").
"""
from __future__ import annotations

import glob
import json
import os
import re
import sys
from collections import Counter

sys.path.insert(0, os.path.dirname(__file__))
from chunking import split_by_headings  # noqa: E402

IMG_RE = re.compile(r"^\s*(photograph|logo|screenshot|image|icon|illustration|picture|diagram)\s*:", re.I)
TOC_LEADER_RE = re.compile(r"\.{4,}\s*\d+\s*$|\s{2,}\d{1,3}\s*$")
TOC_TITLE_RE = re.compile(r"^\s*#*\s*(table of )?contents\s*$", re.I)
PAGE_OF_RE = re.compile(r"\bpage\s+\d+\s+of\s+\d+\b", re.I)
REV_RE = re.compile(r"\b(revision|rev\.?)\s*(no\.?|number)?\s*[:#]?\s*\w+", re.I)
CALLOUT_RE = re.compile(r"^\s*(\d+[.)]\s*)?(click|select|tap|press|choose|enter|go to|open|navigate)\b", re.I)
XREF_RE = re.compile(r"\b(refer to|please refer|see (the )?[\w\s&-]{0,30}(sub-?module|module|section|manual)|covered (in|under)|as (explained|described) (in|under))\b", re.I)


def pages_of(result: dict) -> dict[int, str]:
    md = result.get("markdown") or {}
    if isinstance(md, dict):
        return {int(p.get("page_number", 0)): p.get("markdown", "") for p in md.get("pages", []) if isinstance(p, dict)}
    return {1: str(md)}


def norm(line: str) -> str:
    return re.sub(r"\d+", "#", re.sub(r"\s+", " ", line.strip().lower()))


def analyze(path: str, show: bool = False) -> dict:
    j = json.load(open(path, encoding="utf-8"))
    pages = pages_of(j)
    n = len(pages)
    out: dict = {"file": (j.get("job") or {}).get("name") or os.path.basename(path), "pages": n}
    if not n:
        return out
    # cover page: page 1 with few text lines and image-description lines / a lone title
    p1 = pages.get(min(pages))
    p1_lines = [ln for ln in (p1 or "").splitlines() if ln.strip()]
    out["cover_img_lines"] = sum(1 for ln in p1_lines if IMG_RE.match(ln))
    out["cover_text_lines"] = len(p1_lines)
    out["cover_looks_decorative"] = out["cover_img_lines"] >= 1 and len(p1_lines) <= 8
    # TOC pages
    toc = []
    for pn, md in pages.items():
        lines = [ln for ln in md.splitlines() if ln.strip()]
        leaders = sum(1 for ln in lines if TOC_LEADER_RE.search(ln))
        if any(TOC_TITLE_RE.match(ln) for ln in lines) or (lines and leaders / len(lines) > 0.4 and leaders >= 5):
            toc.append(pn)
    out["toc_pages"] = toc
    # repeated header/footer lines (>=60% of pages)
    cnt: Counter[str] = Counter()
    for md in pages.values():
        seen = set()
        for ln in md.splitlines():
            k = norm(ln)
            if 4 <= len(k) <= 120 and k not in seen:
                seen.add(k)
                cnt[k] += 1
    repeated = [(k, c) for k, c in cnt.items() if c >= max(3, int(0.6 * n))]
    out["repeated_lines"] = sorted(repeated, key=lambda kc: -kc[1])[:8]
    out["page_of_lines"] = sum(1 for md in pages.values() for ln in md.splitlines() if PAGE_OF_RE.search(ln))
    # image-description lines anywhere
    out["img_desc_lines"] = sum(1 for md in pages.values() for ln in md.splitlines() if IMG_RE.match(ln))
    # trailing callouts: last 6 non-empty lines of a page that look like short imperative steps
    callout_pages = 0
    callout_lines = 0
    for md in pages.values():
        lines = [ln for ln in md.splitlines() if ln.strip()]
        tail = lines[-6:]
        c = sum(1 for ln in tail if CALLOUT_RE.match(ln) and len(ln) < 90)
        if c >= 2:
            callout_pages += 1
            callout_lines += c
    out["callout_pages"] = callout_pages
    out["callout_lines"] = callout_lines
    # html tags
    full = "\n".join(pages[k] for k in sorted(pages))
    out["html_tags"] = len(re.findall(r"<[a-zA-Z/][^>]*>", full))
    # cross-reference-only sections
    xref_only = []
    for title, body in split_by_headings(full):
        b = body.strip()
        if 0 < len(b) <= 260 and XREF_RE.search(b) and title not in ("Preamble", "Document"):
            xref_only.append((title[:50], b[:90].replace("\n", " ")))
    out["xref_only_sections"] = xref_only
    if show:
        print("== page 1 ==\n" + (p1 or "")[:600])
        for pn in toc[:1]:
            print(f"== toc page {pn} ==\n" + pages[pn][:500])
        mid = sorted(pages)[len(pages) // 2]
        print(f"== page {mid} (middle) ==\n" + pages[mid][:1200])
    return out


def main() -> None:
    cache = sys.argv[1]
    show = sys.argv[sys.argv.index("--show") + 1] if "--show" in sys.argv else None
    files = sorted(glob.glob(os.path.join(cache, "*.result.json")))
    tot_x = 0
    print(f"{'manual':<50} {'pg':>3} {'cover':>5} {'toc':>6} {'hdr/ftr':>7} {'pgof':>5} {'img':>4} {'callout pg/ln':>13} {'html':>5} {'xref':>4}")
    for f in files:
        r = analyze(f, show=bool(show and os.path.basename(f).startswith(show)))
        if not r.get("pages"):
            continue
        tot_x += len(r["xref_only_sections"])
        print(f"{r['file'][:50]:<50} {r['pages']:>3} {('Y' if r['cover_looks_decorative'] else '-'):>5} {str(r['toc_pages'])[:6]:>6} "
              f"{len(r['repeated_lines']):>7} {r['page_of_lines']:>5} {r['img_desc_lines']:>4} {r['callout_pages']:>6}/{r['callout_lines']:<6} {r['html_tags']:>5} {len(r['xref_only_sections']):>4}")
    print(f"\ncross-reference-only sections total: {tot_x}")
    print("\n== repeated header/footer lines (sample from first 6 manuals) ==")
    for f in files[:6]:
        r = analyze(f)
        print(" ", r["file"][:45], "→", [k for k, _ in r.get("repeated_lines", [])][:4])
    print("\n== cross-reference-only sections (all) ==")
    for f in files:
        r = analyze(f)
        for t, b in r.get("xref_only_sections", []):
            print(f"  {r['file'][:38]:<38} | {t:<40} | {b}")


if __name__ == "__main__":
    main()
