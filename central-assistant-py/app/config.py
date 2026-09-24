"""
Runtime configuration — every knob the Node service read from the environment keeps
its NAME here (deployment matrix in docs/ASSISTANT-API.md §4 stays valid), so the
same assistant.env drives both during the :8012 → :8013 cutover window.
"""
from __future__ import annotations

import json
from functools import lru_cache
from typing import Any

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=None, extra="ignore", case_sensitive=False)

    # service
    port: int = 8000
    host: str = "0.0.0.0"  # container-internal; the host binding stays 127.0.0.1 (nginx in front)

    # secrets / stores
    openai_api_key: str = ""
    database_url: str = ""          # postgres://user:pass@host:5432/db (Node form accepted)
    identity_signing_key: str = ""
    admin_token: str = ""
    db_pool_size: int = 20          # Audit-4 fix: was pg.Pool max=5

    # models
    chat_model: str = "gpt-4o-mini"
    embed_model: str = "text-embedding-3-large"

    # knowledge store: which index set the service reads ('migrated' = the 907 chunks moved
    # from Chroma; the Python indexer writes named sets — switch here after a measured comparison)
    assistant_index_set: str = "migrated"

    # routing (§4.2) — unchanged thresholds; distance semantics kept = Chroma squared-L2
    route_sim_floor: float = 1.15
    route_margin: float = 0.07
    route_top_k: int = 10
    answer_chunks: int = 5

    # sampling: "0.2" (served default) or "default" = send no temperature (models such as gpt-5.6-luna accept only their default)
    chat_temperature: str = "0.2"
    # Tool loop only (Data API answers). gpt-5.6-luna refuses function tools on chat.completions unless
    # reasoning_effort is explicitly 'none' (OpenAI 400, PROVEN on the pilot 23-Sep-2026). "" = do not send.
    # The documentation path never attaches function tools and is not affected by this setting.
    assistant_tool_reasoning_effort: str = "none"
    # 23-Sep-2026: how many prior messages of the widget's conversationHistory the tool loop sees (0 = none).
    # Tool loop only; the documentation path is unchanged.
    assistant_history_messages: int = 8

    # step 4 (owner brief 15-Sep-2026) — both OFF = the served behaviour; each is measured on its own candidate:
    #   route_intent: an explicit module or manual/sub-module name in the question decides the module; the originating
    #                 module (context.module) only breaks a clarify tie when it is one of the candidates.
    #   hybrid:       excerpt selection consults a lexical (tsvector) ranking inside the routed module — "rescue" (r6): the
    #                 served vector selection kept, the lexical leader takes the last slot when absent; "on" (r5): convex score
    #                 fusion of both rankings (measured, superseded by r6). Thresholds and excerpt count unchanged in both.
    assistant_route_intent: str = "off"
    assistant_hybrid: str = "off"          # off | rescue | on
    assistant_hybrid_alpha: float = 0.5   # weight of the vector side in the convex score fusion (r5 only); 1.0 = vector only
    # r7 guards on the rescue (both must hold before the lexical leader may take the last excerpt slot). Calibrated on 77
    # suite questions with embeddings only — see calib_select.py. 0 disables the guard (= the unguarded r6 behaviour).
    assistant_rescue_lex_per_term: float = 0.45
    assistant_rescue_max_penalty: float = 0.15
    # r8: when the module decision was close, let the runner-up module's best chunk take the last slot (0 = off).
    assistant_second_opinion_gap: float = 0.0
    # r9 (routing experiment 21-Sep-2026): append the nearest chunk of EACH other module within `gap` of the routed
    # module's best, as EXTRA excerpts — never displacing one. Measured offline over 101 suite questions: the expected
    # page is supplied on 63 of 65 instead of 62 of 65 (Audit History gains its page), no existing excerpt is removed,
    # and 31 excerpts are added across 24 questions. r8 could not do this: it takes min(other), the single nearest
    # non-routed chunk, which for that question is a Safety chunk and not the Audit page. 0 = off (served behaviour).
    assistant_cross_module_gap: float = 0.0
    assistant_cross_module_slots: int = 2
    # answer prompt in use on the docs path: "v5" (measured baseline) or "v6" (v5 + three rules for the defects in §15.2)
    assistant_docs_prompt: str = "v5"

    # budgets (§5.7)
    llm_timeout_ms: int = 30000
    tool_timeout_ms: int = 10000
    soft_deadline_ms: int = 90000
    max_tool_iterations: int = 8
    manifest_ttl_ms: int = 300000

    # masking / log policy (Stage 5)
    assistant_masking: str = "on"                     # "off" disables
    assistant_masking_disabled_tenants: str = ""      # comma-separated tenant domains
    assistant_masked_only_log_tenants: str = ""

    # embedding / module wiring
    assistant_cors_origins: str = ""                  # comma-separated, '*' for pilot
    assistant_module_apis: str = "{}"                 # RETIRED 24-Sep-2026 (module-keyed, one URL per module) — ignored; see module_instances
    # Trusted registration of module INSTANCES (environment × module), keyed by the token's `iss` claim:
    #   {"technical-dev":  {"module":"technical","env":"dev", "url":"https://dev.../technical/api","secret":"…","signingKey":"…"},
    #    "technical-prod": {"module":"technical","env":"prod","url":"https://app.../technical/api","secret":"…","signingKey":"…"}}
    # A token is verified with ITS issuer's signingKey and its live-data calls go ONLY to that issuer's registered url,
    # with that issuer's secret. Tokens without `iss` verify with IDENTITY_SIGNING_KEY and are documentation-only.
    assistant_module_instances: str = "{}"
    assistant_capture_outbound: str = ""              # test seam: file path; captures ACTUAL wire bodies
    assistant_admin_email: str = "ghazi.anwer@safe-lanes.com"

    # rate limit (Stage A port; now Postgres-backed)
    chatbot_rate_window_ms: int = 60000
    chatbot_rate_max: int = 30

    identity_clock_leeway_sec: int = 90

    # ── derived ─────────────────────────────────────────────────────────────
    @property
    def sqlalchemy_url(self) -> str:
        u = self.database_url
        for prefix in ("postgresql+asyncpg://", "postgres://", "postgresql://"):
            if u.startswith(prefix):
                return "postgresql+asyncpg://" + u[len(prefix):]
        return u

    @property
    def masking_enabled(self) -> bool:
        return self.assistant_masking.lower() != "off"

    @property
    def masking_disabled_tenants(self) -> set[str]:
        return _csv(self.assistant_masking_disabled_tenants)

    @property
    def masked_only_log_tenants(self) -> set[str]:
        return _csv(self.assistant_masked_only_log_tenants)

    @property
    def cors_origins(self) -> list[str]:
        return sorted(_csv(self.assistant_cors_origins))

    @property
    def module_apis(self) -> dict[str, dict[str, Any]]:
        """RETIRED (24-Sep-2026): kept so old env files parse; never consulted for routing."""
        try:
            v = json.loads(self.assistant_module_apis or "{}")
            return v if isinstance(v, dict) else {}
        except json.JSONDecodeError:
            return {}

    @property
    def module_instances(self) -> dict[str, dict[str, Any]]:
        """Registered module instances keyed by issuer id; entries missing module/url/secret/signingKey are dropped
        (a half-registered instance must never be callable)."""
        try:
            v = json.loads(self.assistant_module_instances or "{}")
        except json.JSONDecodeError:
            return {}
        if not isinstance(v, dict):
            return {}
        out: dict[str, dict[str, Any]] = {}
        for iss, e in v.items():
            if isinstance(e, dict) and all(isinstance(e.get(k), str) and e.get(k) for k in ("module", "url", "secret", "signingKey")):
                out[str(iss)] = {"iss": str(iss), "module": e["module"].lower(), "env": str(e.get("env") or ""),
                                 "url": e["url"].rstrip("/"), "secret": e["secret"], "signingKey": e["signingKey"]}
        # Credential reuse is rejected (24-Sep-2026, reviewer requirement): a signing key or a service secret shared by
        # two instances, or an instance signing key equal to the shared documentation key, would let one environment's
        # token or secret pass as another's. Every instance involved in a reuse is DROPPED (fail closed); the reasons
        # are listed by registry_violations() and printed at startup.
        bad = {iss for iss, _ in self.registry_violations(out)}
        return {iss: e for iss, e in out.items() if iss not in bad}

    def registry_violations(self, parsed: dict[str, dict[str, Any]] | None = None) -> list[tuple[str, str]]:
        """(issuer, reason) for every registration that reuses a credential. Pure; used by module_instances and startup."""
        reg = parsed
        if reg is None:  # parse without the reuse filter
            try:
                v = json.loads(self.assistant_module_instances or "{}")
            except json.JSONDecodeError:
                return []
            reg = {str(i): e for i, e in v.items() if isinstance(v, dict) and isinstance(e, dict)}
        out: list[tuple[str, str]] = []
        items = list(reg.items())
        for i, (iss, e) in enumerate(items):
            key, sec = str(e.get("signingKey") or ""), str(e.get("secret") or "")
            if key and key == self.identity_signing_key:
                out.append((iss, "signingKey equals the shared documentation IDENTITY_SIGNING_KEY"))
            for jss, f in items[i + 1:]:
                if key and key == str(f.get("signingKey") or ""):
                    out.append((iss, f"signingKey reused by '{jss}'")); out.append((jss, f"signingKey reused by '{iss}'"))
                if sec and sec == str(f.get("secret") or ""):
                    out.append((iss, f"secret reused by '{jss}'")); out.append((jss, f"secret reused by '{iss}'"))
        return out


def _csv(s: str) -> set[str]:
    return {x.strip() for x in (s or "").split(",") if x.strip()}


@lru_cache(maxsize=1)
def settings() -> Settings:
    return Settings()


MODULE_LABELS = {"technical": "Technical", "audit": "Audit", "safety": "Safety", "incident": "Incident", "crewing": "Crewing"}
