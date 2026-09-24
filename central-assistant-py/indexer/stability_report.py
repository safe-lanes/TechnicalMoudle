"""
Run-to-run STABILITY of a parser configuration, compared by ORIGINAL page number, raw and
after cleanup — reported separately from correctness (stability is not accuracy: two runs
can consistently omit the same content, or flip one word, and still look "stable").

  python indexer/stability_report.py <run1_dir> <run2_dir> [prefix ...]

Per document: pages in each run, pages compared (present in both), identical pages,
formatting-only differences, real word-level differences (with the changed words shown
so a flipped "not" is visible), word-level similarity — for RAW and for CLEANED text.
"""
from __future__ import annotations

import difflib
import glob
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(__file__))
from clean_markdown import clean_pages  # noqa: E402


def load(d: str, prefix: str) -> tuple[str, dict[int, str]]:
    f = [x for x in sorted(glob.glob(os.path.join(d, "*.result.json"))) if os.path.basename(x).startswith(prefix)][0]
    j = json.load(open(f, encoding="utf-8"))
    return (j.get("job") or {}).get("id", "?"), {int(p["page_number"]): p["markdown"] for p in j["markdown"]["pages"]}


def canon(t: str) -> str:
    t = re.sub(r"<table>.*?</table>", " ", t, flags=re.S | re.I)
    t = re.sub(r"```.*?```", " ", t, flags=re.S)
    t = re.sub(r"<[^>]+>", "", t)
    t = re.sub(r"[*_#`>|]+", "", t)
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9' ]+", " ", t.lower())).strip()


def compare(label: str, a: dict[int, str], b: dict[int, str]) -> None:
    both = sorted(set(a) & set(b))
    ident = sum(1 for k in both if a[k].strip() == b[k].strip())
    fmt = sum(1 for k in both if a[k].strip() != b[k].strip() and canon(a[k]) == canon(b[k]))
    real = [k for k in both if canon(a[k]) != canon(b[k])]
    wa = " ".join(canon(a[k]) for k in both).split()
    wb = " ".join(canon(b[k]) for k in both).split()
    sim = difflib.SequenceMatcher(None, wa, wb).ratio() if wa and wb else 0.0
    print(f"   {label:<8} pages run1={len(a)} run2={len(b)} compared={len(both)} (by original page no.) | identical {ident} | formatting-only {fmt} | REAL text diffs {len(real)} | word similarity {sim:.3f}")
    for k in real[:4]:
        d = [x for x in difflib.unified_diff(canon(a[k]).split(" "), canon(b[k]).split(" "), lineterm="", n=0) if x[:1] in "+-" and not x.startswith(("+++", "---"))]
        flips = [x for x in d if x[1:] in ("not", "no", "never", "only", "must", "cannot")]
        print(f"      p{k}: {len(d)} word changes{'  ⚠ negation/modality flip: ' + ' '.join(flips) if flips else ''} — e.g. {' '.join(d[:10])[:120]}")


def main() -> None:
    d1, d2 = sys.argv[1], sys.argv[2]
    prefixes = sys.argv[3:] or sorted({os.path.basename(x).split("__")[0] for x in glob.glob(os.path.join(d2, "*.result.json"))})
    for p in prefixes:
        try:
            j1, a = load(d1, p)
            j2, b = load(d2, p)
        except IndexError:
            continue
        print(f"\n== {p}  (run1 {j1} vs run2 {j2})")
        compare("RAW", a, b)
        ca, ra = clean_pages(a)
        cb, rb = clean_pages(b)
        compare("CLEANED", ca, cb)
        print(f"   removed run1/run2: tables {ra.tables_removed}/{rb.tables_removed}, callouts {ra.callout_lines}/{rb.callout_lines}, struck {ra.struck_spans}/{rb.struck_spans}")


if __name__ == "__main__":
    main()
