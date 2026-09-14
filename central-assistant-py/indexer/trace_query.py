"""
Trace why a query lands where it does: for each service/set, the gate decision (answer /
clarify / not_documented), the candidate modules and margin, and the top hits with distances.
Used to confirm or deny "routing failure" claims with evidence rather than impression.

  IDENTITY_SIGNING_KEY=... python indexer/trace_query.py --set migrated=http://127.0.0.1:8015 [--set ...] -q "question" [-q ...] [--module safety]
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

import httpx2 as httpx

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.identity import sign_identity  # noqa: E402


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--set", action="append", required=True)
    ap.add_argument("-q", action="append", required=True)
    ap.add_argument("--module", default="technical")
    a = ap.parse_args()
    key = os.environ["IDENTITY_SIGNING_KEY"]
    n = 0
    for q in a.q:
        print(f"\n== {q}")
        for spec in a.set:
            name, _, url = spec.partition("=")
            n += 1
            tok = sign_identity({"userId": f"trace-{n}", "userName": "Trace", "role": "Sail Admin", "tenantDomain": "smoke-suite-tenant"}, key, 60)
            j = httpx.post(f"{url}/chat", headers={"x-assistant-identity": tok}, json={"message": q, "routeOnly": True, "context": {"module": a.module}}, timeout=90).json()
            hits = [(c.get("manual", "")[:22], (c.get("section") or "")[-34:], c.get("distance")) for c in (j.get("citations") or [])]
            print(f"   {name:<14} gate={j.get('gate'):<14} module={str(j.get('module')):<10} margin={j.get('confidence')} candidates={j.get('candidates')}")
            for h in hits:
                print(f"        {h}")


if __name__ == "__main__":
    main()
