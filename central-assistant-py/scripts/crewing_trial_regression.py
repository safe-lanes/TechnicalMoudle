"""
Crewing live-data PILOT TRIAL — regression of shared behaviour: the SAME documentation questions and /suggestions
through the v10-code test container (:8061, image widget-b2ae111e0) and the trial container (:8062).
Run ON the AI server (keys read from the env files there, never printed):  python3 crewing_trial_regression.py
Compares gate, cited sources and suggestions; answer text is LLM output and is not expected to be identical.
"""
import base64, hashlib, hmac, json, re, time, urllib.request

def instances(path):
    t = open(path).read()
    return json.loads(re.search(r"^ASSISTANT_MODULE_INSTANCES=(.*)$", t, re.M).group(1))

def mint(iss, key, module_user="1"):
    now = int(time.time())
    body = base64.urlsafe_b64encode(json.dumps({"userId": module_user, "role": "Sail Admin", "userType": "Office", "iss": iss,
                                                "tenantDomain": None, "tuid": None, "iat": now, "exp": now + 60}).encode()).rstrip(b"=")
    mac = base64.urlsafe_b64encode(hmac.new(key.encode(), body, hashlib.sha256).digest()).rstrip(b"=")
    return (body + b"." + mac).decode()

def post(port, path, token, payload):
    req = urllib.request.Request(f"http://127.0.0.1:{port}{path}", data=json.dumps(payload).encode(),
                                 headers={"Content-Type": "application/json", "x-assistant-identity": token}, method="POST")
    t0 = time.time()
    with urllib.request.urlopen(req, timeout=90) as r:
        return json.loads(r.read()), int((time.time() - t0) * 1000)

def get(port, path, token):
    req = urllib.request.Request(f"http://127.0.0.1:{port}{path}", headers={"x-assistant-identity": token})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())

inst = instances("/home/ubuntu/central-assistant/crewtrial.env")
QUESTIONS = [("technical-pilotlocal", "technical", "How do I complete a work order?"),
             ("technical-pilotlocal", "technical", "How do I update running hours?"),
             ("crewing-pilot", "crewing", "How do I add a new licence to a crew member?"),
             ("crewing-pilot", "crewing", "How do I approve or reject a rotation plan?")]
rows = []
for iss, module, q in QUESTIONS:
    key = inst[iss]["signingKey"]
    res = {}
    for port in (8061, 8062):
        body, ms = post(port, "/chat", mint(iss, key), {"message": q, "context": {"module": module}, "conversationHistory": []})
        src = sorted({(c.get("manual") or c.get("title") or json.dumps(c))[:60] for c in (body.get("citations") or [])})
        has_source_line = bool(re.search(r"source", body.get("response", ""), re.I))
        res[port] = {"gate": body.get("gate"), "tools": body.get("toolsUsed"), "sources": src, "sourceLine": has_source_line, "ms": ms,
                     "answer": body.get("response", "")[:240]}
    rows.append({"module": module, "q": q, **{str(k): v for k, v in res.items()}})
sugg = {}
for iss, module in (("technical-pilotlocal", "technical"), ("crewing-pilot", "crewing")):
    tok = mint(iss, inst[iss]["signingKey"])
    a = get(8061, f"/suggestions?module={module}", tok)
    b = get(8062, f"/suggestions?module={module}", mint(iss, inst[iss]["signingKey"]))
    sugg[module] = {"identical": a == b, "n": len(a.get("suggestions", a) if isinstance(a, dict) else a)}
print(json.dumps({"docs": rows, "suggestions": sugg}, indent=1))
