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


def test_run1_fixes_cross_tool_on_board_scope_and_both_statuses_is_no_filter():
    # R02.4 (run 1): 'how many certificates do they hold' after an assignments question — crewOnBoard true is the
    # inherited scope, not an unrequested change
    d = qg.decide(D, {"mode": "count", "crewOnBoard": True, "expiryWithin": {"direction": "next", "amount": 60, "unit": "days"},
                      "conversation": {"basis": "previous"}}, PREV_ASSIGN, "how many certificates do they hold that expire in the next 60 days?")
    assert not d.violations and d.effective["crewOnBoard"] is True and d.effective["vessels"] == ["MV Beta Ocean"]
    # R04.3 (run 1): crewStatus ['primary','secondary'] on a new question is no filter and is not forwarded
    d = qg.decide(A, {"mode": "list", "vessels": ["MV Alpha Trader"], "crewStatus": ["primary", "secondary"], "conversation": {"basis": "new"}},
                  PREV_DOCS, "List all crew on board MV Alpha Trader")
    assert "crewStatus" not in d.effective and not d.violations
    # but primary-only on a follow-up without evidence is still refused
    d = qg.decide(A, {"mode": "list", "crewStatus": ["primary"], "conversation": {"basis": "previous"}}, PREV_ASSIGN, "list them")
    assert d.violations and d.violations[0]["filter"] == "crewStatus"


def test_run3_fixes_cross_tool_translation_consistency_and_placeholder_ids():
    # R01.3 (run 3): documents → assignments follow-up carries the document condition as hasDocument (not a change)
    hd = {"expiryState": "not_expired", "expiryWithin": {"direction": "next", "amount": 60, "unit": "days"}}
    d = qg.decide(A, {"mode": "list", "vessels": ["MV Alpha Star"], "rankGroups": ["engineers"], "hasDocument": hd,
                      "conversation": {"basis": "previous"}}, {"tool": D, "filters": {"vessels": ["MV Alpha Star"], "rankGroups": ["engineers"], **hd}},
                  "show them as a list")
    assert not d.violations and d.effective["hasDocument"] == hd
    # and if the model omits it, it is retained in translated form
    d = qg.decide(A, {"mode": "list", "conversation": {"basis": "previous"}}, {"tool": D, "filters": {"vessels": ["MV Alpha Star"], **hd}}, "show them as a list")
    assert d.effective["hasDocument"] == hd and d.effective["vessels"] == ["MV Alpha Star"]
    # assignments(hasDocument) → documents carries the condition back up + on-board scope
    d = qg.decide(D, {"mode": "count", "conversation": {"basis": "previous"}}, {"tool": A, "filters": {"vessels": ["MV Beta Ocean"], "hasDocument": hd, "crewStatus": ["primary"]}},
                  "how many certificates is that?")
    assert d.effective["expiryWithin"]["amount"] == 60 and d.effective["crewOnBoard"] is True and d.not_carried == ["crewStatus"]
    # R01.4 (run 3): 'the expired ones' drops the future window instead of returning an impossible zero
    d = qg.decide(D, {"mode": "count", "expiryState": "expired", "conversation": {"basis": "previous"}}, PREV_DOCS, "and the expired ones?")
    assert not d.violations and d.effective["expiryState"] == "expired" and "expiryWithin" not in d.effective
    # R02.4 (run 3): a placeholder crewIds value is refused, never run
    d = qg.decide(D, {"mode": "count", "crewIds": ["<primary-engineer-ids>"], "conversation": {"basis": "previous"}}, PREV_ASSIGN, "their certificates")
    assert d.violations[0]["kind"] == "invalid_crew_ids" and d.refusal()["code"] == qg.CODE_IDS
    ok = qg.decide(D, {"mode": "count", "crewIds": ["4b6c2d1e-1111-4222-8333-444455556666"], "conversation": {"basis": "previous"}}, PREV_ASSIGN, "their certificates")
    assert not ok.violations


# ── 28-Oct-2026 review (Astra): pagination from server totals; accurate clarification wording ──
def test_paging_line_uses_server_totals_only():
    first = {"ok": True, "mode": "list", "unit": "people", "total": 8, "returned": 5, "offset": 0, "nextOffset": 5}
    second = {"ok": True, "mode": "list", "unit": "people", "total": 8, "returned": 3, "offset": 5, "nextOffset": None}
    assert qg.paging_line(qg.paging_summary(first)) == "Showing 5 of 8 matching crew members (records 1-5; 3 more available).".replace("-", "–")
    assert qg.paging_line(qg.paging_summary(second)) == "Showing 3 of 8 matching crew members (records 6-8; end of list).".replace("-", "–")
    assert qg.paging_line(qg.paging_summary({"ok": True, "mode": "list", "unit": "documents", "total": 2, "returned": 2, "offset": 0, "nextOffset": None})) == "Showing all 2 matching documents."
    assert qg.paging_line(qg.paging_summary({"ok": True, "mode": "list", "unit": "documents", "total": 0, "returned": 0, "offset": 0, "nextOffset": None})) == "Showing 0 matching documents."
    assert qg.paging_summary({"ok": True, "mode": "count", "total": 8}) is None          # count/group answers get no line
    assert qg.paging_summary({"ok": False, "code": "not_allowed"}) is None


def test_refusal_says_the_filter_was_not_part_of_the_previous_question():
    d = qg.decide(A, {"mode": "count", "crewStatus": ["primary"], "conversation": {"basis": "previous"}}, PREV_ASSIGN, "same for MV Beta Ocean")
    r = d.refusal()
    assert r["code"] == qg.CODE_CHANGE
    assert 'crewStatus = ["primary"] was NOT part of the previous question' in r["error"]
    assert "Never say that it was part of the previous question" in r["error"]
    assert r["details"]["keptFilters"] == PREV_ASSIGN["filters"] and "crewStatus" not in r["details"]["keptFilters"]
    assert r["details"]["notApplied"][0]["filter"] == "crewStatus"
    # a changed value is described as a change from the previous value
    d = qg.decide(D, {"mode": "count", "vessels": ["MV Alpha Star"], "conversation": {"basis": "previous"}}, PREV_DOCS, "and the expired ones?")
    assert "would change from" in d.refusal()["error"] and "MV Beta Ocean" in d.refusal()["error"]


def test_refusal_text_keeps_non_ascii_values_maskable():
    # security review 28-Oct: json.dumps would escape non-ASCII (backslash-u00f1), so the masker could not find a registered name
    n = chr(241)
    prev = {"tool": A, "filters": {"vessels": ["MV Ni" + n + "o Star"]}}
    d = qg.decide(A, {"mode": "count", "vessels": ["MV Peque" + n + "a"], "conversation": {"basis": "previous"}}, prev, "and the other one?")
    err = d.refusal()["error"]
    assert ("Ni" + n + "o") in err and ("Peque" + n + "a") in err and (chr(92) + "u00f1") not in err


def test_primary_only_without_evidence_is_refused_even_on_a_first_question():
    # review probe V01 run 1: the model added crewStatus ['primary'] to "How many engineers are on board MV Beta Ocean?"
    d = qg.decide(A, {"mode": "count", "vessels": ["MV Beta Ocean"], "rankGroups": ["engineers"], "crewStatus": ["primary"],
                      "conversation": {"basis": "new"}}, None, "How many engineers are on board MV Beta Ocean?")
    assert d.violations and d.violations[0]["filter"] == "crewStatus" and d.violations[0].get("previous") is None
    assert "was NOT part of the previous question" not in d.refusal()["error"] and "not asked for" in d.refusal()["error"].lower()
    ok = qg.decide(A, {"mode": "count", "vessels": ["MV Beta Ocean"], "crewStatus": ["primary"], "conversation": {"basis": "new"}}, None,
                   "How many primary crew are on MV Beta Ocean?")
    assert not ok.violations


def test_breakdown_line_from_server_counts_only():
    # 29-Oct-2026 (Sahil A4): the expired / upcoming split is built from the server's breakdown and window, never from the model
    docs = {"ok": True, "mode": "count", "asOf": "2026-11-01", "breakdown": {"expired": {"documents": 3, "people": 3}, "upcoming": {"documents": 15, "people": 12}},
            "expiryWindow": {"from": "2026-11-01", "to": "2026-12-31", "state": "expired_or_expiring"}}
    assert qg.breakdown_line(docs) == "Of these, 3 documents (3 people) already expired as of 2026-11-01; 15 documents (12 people) expire by 2026-12-31."
    people = {"ok": True, "asOf": "2026-11-01", "breakdown": {"expired": {"people": 1}, "upcoming": {"people": 7}}, "expiryWindow": {"to": "2026-12-01"}}
    assert qg.breakdown_line(people) == "Of these, 1 person already expired as of 2026-11-01; 7 people expire by 2026-12-01."
    assert qg.breakdown_line({"ok": True, "mode": "count", "total": 8}) is None            # no expiry condition → no line
    assert qg.breakdown_line({"ok": False, "code": "not_allowed", "breakdown": {}}) is None  # refusals never get a line
    assert qg.breakdown_line({"ok": True, "breakdown": {"expired": {"documents": 0, "people": 0}, "upcoming": {"documents": 0, "people": 0}}, "asOf": "2026-11-01"})         == "Of these, 0 documents (0 people) already expired as of 2026-11-01; 0 documents (0 people) have not expired yet."


def test_rank_config_line_reports_unclassified_from_server_only():
    # 29-Oct-2026 (Sahil A5): unclassified ranks come from the server's rankConfig report, never from the model
    ob = {"ok": True, "rankConfig": {"source": "x", "unclassifiedOnBoard": {"assignments": 2, "people": 2, "ranks": ["Gas Engineer", "Deck Cadet"]}}}
    assert qg.rank_config_line(ob) == "Not counted in any rank group: 2 crew on board whose ranks have no category in Rank Administration (Deck Cadet, Gas Engineer)."
    one = {"ok": True, "rankConfig": {"unclassifiedInResult": {"documents": 1, "people": 1, "ranks": ["Wiper"]}}}
    assert qg.rank_config_line(one) == "Not counted in any rank group: 1 crew in this result whose rank has no category in Rank Administration (Wiper)."
    assert qg.rank_config_line({"ok": True, "rankConfig": {"unclassifiedOnBoard": {"people": 0, "ranks": []}}}) is None   # nothing unclassified → no line
    assert qg.rank_config_line({"ok": True, "totals": {"people": 3}}) is None                                                 # no groups involved
    assert qg.rank_config_line({"ok": False, "code": "not_allowed", "rankConfig": {"unclassifiedOnBoard": {"people": 2}}}) is None


def test_licence_or_certificate_means_both_kinds():
    # Sahil A2 (29-Oct-2026): "licence or certificate" = both kinds; licence-only stands when the user names licences / CoCs alone
    d = qg.decide(D, {"mode": "count", "documentTypes": ["licence"], "expiryWithin": {"direction": "next", "amount": 30, "unit": "days"}}, None,
                  "How many crew members have a licence or certificate expiring within 30 days?")
    assert "documentTypes" not in d.effective and d.effective["expiryWithin"]["amount"] == 30
    d = qg.decide(D, {"mode": "count", "documentTypes": ["licence"]}, None, "How many licences expire in 30 days?")
    assert d.effective["documentTypes"] == ["licence"]
    d = qg.decide(D, {"mode": "count", "documentTypes": ["licence"]}, None, "Which certificates of competency expire soon?")
    assert d.effective["documentTypes"] == ["licence"]                       # CoC = a licence
    d = qg.decide(D, {"mode": "count", "documentTypes": ["training"]}, None, "training certificates expiring in 60 days")
    assert d.effective["documentTypes"] == ["training"]                      # only the licence-only narrowing is corrected
    a = qg.decide("crewing_query_assignments", {"mode": "count", "hasDocument": {"documentTypes": ["licence"], "expiryWithin": {"direction": "next", "amount": 30, "unit": "days"}}}, None,
                  "crew on board with a licence or certificate expiring within 30 days")
    assert "documentTypes" not in a.effective["hasDocument"]
