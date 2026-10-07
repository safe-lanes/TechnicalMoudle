"""7-Oct-2026 — GET /suggestions: starter questions for the shared chat widget. A module gets only questions whose source
passage is one of ITS published manuals in the served index; nothing qualifies → []. The endpoint checks identity like
/chat. The database is faked here (no network)."""
import asyncio
import importlib

import pytest
from fastapi.testclient import TestClient

from app.identity import sign_identity

BASE_ENV = dict(CHAT_TEMPERATURE="default", IDENTITY_SIGNING_KEY="shared-docs-key", OPENAI_API_KEY="x",
                DATABASE_URL="postgres://u:p@h/db")
CREW_FILE = "Crewing - Crewing User Manual R2_10.06.2026.pdf"


@pytest.fixture()
def sug(monkeypatch):
    for k, v in BASE_ENV.items():
        monkeypatch.setenv(k, v)
    from app import config
    config.settings.cache_clear()
    import app.suggestions as s
    s = importlib.reload(s)
    s.clear_cache()
    calls = {"sections": [], "pairs": []}
    published = {
        "crewing": {(CREW_FILE, "1.2.1.3 HOW TO CREATE A NEW CREW RECORD"), (CREW_FILE, "1.3.1.5 HOW TO ADD RECORDS TO CREW POOL")},
        "audit": set(),
    }
    off = {("acme", "safety")}

    async def manual_sections(module):
        calls["sections"].append(module)
        return published.get(module, set())

    async def pair_enabled(tenant, module):
        calls["pairs"].append((tenant, module))
        return (tenant, module) not in off

    monkeypatch.setattr(s.db, "manual_sections", manual_sections)
    monkeypatch.setattr(s.db, "pair_enabled", pair_enabled)
    return s, calls, published


def run(c):
    return asyncio.run(c)


def test_only_questions_with_a_published_source_are_served(sug):
    s, _, _ = sug
    out = run(s.for_module("crewing", {"tenantDomain": "acme"}))
    assert out == ["How do I create a new crew record?", "How do I add records to the crew pool?"]


def test_module_without_published_sources_gets_none_not_generic(sug):
    s, _, _ = sug
    assert run(s.for_module("audit", {"tenantDomain": "acme"})) == []


def test_unknown_or_missing_module_gets_none(sug):
    s, calls, _ = sug
    assert run(s.for_module("hr", {"tenantDomain": "acme"})) == []
    assert run(s.for_module("", {"tenantDomain": "acme"})) == []
    assert run(s.for_module(None, {"tenantDomain": "acme"})) == []
    assert calls["sections"] == [] and calls["pairs"] == []  # nothing looked up for an unknown module


def test_pair_switched_off_gets_none_and_never_reads_sources(sug):
    s, calls, _ = sug
    assert run(s.for_module("safety", {"tenantDomain": "acme"})) == []
    assert calls["sections"] == []


def test_module_id_is_case_insensitive_and_questions_never_cross_modules(sug):
    s, _, _ = sug
    crew = run(s.for_module("CREWING", {"tenantDomain": "acme"}))
    assert crew and all("crew" in q.lower() for q in crew)
    catalog = s.catalog()
    others = {i["question"] for m, items in catalog.items() if m != "crewing" for i in items}
    assert not (set(crew) & others)


def test_catalog_entries_name_their_own_module_manual(sug):
    s, _, _ = sug
    labels = {"technical": "Technical - ", "crewing": "Crewing - ", "audit": "Audit - ", "safety": "Safety - ", "incident": "Incident - "}
    for module, items in s.catalog().items():
        assert module in labels, module
        assert items, module
        for i in items:
            assert i["file"].startswith(labels[module]), (module, i)
            assert i["question"].endswith("?")


def test_limit_is_capped(sug):
    s, _, published = sug
    published["crewing"] = {(i["file"], i["section"]) for i in s.catalog()["crewing"]}
    s.clear_cache()
    assert len(run(s.for_module("crewing", {"tenantDomain": "acme"}, limit=99))) <= s.MAX_QUESTIONS
    assert run(s.for_module("crewing", {"tenantDomain": "acme"}, limit=2)) == [i["question"] for i in s.catalog()["crewing"][:2]]


def test_endpoint_requires_a_valid_identity(sug, monkeypatch):
    s, _, _ = sug
    import app.main as main
    main = importlib.reload(main)
    monkeypatch.setattr(main, "suggestions", s)
    client = TestClient(main.app)
    assert client.get("/suggestions?module=crewing").status_code == 401
    assert client.get("/suggestions?module=crewing", headers={"x-assistant-identity": "x.y"}).status_code == 401
    bad = sign_identity({"userId": "7", "role": "Sail Admin", "tenantDomain": "acme"}, "wrong-key")
    assert client.get("/suggestions?module=crewing", headers={"x-assistant-identity": bad}).status_code == 401
    tok = sign_identity({"userId": "7", "role": "Sail Admin", "tenantDomain": "acme"}, "shared-docs-key")
    r = client.get("/suggestions?module=crewing", headers={"x-assistant-identity": tok})
    assert r.status_code == 200
    assert r.json() == {"module": "crewing", "questions": ["How do I create a new crew record?", "How do I add records to the crew pool?"]}
    r2 = client.get("/suggestions?module=audit", headers={"x-assistant-identity": tok})
    assert r2.json()["questions"] == []


def test_endpoint_fails_closed_on_store_error(sug, monkeypatch):
    s, _, _ = sug

    async def boom(module):
        raise RuntimeError("db down")

    monkeypatch.setattr(s.db, "manual_sections", boom)
    import app.main as main
    main = importlib.reload(main)
    monkeypatch.setattr(main, "suggestions", s)
    tok = sign_identity({"userId": "7", "role": "Sail Admin", "tenantDomain": "acme"}, "shared-docs-key")
    r = TestClient(main.app).get("/suggestions?module=crewing", headers={"x-assistant-identity": tok})
    assert r.status_code == 200 and r.json()["questions"] == []
