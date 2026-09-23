# Post-deployment authentication + tenant-isolation check through the PUBLIC assistant path (23-Sep-2026),
# modelled on the 14-Sep record (postdeploy-iso.txt). Run inside the runner image with the assistant env-file:
#   python /x/postdeploy_iso.py https://assistant.sl-sail.com http://sail-assistant-py-cand2:8000
# arg1 = public base (goes through nginx), arg2 = the container's tunnel-only base for the admin toggle
# (nginx denies /admin publicly — that denial is checked too). Two fresh throwaway tenants; A is disabled and
# re-enabled; expired / wrong-key / missing tokens must be refused with 401.
import json
import os
import sys
import time

sys.path.insert(0, "/app")
import requests                                          # noqa: E402
from app.identity import sign_identity                   # noqa: E402

PUB, ADMIN = sys.argv[1].rstrip("/"), sys.argv[2].rstrip("/")
KEY = os.environ["IDENTITY_SIGNING_KEY"]
ADMIN_TOKEN = os.environ.get("ADMIN_TOKEN", "")
ts = int(time.time())
A, B = f"deploy-iso-a-{ts}", f"deploy-iso-b-{ts}"
Q = "How do I create an unplanned work order?"


def tok(tenant: str, key: str = KEY, ttl: int = 60) -> str:
    return sign_identity({"userId": f"iso-{tenant}", "userName": "Deploy Check", "role": "Sail Admin", "tenantDomain": tenant}, key, ttl)


def ask(tenant: str, token: str | None) -> tuple[int, str, str]:
    h = {"x-assistant-identity": token} if token is not None else {}
    r = requests.post(f"{PUB}/chat", headers=h, json={"message": Q, "context": {"module": "technical"}}, timeout=150)
    try:
        j = r.json()
    except Exception:
        j = {}
    return r.status_code, str(j.get("gate") or j.get("error") or ""), str(j.get("module") or "") + " " + str(j.get("response") or "")[:60].replace("\n", " ")


def toggle(tenant: str, enabled: bool) -> tuple[int, str]:
    for mod in ("technical", "Technical"):
        r = requests.post(f"{ADMIN}/admin/pairs/toggle", headers={"x-admin-token": ADMIN_TOKEN},
                          json={"tenantDomain": tenant, "module": mod, "enabled": enabled}, timeout=30)
        if r.status_code == 200:
            return r.status_code, str(r.json().get("enabled"))
    return r.status_code, r.text[:80]


fails = []
print("A first ask:", *ask(A, tok(A)))
print("B first ask:", *ask(B, tok(B)))
print("admin toggle A off (tunnel-only path):", *toggle(A, False))
sa = ask(A, tok(A)); print("A after disable:", *sa)
sb = ask(B, tok(B)); print("B still:", *sb)
if sa[1] != "disabled": fails.append("tenant A not refused after disable")
if sb[1] != "answer": fails.append("tenant B affected by A's disable")
e = ask(A, tok(A, ttl=-600)); print("expired token:", e[0], e[1]); fails += [] if e[0] == 401 else ["expired token accepted"]
w = ask(A, tok(A, key="not-the-key")); print("wrong-key token:", w[0], w[1]); fails += [] if w[0] == 401 else ["wrong-key token accepted"]
n = ask(A, None); print("no token:", n[0], n[1]); fails += [] if n[0] == 401 else ["missing token accepted"]
print("A re-enabled:", *toggle(A, True))
ra = ask(A, tok(A)); print("A after re-enable:", *ra); fails += [] if ra[1] == "answer" else ["tenant A not restored"]
pa = requests.get(f"{PUB}/admin/pairs", headers={"x-admin-token": ADMIN_TOKEN}, timeout=30)
print("public /admin denied:", pa.status_code); fails += [] if pa.status_code == 403 else ["public admin path not denied"]
print("TENANTS", A, B)
print("RESULT", "PASS" if not fails else "FAIL: " + "; ".join(fails))
sys.exit(0 if not fails else 1)
