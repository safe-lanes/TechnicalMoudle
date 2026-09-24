"""Masker unit behaviour — port of masking-suite.mjs's unit section, plus the
bracket-tolerance regression found by the 11-Sep Pydantic AI spike."""
import json
import re

import pytest

from app.masking import Masker


def test_vessel_person_imo_uuid_all_masked_and_round_trip():
    m = Masker()
    m.register("Gas Mia", "VESSEL")
    m.register("Rahul Singh", "PERSON")
    out = m.mask_text("The gas valve on Gas Mia was checked by Rahul Singh; IMO 9290294, id 743feb08-841a-11ed-aa7c-7003bca91a86.")
    assert not re.search(r"Gas Mia|Rahul Singh|9290294|743feb08", out), out
    assert "gas valve" in out  # common word preserved (whole-name, boundary-aware)
    back = m.unmask_text(out)
    assert "Gas Mia" in back and "Rahul Singh" in back and "9290294" in back and "743feb08-841a-11ed-aa7c-7003bca91a86" in back


def test_repeated_name_same_stable_token():
    m = Masker()
    m.register("Gas Mia", "VESSEL")
    rep = m.mask_text("Gas Mia again, and Gas Mia once more")
    assert rep.count("[VESSEL_1]") == 2
    assert m.unmask_text(rep) == "Gas Mia again, and Gas Mia once more"


def test_unknown_token_stays_visible_and_is_recorded():
    m = Masker()
    assert m.unmask_text("see [VESSEL_9]") == "see [VESSEL_9]"
    assert m.warnings and "VESSEL_9" in m.warnings[0]


def test_bare_name_with_vessel_siblings_is_learned_but_lookalike_title_is_not():
    m = Masker()
    m.learn_from_json({"vessels": [{"id": "v1", "name": "Gas Mia", "code": "GM", "imoNumber": "9290294"},
                                   {"id": "v2", "name": "ATLANTIC PRIDE", "imoNumber": None}]})
    m.learn_from_json({"excerpts": [{"manual": "X", "section": "Save as Draft", "title": "Save as Draft on Work-Order Completion"}]})
    masked = m.mask_text(json.dumps({"vessels": ["Gas Mia", "ATLANTIC PRIDE"], "note": "Save as Draft is a feature, not a vessel"}))
    assert not re.search(r"Gas Mia|ATLANTIC PRIDE", masked), masked
    assert "Save as Draft is a feature" in masked


def test_fail_closed_seam_raises():
    with pytest.raises(RuntimeError):
        Masker().mask_text("__MASK_FAIL_TEST__ x")


# ── Regression: models drop the brackets (spike 11-Sep-2026) ───────────────────────
@pytest.mark.parametrize("shape", ["VESSEL_1", "**VESSEL_1**", "[VESSEL_1]", "vessel VESSEL_1 timed out", "(VESSEL_1)"])
def test_bare_token_without_brackets_is_still_restored(shape):
    m = Masker()
    m.register("Gas Mia", "VESSEL")
    m.mask_text("Gas Mia")  # allocate [VESSEL_1]
    assert "Gas Mia" in m.unmask_text(shape)
    assert not m.warnings


def test_bare_token_inside_tool_args_is_restored_before_execution():
    m = Masker()
    m.register("Gas Mia", "VESSEL")
    m.mask_text("Gas Mia")
    args = m.unmask_json({"vessel_name": "VESSEL_1", "nested": {"x": ["[VESSEL_1]", 5]}})
    assert args == {"vessel_name": "Gas Mia", "nested": {"x": ["Gas Mia", 5]}}


def test_bare_token_matching_does_not_touch_ordinary_words():
    m = Masker()
    assert m.unmask_text("VESSELS_1 and ID_CARD and vessel_12x") == "VESSELS_1 and ID_CARD and vessel_12x"
    assert not m.warnings


def test_mask_json_deep_and_unmask_json_deep_round_trip():
    m = Masker()
    m.register("Gas Mia", "VESSEL")
    data = {"a": ["Gas Mia", {"b": "IMO 9290294"}], "n": 3}
    masked = m.mask_json(data)
    assert masked["a"][0] == "[VESSEL_1]" and "[IMO_1]" in masked["a"][1]["b"] and masked["n"] == 3
    assert m.unmask_json(masked) == data
