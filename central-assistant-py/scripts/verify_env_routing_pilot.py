"""TRACKED pilot harness (24-Sep-2026): two isolated Technical environments through ONE assistant endpoint.
Runs from a workstation that hosts both pilot environments; every value comes from local env files that are never committed.
Env overrides: PMS_ROOT (repo), ASSISTANT_URL (default http://127.0.0.1:8044), DEV_BASE/PROD_BASE (http://localhost:5000 / :5001),
DEV_ENV/PROD_ENV/ASSISTANT_ENV (env file paths). Usage: python central-assistant-py/scripts/verify_env_routing_pilot.py
DEV  = shore A :5000 (instance technical-dev,  master pms_master_pilot,      tenant 'pilot' -> pms_arch   : WKFV 142 overdue)
PROD = shore B :5001 (instance technical-prod, master pms_master_pilot_prod, tenant 'pilot' -> pms_arch_b : no vessels)
Assistant = sail-assistant-py-pilot r6 on :8044 (tunnel) with both registered under separate keys/secrets."""
import base64, json, subprocess, sys, urllib.error, urllib.request
from pathlib import Path

import os
M = Path(os.environ.get("PMS_ROOT", "C:/Users/GhaziAnwer/TechnicalMoudle"))
def envfile(p):
    d = {}
    for l in open(p, encoding="utf-8"):
        l = l.strip()
        if l and not l.startswith("#") and "=" in l:
            k, v = l.split("=", 1); d[k] = v.strip().strip('"')
    return d
A = envfile(os.environ.get("DEV_ENV", M / "local-test-env/.env.shore.example")); B = envfile(os.environ.get("PROD_ENV", M / "local-test-env/.env.shoreB.local"))
PA = envfile(os.environ.get("ASSISTANT_ENV", M / "local-test-env/.env.pilot-assistant"))
SHARED_DOCS_KEY = PA.get("IDENTITY_SIGNING_KEY", "")
V = "743ef9d1-841a-11ed-aa7c-7003bca91a86"
ASSISTANT = os.environ.get("ASSISTANT_URL", "http://127.0.0.1:8044")
DEV_BASE = os.environ.get("DEV_BASE", "http://localhost:5000"); PROD_BASE = os.environ.get("PROD_BASE", "http://localhost:5001")
results = []
def rec(name, ok, got): results.append((name, ok)); print(("PASS  " if ok else "FAIL  ") + name + "  -> " + str(got)[:150])

def node(js):
    r = subprocess.run(["node", "-e", js], capture_output=True, text=True, cwd=str(M)); return r.stdout.strip()
def sailerp_jwt(secret, domain="pilot", uid="pilot-super-1", role="Sail Admin", ut="Office"):
    return node(f"const jwt=require('jsonwebtoken');process.stdout.write(jwt.sign({{id:'{uid}',domain:'{domain}',userType:'{ut}',role:'{role}'}},'{secret}',{{algorithm:'HS256',expiresIn:'10m'}}))")
def http(url, method="GET", headers=None, body=None, timeout=300):
    req = urllib.request.Request(url, method=method, data=(json.dumps(body).encode() if body is not None else None), headers={"content-type": "application/json", **(headers or {})})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r: return r.status, json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        try: return e.code, json.loads(e.read() or b"{}")
        except Exception: return e.code, {}
def mint(base, secret):
    return http(f"{base}/technical/api/assistant/token", headers={"Authorization": "Bearer " + sailerp_jwt(secret), "x-user-name": "Pilot Super"})
def decode(tok):
    b = tok.split(".")[0]; return json.loads(base64.urlsafe_b64decode(b + "=" * (-len(b) % 4)))
def relabel(tok, **changes):
    p = decode(tok); p.update({k: v for k, v in changes.items() if v is not None}); [p.pop(k) for k, v in changes.items() if v is None]
    return base64.urlsafe_b64encode(json.dumps(p, separators=(",", ":")).encode()).decode().rstrip("=") + "." + tok.split(".")[1]
def sign_with(payload, key):  # module-format token minted directly with a key (like the module would)
    return node(f"const c=require('crypto');const now=Math.floor(Date.now()/1000);const p={json.dumps(payload)};p.iat=now;p.exp=now+60;const b=Buffer.from(JSON.stringify(p)).toString('base64url');process.stdout.write(b+'.'+c.createHmac('sha256','{key}').update(b).digest('base64url'))")
def chat(tok, msg, vid=V, module="technical"):
    ctx = {"module": module, "currentPage": "/pms"}
    if vid: ctx.update({"vesselId": vid, "vesselName": "WK Frontier Pilot"})
    return http(f"{ASSISTANT}/chat", "POST", {"x-assistant-identity": tok}, {"message": msg, "context": ctx})
def shore_execute_lines(log):
    try: return [l for l in open(log, encoding="utf-8", errors="replace") if "[assistant-api] execute" in l]
    except FileNotFoundError: return []

logA = M / "local-test-env/shore.log"; logB = M / "local-test-env/shoreB.log"
a0, b0 = len(shore_execute_lines(logA)), len(shore_execute_lines(logB))

# 1. mint on each environment
sA, tA = mint(DEV_BASE, A["JWT_SECRET"]); tokA = tA.get("token", "")
sB, tB = mint(PROD_BASE, B["JWT_SECRET"]); tokB = tB.get("token", "")
rec("DEV mint -> token iss=technical-dev", sA == 200 and decode(tokA).get("iss") == "technical-dev", f"{sA} iss={decode(tokA).get('iss') if tokA else '-'}")
rec("PROD mint -> token iss=technical-prod", sB == 200 and decode(tokB).get("iss") == "technical-prod", f"{sB} iss={decode(tokB).get('iss') if tokB else '-'}")

# 2. correct data from each environment through the ONE assistant
s, r = chat(tokA, "How many overdue work orders does this vessel have?")
rec("DEV token -> DEV data (142 overdue) via the shared assistant", s == 200 and "142" in r.get("response", ""), f"{s} tools={r.get('toolsUsed')} {r.get('response','')[:60]}")
a1, b1 = len(shore_execute_lines(logA)), len(shore_execute_lines(logB))
rec("DEV call reached ONLY the dev instance (shore A log +1, shore B log +0)", a1 == a0 + 1 and b1 == b0, f"A +{a1-a0} B +{b1-b0}")
sB2, tB2 = mint(PROD_BASE, B["JWT_SECRET"]); tokB = tB2.get("token", tokB)
s, r = chat(tokB, "How many overdue work orders does this vessel have?")
rec("PROD token -> PROD instance (its registry has no such vessel -> not 142)", s == 200 and "142" not in r.get("response", "") and (r.get("toolsUsed") or []), f"{s} tools={r.get('toolsUsed')} {r.get('response','')[:70]}")
a2, b2 = len(shore_execute_lines(logA)), len(shore_execute_lines(logB))
rec("PROD call reached ONLY the prod instance (shore B log +1, shore A log +0)", b2 == b1 + 1 and a2 == a1, f"A +{a2-a1} B +{b2-b1}")

# 3. refusals at the assistant
sA2, tA2 = mint(DEV_BASE, A["JWT_SECRET"]); tokA = tA2.get("token", tokA)
s, r = chat(relabel(tokA, iss="technical-prod"), "How many overdue work orders does this vessel have?")
rec("DEV identity claiming the PROD environment (iss re-labelled) -> 401 bad-signature", s == 401 and "bad-signature" in json.dumps(r), f"{s} {r}")
s, r = chat(relabel(tokA, iss="technical-staging"), "hello")
rec("unregistered issuer -> 401 unknown-issuer", s == 401 and "unknown-issuer" in json.dumps(r), f"{s} {r}")
s, r = chat(relabel(tokA, iss=None), "hello")
rec("routing claim removed after signing -> 401 bad-signature", s == 401 and "bad-signature" in json.dumps(r), f"{s} {r}")
no_iss_dev = sign_with({"userId": "pilot-super-1", "role": "Sail Admin", "userType": "Office", "tenantDomain": "pilot"}, A["ASSISTANT_IDENTITY_SIGNING_KEY"])
s, r = chat(no_iss_dev, "hello")
rec("token signed with the DEV key but WITHOUT an issuer -> 401 (not verifiable as a docs token either)", s == 401, f"{s} {r}")
s, r = chat(relabel(tokA, url="http://127.0.0.1:15001/technical/api"), "hello")
rec("token carrying an injected callback address -> 401 bad-signature (addresses come only from the registry)", s == 401, f"{s} {r}")

# 4. documentation-only token (shared key, no issuer) still works and gets NO live tools
if SHARED_DOCS_KEY:
    docs_tok = sign_with({"userId": "docs-user", "role": "Sail Admin", "tenantDomain": "pilot"}, SHARED_DOCS_KEY)
    s, r = chat(docs_tok, "How do I complete a work order?", vid=None)
    rec("docs-only token (no issuer, shared key) -> documentation answer, no tools", s == 200 and r.get("gate") == "answer" and not r.get("toolsUsed"), f"{s} gate={r.get('gate')} tools={r.get('toolsUsed')} cites={len(r.get('citations') or [])}")
    s, r = chat(docs_tok, "How many overdue work orders does this vessel have?")
    rec("docs-only token asking for live data -> no tool call, no data leak", s == 200 and not r.get("toolsUsed") and "142" not in r.get("response", ""), f"{s} gate={r.get('gate')} tools={r.get('toolsUsed')} {r.get('response','')[:60]}")
else:
    rec("docs-only token check (shared key not available locally)", False, "skipped")

# 5. documentation question with a DEV token still answered (tool loop -> search_module_docs)
s, r = chat(tokA, "How do I complete a work order?")
rec("DEV token documentation question -> answered via search_module_docs", s == 200 and "search_module_docs" in (r.get("toolsUsed") or []), f"{s} tools={r.get('toolsUsed')}")

# 6. module side: cross-environment tokens refused by the Data API itself
sB3, tB3 = mint(PROD_BASE, B["JWT_SECRET"]); tokB = tB3.get("token", tokB)
s, r = http(f"{DEV_BASE}/technical/api/assistant/execute", "POST", {"x-service-secret": A["ASSISTANT_SERVICE_SECRET"], "x-assistant-identity": tokB}, {"tool": "get_work_order_counts", "args": {"vesselId": V}})
rec("PROD token presented to the DEV Data API -> 401", s == 401, f"{s} {r}")
s, r = http(f"{PROD_BASE}/technical/api/assistant/execute", "POST", {"x-service-secret": B["ASSISTANT_SERVICE_SECRET"], "x-assistant-identity": tokA}, {"tool": "get_work_order_counts", "args": {"vesselId": V}})
rec("DEV token presented to the PROD Data API -> 401", s == 401, f"{s} {r}")
s, r = http(f"{DEV_BASE}/technical/api/assistant/execute", "POST", {"x-service-secret": B["ASSISTANT_SERVICE_SECRET"], "x-assistant-identity": tokA}, {"tool": "get_work_order_counts", "args": {"vesselId": V}})
rec("PROD secret presented to the DEV Data API -> 401", s == 401, f"{s} {r}")

failed = [n for n, ok in results if not ok]
print(f"\n{len(results)-len(failed)}/{len(results)} passed" + (f" — FAILED: {failed}" if failed else ""))
sys.exit(1 if failed else 0)
