"""21-Oct-2026 Crewing live-data PILOT TRIAL: module-specific instructions + per-conversation masking memory."""
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
    first = Masker()
    first.learn_from_json({"rows": [{"fullName": "Orrin Haverlock", "vesselName": "MV Beta Ocean", "rank": "Chief Engineer"}]})
    mask_memory.remember(first, "trial-a.local", "1", "conv-1")
    history_text = "Orrin Haverlock on MV Beta Ocean holds 3 certificates."

    without = Masker()
    assert "Orrin Haverlock" in without.mask_text(history_text)           # the leak the memory closes

    follow_up = Masker()
    assert mask_memory.recall(follow_up, "trial-a.local", "1", "conv-1") == 2
    masked = follow_up.mask_text(history_text)
    assert "Orrin" not in masked and "Beta Ocean" not in masked

    other_user = Masker()
    assert mask_memory.recall(other_user, "trial-a.local", "2", "conv-1") == 0   # keyed per user
    other_tenant = Masker()
    assert mask_memory.recall(other_tenant, "trial-b.local", "1", "conv-1") == 0  # and per company
    assert mask_memory.recall(Masker(), "trial-a.local", "1", None) == 0
