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


def access(s: kb.Session, **mods: tuple[str, bool]) -> kb.Access:
    return kb.Access(s, {m: kb.Grant(m, scope, share) for m, (scope, share) in mods.items()})


def test_no_grant_no_access() -> None:
    a = kb.Access(sess("someone", "a.com"), {})  # a Sail Admin with no grant
    assert not a.can_write("technical", None, "dev") and not a.can_read("technical", None, "dev")


def test_module_boundary() -> None:
    a = access(sess("t1", "a.com"), technical=("global", False))
    assert a.can_write("technical", None, "dev")
    assert not a.can_write("crewing", None, "dev")          # Technical grant gives nothing in Crewing
    assert not a.can_read("audit", None, "dev")


def test_publish_scope_is_separate_from_module() -> None:
    co = access(sess("t2", "b.com"), technical=("company", False))
    assert not co.can_write("technical", None, "dev")       # company trainer: never product-wide
    assert co.can_write("technical", "b.com", "dev")
    assert not co.can_write("technical", "a.com", "dev")    # never another company
    assert co.can_read("technical", None, "dev") and not co.can_read("technical", "a.com", "dev")


def test_environment_scope() -> None:
    dev = access(sess("t1", "a.com", "dev"), technical=("global", False))
    assert not dev.can_write("technical", None, "prod")     # a dev trainer never changes production guidance
    assert not dev.can_read("technical", None, "prod")
    assert not dev.can_write("technical", None, "*")        # shared guidance needs an explicit share grant
    assert dev.can_read("technical", None, "*")
    share = access(sess("t3", "a.com", "dev"), technical=("global", True))
    assert share.can_write("technical", None, "*")
    assert not share.can_write("technical", None, "prod")   # share = the '*' entries, not another environment's own
    nil = access(sess("t1", "a.com", None), technical=("global", True))
    assert not nil.can_write("technical", None, "dev")      # no registered environment: nothing


def test_review_visibility() -> None:
    g = access(sess("t1", "a.com", "dev"), technical=("global", False))
    c = access(sess("t2", "b.com", "dev"), technical=("company", False))
    assert kb.review_visible(g, "technical", "b.com", "dev") and not kb.review_visible(g, "technical", "b.com", "prod")
    assert kb.review_visible(c, "technical", "b.com", "dev") and not kb.review_visible(c, "technical", "a.com", "dev")
    assert not kb.review_visible(g, "crewing", "a.com", "dev")


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
    e = {"id": "e1", "module": "technical", "scope_tenant": "a.com", "env_scope": "dev"}
    when = datetime(2026, 9, 30, tzinfo=UTC)
    body, meta = kb.render(e, rev(), preview=False, published_by="Jeevan", when=when)
    assert body.startswith("# Deleting a job")
    assert "Code-verified" in body and "Expert-confirmed" in body and "revision 2" in body
    assert meta["file"] == "Technical - Knowledge: Deleting a job" and meta["kb_scope"] == "a.com" and meta["kb_env"] == "dev"
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
