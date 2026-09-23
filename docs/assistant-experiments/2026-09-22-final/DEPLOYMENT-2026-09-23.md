# Deployment report — SAIL AI Assistant, 23-Sep-2026 05:36 UTC

Authorised by Ghazi Anwer (GO for the exact package of `FINAL-DECISION-3.md`). No repository push or merge.

## 1. What is live

| | |
|---|---|
| container | **`sail-assistant-py-cand2`**, 127.0.0.1:8041 → 8000, `--restart unless-stopped`, network `technical-rag-net` |
| image | `sail-assistant-py:v6-r9`, pinned by image ID **`sha256:722127cab5373572d36378d282ccb05d741124f792cde0a5eaa22131cb4f1da2`** (the image is locally built and has no registry digest; the ID is the content digest) |
| index | **`kb-xref-e`** — 30 documents, 965 chunks (`assistant_documents` 30 rows / 965; `assistant_chunks` 965); the 30-source manifest of `manifest.json`, R6 Recent Updates, five KB files, resolver 2026-09-22.4, quote-excluded layout, repairs 2026-09-14.1 |
| prompt / model | v5 `docsPromptSha ff9ee87141ac1362` (combined `aea94e2f5edb6948`), `gpt-5.6-luna`, default temperature |
| flags | `ASSISTANT_DOCS_PROMPT=v5`, `ASSISTANT_ROUTE_INTENT=on`, `ASSISTANT_HYBRID=rescue`, `ASSISTANT_CROSS_MODULE_GAP=0.25`, `ASSISTANT_CROSS_MODULE_SLOTS=2`, `ROUTE_MARGIN=0.07`; env-file `~/central-assistant/assistant-luna.env`; **no** capture variable |
| identity check | env diff against the tested container `sail-assistant-py-g6`: only `ASSISTANT_CAPTURE_OUTBOUND` absent; `/health` identical to the tested one |
| nginx | `/etc/nginx/conf.d/assistant.conf:21` and `/etc/nginx/conf.d/safelanes.conf:375` — `proxy_pass http://127.0.0.1:8017;` → `…:8041;` — the only two lines changed (diff against the backups = exactly those two lines); `nginx -t` ok; `systemctl reload nginx` (graceful) at **05:36:32 UTC** |
| backups | `/etc/nginx/conf.d/assistant.conf.bak-8017-20260923053632`, `/etc/nginx/conf.d/safelanes.conf.bak-8017-20260923053632` |
| previous container | **`sail-assistant-py-cand`** :8017 (prompt-v2 image, index `repaired`, gpt-4o-mini) **kept running** for rollback |
| other sites / containers | before/after snapshot (`s13/before.txt`, `s13/after.txt`) identical apart from the new container's own row; `devsmsragai.com` was unreachable from the server before the switch and still is (pre-existing, not touched) |

## 2. Verification through the public paths (both `https://assistant.sl-sail.com` and `https://viqmap.sl-sail.com/assistant`)

| check | result |
|---|---|
| health + identities | both paths: `indexSet kb-xref-e`, `chunks 965`, `docsPromptSha ff9ee87141ac1362`, `chatModel gpt-5.6-luna` |
| admin path denied publicly | 403 on both paths (`/admin/pairs`) |
| authentication | no token 401 `missing` · malformed token 401 · expired token 401 `expired` · wrong-key token 401 `bad-signature` |
| tenant isolation (two throwaway tenants `deploy-iso-a/b-1790141818`) | both answer; A disabled via the tunnel-only admin path → A refused with the "not enabled" message while B unaffected; A re-enabled → answers again; conversation log per tenant as expected (`s13/iso.txt`: **RESULT PASS**) |
| routing probes 13 | **13/13** on both paths |
| retrieval 18 (expectations v1 and v2) | **18/18** on both paths |
| work orders 8 (+5 phrasings), 3 runs, all-three rule | **8/8** (assistant path) |
| cross-reference 8 cases × 3 runs | assistant path **20 correct / 3 limited / 1 mechanical flag**; viqmap path **21 / 3 / 0**; **Stores bulk update 3/3 correct on both paths** (stays in Stores, Consume/Receive, Save Updates → Confirm & Save, "do not open Spares", code-derived permission labelled, §1.1.8.3 cited); appraisals *limited* by the documented cap |
| the one flag, read in full | waitlist-export run 3: correct Waitlist steps (Waitlist → Edit → Export, §1.2.3.3 with §1.2.1.5 named as the source), but the closing sentence says *"The manual notes that the sequence is adapted from In Progress"* — the resolver's indexing note attributed to the manual. The documented provenance-misattribution limitation (low rate), not a wrong-screen instruction; no rollback trigger |
| latency (public, concurrent with the suites) | cross-reference answers mean 5.0 s |
| logs since the switch | service container: 0 errors/tracebacks; nginx: 0 5xx on either site; only my own 404 probes of `/osm/` and `/maran/` in the global error log |

Answers were compared by meaning against the tested run (`s12/`): same procedures, same screens, same citations; the only differences are wording.

## 3. Remaining limitations (accepted for this release)
- appraisals-filter stays *limited* (Crewing field lists unverifiable); provenance misattribution at a low rate (1 of 48 public answers here); 10 pointer sentences of other forms unresolved by design; manual-coverage literal-phrase misses as documented; ≈ 2× latency and ≈ 2× model cost vs the previous package (≈ $0.70 per 1,000 answered questions at list price).
- Test conversations from these checks are in the shared assistant database under `smoke-suite-tenant` and the two `deploy-iso-*` tenants.

## 4. Exact rollback (seconds; the old container never stopped)
```bash
sudo cp -p /etc/nginx/conf.d/assistant.conf.bak-8017-20260923053632 /etc/nginx/conf.d/assistant.conf
sudo cp -p /etc/nginx/conf.d/safelanes.conf.bak-8017-20260923053632 /etc/nginx/conf.d/safelanes.conf
sudo nginx -t && sudo systemctl reload nginx
curl -s https://assistant.sl-sail.com/health   # must show indexSet "repaired", chunks 911, docsPromptSha b37172f6122a0257
```
Then, only once traffic is confirmed back on 8017: `docker stop sail-assistant-py-cand2 && docker rm sail-assistant-py-cand2`.
Equivalent one-liner if the backups are ever missing: change the two `proxy_pass` lines from `8041` back to `8017`.

## 5. Evidence
`s13/before.txt`, `s13/after.txt`, `s13/iso.txt`, `s13/runs.txt`, `s13/routing-dump.jsonl`, `s13/wo-dump.jsonl`,
`s13/xref-answers-public.json`, `postdeploy_iso.py`; server: `~/central-assistant-py/run-s13-postdeploy.sh`, `s13/snapshot.sh`.
