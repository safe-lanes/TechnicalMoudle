# Actual token usage (from the suite dumps' response.usage) and latency (from the service's conversation log, joined on the
# answer text) per candidate set. Price READ from the model page: gpt-5.6-luna $0.20 input / $1.20 output per 1M tokens.
#   python usage.py convlog-s4.jsonl s4-wo-dump.jsonl s4-answers-dump.jsonl ...
import json
import statistics
import sys
from collections import defaultdict

PRICE_IN, PRICE_OUT = 0.20 / 1e6, 1.20 / 1e6
log = [json.loads(l) for l in open(sys.argv[1], encoding="utf-8") if l.strip()]
by_answer = defaultdict(list)
for r in log:
    if r.get("answer"):
        by_answer[r["answer"]].append(r)
sets = defaultdict(lambda: {"n": 0, "tin": 0, "tout": 0, "lat": [], "no_usage": 0, "no_lat": 0, "suites": set()})
for path in sys.argv[2:]:
    for line in open(path, encoding="utf-8"):
        if not line.strip():
            continue
        d = json.loads(line)
        resp = d.get("response") or {}
        if resp.get("gate") not in ("answer",) or resp.get("routeOnly"):
            continue
        s = sets[d["set"]]
        s["n"] += 1
        s["suites"].add(d.get("suite") or path.split("/")[-1].split("-")[1])
        u = resp.get("usage") or {}
        if u.get("prompt_tokens") is None:
            s["no_usage"] += 1
        else:
            s["tin"] += int(u["prompt_tokens"])
            s["tout"] += int(u["completion_tokens"])
        rows = by_answer.get(resp.get("response") or "")
        if rows:
            s["lat"].append(rows.pop(0)["latency_ms"])
        else:
            s["no_lat"] += 1
print(f"{'set':<12}{'answers':>8}{'tok in':>9}{'tok out':>9}{'in/ans':>8}{'out/ans':>8}{'cost $':>9}{'$/1000':>8}{'lat mean s':>11}{'median':>8}{'p95':>7}{'no-usage':>9}{'no-lat':>7}  suites")
for n, s in sets.items():
    cost = s["tin"] * PRICE_IN + s["tout"] * PRICE_OUT
    k = max(1, s["n"] - s["no_usage"])
    lat = sorted(s["lat"])
    p95 = lat[int(0.95 * (len(lat) - 1))] / 1000 if lat else 0
    print(f"{n:<12}{s['n']:>8}{s['tin']:>9}{s['tout']:>9}{s['tin'] // k:>8}{s['tout'] // k:>8}{cost:>9.4f}{cost / k * 1000:>8.2f}"
          f"{(statistics.mean(lat) / 1000 if lat else 0):>11.2f}{(statistics.median(lat) / 1000 if lat else 0):>8.2f}{p95:>7.2f}{s['no_usage']:>9}{s['no_lat']:>7}  {','.join(sorted(s['suites']))}")
