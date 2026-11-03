"""2-Nov-2026 — the SAILERP area tools (audit_query_observations, safety_query_moc, incident_query_incidents) registered with
the query-state guard: FILTER_KEYS, evidence, state_from_result from the echoed `query`, the guard switched on for the
audit-pilot registration and off for Technical, and the execute body (module, conversationId, conversation basis 'new').
Crewing's guard behaviour is pinned by test_query_guard.py and test_crewing_trial.py (unchanged)."""
import importlib
import json
from types import SimpleNamespace

import pytest

from app import mask_memory
from app import query_guard as qg

OBS, MOC, INC = "audit_query_observations", "safety_query_moc", "incident_query_incidents"
PREV_OBS = {"tool": OBS, "filters": {"vessels": ["Gas Mia"], "status": ["open"], "riskLevels": ["high"],
                                     "dueWithin": {"direction": "next", "amount": 30, "unit": "days"}}}
PREV_MOC = {"tool": MOC, "filters": {"vessels": ["Gas Mia"], "stages": ["implementation"]}}
PREV_INC = {"tool": INC, "filters": {"vessels": ["Gas Mia"], "severityMin": 3, "incidentDateWithin": {"direction": "last", "amount": 12, "unit": "months"}}}

BASE_ENV = dict(CHAT_TEMPERATURE="default", IDENTITY_SIGNING_KEY="shared-docs-key", OPENAI_API_KEY="x", DATABASE_URL="postgres://u:p@h/db")
PILOT = {"module": "audit", "modules": ["audit", "safety", "incident"], "env": "dev", "url": "https://pilot.example/b/api/v1",
         "secret": "pilot-secret", "signingKey": "pilot-key", "capabilities": {"queryState": True, "maskNameParts": True}}
CREWING = {"module": "crewing", "env": "dev", "url": "https://dev.example/crewing/api", "secret": "crew-secret", "signingKey": "crew-key"}
TECHNICAL = {"module": "technical", "env": "dev", "url": "https://dev.example/technical/api", "secret": "tech-secret", "signingKey": "tech-key"}
REGISTRY = json.dumps({"audit-pilot": PILOT, "crewing-dev": CREWING, "technical-dev": TECHNICAL})
AREA_TOOLS = [{"name": OBS, "module": "audit"}, {"name": MOC, "module": "safety"}, {"name": INC, "module": "incident"},
              {"name": "sail_resolve_vessel", "module": "shared"}]


def _reload(monkeypatch, **env):
    for k, v in env.items():
        monkeypatch.setenv(k, v)
    from app import config
    config.settings.cache_clear()
    import app.agent as agent
    import app.llm as llm
    importlib.reload(llm)
    return importlib.reload(agent), config.settings()


# ── registration ──────────────────────────────────────────────────────────────────
def test_area_tools_are_query_tools_with_their_filter_keys_and_crewing_is_unchanged():
    assert set(qg.AREA_QUERY_TOOLS) <= set(qg.QUERY_TOOLS) and "sail_resolve_vessel" not in qg.QUERY_TOOLS
    assert qg.QUERY_TOOLS[:8] == qg.CREWING_QUERY_TOOLS                        # Crewing tools first, same order as before
    assert qg.FILTER_KEYS[OBS] == {"status", "riskLevels", "inspectionTypes", "categories", "viqChapter", "includeRecommended", "includeLae",
                                   "excludeDryDock", "vessels", "dueWithin", "closedWithin", "inspectionDateWithin", "inspectionDateFrom", "inspectionDateTo"}
    assert qg.FILTER_KEYS[MOC] == {"statuses", "extensionStatus", "typeOfChange", "initialRisk", "stages", "effectivenessReviewDue", "vessels", "initiatedWithin",
                                   "initiatedFrom", "initiatedTo", "targetWithin", "targetFrom", "targetTo"}
    assert qg.FILTER_KEYS[INC] == {"categories", "statuses", "severityMin", "severityIn", "multiCategory", "vessels", "incidentDateWithin", "incidentDateFrom",
                                   "incidentDateTo", "reportDateWithin"}
    for tool in qg.AREA_QUERY_TOOLS:                                             # every filter key has an evidence rule (or None = value words)
        assert qg.FILTER_KEYS[tool] <= set(qg.EVIDENCE), tool
    # the shared `status` rule still recognises every Crewing rotation word
    for w in ("draft", "proposed", "waiting", "pending", "approved", "all plans"):
        assert qg.evidence("status", ["x"], f"show the {w} ones")
    # presentation keys of the SAILERP tools are never guarded
    assert {"mode", "groupBy", "sort", "limit", "offset"} <= qg.PRESENTATION_KEYS


# ── decisions ──────────────────────────────────────────────────────────────────────
def test_first_area_question_is_new_and_presentation_keys_pass_through():
    d = qg.decide(OBS, {"mode": "list", "limit": 10, "vessels": ["gas mia"], "status": ["open"]}, None, "open observations on Gas Mia?")
    assert d.basis == "new" and not d.violations and d.effective == {"mode": "list", "limit": 10, "vessels": ["gas mia"], "status": ["open"]}


def test_follow_up_keeps_omitted_filters_and_changes_only_what_the_user_said():
    d = qg.decide(OBS, {"mode": "count", "vessels": ["MV Atlantic Pride"], "conversation": {"basis": "previous"}}, PREV_OBS, "same for Atlantic Pride")
    assert not d.violations and d.basis == "previous" and d.effective["vessels"] == ["MV Atlantic Pride"]
    assert d.effective["status"] == ["open"] and d.effective["riskLevels"] == ["high"] and d.effective["dueWithin"]["amount"] == 30
    assert set(d.inherited) == {"status", "riskLevels", "dueWithin"} and "conversation" not in d.effective
    # 'what about the overdue ones' — the status change is evidenced, the rest is kept
    d = qg.decide(OBS, {"mode": "list", "status": ["overdue"], "conversation": {"basis": "previous"}}, PREV_OBS, "what about the overdue ones?")
    assert not d.violations and d.effective["status"] == ["overdue"] and d.effective["vessels"] == ["Gas Mia"]
    # 'show more' changes offset only
    d = qg.decide(OBS, {"mode": "list", "offset": 10, "conversation": {"basis": "previous"}}, PREV_OBS, "show more")
    assert not d.violations and d.effective["offset"] == 10 and d.effective["riskLevels"] == ["high"]


def test_silently_added_or_changed_area_filters_are_refused_with_kept_filters():
    d = qg.decide(OBS, {"mode": "count", "includeLae": True, "conversation": {"basis": "previous"}}, PREV_OBS, "how many are there?")
    assert [v["kind"] for v in d.violations] == ["unrequested_change"] and d.violations[0]["filter"] == "includeLae"
    r = d.refusal()
    assert r["ok"] is False and r["code"] == qg.CODE_CHANGE and r["details"]["keptFilters"]["vessels"] == ["Gas Mia"] and "includeLae" in r["error"]
    d = qg.decide(INC, {"mode": "count", "severityMin": 4, "conversation": {"basis": "previous"}}, PREV_INC, "and how many of them?")
    assert d.violations and d.violations[0]["filter"] == "severityMin" and d.violations[0]["previous"] == 3
    ok = qg.decide(INC, {"mode": "count", "severityMin": 4, "conversation": {"basis": "previous"}}, PREV_INC, "only severity 4 and up")
    assert not ok.violations and ok.effective["severityMin"] == 4 and ok.effective["incidentDateWithin"]["amount"] == 12


def test_explicit_removal_needs_removal_words_and_new_basis_on_a_follow_up_is_refused():
    ok = qg.decide(MOC, {"mode": "count", "conversation": {"basis": "previous", "unset": ["vessels"]}}, PREV_MOC, "and fleet-wide?")
    assert not ok.violations and "vessels" not in ok.effective and ok.effective["stages"] == ["implementation"]
    bad = qg.decide(MOC, {"mode": "count", "conversation": {"basis": "previous", "unset": ["vessels"]}}, PREV_MOC, "how many?")
    assert bad.violations and bad.violations[0]["kind"] == "unrequested_removal"
    d = qg.decide(MOC, {"mode": "count", "stages": ["verification"], "conversation": {"basis": "new"}}, PREV_MOC, "same ones in verification")
    assert d.violations[0]["kind"] == "new_basis_on_follow_up" and d.refusal()["code"] == qg.CODE_BASIS
    fresh = qg.decide(MOC, {"mode": "count", "typeOfChange": ["permanent"], "conversation": {"basis": "new"}}, PREV_MOC,
                      "How many permanent changes were raised this year?")
    assert fresh.basis == "new" and not fresh.violations and fresh.effective == {"mode": "count", "typeOfChange": ["permanent"]}


def test_state_from_result_reads_the_echoed_query_with_resolver_vessels():
    res = {"ok": True, "asOf": "2026-11-02", "total": 4, "query": {"mode": "count", "vessels": [{"id": 12, "name": "Gas Mia", "imo": "9290294"}],
                                                                   "status": ["open"], "riskLevels": [], "viqChapter": None, "includeLae": False}}
    st = qg.state_from_result(OBS, res)
    assert st == {"tool": OBS, "filters": {"vessels": ["Gas Mia"], "status": ["open"], "includeLae": False}}
    assert qg.state_from_result(OBS, {"ok": False, "code": "vessel_not_found"}) is None
    assert qg.same("vessels", [{"name": "Gas Mia"}], ["MV Gas Mia"]) and qg.same("vessels", [{"vesselName": "Gas Mia"}], ["gas mia"])


# ── guard in force: audit-pilot on, Technical off, Crewing as before ───────────────
def test_guard_is_on_for_audit_pilot_tools_and_off_for_technical(monkeypatch):
    agent, s = _reload(monkeypatch, ASSISTANT_MODULE_INSTANCES=REGISTRY, ASSISTANT_QUERY_STATE_GUARD="true", **BASE_ENV)
    pilot, tech, crew = (s.module_instances[k] for k in ("audit-pilot", "technical-dev", "crewing-dev"))
    assert agent.has_guarded_tools(AREA_TOOLS)
    for mod in ("audit", "safety", "incident"):
        assert agent.guard_in_force(pilot, mod, AREA_TOOLS) is True
        assert "conversation.basis 'previous'" in agent.tool_loop_instructions(mod, guard=True) and "no_previous_query" in agent.tool_loop_instructions(mod, guard=True)
    assert agent.guard_in_force(tech, "technical", [{"name": "get_work_order_counts"}]) is False       # Technical: never
    assert agent.guard_in_force(crew, "crewing", [{"name": "crewing_query_documents"}]) is True        # Crewing: as before
    assert agent.guard_in_force({**pilot, "capabilities": {"queryState": False, "maskNameParts": True}}, "audit", AREA_TOOLS) is False
    assert agent.guard_in_force(pilot, "audit", [{"name": "sail_resolve_vessel", "module": "shared"}]) is False   # lookup only: nothing to guard
    # only the area query tools of the widget module get the `conversation` parameter; the resolver does not
    ts = agent.ManifestToolset(AREA_TOOLS, conversation_param=True, ui_module="safety")
    by_name = {d.name: d for d in ts._defs}
    assert set(by_name) == {"search_module_docs", MOC, "sail_resolve_vessel"}
    assert "conversation" in by_name[MOC].parameters_json_schema["properties"] and "conversation" not in by_name["sail_resolve_vessel"].parameters_json_schema.get("properties", {})
    # with the guard off nothing is added
    _reload(monkeypatch, ASSISTANT_MODULE_INSTANCES=REGISTRY, ASSISTANT_QUERY_STATE_GUARD="false", **BASE_ENV)
    assert agent.guard_in_force(pilot, "audit", AREA_TOOLS) is False


# ── execute body and the guard on the live path (execute stubbed) ──────────────────
@pytest.mark.asyncio
async def test_area_tool_call_sends_module_conversation_id_and_basis_new_and_keeps_state_per_module(monkeypatch):
    agent, s = _reload(monkeypatch, ASSISTANT_MODULE_INSTANCES=REGISTRY, ASSISTANT_QUERY_STATE_GUARD="true", **BASE_ENV)
    mask_memory.clear()
    sent: list[dict] = []

    async def fake_execute(instance, tool, args, token, rid, module=None, conversation_id=None):
        sent.append({"tool": tool, "args": args, "module": module, "conversationId": conversation_id})
        return {"ok": True, "data": {"ok": True, "mode": "count", "total": 3, "asOf": "2026-11-02",
                                     "query": {"mode": "count", "vessels": [{"id": 1, "name": "Gas Mia"}], "status": ["open"]}}}

    monkeypatch.setattr(agent, "execute_module_tool", fake_execute)
    pilot = s.module_instances["audit-pilot"]
    key = ("audit-pilot", "acme", "u1", "c1", "audit")
    ts = agent.ManifestToolset(AREA_TOOLS, conversation_param=True, ui_module="audit")

    def deps(user_message):
        return agent.Deps(masker=None, ui_module="audit", identity_token="T", started_at=0.0, instance=pilot, conv_key=key,
                          conversation_id="c1", user_message=user_message, query_guard=True)

    r = await ts.call_tool(OBS, {"mode": "count", "vessels": ["Gas Mia"], "status": ["open"], "conversation": {"basis": "new"}},
                           SimpleNamespace(deps=deps("open observations on Gas Mia?")), None)
    assert sent[-1]["module"] == "audit" and sent[-1]["conversationId"] == "c1" and sent[-1]["tool"] == OBS
    assert sent[-1]["args"] == {"mode": "count", "vessels": ["Gas Mia"], "status": ["open"], "conversation": {"basis": "new"}}
    assert r["conversationBasis"] == "new" and mask_memory.get_query_state_for(key) == {"tool": OBS, "filters": {"vessels": ["Gas Mia"], "status": ["open"]}}
    # follow-up: the complete validated set goes to the backend as a fresh query (basis 'new'); the assistant reports what was kept
    r = await ts.call_tool(OBS, {"mode": "list", "conversation": {"basis": "previous"}}, SimpleNamespace(deps=deps("show them as a list")), None)
    assert sent[-1]["args"] == {"mode": "list", "vessels": ["Gas Mia"], "status": ["open"], "conversation": {"basis": "new"}}
    assert r["conversationBasis"] == "previous" and set(r["filtersKeptFromPreviousQuestion"]) == {"vessels", "status"}
    # an unrequested added filter is refused by the assistant; the backend is never called
    n = len(sent)
    r = await ts.call_tool(OBS, {"mode": "count", "includeLae": True, "conversation": {"basis": "previous"}}, SimpleNamespace(deps=deps("how many?")), None)
    assert r["ok"] is False and r["code"] == qg.CODE_CHANGE and len(sent) == n
    # the same conversation id under the Safety widget starts with no previous query
    assert mask_memory.get_query_state_for(("audit-pilot", "acme", "u1", "c1", "safety")) is None


@pytest.mark.asyncio
async def test_crewing_and_technical_calls_now_carry_conversation_id_but_no_conversation_basis(monkeypatch):
    """Before 2-Nov-2026 the Crewing execute body was {tool, args, requestId} only; conversationId and module are now sent for
    every module (both backends read only tool/args/requestId — additive). `conversation` is still stripped for Crewing."""
    agent, s = _reload(monkeypatch, ASSISTANT_MODULE_INSTANCES=REGISTRY, ASSISTANT_QUERY_STATE_GUARD="true", **BASE_ENV)
    mask_memory.clear()
    sent: list[dict] = []

    async def fake_execute(instance, tool, args, token, rid, module=None, conversation_id=None):
        sent.append({"tool": tool, "args": args, "module": module, "conversationId": conversation_id})
        return {"ok": True, "data": {"ok": True, "mode": "count", "total": 1, "query": {"vessels": [{"vesselName": "Gas Mia"}]}}}

    monkeypatch.setattr(agent, "execute_module_tool", fake_execute)
    crew = agent.ManifestToolset([{"name": "crewing_query_documents"}], conversation_param=True, ui_module="crewing")
    d = agent.Deps(masker=None, ui_module="crewing", identity_token="T", started_at=0.0, instance=s.module_instances["crewing-dev"],
                   conv_key=("crewing-dev", "acme", "u1", "c9", "crewing"), conversation_id="c9", user_message="documents on Gas Mia", query_guard=True)
    await crew.call_tool("crewing_query_documents", {"mode": "count", "vessels": ["Gas Mia"], "conversation": {"basis": "new"}}, SimpleNamespace(deps=d), None)
    assert sent[-1] == {"tool": "crewing_query_documents", "args": {"mode": "count", "vessels": ["Gas Mia"]}, "module": "crewing", "conversationId": "c9"}
    tech = agent.ManifestToolset([{"name": "get_work_order_counts"}], ui_module="technical")
    d = agent.Deps(masker=None, ui_module="technical", identity_token="T", started_at=0.0, instance=s.module_instances["technical-dev"], conversation_id="c3")
    await tech.call_tool("get_work_order_counts", {"vesselId": "v"}, SimpleNamespace(deps=d), None)
    assert sent[-1] == {"tool": "get_work_order_counts", "args": {"vesselId": "v"}, "module": "technical", "conversationId": "c3"}


@pytest.mark.asyncio
async def test_execute_module_tool_body_has_conversation_id(monkeypatch):
    import httpx
    agent, s = _reload(monkeypatch, ASSISTANT_MODULE_INSTANCES=REGISTRY, **BASE_ENV)
    seen: list[dict] = []

    def handler(req: httpx.Request) -> httpx.Response:
        seen.append(json.loads(req.content))
        return httpx.Response(200, json={"ok": True, "data": {}})

    monkeypatch.setattr(agent.llm, "module_client", lambda: httpx.AsyncClient(transport=httpx.MockTransport(handler), follow_redirects=False))
    await agent.execute_module_tool(s.module_instances["audit-pilot"], OBS, {"mode": "count"}, "TOKEN", "r1", module="audit", conversation_id="c1")
    assert seen[-1] == {"tool": OBS, "args": {"mode": "count"}, "requestId": "r1", "module": "audit", "conversationId": "c1"}
    await agent.execute_module_tool(s.module_instances["audit-pilot"], OBS, {}, "TOKEN", "r2")
    assert "conversationId" not in seen[-1] and "module" not in seen[-1]


def test_round2_keys_have_evidence_rules():
    # 3-Nov-2026: a follow-up that adds these filters is judged on the user's words, like every other filter
    assert qg.evidence("extensionStatus", ["pending"], "which of those have an extension pending?")
    assert not qg.evidence("extensionStatus", ["pending"], "only vessel Alpha")
    assert qg.evidence("multiCategory", True, "which belong to more than one category?")
    assert not qg.evidence("multiCategory", True, "only vessel Alpha")


def test_other_module_tab_refuses_only_foreign_records():
    from app.query_guard import other_module_tab as o
    assert o("audit_query_observations", "How many near misses are overdue?") == "Incident"
    assert o("audit_query_actions", "How many near-miss reports on Desert Rose?") == "Incident"
    assert o("audit_query_inspections", "How many open MOCs are there?") == "Safety"
    assert o("safety_query_moc", "How many incidents last year?") == "Incident"
    assert o("safety_query_risk_assessments", "How many inspections have we completed?") == "Audit"
    assert o("incident_query_near_misses", "How many safety meetings are recorded?") == "Safety"
    # its own records, follow-ups, both named, a word inside another word, tools outside the areas: no objection
    assert o("audit_query_observations", "How many observations are overdue?") is None
    assert o("incident_query_near_misses", "How many near misses are overdue?") is None
    assert o("incident_query_actions", "pending incident actions on Gas Mia") is None
    assert o("audit_query_actions", "list them") is None
    assert o("audit_query_inspections", "inspections on vessels that also had an incident") is None
    assert o("audit_query_inspections", "How many inspections at Smsport?") is None
    assert o("crewing_query_assignments", "How many near misses?") is None
    assert o("audit_query_actions", "") is None


def test_near_miss_report_type_only_when_the_user_mentions_a_type():
    from app.query_guard import without_unasked_near_miss_type as w
    T = "incident_query_near_misses"; A = {"mode": "count", "reportTypes": ["Near Miss"]}
    assert w(T, A, "How many near misses in 2024?") == {"mode": "count"}
    assert w(T, A, "How many near misses of report type Near Miss?") == A
    assert w(T, {"reportTypes": ["Unsafe Act"]}, "unsafe acts") == {"reportTypes": ["Unsafe Act"]}
    assert w("incident_query_actions", A, "near misses") == A

