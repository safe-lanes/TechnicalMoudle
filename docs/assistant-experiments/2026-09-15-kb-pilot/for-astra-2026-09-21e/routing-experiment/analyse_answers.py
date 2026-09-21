# Analysis of the bounded candidate answer test. Mechanical checks only; every answer the mechanics
# flag is printed in full for reading, because the brief requires each changed or failing answer to be
# read against the supplied text rather than scored by a regex.
#
#   python analyse_answers.py            # summary
#   python analyse_answers.py --read     # + the full text of every changed or flagged answer
import argparse
import json
from collections import defaultdict
from pathlib import Path

HERE = Path(__file__).resolve().parent
D = json.loads((HERE / "answers.json").read_text(encoding="utf-8"))
R = D["results"]

MODULE_OF_PREFIX = {"audit": "Audit", "safety": "Safety", "technical": "Technical",
                    "incident": "Incident", "crewing": "Crewing"}


def cite_module_ok(c: dict) -> bool | None:
    """The citation's module label against the module its OWN manual belongs to. This is the reviewer's
    point 4: the shipped citations_of stamped the ROUTED module on every hit, so a cross-module excerpt
    was mislabelled."""
    manual = str(c.get("manual") or "")
    prefix = manual.split(" - ")[0].strip().lower()
    truth = MODULE_OF_PREFIX.get(prefix)
    if truth is None:
        return None
    return str(c.get("module") or "").strip() == truth


def by(key) -> dict:
    out = defaultdict(list)
    for r in R:
        out[key(r)].append(r)
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--read", action="store_true")
    args = ap.parse_args()

    errs = [r for r in R if r.get("error")]
    print(f"{len(R)} responses · {D['runs']} runs · {len({r['id'] for r in R})} questions · errors {len(errs)}")
    for e in errs[:5]:
        print("   ERROR", e["id"], e["arm"], e["error"][:90])

    # ── 1. module selection, per arm, per run ───────────────────────────────────────────────────
    print("\nMODULE SELECTION (answering module vs expected), per run")
    for arm in ("baseline", "candidate"):
        for run in range(1, D["runs"] + 1):
            rows = [r for r in R if r["arm"] == arm and r["run"] == run and not r.get("error")]
            ok = sum(1 for r in rows if str(r.get("module") or "").lower() == (r["expected_module"] or ""))
            gates = defaultdict(int)
            for r in rows:
                gates[r.get("gate")] += 1
            print(f"   {arm:<10} run {run}: {ok}/{len(rows)} correct module   gates "
                  + " ".join(f"{k}={v}" for k, v in sorted(gates.items())))

    # ── 2. citation labels ──────────────────────────────────────────────────────────────────────
    print("\nCITATION MODULE LABELS (each citation against its own manual's module)")
    for arm in ("baseline", "candidate"):
        tot = bad = 0
        offenders: set[str] = set()
        for r in R:
            if r["arm"] != arm:
                continue
            for c in (r.get("citations") or []):
                v = cite_module_ok(c)
                if v is None:
                    continue
                tot += 1
                if not v:
                    bad += 1
                    offenders.add(f"{r['id']}:{str(c.get('manual'))[:30]}→{c.get('module')}")
        print(f"   {arm:<10} {tot - bad}/{tot} correctly labelled" + (f"   MISLABELLED {bad}" if bad else ""))
        for o in sorted(offenders)[:6]:
            print(f"      {o}")

    # ── 3. cost ─────────────────────────────────────────────────────────────────────────────────
    print("\nCOST")
    for arm in ("baseline", "candidate"):
        rows = [r for r in R if r["arm"] == arm and not r.get("error")]
        lat = sorted(r["latency_ms"] for r in rows if r.get("latency_ms"))
        cites = [len(r.get("citations") or []) for r in rows]
        # FIXED 21-Sep (reviewer): the field is prompt_tokens/completion_tokens, never total_tokens,
        # so the old lookup silently reported "tokens not reported by the API" when they were there.
        inp = sum((r.get("usage") or {}).get("prompt_tokens", 0) for r in rows)
        out_t = sum((r.get("usage") or {}).get("completion_tokens", 0) for r in rows)
        toks = [inp] if inp else []
        med = lat[len(lat) // 2] if lat else 0
        print(f"   {arm:<10} latency median {med} ms, p90 {lat[int(len(lat) * 0.9)] if lat else 0} ms"
              f" · excerpts/answer avg {sum(cites) / max(1, len(cites)):.2f}"
              + (f" · input tokens {inp:,} · output tokens {out_t:,}" if toks else " · no usage reported"))

    # ── 4. answers that changed ─────────────────────────────────────────────────────────────────
    print("\nANSWERS THAT CHANGED (same question, same run, baseline vs candidate)")
    pairs = by(lambda r: (r["id"], r["run"]))
    changed: list[tuple] = []
    for (cid, run), rows in sorted(pairs.items()):
        b = next((x for x in rows if x["arm"] == "baseline"), None)
        c = next((x for x in rows if x["arm"] == "candidate"), None)
        if not b or not c:
            continue
        if (b.get("response") or "").strip() != (c.get("response") or "").strip():
            changed.append((cid, run, b, c))
    ids_changed = sorted({c[0] for c in changed})
    print(f"   {len(changed)} of {len(pairs)} question-runs differ, across {len(ids_changed)} questions")
    for cid in ids_changed:
        runs = [str(x[1]) for x in changed if x[0] == cid]
        print(f"      {cid:<28} runs {','.join(runs)}")

    # ── 5. module drift: did the candidate change the answering module anywhere? ────────────────
    print("\nMODULE DRIFT (candidate answering module != baseline, same question+run)")
    drift = [(cid, run, b.get("module"), c.get("module")) for cid, run, b, c in changed
             if b.get("module") != c.get("module")]
    print(f"   {len(drift)}" + ("" if not drift else ""))
    for cid, run, bm, cm in drift:
        print(f"      {cid:<28} run {run}: {bm} -> {cm}")

    if args.read:
        print("\n" + "=" * 110)
        print("FULL TEXT OF EVERY CHANGED ANSWER — to be read against the supplied excerpts")
        for cid, run, b, c in changed:
            print("\n" + "-" * 110)
            print(f"{cid}  run {run}   expected module: {b['expected_module']}")
            print(f"Q: {b['question']}")
            for tag, r in (("BASELINE ", b), ("CANDIDATE", c)):
                print(f"\n  {tag}  module={r.get('module')}  gate={r.get('gate')}  {r.get('latency_ms')}ms")
                for ct in (r.get("citations") or []):
                    flag = "" if cite_module_ok(ct) is not False else "   <-- MISLABELLED"
                    print(f"      cite {str(ct.get('module')):<10} {str(ct.get('manual'))[:46]:<46} "
                          f"{str(ct.get('section'))[:30]}{flag}")
                print("      " + (r.get("response") or "").replace("\n", "\n      ")[:1800])


if __name__ == "__main__":
    main()
