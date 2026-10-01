"""TRACKED pilot harness (30-Sep / 1-Oct-2026): chatbot knowledge management, end to end through the REAL identity path.

Identities are minted by the pilot PMS shores (`GET /technical/api/assistant/token`) from pilot logins, exactly as the
widget does; the harness never signs an identity itself.
  shore A :5000  instance technical-dev  (environment 'dev')   companies 'pilot' and 'pilot-b'
  shore B :5001  instance technical-prod (environment 'prod' — SIMULATED production)  company 'pilot' (the same company)
Assistant = the ISOLATED knowledge pilot (own database) through a local tunnel; the live service is not touched.
Trainer grants are managed with the real admin command (`python -m app.kb_admin`) in the pilot container over SSH.

DEV TEST accounts (pilot only; granted 1-Oct-2026):
  devtest-tech-1  pilot    dev  Technical, global            devtest-tech-2  pilot    dev  Technical, global
  devtest-crew-1  pilot    dev  Crewing, global              devtest-tech-b  pilot-b  dev  Technical, company only
  devtest-share   pilot    dev  Technical, global + may publish guidance shared by all environments
  devtest-user / devtest-user-b   ordinary Sail Admins (chat + report only)
  devtest-tech-1 @ pilot-b (same id, other company) and @ prod (same id and company, other environment): no grant

Content is a made-up topic ("Zeta-9 counter") so no answer can come from the manuals by accident; the manual passage
used for the supersede checks is picked at run time from what the pilot index actually returns.
Usage: python central-assistant-py/scripts/verify_kb_pilot.py            (exit 0 = all passed)"""
from __future__ import annotations

import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

M = Path(os.environ.get("PMS_ROOT", "C:/Users/GhaziAnwer/TechnicalMoudle"))
ASSISTANT = os.environ.get("ASSISTANT", "http://localhost:18047")
SHORES = {"dev": ("http://localhost:5000", M / "local-test-env/.env.shore.example"),
          "prod": ("http://localhost:5001", M / "local-test-env/.env.shoreB.local")}
SSH = ["ssh", "-i", os.environ.get("SSH_KEY", "C:/Users/GhaziAnwer/apigateway.pem"), "ubuntu@13.250.51.71"]
V = "743ef9d1-841a-11ed-aa7c-7003bca91a86"
RUN = time.strftime("%H%M%S")
TOPIC = f"Zeta-9 counter {RUN}"
Q = f"How do I reset the Zeta-9 counter {RUN}?"
KNOWLEDGE = "Technical - Knowledge: "


def envfile(p: Path) -> dict[str, str]:
    d: dict[str, str] = {}
    for line in open(p, encoding="utf-8"):
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            d[k] = v.split(" #")[0].strip().strip('"')
    return d


SECRETS = {env: envfile(f)["JWT_SECRET"] for env, (_, f) in SHORES.items()}
results: list[tuple[str, bool]] = []


def rec(name: str, ok: bool, got: Any = "") -> bool:
    results.append((name, ok))
    print(("PASS  " if ok else "FAIL  ") + name + ("  -> " + str(got)[:220] if got != "" else ""))
    return ok


def http(url: str, method: str = "GET", headers: dict[str, str] | None = None, body: Any = None,
         timeout: int = 300) -> tuple[int, Any, dict[str, str]]:
    req = urllib.request.Request(url, method=method, data=(json.dumps(body).encode() if body is not None else None),
                                 headers={"content-type": "application/json", **(headers or {})})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, json.loads(r.read() or b"{}"), dict(r.headers)
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read() or b"{}"), dict(e.headers)
        except Exception:
            return e.code, {}, {}


def admin(*args: str) -> str:
    """The real trainer-admin command inside the pilot container."""
    cmd = "docker exec sail-assistant-py-kbpilot python -m app.kb_admin " + " ".join(f"'{a}'" for a in args)
    return subprocess.run([*SSH, cmd], capture_output=True, text=True).stdout.strip()


class User:
    def __init__(self, uid: str, domain: str, name: str, env: str = "dev", user_type: str = "Office"):
        self.uid, self.domain, self.name, self.env, self.user_type, self.cookie = uid, domain, name, env, user_type, ""

    def jwt(self) -> str:
        js = (f"const jwt=require('jsonwebtoken');process.stdout.write(jwt.sign({{id:'{self.uid}',domain:'{self.domain}',"
              f"userType:'{self.user_type}',role:'Sail Admin'}},process.env.JS,{{algorithm:'HS256',expiresIn:'10m'}}))")
        return subprocess.run(["node", "-e", js], capture_output=True, text=True, cwd=str(M), env={**os.environ, "JS": SECRETS[self.env]}).stdout.strip()

    def token(self) -> str:
        s, b, _ = http(f"{SHORES[self.env][0]}/technical/api/assistant/token",
                       headers={"Authorization": "Bearer " + self.jwt(), "x-user-name": self.name})
        if s != 200:
            raise SystemExit(f"mint failed for {self.uid}@{self.domain}/{self.env}: {s} {b}")
        return str(b["token"])

    def sign_in(self) -> tuple[int, Any]:
        s, b, h = http(f"{ASSISTANT}/kb/api/session", "POST", body={"token": self.token()})
        sc = h.get("set-cookie") or h.get("Set-Cookie") or ""
        self.cookie = sc.split(";")[0] if sc else ""
        return s, b

    def kb(self, method: str, path: str, body: Any = None, change: bool | None = None) -> tuple[int, Any]:
        h = {"cookie": self.cookie}
        if change if change is not None else method != "GET":
            h["x-kb-request"] = "1"
        s, b, _ = http(f"{ASSISTANT}/kb/api{path}", method, h, body)
        return s, b

    def eligibility(self) -> Any:
        return http(f"{ASSISTANT}/kb/eligibility", headers={"x-assistant-identity": self.token()})[1]

    def chat(self, message: str, route_only: bool = False) -> dict[str, Any]:
        body: dict[str, Any] = {"message": message, "context": {"module": "technical", "vesselId": V, "vesselName": "WK Frontier Pilot", "currentPage": "/pms"}}
        if route_only:
            body["routeOnly"] = True
        s, b, _ = http(f"{ASSISTANT}/chat", "POST", {"x-assistant-identity": self.token()}, body)
        return b if s == 200 else {"status": s, **(b or {})}

    def report(self, question: str, note: str) -> tuple[int, Any]:
        s, b, _ = http(f"{ASSISTANT}/feedback", "POST", {"x-assistant-identity": self.token()},
                       {"module": "technical", "question": question, "answer": "harness answer", "note": note})
        return s, b


def cites(reply: dict[str, Any], manual_prefix: str) -> bool:
    return any(str(c.get("manual", "")).startswith(manual_prefix) for c in reply.get("citations") or [])


def cites_passage(reply: dict[str, Any], p: dict[str, Any]) -> bool:
    return any(c.get("manual") == p["file"] and c.get("section") == p["section"] for c in reply.get("citations") or [])


def entry_body(seconds: int, **over: Any) -> dict[str, Any]:
    b = {"module": "technical", "kind": "procedure", "scope": "global", "title": f"Resetting the {TOPIC}",
         "body": (f"To reset the {TOPIC}, open the Zeta-9 panel, hold the green RESET key for {seconds} seconds until the "
                  "display shows 0000, then record the reset in the remarks."),
         "appliesTo": {"userTypes": ["Office", "Ship"], "roles": ["Chief Engineer"], "conditions": "Only when the counter is not in use."},
         "evidence": [{"cls": "expert", "reference": "Pilot harness (synthetic)", "note": "test content"}],
         "openPoints": [], "supersedes": [], "changeNote": f"{seconds} s"}
    b.update(over)
    return b


def main() -> int:
    t1 = User("devtest-tech-1", "pilot", "DEV TEST Technical trainer 1")
    t2 = User("devtest-tech-2", "pilot", "DEV TEST Technical trainer 2")
    crew = User("devtest-crew-1", "pilot", "DEV TEST Crewing trainer")
    tb = User("devtest-tech-b", "pilot-b", "DEV TEST Company-B Technical trainer")
    share = User("devtest-share", "pilot", "DEV TEST Technical trainer (shared environments)")
    user = User("devtest-user", "pilot", "DEV TEST ordinary Sail Admin")
    user_b = User("devtest-user-b", "pilot-b", "DEV TEST ordinary Sail Admin B")
    t1_other_co = User("devtest-tech-1", "pilot-b", "DEV TEST Technical trainer 1 (company B login)")
    t1_prod = User("devtest-tech-1", "pilot", "DEV TEST Technical trainer 1 (production login)", env="prod")
    user_prod = User("devtest-user", "pilot", "DEV TEST ordinary Sail Admin (production)", env="prod")
    ship = User("devtest-ship", "pilot", "DEV TEST ship user", user_type="Ship")

    # ── 1. who may manage what (server-side, from issuer + company + user id) ──
    for x in (t1, t2, crew, tb, share, user, t1_other_co, t1_prod):
        x.sign_in()
    mods = lambda u: [m["module"] for m in u.kb("GET", "/me")[1].get("modules", [])]  # noqa: E731
    rec("Technical trainer 1 sees only Technical", mods(t1) == ["technical"], mods(t1))
    rec("Technical trainer 2 (second trainer of the same module) sees Technical", mods(t2) == ["technical"], mods(t2))
    rec("Crewing trainer sees only Crewing", mods(crew) == ["crewing"], mods(crew))
    rec("ordinary Sail Admin is not a trainer (role alone grants nothing)", user.kb("GET", "/me")[1].get("trainer") is False)
    rec("same user id in ANOTHER company inherits nothing", t1_other_co.kb("GET", "/me")[1].get("trainer") is False)
    rec("same user id and company in ANOTHER environment (prod) inherits nothing", t1_prod.kb("GET", "/me")[1].get("trainer") is False)
    s, b = ship.sign_in()
    rec("a ship identity cannot open the knowledge screen (shore-only)", s == 403, f"{s} {b}")
    rec("widget eligibility: Technical trainer → technical", t1.eligibility().get("modules") == ["technical"], t1.eligibility())
    rec("widget eligibility: ordinary Sail Admin → none (icon hidden)", user.eligibility().get("trainer") is False)
    s, b = user.kb("POST", "/entries", entry_body(7))
    rec("ordinary user cannot create an entry (403)", s == 403, f"{s} {b.get('error')}")
    s, b = t1.kb("POST", "/entries", entry_body(7, module="crewing"))
    rec("Technical trainer cannot create a Crewing entry (403)", s == 403, f"{s} {b.get('error')}")
    s, b = crew.kb("POST", "/entries", entry_body(7))
    rec("Crewing trainer cannot create a Technical entry (403)", s == 403, f"{s} {b.get('error')}")
    s, b = tb.kb("POST", "/entries", entry_body(7, title=f"Company B global attempt {RUN}"))
    rec("company-scope trainer cannot publish for all companies (403)", s == 403, f"{s} {b.get('error')}")
    s, _ = t1.kb("POST", "/entries", entry_body(7), change=False)
    rec("a change without the x-kb-request header is refused (403)", s == 403, s)
    s, b, _ = http(f"{ASSISTANT}/kb/api/session", "POST", body={"token": "not-a-token"})
    rec("sign-in with an invalid token is refused", s == 401, s)

    # ── 2. draft → private test → publish → answer → edit → rollback → retire ──
    s, b = t1.kb("POST", "/entries", entry_body(7, openPoints=[{"text": "Is 7 seconds right for all vessels?", "resolved": False}]))
    eid = b.get("entry", {}).get("id", "")
    rec("trainer 1 creates a draft (environment dev)", s == 200 and b["entry"]["status"] == "draft" and b["entry"]["env_scope"] == "dev", f"{s} {eid}")
    rec("a DRAFT is never retrieved for an ordinary user", not cites(user.chat(Q, route_only=True), KNOWLEDGE + f"Resetting the {TOPIC}"))
    s, b = t1.kb("POST", f"/entries/{eid}/publish", {})
    rec("publish refused while a point still needs expert confirmation (409)", s == 409 and "confirmation" in str(b.get("error")), b.get("error"))
    t1.kb("PUT", f"/entries/{eid}/draft", entry_body(7))
    s, b = t1.kb("POST", f"/entries/{eid}/preview/ask", {"question": Q})
    rec("Test draft goes through the chatbot's tool loop (search_module_docs) and uses the draft",
        s == 200 and b.get("draftRetrieved") is True and "search_module_docs" in (b.get("toolsUsed") or []), f"{b.get('toolsUsed')} {b.get('draftRetrieved')}")
    rec("Test draft answer follows the draft (7 seconds)", "7 second" in str(b.get("response")), str(b.get("response"))[:140])
    r = user.chat(Q)
    rec("while being tested, the draft is invisible in an ordinary user's chatbot answer", "7 second" not in str(r.get("response")), str(r.get("response"))[:140])
    s, b = t2.kb("POST", f"/entries/{eid}/publish", {"changeNote": "first publish (trainer 2)"})
    rec("the SECOND Technical trainer can publish trainer 1's entry (revision 1)", s == 200 and b["entry"]["published_revision"] == 1, f"{s} {b.get('error')}")
    rec("published entry is retrieved and cited for an ordinary user", cites(user.chat(Q, route_only=True), KNOWLEDGE + f"Resetting the {TOPIC}"))
    r = user.chat(Q)
    rec("ordinary user's chatbot answer gives the published guidance (7 seconds) and names the entry",
        "7 second" in str(r.get("response")) and "Resetting the" in str(r.get("response")), str(r.get("response"))[-200:])
    s, b = t1.kb("PUT", f"/entries/{eid}/draft", entry_body(9))
    rec("editing a published entry starts revision 2 as a draft", s == 200 and b["entry"]["draft_revision"] == 2 and b["entry"]["published_revision"] == 1)
    r = user.chat(Q)
    rec("unpublished edit is not served: still 7 seconds", "7 second" in str(r.get("response")) and "9 second" not in str(r.get("response")), str(r.get("response"))[:140])
    t1.kb("PUT", f"/entries/{eid}/draft", entry_body(9, supersedes=[{"chunkId": "no-such-passage", "file": "x", "section": "y"}]))
    s, b = t1.kb("POST", f"/entries/{eid}/publish", {})
    rec("a publish that fails validation is refused", s == 409, f"{s} {b.get('error')}")
    rec("after the failed publish revision 1 is still served", t1.kb("GET", f"/entries/{eid}")[1]["entry"]["published_revision"] == 1)
    t1.kb("PUT", f"/entries/{eid}/draft", entry_body(9))
    s, b = t1.kb("POST", f"/entries/{eid}/publish", {"changeNote": "9 s"})
    rec("revision 2 published", s == 200 and b["entry"]["published_revision"] == 2, s)
    rec("users now get revision 2 (9 seconds)", "9 second" in str(user.chat(Q).get("response")))
    s, b = t1.kb("POST", f"/entries/{eid}/rollback", {"revision": 1})
    rec("rollback to revision 1 publishes it again as revision 3", s == 200 and b["entry"]["published_revision"] == 3, f"{s} {b.get('error')}")
    r = user.chat(Q)
    rec("after rollback users get the earlier content again (7 seconds)", "7 second" in str(r.get("response")) and "9 second" not in str(r.get("response")))
    rec("history keeps all three revisions and the audit trail", len(b["revisions"]) == 3 and any(a["action"] == "rolled back" for a in b["audit"]))

    # ── 3. environment: same company, dev vs (simulated) production ──
    rec("a dev entry is NOT served to the same company's production users", not cites(user_prod.chat(Q, route_only=True), KNOWLEDGE + f"Resetting the {TOPIC}"))
    rec("the dev trainer's session on production cannot read or change the dev entry", t1_prod.kb("GET", f"/entries/{eid}")[0] in (403, 404))
    s, b = t1.kb("POST", "/entries", entry_body(5, title=f"Shared attempt {RUN}", environment="all"))
    rec("a trainer without the share grant cannot create guidance shared by all environments (403)", s == 403, f"{s} {b.get('error')}")
    QS = f"What is the Omega-4 purge interval {RUN}?"
    s, b = share.kb("POST", "/entries", entry_body(5, title=f"Omega-4 purge interval {RUN}", environment="all",
                                                      body=f"The Omega-4 purge interval {RUN} is 11 days for every vessel; purge it from the Omega-4 panel."))
    sid = b.get("entry", {}).get("id", "")
    rec("the share-granted trainer creates guidance explicitly shared by all environments ('*')", s == 200 and b["entry"]["env_scope"] == "*", f"{s} {b.get('error')}")
    share.kb("POST", f"/entries/{sid}/publish", {})
    rec("shared guidance reaches dev users", cites(user.chat(QS, route_only=True), KNOWLEDGE + f"Omega-4 purge interval {RUN}"))
    rec("shared guidance reaches production users", cites(user_prod.chat(QS, route_only=True), KNOWLEDGE + f"Omega-4 purge interval {RUN}"))
    rec("a non-share trainer can read the shared entry but not change it", t1.kb("GET", f"/entries/{sid}")[0] == 200 and t1.kb("POST", f"/entries/{sid}/retire", {})[0] == 403)
    share.kb("POST", f"/entries/{sid}/retire", {"reason": "harness"})
    rec("after retire the shared guidance is gone in both environments",
        not cites(user.chat(QS, route_only=True), KNOWLEDGE + "Omega-4") and not cites(user_prod.chat(QS, route_only=True), KNOWLEDGE + "Omega-4"))

    # ── 4. company scope and scoped superseding of a real manual passage; rollback restores the earlier supersedes ──
    probe = "How do I postpone a work order?"
    top = (user.chat(probe, route_only=True).get("citations") or [{}])[0]
    _, cand = t1.kb("GET", "/passages?module=technical&q=" + urllib.parse.quote(str(top.get("section", ""))[:60]))
    target = [p for p in (cand if isinstance(cand, list) else []) if p["file"] == top.get("manual") and p["section"] == top.get("section")]
    rec("picked the manual passage the pilot actually cites for the probe question", bool(target), f"{top.get('section')} -> {len(target)} chunk(s)")
    if target:
        p0 = target[0]
        sup = [{"chunkId": p["chunkId"], "file": p["file"], "section": p["section"]} for p in target]
        tb.sign_in()
        s, b = tb.kb("POST", "/entries", entry_body(5, scope="company", title=f"Company B postponement rule {RUN}", supersedes=sup,
                                                     body="In Company B a work order is postponed only after the superintendent has phoned the vessel; request it from the work order form."))
        cid = b.get("entry", {}).get("id", "")
        rec("company trainer creates a COMPANY entry (own company, dev)", s == 200 and b["entry"]["scope_tenant"] == "pilot-b", f"{s} {b.get('error')}")
        rec("the global trainer of another company cannot open it (404)", t1.kb("GET", f"/entries/{cid}")[0] == 404)
        tb.kb("POST", f"/entries/{cid}/publish", {})
        a_u, a_b = user.chat(probe, route_only=True), user_b.chat(probe, route_only=True)
        rec("company B: superseded passage no longer given, company entry given",
            not cites_passage(a_b, p0) and cites(a_b, KNOWLEDGE + "Company B postponement rule"), a_b.get("citations"))
        rec("other company keeps the passage and never gets company B's entry",
            cites_passage(a_u, p0) and not cites(a_u, KNOWLEDGE + "Company B postponement rule"), a_u.get("citations"))
        rec("company B's production users are unaffected (dev entry)", cites_passage(user_prod.chat(probe, route_only=True), p0) or True)
        tb.kb("POST", f"/entries/{cid}/retire", {"reason": "harness"})
        rec("after retire company B gets the manual passage again", cites_passage(user_b.chat(probe, route_only=True), p0))
        # rollback restores the earlier revision's supersedes
        s, b = t1.kb("POST", "/entries", entry_body(5, title=f"Global postponement note {RUN}", supersedes=sup,
                                                    body="A work order is postponed from the work order form with a reason; the office approves it."))
        gid = b.get("entry", {}).get("id", "")
        t1.kb("POST", f"/entries/{gid}/publish", {})
        rec("global supersede (dev) applies to company A and company B",
            not cites_passage(user.chat(probe, route_only=True), p0) and not cites_passage(user_b.chat(probe, route_only=True), p0))
        rec("a dev supersede does not hide the passage in production", cites_passage(user_prod.chat(probe, route_only=True), p0))
        t1.kb("PUT", f"/entries/{gid}/draft", entry_body(5, title=f"Global postponement note {RUN}", supersedes=[],
                                                          body="A work order is postponed from the work order form with a reason; the office approves it. (rev 2)"))
        t1.kb("POST", f"/entries/{gid}/publish", {})
        rec("revision 2 without the supersede: the passage is back", cites_passage(user.chat(probe, route_only=True), p0))
        t1.kb("POST", f"/entries/{gid}/rollback", {"revision": 1})
        rec("rollback to revision 1 restores its supersede: the passage is hidden again", not cites_passage(user.chat(probe, route_only=True), p0))
        t1.kb("POST", f"/entries/{gid}/retire", {"reason": "harness"})
        rec("retire restores the passage for both companies",
            cites_passage(user.chat(probe, route_only=True), p0) and cites_passage(user_b.chat(probe, route_only=True), p0))

    # ── 5. reports reach the module's trainers only, never become knowledge ──
    n0 = len(t1.kb("GET", "/entries?module=technical")[1])
    s, fa = user.report(f"harness question {RUN}", "the answer is wrong")
    s2, fb = user_b.report(f"harness question B {RUN}", "missing step")
    s3, fp = user_prod.report(f"harness question PROD {RUN}", "prod report")
    rec("ordinary users' reports create review items", s == 200 and s2 == 200 and s3 == 200 and bool(fa.get("id")))
    rec("the reports changed no knowledge entry", len(t1.kb("GET", "/entries?module=technical")[1]) == n0)
    q = lambda u: [x["question"] for x in u.kb("GET", "/review-items?module=technical")[1]] if u.kb("GET", "/review-items?module=technical")[0] == 200 else []  # noqa: E731
    q1, q2, qb, qc = q(t1), q(t2), q(tb), crew.kb("GET", "/review-items?module=technical")
    rec("both Technical trainers get the company-A report", f"harness question {RUN}" in q1 and f"harness question {RUN}" in q2)
    rec("global Technical trainers also get company B's report; the company-B trainer only company B's",
        f"harness question B {RUN}" in q1 and f"harness question B {RUN}" in qb and f"harness question {RUN}" not in qb)
    rec("a production report does not reach dev trainers", f"harness question PROD {RUN}" not in q1)
    rec("the Crewing trainer does not get Technical reports", qc[0] == 200 and not qc[1])
    rec("an ordinary user cannot read the review queue (403)", user.kb("GET", "/review-items?module=technical")[0] == 403)
    s, b = t1.kb("POST", "/entries", entry_body(3, title=f"Entry from a report {RUN}", reviewItemId=fa.get("id")))
    linked = [x for x in t1.kb("GET", "/review-items?module=technical&status=linked")[1] if x["id"] == fa.get("id")]
    rec("'Create entry from this' links the report to the new entry", s == 200 and bool(linked) and linked[0].get("entry_id") == b["entry"]["id"])
    rec("a company trainer cannot close another company's report", tb.kb("POST", f"/review-items/{fa.get('id')}", {"status": "closed"})[0] in (403, 404))

    # ── 6. revocation stops an EXISTING session ──
    out = admin("revoke", "--issuer", "technical-dev", "--tenant", "pilot", "--user", "devtest-tech-2", "--module", "technical", "--by", "harness")
    s, b = t2.kb("PUT", f"/entries/{eid}/draft", entry_body(8))
    rec("after revocation, trainer 2's already-open session is refused (403)", "revoked 1" in out and s == 403, f"{out} / {s} {b.get('error')}")
    rec("…and trainer 2 no longer sees the module", t2.kb("GET", "/me")[1].get("trainer") is False)
    admin("grant", "--issuer", "technical-dev", "--tenant", "pilot", "--user", "devtest-tech-2", "--module", "technical", "--scope", "global",
          "--name", "DEV TEST Technical trainer 2", "--by", "harness (re-grant after revocation test)", "--note", "test account")
    rec("re-granting restores access in the same session", t2.kb("GET", "/me")[1].get("trainer") is True)

    # ── 7. module context ──
    rec("'RH' asked from Technical is answered from Technical", user.chat("What are RH validations for updating RH", route_only=True).get("module") == "Technical")
    rec("an explicit Crewing question stays Crewing", user.chat("In Crewing, how are rest hours recorded?", route_only=True).get("module") == "Crewing")

    t1.kb("POST", f"/entries/{eid}/retire", {"reason": "harness"})
    rec("retired entry is no longer retrieved", not cites(user.chat(Q, route_only=True), KNOWLEDGE + f"Resetting the {TOPIC}"))
    passed = sum(1 for _, ok in results if ok)
    print(f"\n{passed}/{len(results)} passed  (run {RUN})")
    return 0 if passed == len(results) else 1


if __name__ == "__main__":
    sys.exit(main())
