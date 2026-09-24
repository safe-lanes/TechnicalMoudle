"""24-Sep-2026 — one central assistant, many module INSTANCES (environment × module), each reachable only by its
own registration: the token's `iss` selects the registered signing key, the callback URL and the service secret.
Nothing here touches the network: httpx.MockTransport stands in for the module instances."""
import importlib
import json

import httpx
import pytest

from app.identity import peek_issuer, sign_identity, verify_identity

DEV = {"module": "technical", "env": "dev", "url": "https://dev.example/technical/api", "secret": "dev-secret", "signingKey": "dev-key"}
PROD = {"module": "technical", "env": "prod", "url": "https://prod.example/technical/api", "secret": "prod-secret", "signingKey": "prod-key"}
REGISTRY = json.dumps({"technical-dev": DEV, "technical-prod": PROD})


def _reload(monkeypatch, **env):
    for k, v in env.items():
        monkeypatch.setenv(k, v)
    from app import config
    config.settings.cache_clear()
    import app.agent as agent
    import app.llm as llm
    importlib.reload(llm)
    return importlib.reload(agent), config.settings()


BASE_ENV = dict(CHAT_TEMPERATURE="default", IDENTITY_SIGNING_KEY="shared-docs-key", OPENAI_API_KEY="x", DATABASE_URL="postgres://u:p@h/db")


def test_registry_parses_only_complete_entries(monkeypatch):
    half = json.dumps({"technical-dev": DEV, "broken": {"module": "technical", "url": "https://x"}})
    _, s = _reload(monkeypatch, ASSISTANT_MODULE_INSTANCES=half, **BASE_ENV)
    reg = s.module_instances
    assert list(reg) == ["technical-dev"] and reg["technical-dev"]["iss"] == "technical-dev"
    assert reg["technical-dev"]["url"] == DEV["url"]
    _, s2 = _reload(monkeypatch, ASSISTANT_MODULE_INSTANCES="not json", **BASE_ENV)
    assert s2.module_instances == {}


def test_issuer_selects_the_registered_key_and_forged_issuers_fail():
    dev_tok = sign_identity({"userId": "u1", "role": "Sail Admin", "iss": "technical-dev", "tenantDomain": "t"}, DEV["signingKey"])
    assert peek_issuer(dev_tok) == "technical-dev"
    assert verify_identity(dev_tok, DEV["signingKey"]).ok
    # a dev token claiming to be production (re-labelled after signing) fails production's key
    body = dev_tok.split(".")[0]
    payload = json.loads(httpx._utils.__dict__ and __import__("base64").urlsafe_b64decode(body + "=" * (-len(body) % 4)))
    payload["iss"] = "technical-prod"
    forged = __import__("base64").urlsafe_b64encode(json.dumps(payload, separators=(",", ":")).encode()).decode().rstrip("=") + "." + dev_tok.split(".")[1]
    assert peek_issuer(forged) == "technical-prod"
    assert verify_identity(forged, PROD["signingKey"]).reason == "bad-signature"
    # a dev-signed token verified with production's key (dev identity claiming the production environment) fails
    assert verify_identity(dev_tok, PROD["signingKey"]).reason == "bad-signature"
    # no issuer at all → peek gives None → the shared docs key applies
    docs_tok = sign_identity({"userId": "u1", "role": "Sail Admin"}, "shared-docs-key")
    assert peek_issuer(docs_tok) is None and verify_identity(docs_tok, "shared-docs-key").ok


@pytest.mark.asyncio
async def test_execute_goes_only_to_the_issuers_registered_url_with_its_secret(monkeypatch):
    agent, s = _reload(monkeypatch, ASSISTANT_MODULE_INSTANCES=REGISTRY, **BASE_ENV)
    seen: list[httpx.Request] = []

    def handler(req: httpx.Request) -> httpx.Response:
        seen.append(req)
        return httpx.Response(200, json={"ok": True, "data": {"host": req.url.host}})

    monkeypatch.setattr(agent.llm, "module_client", lambda: httpx.AsyncClient(transport=httpx.MockTransport(handler), follow_redirects=False))
    dev = s.module_instances["technical-dev"]; prod = s.module_instances["technical-prod"]
    r = await agent.execute_module_tool(dev, "get_work_order_counts", {"vesselId": "v"}, "TOKEN-DEV", "r1")
    assert r["data"]["host"] == "dev.example"
    assert seen[-1].headers["x-service-secret"] == "dev-secret" and seen[-1].headers["x-assistant-identity"] == "TOKEN-DEV"
    r = await agent.execute_module_tool(prod, "get_work_order_counts", {"vesselId": "v"}, "TOKEN-PROD", "r2")
    assert r["data"]["host"] == "prod.example" and seen[-1].headers["x-service-secret"] == "prod-secret"
    # the production secret never went to the dev host and vice versa
    assert all((q.url.host == "dev.example") == (q.headers["x-service-secret"] == "dev-secret") for q in seen)
    # no registration → no call at all
    r = await agent.execute_module_tool(None, "get_work_order_counts", {}, "TOKEN", "r3")
    assert r["ok"] is False and len(seen) == 2


@pytest.mark.asyncio
async def test_redirects_are_refused_and_never_followed(monkeypatch):
    agent, s = _reload(monkeypatch, ASSISTANT_MODULE_INSTANCES=REGISTRY, **BASE_ENV)
    calls: list[str] = []

    def handler(req: httpx.Request) -> httpx.Response:
        calls.append(str(req.url))
        if req.url.host == "dev.example":
            return httpx.Response(302, headers={"location": "https://evil.example/assistant/execute"})
        return httpx.Response(200, json={"ok": True})

    monkeypatch.setattr(agent.llm, "module_client", lambda: httpx.AsyncClient(transport=httpx.MockTransport(handler), follow_redirects=False))
    dev = s.module_instances["technical-dev"]
    r = await agent.execute_module_tool(dev, "t", {}, "TOKEN", "r")
    assert r["ok"] is False and "redirect" in r["error"]
    assert calls == [f"{DEV['url']}/assistant/execute"]          # the redirect target was never contacted
    m = await agent.manifest_for(dev)
    assert m is None and calls[-1] == f"{DEV['url']}/assistant/manifest"


@pytest.mark.asyncio
async def test_manifest_cache_is_per_instance_not_per_module(monkeypatch):
    agent, s = _reload(monkeypatch, ASSISTANT_MODULE_INSTANCES=REGISTRY, **BASE_ENV)
    agent._manifest_cache.clear()

    def handler(req: httpx.Request) -> httpx.Response:
        tool = "dev_tool" if req.url.host == "dev.example" else "prod_tool"
        return httpx.Response(200, json={"apiVersion": 1, "module": "technical", "tools": [{"name": tool}]})

    monkeypatch.setattr(agent.llm, "module_client", lambda: httpx.AsyncClient(transport=httpx.MockTransport(handler), follow_redirects=False))
    dev = await agent.manifest_for(s.module_instances["technical-dev"])
    prod = await agent.manifest_for(s.module_instances["technical-prod"])
    assert dev["tools"][0]["name"] == "dev_tool" and prod["tools"][0]["name"] == "prod_tool"
    assert set(agent._manifest_cache) == {"technical-dev", "technical-prod"}
    # a manifest that names a different module than the registration is refused
    def wrong(req: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"apiVersion": 1, "module": "crewing", "tools": []})
    agent._manifest_cache.clear()
    monkeypatch.setattr(agent.llm, "module_client", lambda: httpx.AsyncClient(transport=httpx.MockTransport(wrong), follow_redirects=False))
    assert await agent.manifest_for(s.module_instances["technical-dev"]) is None
