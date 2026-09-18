# Step 2 of the owner brief of 18-Sep: build a reviewable pack of ALL 171 stored D4 manual-coverage answers
# (57 cases x 3 runs). No service or model calls — reads the stored dump and the captured request bodies.
# For every run the pack carries what a reviewer needs to judge it on its own merits:
#   the case (question, expected manual/pages, required and forbidden phrases, the verbatim manual evidence),
#   the full answer, the citations exactly as the user would see them, and every supplied excerpt with a
#   per-excerpt check of which required phrases it contains (so "supported" is never assumed from a filename).
# Usage: python review_pack_d4.py [--set D4-rescue] [--out review-d4-pack.txt]
import argparse
import json
import os
import re
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
CASES = json.load(open(os.path.join(HERE, "..", "..", "..", "central-assistant-py", "indexer", "manual_cases.json"), encoding="utf-8"))
BY_ID = {c["id"]: c for c in CASES}


def captures(path):
    out = defaultdict(list)
    for line in open(os.path.join(HERE, path), encoding="utf-8"):
        rec = json.loads(line)
        if "chat/completions" not in rec.get("url", ""):
            continue
        body = json.loads(rec["body"])
        user = next((m["content"] for m in body.get("messages", []) if m.get("role") == "user"), "")
        q = user.rsplit("\n\nQuestion: ", 1)[-1].strip() if "\n\nQuestion: " in user else ""
        block = user.split("Manual excerpts:\n\n", 1)[-1].rsplit("\n\nQuestion:", 1)[0]
        ex = []
        for part in block.split("\n\n---\n\n"):
            head, _, txt = part.partition("\n")
            m = re.match(r"\[(\d+)\] \((.+?) — (.+)\)$", head)
            if m:
                ex.append({"file": m.group(2), "section": m.group(3), "text": txt})
        out[q].append(ex)
    return out


def page_of(section):
    m = re.search(r"\(p\.(\d+)\)", str(section or ""))
    return int(m.group(1)) if m else None


ap = argparse.ArgumentParser()
ap.add_argument("--set", default="D4-rescue")
ap.add_argument("--dump", default="s4c-manuals-dump.jsonl")
ap.add_argument("--capture", default="s4-d4-capture.jsonl")
ap.add_argument("--out", default="review-d4-pack-full.txt")
args = ap.parse_args()

rows = [json.loads(l) for l in open(os.path.join(HERE, args.dump), encoding="utf-8") if l.strip()]
rows = [r for r in rows if r["set"] == args.set]
cap = captures(args.capture)
used = defaultdict(int)

out = open(os.path.join(HERE, args.out), "w", encoding="utf-8")
order = [c["id"] for c in CASES]
rows.sort(key=lambda r: (order.index(r["case"]), r["run"]))
for r in rows:
    c = BY_ID[r["case"]]
    resp = r["response"]
    ans = resp.get("response") or ""
    low = ans.lower()
    out.write("\n" + "=" * 110 + "\n")
    out.write(f"CASE {c['id']} [{c['kind']}] run {r['run']}   stored verdict: answer={r['verdict']['answer']} "
              f"citation={r['verdict']['citation']} support={r['verdict']['support']}\n")
    out.write(f"Q: {c['question']}\n")
    out.write(f"EXPECTED manual: {c['file']}  pages {c['pages']}  section {c.get('section')}\n")
    out.write(f"MANUAL EVIDENCE (verified when the case was written): {c['evidence']}\n")
    out.write(f"REQUIRED phrases: {c['must']}   (in answer: {[m for m in c['must'] if m.lower() in low]})\n")
    out.write(f"FORBIDDEN phrases: {c['must_not']}   (in answer: {[m for m in c['must_not'] if m.lower() in low]})\n")
    out.write("\nCITATIONS SHOWN TO THE USER:\n")
    for i, ci in enumerate(resp.get("citations") or [], 1):
        sec = str(ci.get("section"))
        mark = "  <== expected manual+page" if (c["file"].rsplit(".", 1)[0].lower() in str(ci.get("manual", "")).lower()
                                                and (not c["pages"] or page_of(sec) in c["pages"])) else ""
        out.write(f"  [{i}] {ci.get('manual')} — {sec}{mark}\n")
    q = c["question"]
    ex = None
    if cap.get(q):
        i = used[q]
        if i < len(cap[q]):
            ex = cap[q][i]
        used[q] = i + 1
    out.write("\nEXCERPTS ACTUALLY SUPPLIED TO THE MODEL:\n")
    if ex is None:
        out.write("  (not captured)\n")
    else:
        for i, e in enumerate(ex, 1):
            hit = [m for m in c["must"] if m.lower() in e["text"].lower()]
            isexp = c["file"].rsplit(".", 1)[0].lower() in e["file"].lower() and (not c["pages"] or page_of(e["section"]) in c["pages"])
            out.write(f"  [{i}] {e['file']} — {e['section']}{'  <== expected source' if isexp else ''}\n")
            out.write(f"      required phrases present here: {hit}\n")
            # FULL text: a truncated excerpt made three correct answers look fabricated in the first pass (see
            # review-d4-verdicts.json "verification_correction"). Support must always be judged on the whole excerpt.
            body = re.sub(r"[ \t]+", " ", e["text"]).strip()
            out.write(f"      text (FULL, untruncated):\n{body}\n")
    out.write(f"\nANSWER (verbatim):\n{ans}\n")
out.close()
print(f"wrote {args.out}: {len(rows)} runs, {len({r['case'] for r in rows})} cases")
