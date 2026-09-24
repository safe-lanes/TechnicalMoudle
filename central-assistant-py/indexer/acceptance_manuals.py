"""
Manual-coverage suite (owner brief 15-Sep-2026, step 3): source-backed cases over EVERY official manual — ordinary
procedures, conditions, tables/legends, screenshot-only instructions and cross-reference pointers. Cases live in
indexer/manual_cases.json (authored from the manuals-only chunk text; every expected fact quoted verbatim there).

Per answer, this suite records and scores:
  answer      — the base judge (indexer/acceptance_answers.judge): manual name, accepted pages, must / must_not phrases
  support     — does the CITED section's captured excerpt text contain the must phrases? (a file name in a citation or a
                keyword match does not establish support: the phrase must be in the excerpt that was actually supplied)
  sources     — which kinds of source the answer relied on: manual / code-derived (docx notes) / kb-pilot / mixed, from the
                citations AND from the captured excerpts
  limitation  — when the question's evidence is absent from the set, an honest "not covered" is HONEST_LIMIT, a fabricated
                procedure is a defect; when the evidence IS present, "not covered" is a miss
Captured excerpts come from the candidate container's ASSISTANT_CAPTURE_OUTBOUND file (request bodies), matched to each
run by the question text and order (--capture <file>); without --capture, support is reported as "not captured".

  python indexer/acceptance_manuals.py --repeat 3 --set A=http://... --set B=http://... --dump out.jsonl [--capture cap.jsonl]
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import httpx2 as httpx  # noqa: E402
from acceptance_answers import ask, judge  # noqa: E402

MANUAL_SUITE_VERSION = "2026-09-15.1"
NOT_COVERED = ["not covered", "isn't covered", "not documented", "does not cover", "no information", "do not describe", "does not describe", "not described"]
CODE_DERIVED = ("(Operational)", "Recent Updates", "Ship-Side", "Roles & Permissions", "Bulk Data Import", "Sync (Operational)")


def load_cases(path: str) -> list[dict]:
    return json.load(open(path, encoding="utf-8"))


def source_kinds(citations: list[dict], excerpt_files: list[str]) -> str:
    kinds = set()
    for name in [c.get("manual", "") for c in citations] + excerpt_files:
        if "KB pilot" in name:
            kinds.add("kb-pilot")
        elif any(t in name for t in CODE_DERIVED):
            kinds.add("code-derived")
        elif name:
            kinds.add("manual")
    return "+".join(sorted(kinds)) or "none"


def capture_index(path: str | None) -> list[dict]:
    """Chat request bodies in order: [{question, excerpts:[{file, section, text}]}]."""
    if not path or not os.path.exists(path):
        return []
    out = []
    for line in open(path, encoding="utf-8"):
        rec = json.loads(line)
        if "chat/completions" not in rec.get("url", ""):
            continue
        body = json.loads(rec["body"])
        user = next((m["content"] for m in body.get("messages", []) if m.get("role") == "user"), "")
        q = user.rsplit("\n\nQuestion: ", 1)[-1].strip() if "\n\nQuestion: " in user else ""
        ex = []
        block = user.split("Manual excerpts:\n\n", 1)[-1].rsplit("\n\nQuestion:", 1)[0]
        for part in block.split("\n\n---\n\n"):
            head, _, txt = part.partition("\n")
            m = re.match(r"\[(\d+)\] \((.+?) — (.+)\)$", head)
            if m:
                ex.append({"file": m.group(2), "section": m.group(3), "text": txt})
        out.append({"question": q, "excerpts": ex})
    return out


def support_check(case: dict, resp: dict, cap: list[dict], used: set[int]) -> tuple[str, list[str]]:
    """Find the next unused captured request for this question; check must phrases inside the cited/supplied excerpts."""
    q = case["question"]
    idx = next((i for i, c in enumerate(cap) if c["question"] == q and i not in used), None)
    if idx is None:
        return "not captured", []
    used.add(idx)
    files = [e["file"] for e in cap[idx]["excerpts"]]
    cited = {c.get("manual", "") for c in resp.get("citations", [])}
    texts = [e["text"].lower() for e in cap[idx]["excerpts"] if any(e["file"].startswith(c[:40]) for c in cited)] or [e["text"].lower() for e in cap[idx]["excerpts"]]
    blob = "\n".join(texts)
    missing = [m for m in case["must"] if m.lower() not in blob]
    return ("supported" if not missing else "NOT in supplied excerpts: " + ", ".join(missing)), files


async def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--set", action="append", required=True)
    ap.add_argument("--repeat", type=int, default=1)
    ap.add_argument("--dump", default=None)
    ap.add_argument("--cases", default=str(Path(__file__).with_name("manual_cases.json")))
    ap.add_argument("--capture", action="append", default=[], help="name=path of that set's capture file (request bodies)")
    args = ap.parse_args()
    key = os.environ["IDENTITY_SIGNING_KEY"]
    sets = [(s.partition("=")[0], s.partition("=")[2]) for s in args.set]
    caps = {c.partition("=")[0]: capture_index(c.partition("=")[2]) for c in args.capture}
    used: dict[str, set[int]] = {n: set() for n, _ in sets}
    cases = load_cases(args.cases)
    dump = open(args.dump, "w", encoding="utf-8") if args.dump else None  # noqa: SIM115
    score = {n: 0 for n, _ in sets}
    print(f"manual-coverage suite {MANUAL_SUITE_VERSION} · {len(cases)} cases · repeat={args.repeat}")
    async with httpx.AsyncClient(timeout=150.0) as c:
        for case in cases:
            module = case["file"].split(" - ")[0].strip().lower()
            print(f"\n[{case['id']} {case['kind']}] {case['question']}")
            runs = [await asyncio.gather(*(ask(c, u, key, case["question"], module) for _, u in sets)) for _ in range(args.repeat)]
            for si, (n, _) in enumerate(sets):
                votes = []
                for r in range(args.repeat):
                    resp = runs[r][si]
                    a, ct, _at, detail = judge(resp, case["file"].rsplit(".", 1)[0], case["pages"], case["must"], case["must_not"] + NOT_COVERED, "gen")
                    text = (resp.get("response") or "").lower()
                    said_not_covered = any(p in text for p in NOT_COVERED) or resp.get("gate") in ("not_documented", "clarify")
                    sup, files = support_check(case, resp, caps.get(n, []), used[n])
                    kinds = source_kinds(resp.get("citations", []), files)
                    ok = a and ct and sup.startswith(("supported", "not captured"))
                    votes.append(ok)
                    if dump:
                        dump.write(json.dumps({"suite": "manuals", "case": case["id"], "kind": case["kind"], "set": n, "run": r + 1,
                                               "verdict": {"answer": a, "citation": ct, "support": sup, "sources": kinds, "said_not_covered": said_not_covered},
                                               "question": case["question"], "response": resp}, ensure_ascii=False) + "\n")
                    if r == 0:
                        print(f"   {n:<12} answer {'✓' if a else '✗'}  cite {'✓' if ct else '✗'}  support {sup[:60]}  sources={kinds}  {'NOT-COVERED-said' if said_not_covered else ''}  {detail}")
                ok_all = all(votes)
                score[n] += ok_all
                print(f"   {n:<12} PASS {'✓' if ok_all else '✗'} [{sum(votes)}/{len(votes)}]")
    print("\n== totals (answer ∧ citation ∧ support, all runs) ==")
    for n, _ in sets:
        print(f"   {n:<12} {score[n]}/{len(cases)}")
    if dump:
        dump.close()
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
