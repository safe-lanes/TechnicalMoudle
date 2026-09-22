# Final regression (22-Sep-2026 close-out): score every suite dump per case on BOTH arms with that suite's own
# pass rule, and list every individual gain and loss (CAND vs LIVE). Numbers are computed from the dumps, never
# copied from the suites' console totals — the console totals are cross-checked against these in the report.
#
#   python s10_score.py            # tables
#   python s10_score.py --read     # + full text of every answer behind a LOSS (LIVE pass, CAND fail)
#
# Pass rules (each suite's own, unchanged):
#   routing    single routeOnly run, ok per case
#   wo         answer AND citation AND rule in ALL three runs          (owner rule .3, judge .13)
#   frozen     answer AND citation AND attribution in a MAJORITY of three (judge .9)
#   corrected  answer AND citation in a MAJORITY of three                (judge .4)
#   fresh      answer AND module AND citation in ALL three runs          (automatic floor; score_by read by hand)
#   manuals    answer AND citation AND support in {supported, not captured} in ALL three runs
#   xref       judge_xref buckets per run (correct / limited / incorrect), field-level rules, appraisals capped
import argparse
import json
import sys
from collections import defaultdict
from pathlib import Path

HERE = Path(__file__).resolve().parent
XREF_DIR = HERE.parent / "2026-09-15-kb-pilot" / "routing-experiment"
sys.path.insert(0, str(XREF_DIR))
ARMS = ("LIVE", "CAND")


def rows(name: str) -> list[dict]:
    p = HERE / f"{name}-dump.jsonl"
    return [json.loads(l) for l in p.read_text(encoding="utf-8").splitlines() if l.strip()]


def per_case(recs: list[dict], key, vote, rule) -> dict[str, dict[str, bool]]:
    """{case: {arm: pass}} — vote(rec)->bool per run; rule('all'|'majority'|'single') over the runs."""
    votes: dict[str, dict[str, list[bool]]] = defaultdict(lambda: defaultdict(list))
    for r in recs:
        votes[key(r)][r["set"]].append(bool(vote(r)))
    out = {}
    for cid, by_arm in votes.items():
        out[cid] = {}
        for arm, vs in by_arm.items():
            if rule == "all":
                out[cid][arm] = all(vs) and len(vs) > 0
            elif rule == "majority":
                out[cid][arm] = sum(vs) * 2 > len(vs)
            else:
                out[cid][arm] = vs[0] if vs else False
    return out


def tokens(recs: list[dict]) -> dict[str, dict[str, float]]:
    """mean prompt/completion tokens per answer, per arm, from response.usage when the service returned it."""
    acc: dict[str, dict[str, list[int]]] = defaultdict(lambda: defaultdict(list))
    for r in recs:
        u = (r.get("response") or {}).get("usage") or {}
        for k in ("prompt_tokens", "completion_tokens", "total_tokens"):
            if isinstance(u.get(k), (int, float)):
                acc[r["set"]][k].append(u[k])
    return {arm: {k: (sum(v) / len(v) if v else None) for k, v in d.items()} | {"n": len(d.get("prompt_tokens", []))}
            for arm, d in acc.items()}


def table(title: str, pc: dict[str, dict[str, bool]], rule: str, read: bool = False, recs: list[dict] | None = None,
          key=None) -> tuple[int, int]:
    cases = sorted(pc)
    live = sum(1 for c in cases if pc[c].get("LIVE"))
    cand = sum(1 for c in cases if pc[c].get("CAND"))
    print(f"\n## {title}  —  rule: {rule}")
    print(f"   LIVE {live}/{len(cases)}    CAND {cand}/{len(cases)}")
    gains = [c for c in cases if pc[c].get("CAND") and not pc[c].get("LIVE")]
    losses = [c for c in cases if pc[c].get("LIVE") and not pc[c].get("CAND")]
    both_fail = [c for c in cases if not pc[c].get("LIVE") and not pc[c].get("CAND")]
    print(f"   gains (CAND pass, LIVE fail)  {len(gains)}: {gains}")
    print(f"   LOSSES (LIVE pass, CAND fail) {len(losses)}: {losses}")
    print(f"   fail on both                  {len(both_fail)}: {both_fail}")
    if read and recs is not None and losses:
        for c in losses:
            for r in recs:
                if key(r) == c and r["set"] == "CAND":
                    print(f"\n----- LOSS {title} {c} CAND run {r.get('run', 1)} verdict={json.dumps(r.get('verdict') or r.get('ok'))}")
                    print("      Q: " + str(r.get("question", ""))[:200])
                    resp = r.get("response") or {}
                    print("      cites: " + ", ".join(f"{x.get('module')}:{str(x.get('manual'))[:40]}:{str(x.get('section'))[:40]}" for x in (resp.get("citations") or [])))
                    print("      " + str(resp.get("response", ""))[:3000].replace("\n", "\n      "))
    return live, cand


def main() -> None:
    global HERE
    ap = argparse.ArgumentParser()
    ap.add_argument("--read", action="store_true")
    ap.add_argument("--dir", default=None, help="folder holding the *-dump.jsonl files (default: this folder)")
    ap.add_argument("--xref-cand", default=str(XREF_DIR / "xref-answers-c3-captured.json"), help="cross-reference answers file for the CAND arm")
    ap.add_argument("--xref-arm", default="repaired_c", help="arm name inside --xref-cand")
    ap.add_argument("--xref-live", default=None, help="cross-reference answers file for the LIVE arm (default: <dir>/xref-answers-live.json)")
    a = ap.parse_args()
    if a.dir:
        HERE = Path(a.dir).resolve()
    totals = {}
    tok = {}

    r = rows("routing")
    totals["routing 13"] = table("ROUTING probes (13)", per_case(r, lambda x: x["case"], lambda x: x["ok"], "single"), "single run, ok per case", a.read, r, lambda x: x["case"])

    r = rows("wo")
    v = lambda x: x["verdict"]["answer"] and x["verdict"]["citation"] and x["verdict"]["rule"]
    totals["work orders 8+5"] = table("WORK ORDERS (8 + 5 phrasings)", per_case(r, lambda x: x["case"], v, "all"), "answer+citation+rule in ALL 3 runs", a.read, r, lambda x: x["case"])
    tok["wo"] = tokens(r)

    r = rows("answers")
    v = lambda x: x["verdict"]["answer"] and x["verdict"]["citation"] and x["verdict"]["attribution"]
    totals["frozen 12"] = table("FROZEN answers (12)", per_case(r, lambda x: f"frozen-{x['case']:02d}", v, "majority"), "answer+citation+attribution, MAJORITY of 3", a.read, r, lambda x: f"frozen-{x['case']:02d}")
    tok["frozen"] = tokens(r)

    r = rows("generated")
    v = lambda x: x["verdict"]["answer"] and x["verdict"]["citation"]
    totals["corrected 14"] = table("CORRECTED claims (14)", per_case(r, lambda x: f"corrected-{x['case']:02d}", v, "majority"), "answer+citation, MAJORITY of 3", a.read, r, lambda x: f"corrected-{x['case']:02d}")
    tok["corrected"] = tokens(r)

    r = rows("fresh")
    v = lambda x: x["verdict"]["answer"] and x["verdict"]["module"] and x["verdict"]["citation"]
    totals["fresh 10"] = table("FRESH validation (10)", per_case(r, lambda x: x["case"], v, "all"), "answer+module+citation in ALL 3 runs (automatic floor)", a.read, r, lambda x: x["case"])
    tok["fresh"] = tokens(r)

    r = rows("manuals")
    v = lambda x: x["verdict"]["answer"] and x["verdict"]["citation"] and str(x["verdict"]["support"]).startswith(("supported", "not captured"))
    totals["manuals 57"] = table("MANUAL coverage (57)", per_case(r, lambda x: x["case"], v, "all"), "answer+citation+support in ALL 3 runs", a.read, r, lambda x: x["case"])
    tok["manuals"] = tokens(r)

    # cross-reference cases: CAND = the frozen quote-excluded arm of the captured rerun (same configuration as g4 now);
    # LIVE = the same seven cases against the isolated live copy, run today.
    import judge_xref  # noqa: E402  (its self-test runs on import? no — main() only; call self_test explicitly)
    judge_xref.self_test()
    xr = {"CAND": [x for x in json.loads(Path(a.xref_cand).read_text(encoding="utf-8"))["results"] if x["arm"] == a.xref_arm]}
    lp = Path(a.xref_live) if a.xref_live else HERE / "xref-answers-live.json"
    if lp.exists():
        xr["LIVE"] = json.loads(lp.read_text(encoding="utf-8"))["results"]
    print("\n## CROSS-REFERENCE cases (7 x 3 runs)  —  rule: judge_xref buckets per run; appraisals capped at limited")
    for arm, res in xr.items():
        tal = defaultdict(int)
        per = defaultdict(list)
        for x in res:
            b, why = judge_xref.judge(judge_xref.CASES[x["id"]], x.get("response") or "")
            tal[b] += 1
            per[x["id"]].append(b[:3])
        print(f"   {arm:<5} correct {tal['correct']:>2}/21  limited {tal['limited']:>2}/21  incorrect {tal['incorrect']:>2}/21   " +
              "  ".join(f"{k}:{'/'.join(v)}" for k, v in sorted(per.items())))
        totals[f"xref 21 ({arm})"] = tal["correct"]
        u = [x.get("usage") or {} for x in res]
        pt = [z.get("prompt_tokens") for z in u if isinstance(z.get("prompt_tokens"), (int, float))]
        lat = [x.get("latency_ms") for x in res if isinstance(x.get("latency_ms"), (int, float))]
        if pt:
            print(f"         mean prompt tokens {sum(pt)/len(pt):.0f} (n={len(pt)})   mean latency {sum(lat)/len(lat)/1000:.1f}s" if lat else "")

    print("\n## TOKENS per answer (mean, from response.usage where present)")
    for suite, d in tok.items():
        for arm in ARMS:
            if arm in d:
                print(f"   {suite:<10} {arm:<5} n={d[arm]['n']:<4} prompt {d[arm].get('prompt_tokens') or 0:>7.0f}  completion {d[arm].get('completion_tokens') or 0:>6.0f}")

    print("\n## SUMMARY")
    for k, v in totals.items():
        print(f"   {k:<22} {v}")


if __name__ == "__main__":
    main()
