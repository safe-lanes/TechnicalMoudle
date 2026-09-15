import asyncio, os, sys, json
sys.path.insert(0, "/app")
from app import identity as ident
import httpx2 as httpx
KEY = os.environ["IDENTITY_SIGNING_KEY"]
QS = ["how do I create a work order", "why did the running hours not go down after I completed the work order"]
async def main():
    async with httpx.AsyncClient(timeout=60) as c:
        for name, base in [("C0", "http://sail-assistant-py-s4-c0:8000"), ("D2", "http://sail-assistant-py-s4-d2:8000")]:
            for i, q in enumerate(QS):
                tok = ident.sign_identity({"userId": f"probe2-{name}-{i}", "userName": "Acceptance", "role": "Sail Admin", "tenantDomain": "smoke-suite-tenant"}, KEY, 60)
                r = (await c.post(f"{base}/chat", headers={"x-assistant-identity": tok}, json={"message": q, "routeOnly": True, "context": {"module": "technical"}})).json()
                print(f"{name} · {q[:45]!r}: " + " | ".join(f"{x['manual'][:34]} · {x['section'][:38]} d={x['distance']}" for x in r.get("citations", [])))
asyncio.run(main())
