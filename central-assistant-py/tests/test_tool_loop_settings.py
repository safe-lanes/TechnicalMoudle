"""23-Sep-2026: the tool loop must send an explicit reasoning effort (gpt-5.6-luna rejects function tools on
chat.completions otherwise — OpenAI 400, PROVEN on the pilot); the documentation path must be unchanged."""
import importlib


def _reload(monkeypatch, **env):
    for k, v in env.items():
        monkeypatch.setenv(k, v)
    from app import config
    config.settings.cache_clear()
    import app.agent as agent
    return importlib.reload(agent)


def test_tool_loop_settings_add_reasoning_effort_none_and_docs_settings_do_not(monkeypatch):
    agent = _reload(monkeypatch, CHAT_TEMPERATURE="default", ASSISTANT_TOOL_REASONING_EFFORT="none",
                    IDENTITY_SIGNING_KEY="k", OPENAI_API_KEY="x", DATABASE_URL="postgres://u:p@h/db")
    docs = agent._model_settings()
    loop = agent._tool_loop_settings()
    assert "openai_reasoning_effort" not in docs                 # documentation path untouched
    assert loop["openai_reasoning_effort"] == "none"
    assert loop["timeout"] == docs["timeout"] and "temperature" not in loop   # served settings preserved


def test_tool_loop_settings_can_be_switched_off(monkeypatch):
    agent = _reload(monkeypatch, CHAT_TEMPERATURE="0.2", ASSISTANT_TOOL_REASONING_EFFORT="",
                    IDENTITY_SIGNING_KEY="k", OPENAI_API_KEY="x", DATABASE_URL="postgres://u:p@h/db")
    loop = agent._tool_loop_settings()
    assert "openai_reasoning_effort" not in loop and loop["temperature"] == 0.2


def test_vessel_context_prefix_carries_id_and_name_and_is_empty_without_a_vessel(monkeypatch):
    agent = _reload(monkeypatch, CHAT_TEMPERATURE="default", IDENTITY_SIGNING_KEY="k", OPENAI_API_KEY="x", DATABASE_URL="postgres://u:p@h/db")
    p = agent.vessel_context_prefix({"module": "technical", "vesselId": "743ef9d1-841a-11ed-aa7c-7003bca91a86", "vesselName": "WK Frontier Pilot"})
    assert p.startswith("[App context] Selected vessel: WK Frontier Pilot (vesselId 743ef9d1-841a-11ed-aa7c-7003bca91a86)")
    assert "never guess a vessel ID" in p and p.endswith("User question: ")
    assert agent.vessel_context_prefix({"module": "technical"}) == ""
    assert agent.vessel_context_prefix(None) == ""
    # the masking choke point must turn the id into a token on the wire and restore it in tool arguments
    from app.masking import Masker
    m = Masker(); m.register("WK Frontier Pilot", "VESSEL")
    masked = m.mask_text(p + "how many overdue?")
    assert "743ef9d1-841a-11ed-aa7c-7003bca91a86" not in masked and "WK Frontier Pilot" not in masked
    tok = masked.split("vesselId ")[1].split(")")[0]
    assert m.unmask_json({"vesselId": tok}) == {"vesselId": "743ef9d1-841a-11ed-aa7c-7003bca91a86"}
