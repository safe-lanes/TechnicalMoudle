"""Routing gates (§4.2) — pure-function parity with the Node route(); redirect table (§X)."""
from app.db import Hit
from app.retrieval import known_redirect, manual_of, route, section_of


def h(module: str, d: float, file: str = "X - Manual.pdf") -> Hit:
    return Hit(meta={"module": module, "file": file, "breadcrumb": f"{file} > Section A > Sub"}, text="t", distance=d, module=module)


def test_not_documented_when_top_hit_beyond_floor():
    r = route([h("technical", 1.30), h("audit", 1.40)])
    assert r.gate == "not_documented" and r.confidence == 0.0


def test_empty_hits_not_documented():
    assert route([]).gate == "not_documented"


def test_clarify_when_best_modules_within_margin():
    r = route([h("technical", 0.80), h("safety", 0.84), h("audit", 1.10)])
    assert r.gate == "clarify" and r.candidates[:2] == ["Technical", "Safety"] and abs(r.confidence - 0.04) < 1e-9


def test_answer_picks_top_module_hits_only_and_caps_at_answer_chunks():
    hits = [h("technical", 0.70), h("technical", 0.75), h("audit", 1.00), h("technical", 0.90), h("technical", 1.20)]
    r = route(hits)
    assert r.gate == "answer" and r.module == "technical"
    assert [x.distance for x in r.hits] == [0.70, 0.75, 0.90]  # 1.20 is beyond the floor
    assert abs(r.confidence - 0.30) < 1e-9


def test_single_module_margin_is_one():
    r = route([h("crewing", 0.9), h("crewing", 1.0)])
    assert r.gate == "answer" and r.confidence == 1.0


def test_manual_and_section_helpers():
    meta = {"file": "Incident - Near Miss.pdf", "breadcrumb": "Incident - Near Miss > Reporting > Steps"}
    assert manual_of(meta) == "Incident - Near Miss"
    assert section_of(meta) == "Reporting > Steps"
    assert section_of({"breadcrumb": "Only"}) == "Only"
    assert section_of({}) == "Document"


# ── known redirects (owner decisions 11-Sep) ──
def test_purchasing_redirect():
    assert known_redirect("how do I raise a purchase order for spares").label == "Purchasing"
    assert known_redirect("where is the requisition list").label == "Purchasing"
    assert known_redirect("how do I open shipskart").label == "Purchasing"


def test_noon_report_redirect_including_hyphen_and_plural():
    assert known_redirect("how do I submit the noon report").label == "Noon Report"
    assert known_redirect("noon-reports history").label == "Noon Report"


def test_no_redirect_for_ordinary_questions():
    assert known_redirect("how do I create a work order") is None
    assert known_redirect("how do I record a spare received on board") is None
    assert known_redirect("what happens at noon during the audit") is None
