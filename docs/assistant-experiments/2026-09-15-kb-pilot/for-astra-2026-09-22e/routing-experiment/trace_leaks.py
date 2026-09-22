# Trace every source term in the captured model context to the EXCERPT that carried it.
#
# Reviewer, 22-Sep-2026: I saw "(Criticality, Rotation Item, or Stock)" in the captured input and
# attributed it to a separately retrieved Spares section; it was inside my own adapted Stores block.
# So a term is never reported as "retrieved source text" until this script has shown which excerpt
# header it sits under, and whether that excerpt is (a) a resolved destination chunk — and if so,
# whether the term is in its adapted part or in a quoted part — or (b) an ordinary source section.
#
#   python trace_leaks.py capture-g4.jsonl
import json
import re
import sys
from pathlib import Path

TERMS = ["criticality", "rotation item", "promotion rank", "issue date", "expiry date",
         "new annual", "annual drug", "‘in-progress’ sub", "‘in—progress’ sub",
         "'in-progress' sub", "'certificates' sub", "‘spares’ sub", "'spares' sub"]
# The header nests a parenthesis — "(Crewing … — 1.2.3.3 HOW TO EXPORT CREW DETAILS (p.22))" — so a
# "[^)]" class stopped at "(p.22" and matched nothing; the header ends at the first ")\n".
EXC = re.compile(r"\[(\d+)\] \((.+?)\)\n(.*?)(?=\n\[\d+\] \(|\Z)", re.S)


def norm(t: str) -> str:
    """Strip emphasis and collapse spaces — but KEEP newlines: classification reads the line that
    carries the term, and collapsing '\\n' made every term in a resolved chunk look like it sat in the
    pointer sentence (a bug this script had on its first validation run)."""
    t = re.sub(r"[*_`]+", "", t or "")
    return re.sub(r"[ \t]+", " ", t).lower()


# The 41 sections that carry a resolved cross-reference, from the index dump: (module, page, section
# title). An excerpt whose header names one of them is OURS even when it is the continuation chunk
# after a 1200-char split, where the "(Cross-reference resolved" line is not present. Without this,
# the Vessel manual's "1.1.8.2 HOW TO APPLY FILTER" continuation — which carried my own parenthesised
# list — was labelled a separately retrieved source section. That is the error the reviewer caught.
_XREFS = Path(__file__).resolve().parent / "xrefs.json"
RESOLVED = set()
if _XREFS.exists():
    for r in json.loads(_XREFS.read_text(encoding="utf-8")):
        RESOLVED.add((str(r.get("section") or "").strip().lower(), str(r.get("page") or "")))


def header_is_resolved(header: str) -> bool:
    h = header.lower()
    m = re.search(r"\(p\.(\d+)\)\s*$", header)
    page = m.group(1) if m else ""
    return any(sec and sec in h and (not page or page == pg) for sec, pg in RESOLVED)


def classify(block_text: str, pos: int, header: str) -> str:
    """Where inside the excerpt the term sits."""
    t = block_text
    is_resolved = "cross-reference resolved" in t.lower() or header_is_resolved(header)
    if not is_resolved:
        return f"SOURCE SECTION retrieved on its own — {header[:70]}"
    # the manual's own pointer sentence ("Refer to the ‘In—Progress’ sub-sub-module … same steps")
    line_start = t.rfind("\n", 0, pos) + 1
    line = t[line_start: t.find("\n", pos) if t.find("\n", pos) > 0 else len(t)]
    if "refer to the" in line and "same steps" in line:
        return "the manual's OWN pointer sentence — legitimate, not an instruction"
    before = t[:pos].lower()
    if "steps for" in before and "indexing note" not in before and "(source:" not in before:
        return "OUR ADAPTED BLOCK (resolver output) — content defect"
    if "indexing note" in before or "do not exist here" in t[max(0, pos - 160):pos + 160].lower() \
            or "not repeated" in t[max(0, pos - 160):pos + 160].lower():
        return "our adapted block, inside a DENIAL / indexing note — not an instruction"
    if "quoted verbatim" in before or "audit copy" in before:
        return "QUOTED SOURCE TEXT inside the resolved chunk (layout still carries the quote)"
    if "cross-reference resolved" not in t.lower():
        # a continuation chunk: the resolved section split at 1200 chars and this excerpt is the tail,
        # so neither the header line nor "Steps for" precedes the term — but it is still our text
        return "OUR ADAPTED BLOCK (continuation chunk after the split) — content defect"
    return "resolved chunk, position unclassified — read by hand"


def main() -> None:
    p = Path(sys.argv[1] if len(sys.argv) > 1 else "capture-g4.jsonl")
    recs = [json.loads(l) for l in p.read_text(encoding="utf-8").splitlines() if l.strip()]
    tally: dict[str, int] = {}
    print(f"{len(recs)} captured requests in {p.name}\n")
    for i, r in enumerate(recs, 1):
        if "/embeddings" in r.get("url", ""):
            continue                       # the embedding call carries only the question
        body = r.get("body", "")

        def leaves(o) -> list[str]:        # shape-agnostic: every string in the wire body
            if isinstance(o, str):
                return [o]
            if isinstance(o, dict):
                return [s for v in o.values() for s in leaves(v)]
            if isinstance(o, list):
                return [s for v in o for s in leaves(v)]
            return []
        try:
            ctx = "\n".join(leaves(json.loads(body)))
        except Exception:
            ctx = body
        hits = []
        for n, header, text in EXC.findall(ctx):
            nt = norm(text)
            for term in TERMS:
                pos = nt.find(term)
                if pos >= 0:
                    where = classify(nt, pos, header)
                    hits.append((term, n, where))
                    tally[where.split(" — ")[0]] = tally.get(where.split(" — ")[0], 0) + 1
        if hits:
            print(f"#{i:>2}")
            for term, n, where in hits:
                print(f"     {term!r:<28} excerpt [{n}]  {where}")
    print("\nSUMMARY by origin (term occurrences):")
    for k, v in sorted(tally.items(), key=lambda kv: -kv[1]):
        print(f"   {v:>3}  {k}")


if __name__ == "__main__":
    main()
