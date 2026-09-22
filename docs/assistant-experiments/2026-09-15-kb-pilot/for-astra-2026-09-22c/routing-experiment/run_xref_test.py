# Cross-reference repair — answer comparison on the seven FROZEN cases.
#
# Two arms differing only in the documents:
#   baseline  sail-assistant-py-g1  index kb-pilot-e  (unrepaired cross-references)
#   repaired  sail-assistant-py-g2  index kb-xref-a   (repaired cross-references)
# Same image, same model, same prompt v5, same retrieval settings and the same cross-module flags,
# so the only variable is the document text.
#
#   docker exec sail-assistant-py-g2 python /tmp/run_xref_test.py /tmp/xref_expectations.json > xref-answers.json
#
# Only these two containers are contacted. Nothing is deployed.
import json
import sys
import time

sys.path.insert(0, "/app")
import requests                                          # noqa: E402
from app.identity import sign_identity                   # noqa: E402
from app.config import settings                          # noqa: E402

# Three arms, differing only in the documents (22-Sep, second run):
#   baseline    g1  kb-pilot-e  unrepaired cross-references
#   repaired_a  g2  kb-xref-a   adapted steps first, quote after (first repair layout)
#   repaired_b  g3  kb-xref-b   adapted steps are the actionable guidance; the quote is an audit copy,
#                               corrected Stores/Surveys facts, indexing note attributed, built --cache-only
# Run INSIDE g3, so "localhost" is repaired_b.
ARMS = {"baseline": "http://sail-assistant-py-g1:8000",
        "repaired_a": "http://sail-assistant-py-g2:8000",
        "repaired_b": "http://localhost:8000"}
RUNS = 3
_n = 0


def ask(session, base: str, q: str, module: str | None) -> dict:
    global _n
    _n += 1
    tok = sign_identity({"userId": f"xref-{_n}", "userName": "Acceptance", "role": "Sail Admin",
                         "tenantDomain": "smoke-suite-tenant"}, settings().identity_signing_key, 60)
    body: dict = {"message": q}
    if module:
        body["context"] = {"module": module}
    t0 = time.perf_counter()
    r = session.post(f"{base}/chat", headers={"x-assistant-identity": tok}, json=body, timeout=180)
    out = r.json()
    out["_latency_ms"] = round((time.perf_counter() - t0) * 1000)
    return out


def main() -> None:
    spec = json.load(open(sys.argv[1], encoding="utf-8"))
    session = requests.Session()
    results = []
    for run in range(1, RUNS + 1):
        for case in spec["cases"]:
            for arm, base in ARMS.items():
                try:
                    r = ask(session, base, case["question"], case.get("module"))
                except Exception as exc:                          # noqa: BLE001
                    r = {"error": f"{type(exc).__name__}: {exc}"}
                results.append({"id": case["id"], "arm": arm, "run": run,
                                "question": case["question"],
                                "gate": r.get("gate"), "module": r.get("module"),
                                "citations": r.get("citations"), "usage": r.get("usage"),
                                "latency_ms": r.get("_latency_ms"),
                                "response": r.get("response"), "error": r.get("error")})
            print(f"  run {run}  {case['id']}", file=sys.stderr)
    json.dump({"runs": RUNS, "arms": ARMS, "results": results}, sys.stdout, ensure_ascii=False)


main()
