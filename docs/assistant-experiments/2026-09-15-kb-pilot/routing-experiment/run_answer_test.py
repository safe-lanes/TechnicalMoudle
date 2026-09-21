# Bounded candidate answer test — baseline vs candidate, same model, same prompt, same index.
#
# Runs INSIDE the candidate container so the identity signing key and the API key stay on the server:
#   docker exec sail-assistant-py-g1 python /tmp/run_answer_test.py /tmp/cases.json /tmp/test-set.json > answers.json
#
#   baseline  sail-assistant-py-f1 : kb-pilot-e, prompt v5, ROUTE_INTENT=on, HYBRID=rescue         (unchanged, served shape)
#   candidate sail-assistant-py-g1 : the same, plus ASSISTANT_CROSS_MODULE_GAP=0.25 / SLOTS=2 and the
#                                    per-hit citation label
#
# Only these two containers are contacted. Nothing is deployed and no other container is touched.
import json
import sys
import time

sys.path.insert(0, "/app")
import requests                                          # noqa: E402
from app.identity import sign_identity                   # noqa: E402
from app.config import settings                          # noqa: E402

ARMS = {"baseline": "http://sail-assistant-py-f1:8000", "candidate": "http://localhost:8000"}
RUNS = 3
_n = 0


def ask(session: "requests.Session", base: str, q: str, module: str | None) -> dict:
    global _n
    _n += 1
    tok = sign_identity({"userId": f"r9-{_n}", "userName": "Acceptance", "role": "Sail Admin",
                         "tenantDomain": "smoke-suite-tenant"}, settings().identity_signing_key, 60)
    body: dict = {"message": q}
    if module:
        body["context"] = {"module": module}
    t0 = time.perf_counter()
    r = session.post(f"{base}/chat", headers={"x-assistant-identity": tok}, json=body, timeout=180)
    ms = round((time.perf_counter() - t0) * 1000)
    out = r.json()
    out["_latency_ms"] = ms
    return out


def main() -> None:
    cases = {c["id"]: c for c in json.load(open(sys.argv[1], encoding="utf-8"))}
    ids = json.load(open(sys.argv[2], encoding="utf-8"))
    results = []
    session = requests.Session()
    if True:
        for run in range(1, RUNS + 1):
            for cid in ids:
                c = cases[cid]
                for arm, base in ARMS.items():
                    try:
                        r = ask(session, base, c["question"], c.get("ui_module"))
                    except Exception as exc:                      # noqa: BLE001
                        r = {"error": f"{type(exc).__name__}: {exc}"}
                    results.append({
                        "id": cid, "arm": arm, "run": run,
                        "question": c["question"],
                        "expected_module": c.get("expected_module"),
                        "expected_file": c.get("expected_file"),
                        "expected_pages": c.get("expected_pages"),
                        "gate": r.get("gate"), "module": r.get("module"),
                        "routing": r.get("routing"), "confidence": r.get("confidence"),
                        "citations": r.get("citations"), "usage": r.get("usage"),
                        "latency_ms": r.get("_latency_ms"),
                        "response": r.get("response"), "error": r.get("error"),
                    })
                print(f"  run {run}  {cid}", file=sys.stderr)
    json.dump({"runs": RUNS, "arms": {k: k for k in ARMS}, "results": results}, sys.stdout, ensure_ascii=False)


main()
