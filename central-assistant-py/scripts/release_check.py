"""Release check, run ON the AI server, before and after an nginx switch. Prints no secret.
  python3 release_check.py <base url> <env file> [existing|all]
Mints identities with each registration's own signing key. `existing` = registrations already deployed (Technical, crewing-dev):
manual and live answers. `all` also asks through registrations whose module may not be deployed yet (audit-dev, audit-demo,
crewing-demo): manual answers must work, and a live question must give no figure and must not hang.
Writes /tmp/release-check-<port or host>.json so two runs can be compared.
"""
import base64, hashlib, hmac, json, re, sys, time, urllib.error, urllib.request

BASE, ENV = sys.argv[1].rstrip("/"), sys.argv[2]
SCOPE = sys.argv[3] if len(sys.argv) > 3 else "all"
REG = json.loads(re.search(r"^ASSISTANT_MODULE_INSTANCES='?(.*?)'?$", open(ENV).read(), re.M).group(1))
b64 = lambda b: base64.urlsafe_b64encode(b).rstrip(b"=").decode()
nums = lambda s: sorted({int(x.replace(",", "")) for x in re.findall(r"(?<![\d-])\d[\d,]*(?![\d-])", s or "")})


def mint(iss, **c):
    now = int(time.time())
    p = b64(json.dumps({"userName": "Release Check", "role": "Sail Admin", "userType": "Office", "iat": now, "exp": now + 180, "iss": iss, **c}, separators=(",", ":")).encode())
    return p + "." + b64(hmac.new(REG[iss]["signingKey"].encode(), p.encode(), hashlib.sha256).digest())


def chat(iss, q, ctx, **claims):
    body = {"message": q, "context": ctx, "conversationId": f"release-{iss}-{int(time.time() * 1000)}", "conversationHistory": []}
    req = urllib.request.Request(BASE + "/chat", data=json.dumps(body).encode(), headers={"Content-Type": "application/json", "User-Agent": "release-check", "x-assistant-identity": mint(iss, **claims)})
    t = time.time()
    try:
        with urllib.request.urlopen(req, timeout=150) as r:
            j = json.loads(r.read())
            status = r.status
    except urllib.error.HTTPError as e:
        status, j = e.code, {"response": e.read().decode()[:160]}
    except Exception as e:
        status, j = 0, {"response": str(e)[:160]}
    return {"http": status, "gate": j.get("gate"), "tools": j.get("toolsUsed") or [], "answer": j.get("response") or "", "citations": len(j.get("citations") or []), "ms": int((time.time() - t) * 1000)}


T = dict(userId="release-check", tenantDomain="rsms05102026")
V2 = {"module": "technical", "vesselId": "743feb08-841a-11ed-aa7c-7003bca91a86", "vesselName": "Vessel 2"}
C = dict(userId="362", tenantDomain="rsms")
CASES = [
    ("technical-dev", "manual", "How do I create a work order?", {"module": "technical"}, T),
    ("technical-dev", "live", "How many work orders are overdue?", V2, T),
    ("technical-demo", "manual", "How do I create a work order?", {"module": "technical"}, dict(userId="release-check", tenantDomain="release-check")),
    ("technical-prod", "manual", "How do I create a work order?", {"module": "technical"}, dict(userId="release-check", tenantDomain="release-check")),
    ("crewing-dev", "manual", "How do I add a new crew member?", {"module": "crewing"}, C),
    ("crewing-dev", "live", "How many crew are on board Vessel 8?", {"module": "crewing"}, C),
]
if SCOPE == "all":
    A = dict(userId="release-check", tenantDomain="release-check")
    for iss in ("audit-dev", "audit-demo"):
        CASES += [
            (iss, "manual", "How do I create a new preparation?", {"module": "audit"}, A),
            (iss, "manual", "How do I create a new MOC?", {"module": "safety"}, A),
            (iss, "manual", "How do I create a new near miss?", {"module": "incident"}, A),
            (iss, "undeployed", "How many audit actions are pending?", {"module": "audit"}, A),
        ]
    CASES += [("crewing-demo", "manual", "How do I add a new crew member?", {"module": "crewing"}, A),
              ("crewing-demo", "undeployed", "How many crew are on board?", {"module": "crewing"}, A)]

out = []
for iss, kind, q, ctx, claims in CASES:
    r = chat(iss, q, ctx, **claims)
    if kind == "manual":
        ok = r["http"] == 200 and r["gate"] == "answer" and bool(re.search(r"source|manual", r["answer"], re.I) or r["citations"])
    elif kind == "live":
        ok = r["http"] == 200 and r["gate"] == "answer" and any(t != "search_module_docs" for t in r["tools"]) and bool(nums(r["answer"]))
    else:
        figure = re.search(r"\*\*\d", r["answer"])
        ok = r["http"] == 200 and not figure and r["ms"] < 60000
    print(("PASS " if ok else "FAIL ") + f"{iss:15} {kind:10} {r['ms']:6}ms http {r['http']} gate {r['gate']} tools {r['tools']} nums {nums(r['answer'])[:4]} | {r['answer'][:100]!r}", flush=True)
    out.append({"iss": iss, "kind": kind, "q": q, "ok": ok, **{k: r[k] for k in ("gate", "tools", "ms", "citations")}, "nums": nums(r["answer"]), "head": r["answer"][:300]})
name = re.sub(r"[^a-z0-9]+", "-", BASE.lower()).strip("-")
json.dump(out, open(f"/tmp/release-check-{name}.json", "w"), indent=1, ensure_ascii=False)
print(f"TOTAL pass {sum(o['ok'] for o in out)} fail {sum(not o['ok'] for o in out)}")
