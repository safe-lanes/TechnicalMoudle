# Check the ACTUAL outgoing model context, not the index (reviewer, 22-Sep-2026: "check the actual
# outgoing context"). The candidate container writes every outbound request to capture.jsonl when
# ASSISTANT_CAPTURE_OUTBOUND is set. For each captured request this reports whether any source
# step line from a resolved cross-reference reached the model, and whether the adapted step did.
#
#   python verify_capture.py capture.jsonl
import json
import re
import sys
from pathlib import Path

# literal source instructions that must never appear in the context under quote-excluded
SOURCE_LINES = [
    "click on the ‘spares’ sub", "click the ‘spares’ sub", "click on the 'spares' sub",
    "click on the ‘in-progress’ sub", "click on the ‘in—progress’ sub", "click on ‘in-progress’ sub",
    "go to the 'certificates' sub", "go to the ‘certificates’ sub",
    "promotion rank", "new annual drug and alcohol record", "click the 'issue date' cell",
    "quoted verbatim from", "audit copy",
]
ADAPTED_MARK = "steps for "


def text_of(rec: dict) -> str:
    """Whatever field holds the outbound messages; tolerate either a raw messages list or a body."""
    for k in ("messages", "input", "body", "request"):
        if k in rec:
            return json.dumps(rec[k], ensure_ascii=False)
    return json.dumps(rec, ensure_ascii=False)


def main() -> None:
    p = Path(sys.argv[1] if len(sys.argv) > 1 else "capture.jsonl")
    recs = [json.loads(l) for l in p.read_text(encoding="utf-8").splitlines() if l.strip()]
    print(f"{len(recs)} captured outbound requests in {p.name}")
    leaks, adapted, resolved_ctx = 0, 0, 0
    for i, r in enumerate(recs, 1):
        t = text_of(r).lower()
        t = re.sub(r"[*_`]+", "", t)
        if "cross-reference resolved" in t:
            resolved_ctx += 1
            hit = [s for s in SOURCE_LINES if s in t]
            if hit:
                leaks += 1
                print(f"  #{i}: SOURCE LINE REACHED THE MODEL -> {hit[:3]}")
            if ADAPTED_MARK in t:
                adapted += 1
    print(f"requests whose context contained a resolved cross-reference: {resolved_ctx}")
    print(f"  ... with the adapted 'Steps for' block present : {adapted}")
    print(f"  ... with a SOURCE step line present (leak)     : {leaks}")


if __name__ == "__main__":
    main()
