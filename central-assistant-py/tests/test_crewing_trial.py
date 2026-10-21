"""21-Oct-2026 Crewing live-data PILOT TRIAL: module-specific instructions + per-conversation masking memory."""
import json
import subprocess
from pathlib import Path

from app import agent, mask_memory
from app.masking import Masker


def _released_tool_loop_text() -> str:
    """TOOL_LOOP_INSTRUCTIONS as released in v10 (commit 12f2aef44), read from git — the regression reference."""
    src = subprocess.run(["git", "show", "12f2aef44:central-assistant-py/app/agent.py"], capture_output=True, text=True, encoding="utf-8",
                         cwd=Path(__file__).resolve().parents[1], check=True).stdout
    ns: dict = {}
    start = src.index("TOOL_LOOP_INSTRUCTIONS = (")
    end = src.index("\n)\n", start) + 3
    exec(src[start:end], ns)  # noqa: S102 — trusted repository source
    return ns["TOOL_LOOP_INSTRUCTIONS"]


def test_technical_instructions_unchanged():
    assert agent.TOOL_LOOP_INSTRUCTIONS == _released_tool_loop_text()
    assert agent.tool_loop_instructions("technical") == agent.TOOL_LOOP_INSTRUCTIONS.format(module="technical")


def test_crewing_instructions_compose():
    t = agent.crewing_tool_loop_instructions()
    assert t.startswith("You are the SAIL Crewing assistant.")
    assert "For HOW-TO questions call search_module_docs" in t          # shared documentation rules
    assert "RULE — cross-references" in t and "RULE — sources" in t
    assert "RULE — follow-ups" in t and "RULE — fresh data" in t        # shared conversation rules
    assert "running hours" not in t.lower() and "work order" not in t.lower()  # PMS rules excluded
    assert "never count or add up rows yourself" in t and "Filters:" in t
    assert agent.tool_loop_instructions("crewing") == t or agent.tool_loop_instructions("crewing").startswith(t)


def test_masker_entries_round_trip():
    m = Masker()
    m.register("Orrin Haverlock", "PERSON")
    m.register("MV Beta Ocean", "VESSEL")
    assert m.entries() == [("Orrin Haverlock", "PERSON"), ("MV Beta Ocean", "VESSEL")]


def test_mask_memory_masks_previous_turn_names():
    mask_memory.clear()
    first = Masker()
    first.learn_from_json({"rows": [{"fullName": "Orrin Haverlock", "vesselName": "MV Beta Ocean", "rank": "Chief Engineer"}]})
    key = ("crewing-pilot", "trial-a.local", "1", "conv-1")
    mask_memory.remember(first, *key)
    history_text = "Orrin Haverlock on MV Beta Ocean holds 3 certificates."
    assert "Orrin Haverlock" in Masker().mask_text(history_text)          # the leak the memory closes

    follow_up = Masker()
    assert mask_memory.recall(follow_up, *key) == 2
    masked = follow_up.mask_text(history_text)
    assert "Orrin" not in masked and "Beta Ocean" not in masked


def test_mask_memory_isolated_by_issuer_company_user_conversation():
    mask_memory.clear()
    m = Masker()
    m.learn_from_json({"rows": [{"fullName": "Orrin Haverlock"}]})
    mask_memory.remember(m, "crewing-pilot", "trial-a.local", "1", "conv-1")
    for other in [("crewing-pilotmt", "trial-a.local", "1", "conv-1"),   # issuer
                  ("crewing-pilot", "trial-b.local", "1", "conv-1"),     # company
                  ("crewing-pilot", "trial-a.local", "2", "conv-1"),     # user
                  ("crewing-pilot", "trial-a.local", "1", "conv-2"),     # conversation
                  ("crewing-pilot", "trial-a.local", "1", None)]:        # no conversation id
        assert mask_memory.recall(Masker(), *other) is None
    assert mask_memory.recall(Masker(), "crewing-pilot", "trial-a.local", "1", "conv-1") == 1


def test_turn_without_names_is_a_hit_not_a_miss():
    mask_memory.clear()
    mask_memory.remember(Masker(), "crewing-pilot", "t", "1", "c")
    assert mask_memory.recall(Masker(), "crewing-pilot", "t", "1", "c") == 0


def test_restart_miss_withholds_earlier_answers():
    mask_memory.clear()                                                     # = container restart
    hist = [{"role": "user", "content": "Who is on board MV Beta Ocean?"},
            {"role": "assistant", "content": "Orrin Haverlock, Petra Wintermarsh …"}]
    assert mask_memory.recall(Masker(), "crewing-pilot", "t", "1", "c") is None
    out = mask_memory.withhold_assistant_turns(hist)
    assert out[0] == hist[0]
    assert out[1]["content"] == mask_memory.WITHHELD and "Orrin" not in json.dumps(out)


def test_name_parts_only_when_enabled():
    rows = {"rows": [{"fullName": "Petra Wintermarsh", "rank": "Second Engineer"}]}
    crew = Masker(name_parts=True)
    crew.learn_from_json(rows)
    assert "Petra" not in crew.mask_text("Is Petra on board?")
    assert "Wintermarsh" not in crew.mask_text("and Wintermarsh?")
    tech = Masker()                                                       # Technical: unchanged behaviour
    tech.learn_from_json(rows)
    assert "Petra" in tech.mask_text("Is Petra on board?")
