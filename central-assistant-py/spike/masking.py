"""
Python port of central-assistant/masking.mjs (Stage 5) — same contract:

  OUTBOUND: every string that leaves for the LLM passes mask_text. Real vessel
  names, person names, IMO numbers and DB UUIDs become stable per-request tokens
  [VESSEL_1], [PERSON_1], [IMO_1], [ID_1].
  INBOUND: the final answer passes unmask_text; LLM-produced tool arguments pass
  unmask_json BEFORE a module runs them (modules always work on real data).

Failure policy is unchanged: mask failure -> raise (request refused before any
LLM call); unmapped token on the way back -> left VISIBLE and recorded in
`warnings`. The '__MASK_FAIL_TEST__' seam is kept so the fail-closed path stays
provable end to end.
"""
from __future__ import annotations

import re
from typing import Any

NAME_KEY_RE = re.compile(
    r"(vessel_?name|user_?name|full_?name|display_?name|_by_name|_by$|approver|observer|"
    r"reported_by|completed_by|created_by|updated_by|master|chief|requestedBy|assignee)",
    re.I,
)
UUID_RE = re.compile(r"\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b", re.I)
IMO_RE = re.compile(r"\b\d{7}\b")
# Accepts the token WITH or WITHOUT its brackets: models (gpt-4o-mini, spike 11-Sep) sometimes
# emit "VESSEL_1" / "**VESSEL_1**" — markdown eats the brackets — in answers AND in tool
# arguments. A bare VESSEL_1 never occurs in real text, so the looser match is safe.
TOKEN_RE = re.compile(r"\[?\b(VESSEL|PERSON|IMO|ID)_(\d+)\b\]?")

VESSEL_SIGNAL = re.compile(r"^(imo|imo_?number|vessel_?id|vuuid|v_?code|vessel_?code|flag)$", re.I)
PERSON_SIGNAL = re.compile(r"^(rank|rank_?name|email|crew_?id|employee_?id|designation|department)$", re.I)
BARE_NAME_KEY = re.compile(r"^(name|full_?name|title)$", re.I)
IMO_KEY = re.compile(r"^(imo|imo_?number)$", re.I)


class Masker:
    def __init__(self) -> None:
        self._real_to_token: dict[str, str] = {}   # lowercased real -> token
        self._token_to_real: dict[str, str] = {}   # token -> real (original casing)
        self._counters = {"VESSEL": 0, "PERSON": 0, "IMO": 0, "ID": 0}
        self._name_re: re.Pattern[str] | None = None
        self.warnings: list[str] = []

    # -- registration -------------------------------------------------------
    def register(self, value: Any, kind: str) -> str | None:
        v = str(value if value is not None else "").strip()
        if len(v) < 3:
            return None
        key = v.lower()
        if key in self._real_to_token:
            return self._real_to_token[key]
        self._counters[kind] += 1
        token = f"[{kind}_{self._counters[kind]}]"
        self._real_to_token[key] = token
        self._token_to_real[token] = v
        self._name_re = None  # rebuild lazily
        return token

    def _build_name_re(self) -> re.Pattern[str] | None:
        names = [k for k in self._real_to_token if not UUID_RE.fullmatch(k) and not re.fullmatch(r"\d{7}", k)]
        if not names:
            return None
        names.sort(key=len, reverse=True)
        return re.compile(r"(?<!\w)(" + "|".join(re.escape(n) for n in names) + r")(?!\w)", re.I)

    def learn_from_json(self, obj: Any) -> None:
        """Learn identifier values from a data-tool result (walks the JSON, sibling-aware)."""
        if obj is None:
            return
        if isinstance(obj, list):
            for item in obj:
                self.learn_from_json(item)
            return
        if isinstance(obj, dict):
            keys = list(obj.keys())
            has_vessel = any(VESSEL_SIGNAL.match(str(k)) for k in keys)
            has_person = any(PERSON_SIGNAL.match(str(k)) for k in keys)
            for k, v in obj.items():
                k = str(k)
                if isinstance(v, str):
                    if NAME_KEY_RE.search(k):
                        self.register(v, "VESSEL" if re.search("vessel", k, re.I) else "PERSON")
                    elif BARE_NAME_KEY.match(k) and (has_vessel or has_person):
                        self.register(v, "VESSEL" if has_vessel else "PERSON")
                    elif IMO_KEY.match(k) and re.fullmatch(r"\d{6,8}", v.strip()):
                        self.register(v.strip(), "IMO")
                elif isinstance(v, (int, float)) and not isinstance(v, bool) and IMO_KEY.match(k):
                    self.register(str(v), "IMO")
                self.learn_from_json(v)

    # -- outbound -----------------------------------------------------------
    def mask_text(self, s: Any) -> Any:
        if not isinstance(s, str) or not s:
            return s
        if "__MASK_FAIL_TEST__" in s:
            raise RuntimeError("masking self-test failure requested")
        out = s
        if self._name_re is None:
            self._name_re = self._build_name_re()
        if self._name_re is not None:
            out = self._name_re.sub(lambda m: self._real_to_token.get(m.group(0).lower(), m.group(0)), out)
        out = UUID_RE.sub(lambda m: self._real_to_token.get(m.group(0).lower()) or self.register(m.group(0), "ID") or m.group(0), out)
        out = IMO_RE.sub(lambda m: self._real_to_token.get(m.group(0)) or self.register(m.group(0), "IMO") or m.group(0), out)
        return out

    def mask_json(self, obj: Any) -> Any:
        """Deep-mask every string in a JSON-like structure (returns a copy)."""
        if isinstance(obj, str):
            return self.mask_text(obj)
        if isinstance(obj, list):
            return [self.mask_json(x) for x in obj]
        if isinstance(obj, dict):
            return {k: self.mask_json(v) for k, v in obj.items()}
        return obj

    # -- inbound ------------------------------------------------------------
    def unmask_text(self, s: Any) -> Any:
        if not isinstance(s, str) or not s:
            return s

        def repl(m: re.Match[str]) -> str:
            tok = f"[{m.group(1)}_{m.group(2)}]"  # canonical form, brackets or not
            real = self._token_to_real.get(tok)
            if real is None:
                self.warnings.append(f"unmapped token left visible: {tok}")
                return tok  # visible placeholder beats a guess or a leak
            return real

        return TOKEN_RE.sub(repl, s)

    def unmask_json(self, obj: Any) -> Any:
        """Restore real values inside LLM-produced tool arguments (deep)."""
        if isinstance(obj, str):
            return self.unmask_text(obj)
        if isinstance(obj, list):
            return [self.unmask_json(x) for x in obj]
        if isinstance(obj, dict):
            return {k: self.unmask_json(v) for k, v in obj.items()}
        return obj

    def size(self) -> int:
        return len(self._token_to_real)
