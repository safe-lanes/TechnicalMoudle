"""
Targeted extraction repairs (owner instruction 14-Sep-2026): content the saved parse missed
(screenshot callouts, table content, captions) is transcribed from the source page and saved
SEPARATELY from the raw parse — one JSON record per source document under indexer/repairs/,
keyed by the document's sha256, each entry carrying page, figure, extraction method, and the
repair version. The raw parse in the parse store is never modified.

At build time (`--apply-repairs`) an entry's text is inserted on its page immediately before
the "Figure N" caption line it belongs to, so the transcription sits where the manual's own
text refers to that figure. A record whose sha256 does not match the file being indexed is
ignored and reported (the source changed → the repair must be re-verified).
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from pathlib import Path

REPAIR_VERSION = "2026-09-14.1"  # part of the build key when repairs are applied; bump on any change to the records or this logic
REPAIRS_DIR = Path(__file__).resolve().parent / "repairs"


@dataclass
class RepairReport:
    applied: list[str] = field(default_factory=list)      # "p15 Figure 20"
    not_found: list[str] = field(default_factory=list)    # figure line not located on the page
    sha_mismatch: list[str] = field(default_factory=list)


def load_repairs(directory: Path = REPAIRS_DIR) -> dict[str, dict]:
    out: dict[str, dict] = {}
    for f in sorted(directory.glob("*.json")):
        rec = json.loads(f.read_text(encoding="utf-8"))
        out[rec["sha256"]] = rec
    return out


def _figure_line_re(figure: str) -> re.Pattern[str]:
    # "Figure 20", "<u>Figure 20</u>", "Figure 20 Click anywhere…" — the caption line for that figure number
    num = re.escape(figure.split()[-1])
    return re.compile(rf"^(?:<u>)?\s*Figure\s+{num}(?:</u>)?\b.*$", re.M | re.I)


def apply_repairs(pages: dict[int, str], sha256: str, file: str, repairs: dict[str, dict]) -> tuple[dict[int, str], RepairReport]:
    rep = RepairReport()
    rec = repairs.get(sha256)
    if rec is None:
        # a record for this file name but another hash → the source changed since the repair was verified
        for r in repairs.values():
            if r.get("file") == file:
                rep.sha_mismatch.append(f"{file}: repair record {r['sha256'][:16]} != source {sha256[:16]}")
        return pages, rep
    out = dict(pages)
    for e in rec["entries"]:
        pn = int(e["page"])
        md = out.get(pn)
        label = f"p{pn} {e['figure']}"
        if md is None:
            rep.not_found.append(label + " (page absent)")
            continue
        m = _figure_line_re(e["figure"]).search(md)
        block = (f"\n(Extraction repair {rec['repair_version']} — transcribed from the {e['figure']} screenshot on page {pn}, "
                 f"verified against the source page:)\n{e['text'].strip()}\n\n")
        if m:
            out[pn] = md[:m.start()] + block + md[m.start():]
        else:
            out[pn] = md.rstrip() + "\n" + block  # keep the content even if the caption line is not where expected
            rep.not_found.append(label + " (figure line not found; appended at page end)")
        rep.applied.append(label)
    return out, rep
