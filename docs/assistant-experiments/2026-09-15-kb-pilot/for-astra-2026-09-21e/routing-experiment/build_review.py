# Assemble each stored answer next to the excerpts that were actually supplied to it, so correctness
# can be judged by reading rather than by text similarity (reviewer, 21-Sep-2026: "similar wording can
# contain a wrong condition; different wording can be equally correct").
#
# The supplied excerpts are reconstructed from the offline model, which verify_instruments.py checks
# against the live containers — 34 of 34 questions, both arms, on excerpt counts. The chunk TEXT is
# then fetched from the index.
#
#   python build_review.py            # writes review-input.json  (needs chunk-text.json, see below)
#   # chunk text is fetched separately on the server:
#   #   python build_review.py --keys > keys.json   then the SQL in the README, then save chunk-text.json
import argparse
import json
from pathlib import Path

import analyse as A

HERE = Path(__file__).resolve().parent
R = json.loads((HERE / "answers.json").read_text(encoding="utf-8"))["results"]
R6C = [r for label, r in A.RULES if label.startswith("R6c")][0]
CASE = {c["id"]: c for c in A.CAND["cases"]}
TESTED = sorted({r["id"] for r in R})


def supplied(cid: str, arm: str) -> list[dict]:
    rule = A.RULES[0][1] if arm == "baseline" else R6C
    return A.run_rule(CASE[cid], rule)[1]


def affected() -> list[str]:
    out = []
    for cid in TESTED:
        b = {A.ident(h) for h in supplied(cid, "baseline")}
        c = {A.ident(h) for h in supplied(cid, "candidate")}
        if b != c:
            out.append(cid)
    return out


def key(h: dict) -> str:
    return f"{h['file']}||{h['page']}||{h['chunk_index']}"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--keys", action="store_true")
    args = ap.parse_args()

    aff = affected()
    if args.keys:
        ks = sorted({key(h) for cid in TESTED for arm in ("baseline", "candidate")
                     for h in supplied(cid, arm)})
        print(json.dumps(ks))
        return

    text = {}
    p = HERE / "chunk-text.json"
    if p.exists():
        text = json.loads(p.read_text(encoding="utf-8"))

    out = []
    for cid in aff:
        c = CASE[cid]
        entry = {"id": cid, "question": c["question"], "expected_module": c["expected_module"],
                 "expected_file": c.get("expected_file"), "expected_pages": c.get("expected_pages"),
                 "arms": {}}
        for arm in ("baseline", "candidate"):
            hits = supplied(cid, arm)
            entry["arms"][arm] = {
                "excerpts": [{"module": h["module"], "file": h["file"], "page": h["page"],
                              "section": h["section"], "distance": h["distance"],
                              "text": text.get(key(h), "")} for h in hits],
                "answers": [r["response"] for r in R if r["id"] == cid and r["arm"] == arm],
            }
        out.append(entry)
    (HERE / "review-input.json").write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{len(out)} affected questions written to review-input.json"
          f" · chunk text available for {sum(1 for v in text.values() if v)} chunks")


if __name__ == "__main__":
    main()
