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
    assistant_module_apis: str = "{}"                 # {"technical":{"url":"...","secret":"..."}}
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
        try:
            v = json.loads(self.assistant_module_apis or "{}")
            return v if isinstance(v, dict) else {}
        except json.JSONDecodeError:
            return {}


def _csv(s: str) -> set[str]:
    return {x.strip() for x in (s or "").split(",") if x.strip()}


@lru_cache(maxsize=1)
def settings() -> Settings:
    return Settings()


MODULE_LABELS = {"technical": "Technical", "audit": "Audit", "safety": "Safety", "incident": "Incident", "crewing": "Crewing"}
