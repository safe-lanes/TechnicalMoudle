"""Documentation-answer regression: LIVE v11 (:8054, crewing-stage2-release.env) vs PILOT (:8070, audit-pilot.env).
Runs ON the AI server. Each set mints a documentation-only token with ITS OWN IDENTITY_SIGNING_KEY (read from the env file,
never printed). Compares, per question: gate, answering module, cited files; plus /suggestions per module. Prints a summary +
every difference. Questions = indexer/manual_cases.json (Technical/Crewing/Audit/Safety/Incident how-tos) when present, else a
built-in set. Usage: python3 docs-regression.py [cases.json]"""
import base64, hashlib, hmac, json, os, sys, time, urllib.request

SETS = {"live": ("/home/ubuntu/central-assistant/crewing-stage2-release.env", 8054), "pilot": ("/home/ubuntu/central-assistant/audit-pilot.env", 8070)}
def key_of(path):
    for l in open(path):
        if l.startswith("IDENTITY_SIGNING_KEY="): return l.split("=", 1)[1].strip().strip("'\"").encode()
    raise SystemExit("no IDENTITY_SIGNING_KEY in " + path)
def b64(b): return base64.urlsafe_b64encode(b).rstrip(b"=").decode()
def mint(key, tenant="docs-regression-tenant"):
    now = int(time.time()); p = b64(json.dumps({"userId": "reg-1", "userName": "Reg User", "role": "Sail Admin", "userType": "Office", "tenantDomain": tenant, "iat": now, "exp": now + 60}, separators=(",", ":")).encode())
    return p + "." + b64(hmac.new(key, p.encode(), hashlib.sha256).digest())
def call(port, method, path, body=None, tok=None):
    h = {"Content-Type": "application/json", "x-assistant-identity": tok}
    req = urllib.request.Request(f"http://127.0.0.1:{port}{path}", data=json.dumps(body).encode() if body is not None else None, headers=h, method=method)
    try:
        with urllib.request.urlopen(req, timeout=180) as r: return r.status, json.loads(r.read().decode())
    except urllib.error.HTTPError as e: return e.code, {"error": e.read().decode()[:200]}
    except Exception as e: return 0, {"error": str(e)[:200]}

cases_path = sys.argv[1] if len(sys.argv) > 1 else None
cases = []
if cases_path and os.path.exists(cases_path):
    raw = json.load(open(cases_path))
    for c in (raw if isinstance(raw, list) else raw.get("cases", [])):
        q = c.get("question") or c.get("q"); m = (c.get("module") or c.get("context", {}).get("module") or "technical").lower()
        if q: cases.append((m, q))
if not cases:
    cases = [("technical", "How do I complete a work order?"), ("technical", "How do I update running hours?"), ("technical", "How do I create an unplanned work order?"),
             ("technical", "How do I add a new spare part?"), ("technical", "What is the Generate Now button for?"),
             ("crewing", "How do I create a new crew record?"), ("crewing", "How do I approve or reject a rotation plan?"), ("crewing", "How do I download the IMO crew list?"),
             ("audit", "How do I create a new preparation?"), ("audit", "How do I access Fleet Sharing?"), ("audit", "How do I upload a SIRE or CDI inspection report in History?"),
             ("safety", "How do I create a new MOC?"), ("safety", "How do I open a new safety meeting form?"), ("safety", "How do I create an office risk assessment?"),
             ("incident", "How do I create a new incident record?"), ("incident", "How do I create a new near miss?"), ("incident", "How do I access Lesson Learnt?")]
keys = {n: key_of(p) for n, (p, _) in SETS.items()}
diffs, rows = [], []
ALL = []
for m in ("technical", "crewing", "audit", "safety", "incident"):
    s = {n: call(port, "GET", f"/suggestions?module={m}", tok=mint(keys[n]))[1].get("questions") for n, (_, port) in SETS.items()}
    if s["live"] != s["pilot"]: diffs.append(("suggestions", m, s))
for (m, q) in cases:
    r = {}
    for n, (_, port) in SETS.items():
        st, body = call(port, "POST", "/chat", {"message": q, "context": {"module": m}, "conversationId": f"reg-{n}-{abs(hash(q))%10**8}"}, tok=mint(keys[n]))
        r[n] = {"answer": body.get("response") or "", "http": st, "gate": body.get("gate"), "module": body.get("module"), "files": sorted({(c.get("manual") or c.get("file") or "") for c in (body.get("citations") or [])}), "tools": body.get("toolsUsed")}
    same = r["live"]["gate"] == r["pilot"]["gate"] and r["live"]["module"] == r["pilot"]["module"] and r["live"]["files"] == r["pilot"]["files"]
    ALL.append({"module": m, "q": q, "same": same, "live": r["live"], "pilot": r["pilot"]})
    rows.append((m, q, same));
    if not same: diffs.append(("chat", m, q, r))
print(json.dumps({"questions": len(rows), "identical": sum(1 for _, _, s in rows if s), "different": [r for r in rows if not r[2]], "suggestion_diffs": [d for d in diffs if d[0] == "suggestions"], "chat_diffs": [d for d in diffs if d[0] == "chat"]}, indent=1, ensure_ascii=False))

json.dump(ALL, open("/tmp/docs-regression-answers.json","w"), indent=1, ensure_ascii=False)
