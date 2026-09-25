"""
The one OpenAI client for the service, and the two things the proofs need from it:

  llm_calls — incremented on EVERY outbound HTTP request to the model provider
              (chat and embeddings alike). The kill-switch proof reads its delta.
  capture   — when ASSISTANT_CAPTURE_OUTBOUND names a file, the ACTUAL wire body of
              every outbound request is appended there (JSON lines). The Stage 5
              leak scan reads that file — captured evidence, not code-reading.

Both are httpx request hooks on the shared client, so they see exactly what leaves.
The Pydantic AI model (agent.py) is built on this same client.
"""
from __future__ import annotations

import json
from functools import lru_cache
from typing import Any

import openai._base_client as _bc
from openai import AsyncOpenAI
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.providers.openai import OpenAIProvider

from .config import settings
from .masking import Masker

httpx = _bc.httpx2  # the http library the installed openai SDK actually uses

llm_calls = 0


async def _on_request(request: Any) -> None:
    global llm_calls
    llm_calls += 1
    f = settings().assistant_capture_outbound
    if not f:
        return
    try:
        body = request.content.decode("utf-8", "replace") if request.content else ""
        with open(f, "a", encoding="utf-8") as fh:
            fh.write(json.dumps({"url": str(request.url), "body": body}) + "\n")
    except Exception:
        pass  # capture never breaks serving


@lru_cache(maxsize=1)
def http_client() -> Any:
    """The MODEL-PROVIDER client: hooked for llm_calls + capture. Nothing else uses it."""
    return httpx.AsyncClient(timeout=settings().llm_timeout_ms / 1000.0, event_hooks={"request": [_on_request]})


@lru_cache(maxsize=1)
def module_client() -> Any:
    """Plain client for module Data API calls (manifest/execute) — deliberately NOT hooked,
    so llmCalls counts model requests only and the capture file is the OpenAI wire alone."""
    # follow_redirects=False (explicit, 24-Sep-2026): a registered callback URL must answer itself — a redirect can
    # never move the service secret or the user's token to another host.
    return httpx.AsyncClient(timeout=settings().tool_timeout_ms / 1000.0 + 1.0, follow_redirects=False)


@lru_cache(maxsize=1)
def openai_client() -> AsyncOpenAI:
    return AsyncOpenAI(api_key=settings().openai_api_key, http_client=http_client(), max_retries=0)


@lru_cache(maxsize=1)
def chat_model() -> OpenAIChatModel:
    return OpenAIChatModel(settings().chat_model, provider=OpenAIProvider(openai_client=openai_client()))


async def embed(text: str, masker: Masker | None = None) -> list[float]:
    """Embedding input passes the masker too — a question naming a vessel never leaves raw."""
    inp = masker.mask_text(text) if masker else text
    r = await openai_client().embeddings.create(model=settings().embed_model, input=inp)
    return list(r.data[0].embedding)
