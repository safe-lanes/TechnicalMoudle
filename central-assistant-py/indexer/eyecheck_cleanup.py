"""
Eye-check of the cleanup's figure-zone rule across every cached parse (owner ask 14-Sep):
per manual — tables removed / kept, mermaid removed, and EVERYTHING the rule removed that
could conceivably be instruction (bullet-shaped lines, lines > 70 chars, or the header row of
every removed table) so a human can confirm nothing real was taken. Also lists every KEPT
table's header row (those are the ones we assert are genuine).

  python indexer/eyecheck_cleanup.py <cache_dir> [--full]
"""
from __future__ import annotations

import glob
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(__file__))
from clean_markdown import BULLET_RE, FIGURE_CAPTION_RE, HEADING_RE, IMG_LINE_RE, PAGE_OF_RE, _blocks, clean_pages  # noqa: E402
from xrefs import resolve_xrefs  # noqa: E402


def table_header(t: str) -> str:
    cells = re.findall(r"<t[hd][^>]*>(.*?)</t[hd]>", t, re.S | re.I)
    cells = [re.sub(r"<[^>]+>", "", c).strip() for c in cells]
    return " | ".join(c for c in cells[:6] if c)[:90] or "(empty cells)"


def removed_material(pages: dict[int, str], cleaned: dict[int, str]) -> tuple[list[str], list[str], list[str]]:
    """Return (removed table headers, kept table headers, suspicious removed lines)."""
    removed_t, kept_t, suspicious = [], [], []
    for pn, md in pages.items():
        raw_tables = [t for k, t in _blocks(md) if k == "table"]
        kept = cleaned.get(pn, "")
        for t in raw_tables:
            (kept_t if t in kept else removed_t).append(f"p{pn}: {table_header(t)}")
        # lines present in raw but absent in cleaned (ignoring tags/refs/whitespace)
        def canon(s: str) -> str:
            s = re.sub(r"<[^>]+>", "", s)
            s = re.sub(r"\(?\s*ref\.?\s*figure\s*\d+\s*\)?\.?", "", s, flags=re.I)
            return re.sub(r"\s+", " ", s).strip().lower()
        kept_lines = {canon(ln) for ln in kept.splitlines()}
        in_table = False
        for ln in md.splitlines():
            low = ln.strip().lower()
            if low.startswith("<table"):
                in_table = True
            if in_table:
                if "</table>" in low:
                    in_table = False
                continue
            if low.startswith("```") or not ln.strip():
                continue
            c = canon(ln)
            if c and c not in kept_lines and not FIGURE_CAPTION_RE.match(ln) and not PAGE_OF_RE.match(ln) and not IMG_LINE_RE.match(ln) and not HEADING_RE.match(ln):
                if BULLET_RE.match(ln) or len(c) > 70:
                    suspicious.append(f"p{pn}: {ln.strip()[:110]}")
    return removed_t, kept_t, suspicious


def main() -> None:
    cache = sys.argv[1]
    full = "--full" in sys.argv
    files = sorted(glob.glob(os.path.join(cache, "*.result.json")))
    tot = {"removed": 0, "kept": 0, "mermaid": 0, "suspicious": 0, "xres": 0, "xun": 0}
    print(f"{'manual':<52}{'pg':>3} {'cover':>5} {'toc':>4} {'hdr':>4} {'ftr':>4} {'zones':>5} {'tbl rm/kept':>11} {'merm':>4} {'callout':>7} {'susp':>4} {'xref ok/un':>10}")
    details = []
    for f in files:
        j = json.load(open(f, encoding="utf-8"))
        name = (j.get("job") or {}).get("name") or os.path.basename(f)
        pages = {int(p.get("page_number", 0)): p.get("markdown", "") for p in (j.get("markdown") or {}).get("pages", []) if isinstance(p, dict)}
        cleaned, rep = clean_pages(pages)
        _, xr = resolve_xrefs(cleaned)
        rm, kp, sus = removed_material(pages, cleaned)
        tot["removed"] += len(rm)
        tot["kept"] += len(kp)
        tot["mermaid"] += rep.mermaid_removed
        tot["suspicious"] += len(sus)
        tot["xres"] += len(xr.resolved)
        tot["xun"] += len(xr.unresolved)
        print(f"{name[:52]:<52}{len(pages):>3} {('Y' if rep.cover_dropped else '-'):>5} {len(rep.toc_pages):>4} {rep.header_lines:>4} {rep.footer_lines:>4} {rep.figure_zones:>5} {len(rm):>5}/{len(kp):<5} {rep.mermaid_removed:>4} {rep.callout_lines:>7} {len(sus):>4} {len(xr.resolved):>5}/{len(xr.unresolved):<4}")
        details.append((name, rm, kp, sus, xr))
    print(f"\nTOTAL tables removed {tot['removed']} · kept {tot['kept']} · mermaid removed {tot['mermaid']} · suspicious removed lines {tot['suspicious']} · xrefs resolved {tot['xres']} / unresolved {tot['xun']}")
    def section(title: str, rows: list[str]) -> None:
        print(f"\n== {title} ==")
        for r in rows:
            print(f"  {r}")

    section("KEPT tables (asserted genuine) — header cells", [f"{n[:40]:<40} {h}" for n, _rm, kp, _s, _x in details for h in kp])
    section("SUSPICIOUS removed lines (bullet-shaped or > 70 chars, outside tables) — review each", [f"{n[:40]:<40} {s}" for n, _rm, _kp, sus, _x in details for s in sus])
    section("UNRESOLVED cross-references", [f"{n[:40]:<40} {t[:45]:<45} → {r}" for n, _rm, _kp, _s, xr in details for t, r in xr.unresolved])
    if full:
        section("REMOVED tables — header cells (first 12 per manual)", [f"{n[:40]:<40} {h}" for n, rm, _kp, _s, _x in details for h in rm[:12]])
        section("RESOLVED cross-references", [f"{n[:40]:<40} {t[:45]:<45} → {tt[:45]}" for n, _rm, _kp, _s, xr in details for t, tt in xr.resolved])


if __name__ == "__main__":
    main()
