"""28-Oct-2026 Astra round 3 (Crewing live-data PILOT TRIAL): server-held query state — follow-ups retain filters,
unrequested changes are refused, explicit removals need removal words, a new question replaces the state."""
from app import mask_memory, query_guard as qg

A = "crewing_query_assignments"
D = "crewing_query_documents"
PREV_DOCS = {"tool": D, "filters": {"vessels": ["MV Beta Ocean"], "rankGroups": ["engineers"], "crewOnBoard": True,
                                   "expiryState": "not_expired", "expiryWithin": {"direction": "next", "amount": 60, "unit": "days"}}}
PREV_ASSIGN = {"tool": A, "filters": {"vessels": ["MV Beta Ocean"], "rankGroups": ["engineers"]}}


def test_first_question_has_no_state_to_inherit():
    d = qg.decide(D, {"mode": "count", "vessels": ["beta ocean"]}, None, "How many certificates on MV Beta Ocean expire soon?")
    assert d.basis == "new" and not d.violations and d.effective == {"mode": "count", "vessels": ["beta ocean"]}


def test_follow_up_retains_every_omitted_filter_and_changes_only_the_vessel():
    d = qg.decide(D, {"mode": "count", "vessels": ["MV Alpha Star"], "conversation": {"basis": "previous"}}, PREV_DOCS, "same for MV Alpha Star")
    assert not d.violations and d.basis == "previous"
    assert d.effective["vessels"] == ["MV Alpha Star"]
    assert d.effective["rankGroups"] == ["engineers"] and d.effective["crewOnBoard"] is True
    assert d.effective["expiryWithin"]["amount"] == 60 and d.effective["expiryState"] == "not_expired"
    assert set(d.inherited) == {"rankGroups", "crewOnBoard", "expiryState", "expiryWithin"}
    assert "conversation" not in d.effective


def test_show_more_and_list_change_only_presentation_keys():
    for text, args in [("show more", {"mode": "list", "offset": 10, "conversation": {"basis": "previous"}}),
                       ("show them as a list", {"mode": "list", "conversation": {"basis": "previous"}})]:
        d = qg.decide(D, args, PREV_DOCS, text)
        assert not d.violations and d.effective["vessels"] == ["MV Beta Ocean"] and d.effective["rankGroups"] == ["engineers"]
        assert d.effective.get("offset") == args.get("offset") and d.effective["mode"] == "list"


def test_silently_added_primary_only_is_refused():
    d = qg.decide(A, {"mode": "count", "vessels": ["MV Beta Ocean"], "rankGroups": ["engineers"], "crewStatus": ["primary"],
                      "conversation": {"basis": "previous"}}, PREV_ASSIGN, "how many of them are there?")
    assert [v["kind"] for v in d.violations] == ["unrequested_change"] and d.violations[0]["filter"] == "crewStatus"
    r = d.refusal()
    assert r["ok"] is False and r["code"] == qg.CODE_CHANGE and "crewStatus" in r["error"] and r["details"]["keptFilters"]["vessels"] == ["MV Beta Ocean"]


def test_primary_only_is_allowed_when_the_user_asked_for_it():
    d = qg.decide(A, {"mode": "count", "crewStatus": ["primary"], "conversation": {"basis": "previous"}}, PREV_ASSIGN,
                  "only the primary assignments please")
    assert not d.violations and d.effective["crewStatus"] == ["primary"] and d.effective["vessels"] == ["MV Beta Ocean"]


def test_silently_dropped_condition_is_kept_and_a_silent_vessel_switch_is_refused():
    # model resends a reduced set without the rank group → the server keeps it
    d = qg.decide(D, {"mode": "count", "vessels": ["MV Beta Ocean"], "conversation": {"basis": "previous"}}, PREV_DOCS, "and the expired ones?")
    assert not d.violations and d.effective["rankGroups"] == ["engineers"]
    # model swaps the vessel although the user did not name one
    d = qg.decide(D, {"mode": "count", "vessels": ["MV Alpha Star"], "conversation": {"basis": "previous"}}, PREV_DOCS, "and the expired ones?")
    assert d.violations and d.violations[0]["filter"] == "vessels" and d.violations[0]["previous"] == ["MV Beta Ocean"]


def test_explicit_removal_needs_removal_words():
    ok = qg.decide(D, {"mode": "count", "conversation": {"basis": "previous", "unset": ["vessels"]}}, PREV_DOCS, "and across all vessels?")
    assert not ok.violations and "vessels" not in ok.effective and ok.effective["rankGroups"] == ["engineers"]
    bad = qg.decide(D, {"mode": "count", "conversation": {"basis": "previous", "unset": ["vessels"]}}, PREV_DOCS, "how many are there?")
    assert bad.violations and bad.violations[0]["kind"] == "unrequested_removal"


def test_new_question_replaces_the_state_but_a_follow_up_may_not_claim_new():
    d = qg.decide(A, {"mode": "count", "vessels": ["MV Gamma Bay"], "conversation": {"basis": "new"}}, PREV_DOCS,
                  "How many crew are on board MV Gamma Bay?")
    assert d.basis == "new" and not d.violations and d.effective == {"mode": "count", "vessels": ["MV Gamma Bay"]}
    d = qg.decide(A, {"mode": "count", "vessels": ["MV Gamma Bay"], "conversation": {"basis": "new"}}, PREV_DOCS, "same for MV Gamma Bay")
    assert d.violations and d.violations[0]["kind"] == "new_basis_on_follow_up" and d.refusal()["code"] == qg.CODE_BASIS


def test_missing_basis_is_inferred_from_the_message():
    follow = qg.decide(D, {"mode": "list"}, PREV_DOCS, "show them as a list")
    assert follow.basis == "previous" and follow.effective["vessels"] == ["MV Beta Ocean"]
    fresh = qg.decide(D, {"mode": "count", "expiryState": "expired"}, PREV_DOCS, "How many expired licences are there in the fleet?")
    assert fresh.basis == "new" and fresh.effective == {"mode": "count", "expiryState": "expired"}


def test_cross_tool_follow_up_inherits_only_shared_filters():
    d = qg.decide(A, {"mode": "count", "conversation": {"basis": "previous"}}, PREV_DOCS, "and how many of them are on board in total?")
    assert not d.violations
    assert d.effective["vessels"] == ["MV Beta Ocean"] and d.effective["rankGroups"] == ["engineers"]
    assert "expiryWithin" not in d.effective and "crewOnBoard" not in d.effective


def test_same_value_in_a_different_spelling_is_not_a_change():
    d = qg.decide(D, {"vessels": ["beta ocean"], "rankGroups": ["engineers"], "conversation": {"basis": "previous"}}, PREV_DOCS, "show more")
    assert not d.violations


def test_state_from_result_uses_the_validated_query_echo():
    res = {"ok": True, "area": "documents", "query": {"mode": "count", "unit": "people", "vessels": [{"vesselName": "MV Beta Ocean"}],
                                                      "rankGroups": ["engineers"], "expiryState": "not_expired", "limit": 10, "offset": 0}}
    st = qg.state_from_result(D, res)
    assert st == {"tool": D, "filters": {"vessels": ["MV Beta Ocean"], "rankGroups": ["engineers"], "expiryState": "not_expired"}}
    assert qg.state_from_result(D, {"ok": False, "code": "vessel_not_found"}) is None


def test_conversation_param_is_added_to_query_tools_only():
    t = qg.with_conversation_param({"name": D, "parameters": {"type": "object", "properties": {"mode": {}}}})
    assert "conversation" in t["parameters"]["properties"] and t["parameters"]["properties"]["mode"] == {}
    assert "basis" in t["parameters"]["properties"]["conversation"]["properties"]


def test_query_state_is_bound_to_the_conversation_key_and_forgotten_on_a_miss():
    mask_memory.clear()
    key = ("crewing-pilot", "trial-a.local", "1", "conv-1")
    mask_memory.remember(mask_memory.Masker(), *key)
    mask_memory.set_query_state(*key, PREV_DOCS)
    assert mask_memory.get_query_state(*key) == PREV_DOCS
    assert mask_memory.get_query_state("crewing-pilot", "trial-a.local", "2", "conv-1") is None
    mask_memory.clear()                                                   # restart
    assert mask_memory.get_query_state(*key) is None
