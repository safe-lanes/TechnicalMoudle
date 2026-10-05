"""Knowledge management (30-Sep-2026): owner permissions, publish checks, rendering, module-context routing."""
from __future__ import annotations

import json
from datetime import UTC, datetime

import pytest

from app import kb, retrieval
from app.config import settings
from app.db import Hit


@pytest.fixture(autouse=True)
def _env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ASSISTANT_CONTEXT_MODULE_GAP", "0.15")
    settings.cache_clear()
    yield
    settings.cache_clear()


def sess(user: str, tenant: str | None, env: str | None = "dev", iss: str | None = "technical-dev") -> kb.Session:
    return kb.Session("s", user, user.title(), "Sail Admin", tenant, iss, env, "Office")


def access(s: kb.Session, *mods: str) -> kb.Access:
    return kb.Access(s, {m: kb.Grant(m) for m in mods})


def test_no_grant_no_access() -> None:
    a = kb.Access(sess("someone", "a.com"), {})  # a Sail Admin with no grant
    assert not a.can_write("technical", None) and not a.can_read("technical", None)


def test_module_boundary() -> None:
    a = access(sess("t1", "a.com"), "technical")
    assert a.can_write("technical", None)
    assert not a.can_write("crewing", None)                  # a Technical trainer gets nothing in Crewing
    assert not a.can_read("audit", None)


def test_entries_are_for_all_clients_and_environments() -> None:
    a = access(sess("t1", "a.com"), "technical")
    assert a.can_write("technical", None, "*")
    assert not a.can_write("technical", "a.com", "*")        # no company-only entries any more (owner decision 1-Oct)
    assert not a.can_write("technical", None, "dev")         # no environment-only entries any more


def test_review_visibility() -> None:
    a = access(sess("t1", "a.com"), "technical")
    assert kb.review_visible(a, "technical", "b.com", "prod")  # every company and environment of the trainer's module
    assert not kb.review_visible(a, "crewing", "a.com", "dev")


def _instances(monkeypatch: pytest.MonkeyPatch, reg: dict[str, tuple[str, str]], envs: str | None = None) -> None:
    monkeypatch.setenv("ASSISTANT_MODULE_INSTANCES", json.dumps({
        iss: {"module": mod, "env": env, "url": f"http://127.0.0.1/{iss}", "secret": f"s-{iss}", "signingKey": f"k-{iss}"}
        for iss, (mod, env) in reg.items()}))
    if envs is not None:
        monkeypatch.setenv("ASSISTANT_KB_TRAINER_ENVS", envs)
    settings.cache_clear()


def test_trainers_sign_in_on_dev_only(monkeypatch: pytest.MonkeyPatch) -> None:
    """Owner decision 5-Oct-2026: training on dev only; the company is not part of the match."""
    _instances(monkeypatch, {"technical-dev": ("technical", "dev"), "technical-prod": ("technical", "prod")})
    assert kb.is_trainer_instance("technical-dev")
    assert not kb.is_trainer_instance("technical-prod")     # the same user id on production is never a trainer
    assert not kb.is_trainer_instance("unregistered") and not kb.is_trainer_instance(None)
    _instances(monkeypatch, {"technical-dev": ("technical", "dev"), "technical-prod": ("technical", "prod")}, envs="dev,prod")
    assert kb.is_trainer_instance("technical-prod")         # only if the setting is widened on purpose


def test_grant_instance_is_the_modules_dev_instance(monkeypatch: pytest.MonkeyPatch) -> None:
    _instances(monkeypatch, {"technical-dev": ("technical", "dev"), "technical-prod": ("technical", "prod")})
    assert kb.resolve_trainer_instance("technical") == "technical-dev"            # picked automatically
    assert kb.resolve_trainer_instance("technical", "technical-dev") == "technical-dev"
    with pytest.raises(kb.KBError, match="training environment only"):
        kb.resolve_trainer_instance("technical", "technical-prod")                 # a production instance is refused
    with pytest.raises(kb.KBError, match="not connected"):
        kb.resolve_trainer_instance("crewing")                                     # crewing dev not registered yet
    with pytest.raises(kb.KBError, match="training environment only"):
        kb.resolve_trainer_instance("crewing", "technical-dev")                    # another module's instance
    _instances(monkeypatch, {"technical-dev": ("technical", "dev"), "technical-dev2": ("technical", "dev")})
    with pytest.raises(kb.KBError, match="choose one"):
        kb.resolve_trainer_instance("technical")


def rev(**over: object) -> dict:
    r = {"revision": 2, "title": "Deleting a job", "kind": "procedure", "body": "Open the Job form and click Delete (trash icon).",
         "applies_to": {"userTypes": ["Office"], "roles": ["Sail Admin"], "conditions": "", "environment": "", "appVersion": ""},
         "evidence": [{"cls": "code", "reference": "JobsFormPage.tsx:1032", "note": ""}, {"cls": "expert", "reference": "Jeevan", "note": "confirmed"}],
         "open_points": [], "supersedes": []}
    r.update(over)
    return r


def test_publish_problems() -> None:
    e = {"id": "e1", "module": "technical", "scope_tenant": None}
    assert kb.publish_problems(e, rev()) == []
    assert any("expert confirmation" in p for p in kb.publish_problems(e, rev(open_points=[{"text": "25 h?", "resolved": False}])))
    assert any("evidence" in p for p in kb.publish_problems(e, rev(evidence=[])))
    assert any("guidance" in p for p in kb.publish_problems(e, rev(body="x")))


def test_render_labels_and_scope() -> None:
    e = {"id": "e1", "module": "technical", "scope_tenant": None, "env_scope": "*"}
    when = datetime(2026, 9, 30, tzinfo=UTC)
    body, meta = kb.render(e, rev(), preview=False, published_by="Jeevan", when=when)
    assert body.startswith("# Deleting a job")
    assert "Code-verified" in body and "Expert-confirmed" in body and "revision 2" in body
    assert meta["file"] == "Technical - Knowledge: Deleting a job" and meta["kb_scope"] == "global" and meta["kb_env"] == "*"
    assert retrieval.manual_of(meta) == "Technical - Knowledge: Deleting a job"
    pbody, _ = kb.render(e, rev(), preview=True, published_by=None, when=when)
    assert "DRAFT PREVIEW" in pbody


def hit(module: str, d: float) -> Hit:
    return Hit(meta={"module": module, "file": f"{module}.pdf", "breadcrumb": "x > y"}, text="t", distance=d, module=module)


def test_module_context_resolves_ambiguous_term() -> None:
    hits = [hit("crewing", 1.03), hit("crewing", 1.08), hit("technical", 1.16 - 0.01), hit("technical", 1.12)]
    r = retrieval.route(sorted(hits, key=lambda h: h.distance), "What are RH validations for updating RH", "technical", {})
    assert r.gate == "answer" and r.module == "technical" and str(r.reason).startswith("module context")


def test_module_context_keeps_explicit_other_module() -> None:
    hits = sorted([hit("crewing", 1.03), hit("technical", 1.12)], key=lambda h: h.distance)
    r = retrieval.route(hits, "In Crewing, how are rest hours recorded?", "technical", {})
    assert r.module == "crewing"


def test_glossary_expands_in_own_module_only(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ASSISTANT_MODULE_GLOSSARY", json.dumps({"technical": {"RH": "Running Hours"}, "crewing": {"RH": "Rest Hours"}}))
    settings.cache_clear()
    assert retrieval.expand_for_module("How do I update RH?", "technical", {}) == "How do I update Running Hours (RH)?"
    assert retrieval.expand_for_module("How do I update RH?", "crewing", {}) == "How do I update Rest Hours (RH)?"
    assert retrieval.expand_for_module("In Crewing, how is RH recorded?", "technical", {}) == "In Crewing, how is RH recorded?"
    assert retrieval.expand_for_module("THRESHOLD and rh stay", "technical", {}) == "THRESHOLD and rh stay"  # whole word, case-sensitive
    assert retrieval.expand_for_module("How do I update RH?", "audit", {}) == "How do I update RH?"


def test_glossary_off_by_default() -> None:
    assert retrieval.expand_for_module("How do I update RH?", "technical", {}) == "How do I update RH?"


def test_module_context_not_used_when_far() -> None:
    hits = sorted([hit("crewing", 0.80), hit("technical", 1.10)], key=lambda h: h.distance)
    r = retrieval.route(hits, "How do I appraise a seafarer?", "technical", {})
    assert r.module == "crewing"
