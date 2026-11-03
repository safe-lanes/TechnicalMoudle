"""TRACKED regression of the shared assistant on the final candidate (3-Nov-2026). Runs ON the AI server; keys are read from the env files
and never printed. Every live-data case compares the chat answer with a DIRECT call to the source tool (same identity), and records the
ACTUAL tool arguments from the outbound capture. A refused request never counts as a pass unless the case expects a refusal.

Evidence labels (printed per case):
  LOCAL-PILOT  local Technical/Crewing pilot servers and databases through tunnels, signed test identities
  DEV-TOOLPATH the real dev Technical/Crewing backends through the registered instance, signed test identity (NOT a genuine dev login)
Usage: python3 final_regression.py <section ...>   sections: technical crewing date auth masking
"""
import base64, hashlib, hmac, json, re, sys, time, urllib.error, urllib.request

ENV_C = "/home/ubuntu/central-assistant/audit-pilot.env"
ENV_L = "/home/ubuntu/central-assistant/crewing-stage2-release.env"
CAPDIR = "/home/ubuntu/central-assistant-py/s4-captures/auditpilot/"
CAND, LIVE = 8070, 8054
CAPS = {8070: CAPDIR + "capture.jsonl", 8071: CAPDIR + "cap-8071.jsonl", 8072: CAPDIR + "cap-8072.jsonl", 8073: CAPDIR + "cap-8073.jsonl"}


def regs(path):
    return json.loads(re.search(r"^ASSISTANT_MODULE_INSTANCES=(.*)$", open(path).read(), re.M).group(1))


RC, RL = regs(ENV_C), regs(ENV_L)
b64 = lambda b: base64.urlsafe_b64encode(b).rstrip(b"=").decode()


def mint(key, **c):
    now = int(time.time())
    p = b64(json.dumps({"userName": "Reg User", "role": "Sail Admin", "userType": "Office", "iat": now, "exp": now + 120, **c}, separators=(",", ":")).encode())
    return p + "." + b64(hmac.new(key.encode(), p.encode(), hashlib.sha256).digest())


def tok(iss, port=CAND, **c):
    return mint((RL if port == LIVE else RC)[iss]["signingKey"], iss=iss, **c)


def http(url, body=None, headers=None, timeout=180):
    req = urllib.request.Request(url, data=json.dumps(body).encode() if body is not None else None, headers={"Content-Type": "application/json", **(headers or {})})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, json.loads(r.read() or b"null")
    except urllib.error.HTTPError as e:
        return e.code, {"raw": e.read().decode()[:200]}
    except Exception as e:
        return 0, {"raw": str(e)[:200]}


def source(iss, tool, args, **c):
    s, j = http(RC[iss]["url"] + "/assistant/execute", {"tool": tool, "args": args, "requestId": "reg", "module": tool.split("_")[0] if tool.split("_")[0] in ("audit", "safety", "incident") else RC[iss]["module"]},
                {"x-service-secret": RC[iss]["secret"], "x-assistant-identity": tok(iss, **c)})
    return (j or {}).get("data") if isinstance(j, dict) else None


def caplen(port):
    try:
        return sum(1 for _ in open(CAPS[port]))
    except Exception:
        return 0


def tool_args(port, start):
    out = []
    try:
        for ln in open(CAPS[port]).read().splitlines()[start:]:
            try:
                b = json.loads(json.loads(ln)["body"])
            except Exception:
                continue
            for m in b.get("messages", []):
                for tc in (m.get("tool_calls") or []):
                    fn = tc.get("function", {})
                    a = fn.get("name") + " " + str(fn.get("arguments"))
                    if a not in out:
                        out.append(a)
    except Exception as e:
        out.append(f"capture read failed: {e}")
    return out


def chat(port, iss, q, ctx, cid, hist=None, **claims):
    n = caplen(port) if port in CAPS else 0
    t = time.time()
    s, j = http(f"http://127.0.0.1:{port}/chat", {"message": q, "context": ctx, "conversationId": cid, "conversationHistory": hist or []}, {"x-assistant-identity": tok(iss, port=port if port == LIVE else CAND, **claims)})
    j = j or {}
    return {"http": s, "gate": j.get("gate"), "tools": j.get("toolsUsed"), "answer": j.get("response") or j.get("raw") or "", "citations": j.get("citations") or [],
            "ms": int((time.time() - t) * 1000), "args": tool_args(port, n) if port in CAPS else None, "partial": j.get("partial")}


RESULTS = []
nums = lambda s: {int(x.replace(",", "")) for x in re.findall(r"(?<![\d-])\d[\d,]*(?![\d-])", s or "")}


def rec(section, label, ev, ok, **detail):
    RESULTS.append({"section": section, "label": label, "evidence": ev, "ok": ok, **detail})
    print(("PASS " if ok else "FAIL ") + f"[{ev}] {label}" + (" — " + json.dumps({k: (v[:230] if isinstance(v, str) else v) for k, v in detail.items() if k in ('expected', 'source', 'args', 'head', 'note', 'tools')}, ensure_ascii=False)[:640] if detail else ""), flush=True)


def cid(p):
    return f"{p}-{int(time.time() * 1000)}"


# ------------------------------------------------------------------------------------------------------------- TECHNICAL
def technical():
    # A. local pilot, vessel with real data (the host passes the selected vessel in the context, as the Technical widget does)
    A = dict(userId="devtest-user", tenantDomain="pilot")
    V = {"module": "technical", "vesselId": "WKFV", "vesselName": "WK Frontier Pilot"}
    I = "technical-pilotlocal"
    src = source(I, "get_overdue_work_orders", {"vesselId": "WKFV"}, **A)
    total = src["totalOverdue"]
    c = cid("t"); hist = []
    def turn(q):
        r = chat(CAND, I, q, V, c, hist, **A)
        hist.extend([{"role": "user", "content": q}, {"role": "assistant", "content": r["answer"]}])
        return r
    r = turn("How many work orders are overdue?")
    rec("technical", "overdue total = direct tool", "LOCAL-PILOT", r["gate"] == "answer" and total in nums(r["answer"]), source=total, tools=r["tools"], args=r["args"], head=r["answer"][:200])
    cnt = source(I, "get_work_order_counts", {"vesselId": "WKFV"}, **A)
    r = turn("Break the work orders down by status")
    rec("technical", "follow-up: counts by status = direct tool", "LOCAL-PILOT", {cnt["overdue"], cnt["due"], cnt["total"]} & nums(r["answer"]) == {cnt["overdue"], cnt["due"], cnt["total"]} or {cnt["overdue"], cnt["due"]} <= nums(r["answer"]), source={k: cnt[k] for k in ("total", "overdue", "due", "pendingApproval")}, tools=r["tools"], head=r["answer"][:220])
    r = turn("List the overdue ones")
    first = {w.get("workOrderNo") or w.get("woNumber") or w.get("workOrderNumber") or w.get("id") for w in src["workOrders"]}
    r2 = turn("show more")
    p2 = source(I, "get_overdue_work_orders", {"vesselId": "WKFV", "offset": 10}, **A)
    second = {w.get("workOrderNo") or w.get("woNumber") or w.get("workOrderNumber") or w.get("id") for w in p2["workOrders"]}
    hit = [w for w in second if w and str(w) in r2["answer"]]
    rec("technical", "pagination: 'show more' returns the next page", "LOCAL-PILOT", any("offset" in a for a in r2["args"]) and len(hit) >= 1 and not any(str(w) in r2["answer"] for w in first if w), args=r2["args"], note=f"second-page ids found in the answer: {len(hit)}/{len(second)}", head=r2["answer"][:200])
    due = source(I, "get_due_work_orders", {"vesselId": "WKFV", "dateRange": "month"}, **A) or {}
    r = chat(CAND, I, "Which work orders are due this month?", V, cid("t2"), **A)
    rec("technical", "date filter: 'due this month' uses the tool's month range", "LOCAL-PILOT", any('"month"' in a or "month" in a for a in r["args"]) and due.get("totalDue") in nums(r["answer"]), source=due.get("totalDue"), args=r["args"], head=r["answer"][:220])
    r = chat(CAND, I, "How do I complete a work order?", {"module": "technical"}, cid("t4"), **A)
    rec("technical", "manual answer on the tool loop", "LOCAL-PILOT", r["gate"] == "answer" and "search_module_docs" in (r["tools"] or []), tools=r["tools"], head=r["answer"][:220], note=f"citations field: {len(r['citations'])} (Technical returns none on this path, live too)")
    # B. real dev backend: live v11 vs candidate, same registration
    D = dict(userId="release-check-3nov", userName="Release check", tenantDomain="rsms05102026")
    Dctx = {"module": "technical", "vesselId": "743feb08-841a-11ed-aa7c-7003bca91a86", "vesselName": "Vessel 2"}
    s_od = source("technical-dev", "get_overdue_work_orders", {"vesselId": Dctx["vesselId"]}, **D)
    s_ls = source("technical-dev", "get_low_stock_spares", {"vesselId": Dctx["vesselId"]}, **D)
    for q, val in (("How many work orders are overdue?", s_od["totalOverdue"]), ("How many spares are below minimum stock?", s_ls["totalLowStock"])):
        rl = chat(LIVE, "technical-dev", q, Dctx, cid("dl"), **D); rc = chat(CAND, "technical-dev", q, Dctx, cid("dc"), **D)
        rec("technical", f"dev: '{q}' live and candidate = direct tool", "DEV-TOOLPATH", val in nums(rl["answer"]) and val in nums(rc["answer"]) and rl["tools"] == rc["tools"], source=val, tools=[rl["tools"], rc["tools"]], head=rc["answer"][:160])
    c1 = cid("dfu"); h = []
    r1 = chat(CAND, "technical-dev", "How many work orders are overdue?", Dctx, c1, **D); h += [{"role": "user", "content": "How many work orders are overdue?"}, {"role": "assistant", "content": r1["answer"]}]
    r2 = chat(CAND, "technical-dev", "show more", Dctx, c1, h, **D)
    rec("technical", "dev: follow-up with the vessel in context works (my round-2 'not recognised' came from a probe without vessel context)", "DEV-TOOLPATH", r2["gate"] == "answer" and "not recogni" not in r2["answer"].lower() and "unknown vessel" not in r2["answer"].lower(), args=r2["args"], head=r2["answer"][:200])
    # Technical tools have only rolling ranges: 'last month' must be declined, never answered with the rolling count
    V9 = {"module": "technical", "vesselId": "744cf286-841a-11ed-aa7c-7003bca91a86", "vesselName": "Vessel 9"}
    rolling = (source("technical-dev", "get_work_orders", {"vesselId": V9["vesselId"], "status": "Completed", "dateRange": "month", "limit": 50}, **D) or {}).get("count")
    decline = r"(can(?:not|['’]t)|couldn['’]t|unable|not able|does not (?:support|provide|filter)|doesn['’]t|no (?:tool|filter)|only)"
    for q in ("How many work orders were completed last month?", "Which work orders were completed last month?", "How many defects were raised in October?"):
        r = chat(CAND, "technical-dev", q, V9, cid("t3"), **D); rl = chat(LIVE, "technical-dev", q, V9, cid("t3l"), **D)
        claims_count = rolling in nums(r["answer"]) and re.search(r"last month|October", r["answer"][:200]) and not re.search(decline, r["answer"], re.I)
        rec("technical", f"dev: '{q}' is declined or clearly qualified, no false month count", "DEV-TOOLPATH", r["gate"] == "answer" and bool(re.search(decline, r["answer"], re.I)) and not claims_count, source=rolling, args=r["args"], head=r["answer"][:300], note="live v11: " + rl["answer"][:150])
    # C. company isolation
    fa = source(I, "get_fleet_overview", {}, **A); fb = source(I, "get_fleet_overview", {}, userId="devtest-user-b", tenantDomain="pilot-b")
    rb = chat(CAND, I, "How many vessels are in the fleet?", {"module": "technical"}, cid("tb"), userId="devtest-user-b", tenantDomain="pilot-b")
    ra = chat(CAND, I, "How many vessels are in the fleet?", {"module": "technical"}, cid("ta"), **A)
    rec("technical", "company isolation: pilot vs pilot-b fleets", "LOCAL-PILOT", fa["totalVessels"] in nums(ra["answer"]) and fb["totalVessels"] != fa["totalVessels"] and fa["totalVessels"] not in nums(rb["answer"]), source=[fa["totalVessels"], fb["totalVessels"]], head=rb["answer"][:140])


# --------------------------------------------------------------------------------------------------------------- CREWING
def crewing():
    S = dict(userId="1", tenantDomain=None, tuid=None); I = "crewing-pilot"; X = {"module": "crewing"}
    t = lambda tool, a: (source(I, tool, a, **S) or {}).get("total")
    c = cid("c"); h = []
    def turn(q):
        r = chat(CAND, I, q, X, c, h, **S); h.extend([{"role": "user", "content": q}, {"role": "assistant", "content": r["answer"]}]); return r
    v = t("crewing_query_assignments", {"mode": "count"})
    r = turn("How many crew are on board?")
    rec("crewing", "crew on board = direct tool", "LOCAL-PILOT", v in nums(r["answer"]), source=v, args=r["args"], head=r["answer"][:170])
    v2 = t("crewing_query_assignments", {"mode": "count", "rankGroups": ["engineers"]})
    r = turn("only engineers")
    rec("crewing", "follow-up keeps the question, narrows to engineers = direct tool", "LOCAL-PILOT", v2 in nums(r["answer"]) and any("rankGroups" in a or "conversation" in a for a in r["args"]), source=v2, args=r["args"], head=r["answer"][:170])
    r = turn("list them")
    rec("crewing", "follow-up list", "LOCAL-PILOT", r["gate"] == "answer" and "crewing_query_assignments" in (r["tools"] or []), args=r["args"], head=r["answer"][:170])
    c2 = cid("c2"); h2 = []
    q = "Which certificates expire in the next 60 days?"
    src = source(I, "crewing_query_documents", {"mode": "list", "expiryWithin": {"direction": "next", "amount": 60, "unit": "days"}}, **S) or {}
    r = chat(CAND, I, q, X, c2, **S); h2 += [{"role": "user", "content": q}, {"role": "assistant", "content": r["answer"]}]
    rec("crewing", "documents expiring in 60 days = direct tool", "LOCAL-PILOT", src.get("total") in nums(r["answer"]), source=src.get("total"), args=r["args"], head=r["answer"][:170])
    r2 = chat(CAND, I, "show more", X, c2, h2, **S)
    rec("crewing", "pagination: 'show more' uses the next offset", "LOCAL-PILOT", any('"offset"' in a and not re.search(r'"offset":\s*0\b', a) for a in r2["args"]) or (src.get("total") or 0) <= 10, source=src.get("total"), args=r2["args"], head=r2["answer"][:170])
    r = chat(CAND, I, "How do I add a new licence to a crew member?", X, cid("c3"), **S)
    rec("crewing", "manual answer with citations", "LOCAL-PILOT", r["gate"] == "answer" and len(r["citations"]) > 0, note=f"citations {len(r['citations'])}", head=r["answer"][:170])
    # multi-company
    M = "crewing-pilotmt"; Aa = dict(userId="1", tenantDomain="trial-a.local", tuid="crew_trial_a"); Bb = dict(userId="1", tenantDomain="trial-b.local", tuid="crew_trial_b")
    a = (source(M, "crewing_query_assignments", {"mode": "count"}, **Aa) or {}).get("total"); b = (source(M, "crewing_query_assignments", {"mode": "count"}, **Bb) or {}).get("total")
    ra = chat(CAND, M, "How many crew are on board?", X, cid("ma"), **Aa); rb = chat(CAND, M, "How many crew are on board?", X, cid("mb"), **Bb)
    rec("crewing", "company isolation: two companies, each its own number", "LOCAL-PILOT", a != b and a in nums(ra["answer"]) and b in nums(rb["answer"]), source=[a, b], head=rb["answer"][:120])
    # real dev: live v11 vs candidate with the recovered identity (user 362, tenant rsms)
    D = dict(userId="362", userName="Reg User", tenantDomain="rsms")
    d = lambda tool, a: (source("crewing-dev", tool, a, **D) or {}).get("total")
    for q, val in (("How many crew are on board Vessel 8?", None), ("Which certificates expire in the next 60 days?", d("crewing_query_documents", {"mode": "count", "expiryWithin": {"direction": "next", "amount": 60, "unit": "days"}})),
                   ("Who is due for relief in the next 30 days?", None), ("Which rotation plans are waiting for approval?", None), ("How many engineers are on board across the fleet?", None)):
        rl = chat(LIVE, "crewing-dev", q, X, cid("cl"), **D); rc = chat(CAND, "crewing-dev", q, X, cid("cc"), **D)
        ok = rl["gate"] == rc["gate"] == "answer" and rl["tools"] == rc["tools"] and "not linked" not in rc["answer"] and (val is None or (val in nums(rl["answer"]) and val in nums(rc["answer"])))
        rec("crewing", f"dev: '{q}' live vs candidate", "DEV-TOOLPATH", ok, source=val, tools=[rl["tools"], rc["tools"]], args=rc["args"], head=rc["answer"][:150])


# ------------------------------------------------------------------------------------------------------------------ DATE
def month_tool_case(port, label, ev, iss, claims, q, want_month, tool, srcargs, ctx, current_month_rolling_ok=False):
    r = chat(port, iss, q, ctx, cid("d"), **claims)
    src = source(iss, tool, srcargs, **claims) or {}
    argtext = " ".join(r["args"] or [])
    # lastMonths: 1 IS the current month by the tool's definition, so it is correct only for a 'this month' question, and only when the answer names that month
    rolling_current = current_month_rolling_ok and '"lastMonths":1' in argtext.replace(" ", "") and "November 2026" in r["answer"]
    ok_args = rolling_current or (want_month in argtext and "lastMonths" not in argtext)
    v = src.get("total")
    ok = ok_args and r["gate"] == "answer" and (v in nums(r["answer"]) or (v == 0 and re.search(r"\b(no|none|zero|0)\b", r["answer"], re.I) is not None))
    rec("date", label, ev, ok, expected=want_month, source=v, args=r["args"], head=r["answer"][:190])


def date():
    S = dict(userId="1", tenantDomain=None, tuid=None); I = "crewing-pilot"; X = {"module": "crewing"}
    rh = lambda m: {"mode": "count", "months": [m]}
    Q = "Show me rest hour violations last month"
    month_tool_case(CAND, "Crewing, today (Nov 2026): last month = 2026-10", "LOCAL-PILOT", I, S, Q, "2026-10", "crewing_query_rest_hours", rh("2026-10"), X)
    month_tool_case(CAND, "Crewing, today: previous month wording", "LOCAL-PILOT", I, S, "How many rest hour violations in the previous month?", "2026-10", "crewing_query_rest_hours", rh("2026-10"), X)
    month_tool_case(CAND, "Crewing, today: this month = 2026-11", "LOCAL-PILOT", I, S, "Show me rest hour violations this month", "2026-11", "crewing_query_rest_hours", rh("2026-11"), X, current_month_rolling_ok=True)
    month_tool_case(CAND, "Crewing, today: named month without year = September 2026", "LOCAL-PILOT", I, S, "Rest hour violations in September", "2026-09", "crewing_query_rest_hours", rh("2026-09"), X)
    r = chat(CAND, I, "Rest hour violations in the last 3 months", X, cid("d"), **S)
    rec("date", "Crewing: an explicit rolling period may still use the rolling parameter", "LOCAL-PILOT", r["gate"] == "answer" and ("lastMonths" in " ".join(r["args"]) or "2026-09" in " ".join(r["args"])), args=r["args"], head=r["answer"][:170])
    c = cid("dfu"); r1 = chat(CAND, I, Q, X, c, **S)
    r2 = chat(CAND, I, "and the month before that?", X, c, [{"role": "user", "content": Q}, {"role": "assistant", "content": r1["answer"]}], **S)
    v = (source(I, "crewing_query_rest_hours", rh("2026-09"), **S) or {}).get("total")
    rec("date", "Crewing: date follow-up 'the month before that' = 2026-09", "LOCAL-PILOT", "2026-09" in " ".join(r2["args"]) and v in nums(r2["answer"]), source=v, args=r2["args"], head=r2["answer"][:170])
    month_tool_case(8071, "Crewing, pinned 15 Jan 2027: last month = 2026-12 (year boundary)", "LOCAL-PILOT", I, S, Q, "2026-12", "crewing_query_rest_hours", rh("2026-12"), X)
    month_tool_case(8071, "Crewing, pinned 15 Jan 2027: this month = 2027-01", "LOCAL-PILOT", I, S, "Show me rest hour violations this month", "2027-01", "crewing_query_rest_hours", rh("2027-01"), X)
    D = dict(userId="362", userName="Reg User", tenantDomain="rsms")
    month_tool_case(CAND, "Crewing DEV: last month = 2026-10", "DEV-TOOLPATH", "crewing-dev", D, Q, "2026-10", "crewing_query_rest_hours", rh("2026-10"), X)
    rl = chat(LIVE, "crewing-dev", Q, X, cid("d"), **D)
    rec("date", "Crewing DEV: released v11 for comparison (no capture on live; answer only)", "DEV-TOOLPATH", True, head=rl["answer"][:220], note="comparison only")
    # the three pilot areas, real backend data; explicit from/to dates so the pinned assistant date decides the period
    AR = dict(userId="301", tenantDomain="rsms", tuid="sail_trial_a"); P = "audit-pilot"
    def area(port, label, q, mod, tool, a, want):
        month_tool_case(port, label, "LOCAL-PILOT", P, AR, q, want, tool, a, {"module": mod})
    dr = lambda k, f, t: {"mode": "count", k + "From": f, k + "To": t}
    area(8072, "MOC, pinned 15 Jan 2025: initiated last month = Dec 2024 (year boundary)", "How many MOCs were initiated last month?", "safety", "safety_query_moc", dr("initiated", "2024-12-01", "2024-12-31"), "2024-12-01")
    area(8073, "Incidents, pinned 10 Jul 2025: last month = Jun 2025", "How many incidents happened last month?", "incident", "incident_query_incidents", dr("incidentDate", "2025-06-01", "2025-06-30"), "2025-06-01")
    area(8073, "Incidents, pinned 10 Jul 2025: this month = Jul 2025", "How many incidents happened this month?", "incident", "incident_query_incidents", dr("incidentDate", "2025-07-01", "2025-07-31"), "2025-07-01")
    area(8072, "Incidents, pinned 15 Jan 2025: last month = Dec 2024", "How many incidents happened last month?", "incident", "incident_query_incidents", dr("incidentDate", "2024-12-01", "2024-12-31"), "2024-12-01")
    area(CAND, "Audit, today: inspections last month = Oct 2026", "How many observations are there from inspections last month?", "audit", "audit_query_observations", dr("inspectionDate", "2026-10-01", "2026-10-31"), "2026-10-01")


# ------------------------------------------------------------------------------------------------------------------ AUTH
def auth():
    for iss, ctx, claims in (("technical-pilotlocal", {"module": "technical"}, dict(userId="devtest-user", tenantDomain="pilot")), ("crewing-pilot", {"module": "crewing"}, dict(userId="1", tenantDomain=None, tuid=None))):
        url = f"http://127.0.0.1:{CAND}/chat"; body = {"message": "How many vessels?", "context": ctx}
        good = tok(iss, **claims)
        s1, _ = http(url, body, {"x-assistant-identity": good[:-3] + "abc"})
        s2, _ = http(url, body, {"x-assistant-identity": mint("deadbeef" * 8, iss=iss, **claims)})
        s3, _ = http(url, body, {"x-assistant-identity": mint(RC[iss]["signingKey"], iss="unknown-issuer", **claims)})
        s4, _ = http(url, body, {})
        now = int(time.time()) - 900
        p = b64(json.dumps({"userName": "x", "role": "Sail Admin", "userType": "Office", "iss": iss, "iat": now, "exp": now + 60, **claims}, separators=(",", ":")).encode())
        s5, _ = http(url, body, {"x-assistant-identity": p + "." + b64(hmac.new(RC[iss]["signingKey"].encode(), p.encode(), hashlib.sha256).digest())})
        rec("auth", f"{iss}: tampered / wrong key / unknown issuer / none / expired → 401", "LOCAL-PILOT", [s1, s2, s3, s4, s5] == [401] * 5, source=[s1, s2, s3, s4, s5])
    I = "crewing-pilotmt"; Aa = dict(tenantDomain="trial-a.local", tuid="crew_trial_a")
    r = source(I, "crewing_query_assignments", {"mode": "count"}, userId="37", userType="Ship", role="Vessel Admin", **Aa) or {}
    rec("auth", "Crewing: Ship user refused", "LOCAL-PILOT", r.get("ok") is False or r == {}, source=str(r.get("code")))
    r = source(I, "crewing_query_assignments", {"mode": "count"}, userId="1", tenantDomain="trial-a.local", tuid="crew_trial_b") or {}
    rec("auth", "Crewing: tenant / tuid mismatch refused", "LOCAL-PILOT", r.get("ok") is False or r == {}, source=str(r.get("code")))
    r = source(I, "crewing_query_assignments", {"mode": "count"}, userId="6", role="Sail Admin", **Aa) or {}
    rec("auth", "Crewing: token claiming Sail Admin for a stored 'User' re-checked by the server", "LOCAL-PILOT", r.get("ok") is False, source=str(r.get("code")))
    # conversation separation
    Si = dict(userId="1", tenantDomain=None, tuid=None); same = cid("sep"); X = {"module": "crewing"}
    vessel_only = (source("crewing-pilot", "crewing_query_assignments", {"mode": "count", "vessels": ["MV Alpha Star"], "rankGroups": ["engineers"]}, **Si) or {}).get("total")
    fleet = (source("crewing-pilot", "crewing_query_assignments", {"mode": "count", "rankGroups": ["engineers"]}, **Si) or {}).get("total")
    chat(CAND, "crewing-pilot", "How many crew are on board MV Alpha Star?", X, same, **Si)
    r0 = chat(CAND, "crewing-pilot", "only engineers", X, same, [{"role": "user", "content": "How many crew are on board MV Alpha Star?"}], **Si)
    rec("auth", "control: the SAME user's follow-up keeps the vessel (so the next check can fail)", "LOCAL-PILOT", vessel_only != fleet and vessel_only in nums(r0["answer"]), source=[vessel_only, fleet], args=r0["args"], head=r0["answer"][:150])
    r = chat(CAND, "crewing-pilot", "only engineers", X, same, userId="2", tenantDomain=None, tuid=None)
    rec("auth", "conversation separation: same conversation id, other user does not inherit the vessel", "LOCAL-PILOT", vessel_only not in nums(r["answer"]) or fleet in nums(r["answer"]) or r["gate"] != "answer", source=[vessel_only, fleet], args=r["args"], head=r["answer"][:170])
    same2 = cid("sep2"); chat(CAND, "crewing-pilot", "How many crew are on board?", X, same2, **Si)
    r = chat(CAND, "technical-pilotlocal", "only engineers", {"module": "technical", "vesselId": "WKFV", "vesselName": "WK Frontier Pilot"}, same2, userId="devtest-user", tenantDomain="pilot")
    rec("auth", "conversation separation: same id across instances/modules carries nothing", "LOCAL-PILOT", "crewing_query_assignments" not in (r["tools"] or []), tools=r["tools"], head=r["answer"][:150])



# ------------------------------------------------------------------------------------------------------------- ALL AREAS
def areas():
    AR = dict(userId="301", tenantDomain="rsms", tuid="sail_trial_a"); P = "audit-pilot"
    def src(tool, args):
        d = source(P, tool, args, **AR) or {}
        return d.get("total"), d
    def ask(label, module, q, tool, args, cid_=None, hist=None, words=None):
        total, d = src(tool, args)
        r = chat(CAND, P, q, {"module": module}, cid_ or cid("a"), hist, **AR)
        hit = total is not None and (total in nums(r["answer"]) or (total == 0 and re.search(r"\b(no|none|zero|0)\b", r["answer"], re.I) is not None))
        ok = r["gate"] == "answer" and tool in (r["tools"] or []) and hit and (not words or all(w.lower() in r["answer"].lower() for w in words))
        rec("areas", label, "LOCAL-PILOT", ok, source=total, tools=r["tools"], args=r["args"], head=r["answer"][:210])
        return r
    # AUDIT
    ask("completed inspections = Done + Closed, with the note", "audit", "How many inspections have we completed in total?", "audit_query_inspections", {"mode": "count", "tab": "history", "statuses": ["Done", "Closed"]}, words=["Done", "Closed"])
    ask("History tab total is a different question", "audit", "How many inspections are in the History tab?", "audit_query_inspections", {"mode": "count"})
    ask("inspections: type filter", "audit", "How many SIRE inspections are on record?", "audit_query_inspections", {"mode": "count", "inspectionTypes": ["SIRE"]})
    ask("inspections: vessel filter, other wording", "audit", "What is the inspection count for Desert Rose?", "audit_query_inspections", {"mode": "count", "vessels": ["Desert Rose"]})
    ask("planned: overdue", "audit", "How many planned inspections are overdue?", "audit_query_planned_inspections", {"mode": "count", "dueStatus": "overdue"})
    ask("planned: next due view", "audit", "How many vessels are due for a SIRE inspection?", "audit_query_planned_inspections", {"mode": "count", "view": "next_due", "inspectionTypes": ["SIRE"]})
    ask("preparations: active", "audit", "How many inspection preparations are active right now?", "audit_query_preparations", {"mode": "count"})
    ask("preparations: archived", "audit", "How many preparations have been archived?", "audit_query_preparations", {"mode": "count", "archived": "archived"})
    ask("actions: pending", "audit", "How many audit actions are pending?", "audit_query_actions", {"mode": "count"})
    ask("actions: overdue", "audit", "How many audit actions are past their due date?", "audit_query_actions", {"mode": "count", "status": "overdue"})
    # follow-ups + paging in Audit
    c = cid("af"); q1 = "How many audit actions are pending?"
    r1 = chat(CAND, P, q1, {"module": "audit"}, c, **AR); h = [{"role": "user", "content": q1}, {"role": "assistant", "content": r1["answer"]}]
    t2, _ = src("audit_query_actions", {"mode": "count", "status": "overdue"})
    r2 = chat(CAND, P, "how many of those are overdue?", {"module": "audit"}, c, h, **AR); h += [{"role": "user", "content": "how many of those are overdue?"}, {"role": "assistant", "content": r2["answer"]}]
    rec("areas", "audit actions follow-up keeps the question", "LOCAL-PILOT", t2 in nums(r2["answer"]) and "audit_query_actions" in (r2["tools"] or []), source=t2, args=r2["args"], head=r2["answer"][:170])
    r3 = chat(CAND, P, "list them", {"module": "audit"}, c, h, **AR); h += [{"role": "user", "content": "list them"}, {"role": "assistant", "content": r3["answer"]}]
    r4 = chat(CAND, P, "show more", {"module": "audit"}, c, h, **AR)
    rec("areas", "audit actions list then next page", "LOCAL-PILOT", any('"offset":10' in str(a).replace(" ", "").replace("'", '"') for a in r4["args"]) and r4["gate"] == "answer", args=r4["args"], head=r4["answer"][:170])
    # SAFETY
    ask("MOC actions: pending", "safety", "How many MOC actions are still pending?", "safety_query_moc_actions", {"mode": "count"})
    ask("risk assessments: all", "safety", "How many risk assessments do we have across vessel, office and generic?", "safety_query_risk_assessments", {"mode": "count"})
    ask("risk assessments: review overdue", "safety", "How many risk assessments are overdue for review?", "safety_query_risk_assessments", {"mode": "count", "reviewOverdue": True})
    ask("safety meetings: total", "safety", "How many safety meetings are recorded?", "safety_query_safety_meetings", {"mode": "count"})
    ask("safety meetings: response overdue", "safety", "How many safety meetings have an overdue office response?", "safety_query_safety_meetings", {"mode": "count", "officeResponses": ["overdue"]})
    ask("SMS: dashboard total", "safety", "How many SMS document changes are on the dashboard?", "safety_query_sms_documents", {"mode": "count"})
    ask("SMS: revisions in draft", "safety", "How many SMS revisions are in draft?", "safety_query_sms_documents", {"mode": "count", "kinds": ["revision"], "buckets": ["draft"]})
    ask("master review: total", "safety", "How many master reviews are there?", "safety_query_master_reviews", {"mode": "count"})
    # INCIDENT
    ask("near misses overdue = type Near Miss, unsafe types named", "incident", "How many near miss reports are overdue?", "incident_query_near_misses", {"mode": "count", "statuses": ["OverDue"], "reportTypes": ["Near Miss"]}, words=["Unsafe"])
    ask("near misses in a year = type Near Miss", "incident", "How many near misses were reported in 2024?", "incident_query_near_misses", {"mode": "count", "dateFrom": "2024-01-01", "dateTo": "2024-12-31", "reportTypes": ["Near Miss"]}, words=["Unsafe"])
    ask("unsafe acts are their own count", "incident", "How many unsafe acts were reported in 2024?", "incident_query_near_misses", {"mode": "count", "dateFrom": "2024-01-01", "dateTo": "2024-12-31", "reportTypes": ["Unsafe Act"]})
    ask("whole screen when asked", "incident", "How many reports of all types are on the Near Miss screen?", "incident_query_near_misses", {"mode": "count"})
    ask("incident actions: pending, near-miss scope stated", "incident", "How many incident and near miss actions are pending?", "incident_query_actions", {"mode": "count"}, words=["Unsafe"])
    ask("lessons + fleet: total", "incident", "How many lessons learnt and fleet notifications are there?", "incident_query_lessons_fleet", {"mode": "count"})
    # missing records never a false zero
    for mod, q in (("audit", "How many preparations does vessel Zyzzyva Nonexistent have?"), ("safety", "How many safety meetings has vessel Zyzzyva Nonexistent held?"), ("incident", "How many near misses does vessel Zyzzyva Nonexistent have?")):
        r = chat(CAND, P, q, {"module": mod}, cid("nf"), **AR)
        rec("areas", f"unknown vessel, {mod}: not found, not 0", "LOCAL-PILOT", bool(re.search(r"couldn|could not|not found|no vessel|unable|can.t find|cannot find", r["answer"], re.I)) and not re.search(r"\*\*0\b|\b0 (near|meeting|prep)", r["answer"]), tools=r["tools"], head=r["answer"][:150])
    # module switching with one conversation id, and tools offered per module
    same = cid("sw"); chat(CAND, P, "How many planned inspections are overdue?", {"module": "audit"}, same, **AR)
    r = chat(CAND, P, "how many of those are there?", {"module": "safety"}, same, **AR)
    rec("areas", "module switch: same conversation id, Safety does not inherit the Audit query", "LOCAL-PILOT", not any(t.startswith("audit_") for t in (r["tools"] or [])), tools=r["tools"], head=r["answer"][:150])
    for mod, q, tab, bad in (("audit", "How many near misses are overdue?", "incident", "incident_"), ("audit", "How many open MOCs are there?", "safety", "safety_"), ("safety", "How many inspections have we completed?", "audit", "audit_"), ("incident", "How many safety meetings are recorded?", "safety", "safety_")):
        r = chat(CAND, P, q, {"module": mod}, cid("mx"), **AR)
        rec("areas", f"another module's records asked in {mod}: names the {tab} tab, no figure", "LOCAL-PILOT", tab in r["answer"].lower() and not nums(r["answer"]), tools=r["tools"], head=r["answer"][:170])
    # company B: role right refuses, relayed, and its own data elsewhere
    B = dict(userId="369", tenantDomain="kotc", tuid="sail_trial_b")
    r = chat(CAND, P, "How many near misses are overdue?", {"module": "incident"}, cid("b"), **B)
    rec("areas", "company B without the menu right: refusal relayed, no number", "LOCAL-PILOT", bool(re.search(r"permission|cannot|can't|can\u2019t|not permitted|not allowed|access", r["answer"], re.I)) and 30 not in nums(r["answer"]), tools=r["tools"], head=r["answer"][:150])
    ba = (source(P, "audit_query_inspections", {"mode": "count", "tab": "history", "statuses": ["Done", "Closed"]}, **B) or {}).get("total"); aa = (source(P, "audit_query_inspections", {"mode": "count", "tab": "history", "statuses": ["Done", "Closed"]}, **AR) or {}).get("total")
    r = chat(CAND, P, "How many inspections have we completed in total?", {"module": "audit"}, cid("b2"), **B)
    rec("areas", "company isolation: company B's own inspections", "LOCAL-PILOT", ba is not None and ba != aa and ba in nums(r["answer"]), source=[ba, aa], head=r["answer"][:130])
    # masking: names from the new tools never reach the model
    n = caplen(CAND)
    rs = source(P, "incident_query_actions", {"mode": "list", "limit": 10}, **AR) or {}
    rm = source(P, "safety_query_master_reviews", {"mode": "list", "limit": 10}, **AR) or {}
    rows = (rs.get("rows") or []) + (rm.get("rows") or [])
    vs = sorted({str(x.get("vesselName")) for x in rows if x.get("vesselName")})
    people = sorted({str(v) for x in rows for k, v in x.items() if isinstance(v, str) and k.endswith("Name") and k != "vesselName" and len(v) >= 3})
    resp = sorted({str(x.get("responsibility")) for x in rows if x.get("responsibility")})
    chat(CAND, P, "List the pending incident and near miss actions", {"module": "incident"}, cid("mk"), **AR)
    chat(CAND, P, "List the master reviews", {"module": "safety"}, cid("mk2"), **AR)
    blob = chr(10).join(open(CAPS[CAND]).read().splitlines()[n:])
    leak_v = [v for v in vs if v in blob]; leak_p = [x for x in people if x in blob]; leak_r = [x for x in resp if x in blob]
    rec("areas", "masking on the new tools: vessel and person names from results never reach the model", "LOCAL-PILOT", bool(vs) and not leak_v and not leak_p, source={"vessels": len(vs), "people": len(people), "vesselTokens": len(re.findall(r"\[VESSEL_\d+\]", blob))}, note=f"leaks {leak_v[:3]} {leak_p[:3]}; responsibility text samples {resp[:3]}; responsibility text in model requests {leak_r[:3]}")


# --------------------------------------------------------------------------------------------------------------- MASKING
def masking():
    S = dict(userId="1", tenantDomain=None, tuid=None); X = {"module": "crewing"}
    src = source("crewing-pilot", "crewing_query_assignments", {"mode": "list", "limit": 10}, **S) or {}
    rows = src.get("rows") or []
    people = sorted({str(v) for row in rows for k, v in row.items() if isinstance(v, str) and re.search(r"(crewName|fullName|^name$)", k)})
    vessels = sorted({str(row.get("vesselName")) for row in rows if row.get("vesselName")})
    n = caplen(CAND); c = cid("m"); h = []
    for q in ("List the crew on board", "show more"):
        r = chat(CAND, "crewing-pilot", q, X, c, h, **S); h += [{"role": "user", "content": q}, {"role": "assistant", "content": r["answer"]}]
    bodies = open(CAPS[CAND]).read().splitlines()[n:]
    blob = "\n".join(bodies)
    leak_p = [p for p in people if p in blob]; leak_v = [v for v in vessels if v in blob]
    rec("masking", "Crewing: crew and vessel names from tool results never reach the model", "LOCAL-PILOT", bool(people) and not leak_p and not leak_v and "[PERSON_" in blob, source={"requests": len(bodies), "people": len(people), "vessels": len(vessels), "personTokens": len(re.findall(r"\[PERSON_\d+\]", blob)), "vesselTokens": len(re.findall(r"\[VESSEL_\d+\]", blob))}, note=f"leaks: {leak_p[:3]} {leak_v[:3]}", head=(r["answer"][:120]))
    restored = [p for p in people if p in r["answer"]] + [p for p in people if any(p in x.get("content", "") for x in h)]
    rec("masking", "Crewing: names restored for the user in the answer", "LOCAL-PILOT", bool(restored), note=f"{len(set(restored))} of {len(people)} listed names shown")
    A = dict(userId="devtest-user", tenantDomain="pilot"); V = {"module": "technical", "vesselId": "WKFV", "vesselName": "WK Frontier Pilot"}
    n = caplen(CAND)
    r = chat(CAND, "technical-pilotlocal", "List the overdue work orders", V, cid("mt"), **A)
    blob = "\n".join(open(CAPS[CAND]).read().splitlines()[n:])
    rec("masking", "Technical: fleet vessel name masked in model requests", "LOCAL-PILOT", "WK Frontier Pilot" not in blob and "[VESSEL_" in blob, source={"vesselTokens": len(re.findall(r"\[VESSEL_\d+\]", blob))}, head=r["answer"][:120])


SECTIONS = {"areas": areas, "technical": technical, "crewing": crewing, "date": date, "auth": auth, "masking": masking}
for name in sys.argv[1:] or SECTIONS:
    print(f"======== {name}", flush=True)
    try:
        SECTIONS[name]()
    except Exception as e:
        import traceback
        rec(name, "SECTION CRASHED", "-", False, note=traceback.format_exc()[-500:])
json.dump(RESULTS, open(f"/tmp/final-regression-{'-'.join(sys.argv[1:]) or 'all'}.json", "w"), indent=1, ensure_ascii=False)
print(f"TOTAL pass {sum(1 for r in RESULTS if r['ok'])} fail {sum(1 for r in RESULTS if not r['ok'])}")
