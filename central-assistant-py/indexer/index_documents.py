"""
The assistant's indexer — Python + pgvector (port plan §S.2 / owner ask 11-Sep).

  parse   PDF/DOCX via LlamaParse v2 (tier agentic by default — the same tier that produced
          the current corpus), result cached on disk per file-hash+tier+version
  chunk   indexer/chunking.py — the same algorithm as the original indexer
  embed   OpenAI text-embedding-3-large, batched
  store   assistant_chunks (pgvector) + assistant_documents manifest, under an INDEX SET

Per-document re-index: one file's rows are replaced inside a transaction (DELETE that file in
that set → INSERT the new chunks → UPSERT its manifest row); nothing else is touched. Adding
the Noon Report manual later is `--only "Noon Report - X.pdf"`.

  DATABASE_URL=... OPENAI_API_KEY=... LLAMA_CLOUD_API_KEY=... \
    python indexer/index_documents.py --documents /app/documents --index-set py-llamaparse \
      [--only FILE ...] [--force] [--fresh-parse] [--tier agentic] [--dry-run]

Module tag = filename prefix before " - " (Technical/Audit/Safety/Incident/Crewing).
"""
from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import os
import re
import sys
import time
from pathlib import Path
from typing import Any

import asyncpg
import httpx2 as httpx
from openai import OpenAI

sys.path.insert(0, str(Path(__file__).resolve().parent))
from chunking import CHUNKER_VERSION, Chunk, chunks_from_markdown, title_stub  # noqa: E402
from clean_markdown import CLEANUP_VERSION, clean_pages  # noqa: E402
from repairs import REPAIR_VERSION, apply_repairs, load_repairs  # noqa: E402
from xrefs import XREF_SETTINGS, XREF_VERSION, resolve_xrefs  # noqa: E402

# Embedding record (owner ask 14-Sep-2026: name the exact model, dimensions and vector handling
# instead of the unproven "embedding drift"). Vectors are stored in pgvector `vector(3072)` as a
# text literal built with repr(float) — full double precision, no rounding on our side.
EMBED_MODEL_DEFAULT = "text-embedding-3-large"
EMBED_DIMS = 3072
VECTOR_HANDLING = "pgvector vector(3072); literal '[repr(float),…]'; no normalisation; squared L2 at query time"

MODULES = {"technical", "audit", "safety", "incident", "crewing"}
LP_UPLOAD = "https://api.cloud.llamaindex.ai/api/v2/parse/upload"
LP_JOB = "https://api.cloud.llamaindex.ai/api/v2/parse/{job_id}"
TERMINAL = {"COMPLETED", "FAILED", "CANCELLED"}


def sha256_file(p: Path) -> str:
    h = hashlib.sha256()
    with p.open("rb") as f:
        for b in iter(lambda: f.read(1 << 20), b""):
            h.update(b)
    return h.hexdigest()


def module_of(file: str) -> str:
    prefix = file.split(" - ")[0].strip().lower()
    return prefix if prefix in MODULES else "unknown"


# ── LlamaParse v2 + the parse store ─────────────────────────────────────────────────
API_ENDPOINT = "api.cloud.llamaindex.ai/api/v2/parse"
OUTPUT_OPTIONS: dict[str, Any] = {"markdown": {"annotate_links": True, "tables": {"merge_continued_tables": True}}, "extract_printed_page_number": True}
PROCESSING_CONTROL: dict[str, Any] = {"timeouts": {"base_in_seconds": 300, "extra_time_per_page_in_seconds": 30}}


def request_configuration(tier: str, version: str) -> dict[str, Any]:
    """EVERY output-affecting request setting we send (add here whenever a new one is used:
    custom prompts, OCR/language options, page selection/cropping, processing control)."""
    return {"tier": tier, "version": version, "output_options": OUTPUT_OPTIONS, "processing_control": PROCESSING_CONTROL,
            "parsing_instruction": None, "target_pages": None, "language": None, "ocr": None}


def parse_key_for(sha: str, tier: str, version: str) -> str:
    """The accepted-parse key: source-file hash + a hash of the COMPLETE request configuration.
    Same key ⇒ same parse is reused and the parser is never called again."""
    cfg = hashlib.sha256(json.dumps(request_configuration(tier, version), sort_keys=True).encode()).hexdigest()[:16]
    return f"{sha}|{cfg}"


def build_key_for(parse_key: str, cleanup_version: str | None, chunker_version: str, max_chunk: int, overlap: int, resolve_xrefs: bool,
                  embed_mode: str = "meta", embed_model: str = EMBED_MODEL_DEFAULT, repairs: bool = False) -> str:
    """The index-build key: parse + cleanup code version + resolver code version + repair version +
    chunker code version + chunk params + embedding input mode + embedding model/dimensions. A
    change in any of these invalidates the built index even when the parse is still valid."""
    return (f"{parse_key}|clean={cleanup_version or 'off'}|xrefs={XREF_VERSION if resolve_xrefs else 'off'}|repairs={REPAIR_VERSION if repairs else 'off'}"
            f"|chunker={chunker_version}|{max_chunk}/{overlap}|embed={EMBED_INPUT_VERSION if embed_mode == 'meta' else 'text'}|model={embed_model}:{EMBED_DIMS}")


def build_record(*, tier: str, version: str, cleaned: bool, resolve: bool, max_chunk: int, overlap: int, embed_mode: str, embed_model: str,
                 repairs: bool = False) -> dict[str, Any]:
    """Everything needed to reproduce a build, stored with each document (clean_report.build)."""
    return {"parser": "llamaparse-v2", "tier": tier, "requested_version": version, "request_configuration": request_configuration(tier, version),
            "cleanup_version": CLEANUP_VERSION if cleaned else None, "xref_version": XREF_VERSION if resolve else None,
            "xref_settings": XREF_SETTINGS if resolve else None, "repair_version": REPAIR_VERSION if repairs else None,
            "chunker_version": CHUNKER_VERSION, "max_chunk": max_chunk, "overlap": overlap,
            "embed_input": EMBED_INPUT_VERSION if embed_mode == "meta" else "text", "embed_model": embed_model, "embed_dims": EMBED_DIMS,
            "vector_handling": VECTOR_HANDLING}


def version_evidence(result: dict[str, Any]) -> tuple[bool, str | None]:
    """The current LlamaParse docs say to read metadata.version; our tested responses do not carry it.
    Record presence/value as evidence (owner is raising the discrepancy with support)."""
    md = result.get("metadata") or {}
    v = md.get("version") if isinstance(md, dict) else None
    return (v is not None), (str(v) if v is not None else None)


async def parse_store_get(conn: asyncpg.Connection | None, key: str) -> dict[str, Any] | None:
    if conn is None:
        return None
    row = await conn.fetchrow("SELECT raw_response FROM assistant_parses WHERE parse_key=$1 AND accepted", key)
    return json.loads(row["raw_response"]) if row else None


async def parse_store_put(conn: asyncpg.Connection | None, *, key: str, file: str, sha: str, tier: str, version: str,
                          options: dict[str, Any], result: dict[str, Any], pages: int | None) -> None:
    if conn is None:
        return
    present, value = version_evidence(result)
    await conn.execute(
        "INSERT INTO assistant_parses (parse_key, file, sha256, tier, requested_version, options, api_endpoint, job_id, "
        "response_version_field, version_field_present, raw_response, pages) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$11::jsonb,$12) "
        "ON CONFLICT (parse_key) DO UPDATE SET raw_response=EXCLUDED.raw_response, job_id=EXCLUDED.job_id, pages=EXCLUDED.pages, "
        "response_version_field=EXCLUDED.response_version_field, version_field_present=EXCLUDED.version_field_present, parsed_at=now(), accepted=TRUE",
        key, file, sha, tier, version, json.dumps(options), API_ENDPOINT, (result.get("job") or {}).get("id"), value, present,
        json.dumps(result, ensure_ascii=False), pages)


def llamaparse(path: Path, *, api_key: str, tier: str, version: str, fresh: bool, cache_dir: Path, log) -> dict[str, Any]:
    """Call LlamaParse v2 (or reuse the on-disk copy of an identical request). The DB parse store
    is consulted BEFORE this in main(); this is the last resort that actually parses."""
    cache_dir.mkdir(parents=True, exist_ok=True)
    key = hashlib.sha256(f"{sha256_file(path)}|tier={tier}|ver={version}|nocache={int(fresh)}".encode()).hexdigest()[:24]
    result_f = cache_dir / f"{path.stem}__{key}.result.json"
    if result_f.exists():
        log(f"   on-disk LlamaParse result for {path.name} ({result_f.name})")
        return json.loads(result_f.read_text(encoding="utf-8"))
    if not api_key:
        raise RuntimeError("LLAMA_CLOUD_API_KEY missing")
    configuration = {"tier": tier, "version": version, "disable_cache": bool(fresh),
                     "output_options": OUTPUT_OPTIONS, "processing_control": PROCESSING_CONTROL}
    headers = {"Authorization": f"Bearer {api_key}"}
    with httpx.Client(timeout=120.0) as c:
        log(f"   uploading {path.name} to LlamaParse v2 (tier={tier}, fresh={fresh})")
        with path.open("rb") as fh:
            r = c.post(LP_UPLOAD, headers=headers, files={"file": (path.name, fh, "application/octet-stream")},
                       data={"configuration": json.dumps(configuration)})
        if r.status_code >= 300:
            raise RuntimeError(f"LlamaParse upload failed: HTTP {r.status_code} {r.text[:300]}")
        job_id = r.json().get("id") or r.json().get("job_id")
        deadline, last = time.time() + 1800, None
        while True:
            if time.time() > deadline:
                raise RuntimeError(f"LlamaParse job {job_id} timed out")
            j = c.get(LP_JOB.format(job_id=job_id), headers=headers, params={"expand": "markdown,metadata,items"})
            if j.status_code >= 300:
                raise RuntimeError(f"LlamaParse job fetch failed: HTTP {j.status_code}")
            result = j.json()
            status = str((result.get("job") or {}).get("status") or "").upper()
            if status != last:
                log(f"   job {job_id}: {status}")
                last = status
            if status in TERMINAL:
                if status != "COMPLETED":
                    raise RuntimeError(f"LlamaParse job {job_id} {status}: {(result.get('job') or {}).get('error_message')}")
                result_f.write_text(json.dumps(result, ensure_ascii=False), encoding="utf-8")
                return result
            time.sleep(1.5)


def markdown_and_pages(result: dict[str, Any]) -> tuple[str, dict[int, str] | None]:
    md_raw = result.get("markdown") or ""
    if isinstance(md_raw, dict):
        page_map: dict[int, str] = {}
        parts = []
        for p in md_raw.get("pages", []):
            if isinstance(p, dict) and p.get("markdown"):
                parts.append(p["markdown"])
                page_map[int(p.get("page_number", 0))] = p["markdown"]
        return "\n\n".join(parts), (page_map or None)
    return str(md_raw), None


# ── embed + store ────────────────────────────────────────────────────────────────────
# The live set was embedded by LlamaIndex, whose nodes embed METADATA + TEXT
# ("file: …\nslug_url: …\nbreadcrumb: …\nsection_title: …\nsource_type: …\nchunk_index: …\n
# page_number: …\nllamaparse_tier: …\nllamaparse_version: …\n\n<text>") — PROVEN 14-Sep by
# cosine against the stored vectors (0.96–0.99 vs 0.36–0.90 for text only). The manual name
# and section title in that prefix are part of what the live routing relies on.
EMBED_META_KEYS = ["file", "slug_url", "breadcrumb", "section_title", "source_type", "chunk_index", "page_number", "llamaparse_tier", "llamaparse_version"]
EMBED_INPUT_VERSION = "llamaindex-meta9"  # part of the build key


def embed_input(chunk: Chunk, mode: str) -> str:
    if mode == "text":
        return chunk.text
    md = "\n".join(f"{k}: {chunk.metadata[k]}" for k in EMBED_META_KEYS if k in chunk.metadata)
    return f"{md}\n\n{chunk.text}"


def embed_sha(text: str, model: str) -> str:
    """Identity of an embedding request: exact input text + model. Same sha ⇒ the stored vector
    is reused verbatim (owner rule 14-Sep-2026: never re-embed an unchanged input)."""
    return hashlib.sha256(f"{model}\n{text}".encode()).hexdigest()


async def stored_vectors(conn: asyncpg.Connection | None, shas: list[str]) -> dict[str, str]:
    """sha → vector literal, from ANY index set that already holds that exact embedding input."""
    if conn is None or not shas:
        return {}
    served = os.environ.get("ASSISTANT_INDEX_SET", "migrated")  # the served set's vector wins when several sets hold the input
    rows = await conn.fetch("SELECT DISTINCT ON (metadata->>'embed_sha') metadata->>'embed_sha' AS s, embedding::text AS v "
                            "FROM assistant_chunks WHERE metadata->>'embed_sha' = ANY($1::text[]) "
                            "ORDER BY metadata->>'embed_sha', (index_set <> $2), index_set", shas, served)
    return {r["s"]: r["v"] for r in rows}


def embed_all(client: OpenAI, model: str, texts: list[str], batch: int, log) -> list[list[float]]:
    out: list[list[float]] = []
    for i in range(0, len(texts), batch):
        r = client.embeddings.create(model=model, input=texts[i:i + batch])
        out.extend(list(d.embedding) for d in sorted(r.data, key=lambda d: d.index))
        log(f"   embedded {min(i + batch, len(texts))}/{len(texts)}")
    return out


def vector_literal(e: list[float]) -> str:
    return "[" + ",".join(repr(float(x)) for x in e) + "]"


async def embed_or_reuse(conn: asyncpg.Connection, client: OpenAI, model: str, texts: list[str], batch: int, reuse: bool, log) -> tuple[list[str], int]:
    """Vector literal per input; reuses stored vectors whose embed_sha matches. Returns (vectors, reused count)."""
    shas = [embed_sha(t, model) for t in texts]
    have = await stored_vectors(conn, list(set(shas))) if reuse else {}
    todo = [i for i, s in enumerate(shas) if s not in have]
    fresh = embed_all(client, model, [texts[i] for i in todo], batch, log) if todo else []
    new = {shas[i]: vector_literal(e) for i, e in zip(todo, fresh, strict=True)}
    log(f"   vectors: reused {len(texts) - len(todo)} stored, embedded {len(todo)} new")
    return [have.get(s) or new[s] for s in shas], len(texts) - len(todo)


async def store_document(conn: asyncpg.Connection, *, index_set: str, file: str, module: str, sha: str, source_type: str,
                         chunks: list[Chunk], vectors: list[str], embed_inputs: list[str], pages: int | None, stub: bool, tier: str, version: str,
                         embed_model: str, job_id: str | None = None, cleaned: bool = False, xrefs_resolved: int = 0,
                         xrefs_unresolved: int = 0, clean_report: dict[str, Any] | None = None) -> None:
    rows = []
    for c, v, inp in zip(chunks, vectors, embed_inputs, strict=True):
        m = dict(c.metadata)
        m["module"] = module
        m["embed_sha"] = embed_sha(inp, embed_model)  # identity of the embedding request → later builds reuse the vector
        m["embed_model"] = embed_model
        m["embed_sha_source"] = "recorded"  # written at embedding time (vs "reconstructed" for backfilled sets)
        pn = m.get("page_number")
        rows.append((index_set, c.id, module, file, m.get("section_title"), m.get("breadcrumb"),
                     str(pn) if pn is not None else None, int(m.get("chunk_index") or 0), c.text, json.dumps(m), v))
    async with conn.transaction():
        await conn.execute("DELETE FROM assistant_chunks WHERE index_set=$1 AND file=$2", index_set, file)
        await conn.executemany(
            "INSERT INTO assistant_chunks (index_set, id, module, file, section_title, breadcrumb, page_number, chunk_index, content, metadata, embedding) "
            "VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::vector)", rows)
        # parser_version = the REQUESTED version. The API does not return the effective one
        # (unverifiable from our side — owner informed 14-Sep-2026); job_id is the audit handle.
        await conn.execute(
            "INSERT INTO assistant_documents (index_set, file, module, sha256, source_type, chunks, pages, stub, parser, parser_tier, parser_version, "
            "embed_model, indexed_at, job_id, cleaned, xrefs_resolved, xrefs_unresolved, clean_report) "
            "VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'llamaparse-v2',$9,$10,$11,now(),$12,$13,$14,$15,$16::jsonb) "
            "ON CONFLICT (index_set, file) DO UPDATE SET module=EXCLUDED.module, sha256=EXCLUDED.sha256, source_type=EXCLUDED.source_type, "
            "chunks=EXCLUDED.chunks, pages=EXCLUDED.pages, stub=EXCLUDED.stub, parser=EXCLUDED.parser, parser_tier=EXCLUDED.parser_tier, "
            "parser_version=EXCLUDED.parser_version, embed_model=EXCLUDED.embed_model, indexed_at=now(), job_id=EXCLUDED.job_id, "
            "cleaned=EXCLUDED.cleaned, xrefs_resolved=EXCLUDED.xrefs_resolved, xrefs_unresolved=EXCLUDED.xrefs_unresolved, clean_report=EXCLUDED.clean_report",
            index_set, file, module, sha, source_type, len(chunks), pages, stub, tier, version, embed_model,
            job_id, cleaned, xrefs_resolved, xrefs_unresolved, json.dumps(clean_report or {}))


async def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--documents", default=os.environ.get("ASSISTANT_DOCUMENTS", "/app/documents"))
    ap.add_argument("--index-set", required=True)
    ap.add_argument("--only", action="append", default=[], help="index just these file names (repeatable)")
    ap.add_argument("--force", action="store_true", help="re-index even if sha256 unchanged")
    ap.add_argument("--fresh-parse", action="store_true", help="bypass the on-disk AND LlamaCloud parse caches")
    ap.add_argument("--tier", default=os.environ.get("LLAMAPARSE_TIER", "agentic"))
    ap.add_argument("--version", default=os.environ.get("LLAMAPARSE_VERSION", "latest"))
    ap.add_argument("--cache-dir", default=None)
    ap.add_argument("--max-chunk", type=int, default=1200)
    ap.add_argument("--overlap", type=int, default=150)
    ap.add_argument("--embed-batch", type=int, default=128)
    ap.add_argument("--dry-run", action="store_true", help="parse + chunk only; no embedding, no DB writes")
    ap.add_argument("--clean", action="store_true", help="pre-chunk cleanup: cover, TOC, page header/footer, screenshot figure zones, inline tags")
    ap.add_argument("--resolve-xrefs", action="store_true", help="append the target section's text to cross-reference-only sections")
    ap.add_argument("--reparse", action="store_true", help="ignore the accepted parse in the parse store and parse again (normally never needed)")
    ap.add_argument("--embed-input", choices=["meta", "text"], default="meta", help="what is embedded: metadata+text (LlamaIndex-compatible, the live set) or text only")
    ap.add_argument("--no-reuse-vectors", action="store_true", help="always call the embedding API, even when a stored vector exists for the identical input")
    ap.add_argument("--apply-repairs", action="store_true", help="insert the verified extraction repairs (indexer/repairs/*.json, matched by source sha256) on their pages")
    ap.add_argument("--kb-dir", default=None, help="KB pilot: directory of reviewed procedure markdown files, indexed as-is (no parser) with metadata source=kb-pilot")
    ap.add_argument("--kb-module", default="technical", help="module tag for --kb-dir files")
    ap.add_argument("--kb-provenance-line", action="store_true",
                    help="KB pilot input-format correction (owner, 15-Sep-2026): prepend one short qualification line to each kb chunk's "
                         "embedded/answer text so the answer model is told which statements are code-derived (draft guidance, inspected "
                         "repository revision, owner-confirmed as the running application) and which come from the manuals; the detailed "
                         "code paths stay in metadata")
    a = ap.parse_args()
    repairs = load_repairs() if a.apply_repairs else {}

    docs = Path(a.documents)
    cache_dir = Path(a.cache_dir) if a.cache_dir else docs.parent / "llamaparse_cache"
    embed_model = os.environ.get("EMBED_MODEL", EMBED_MODEL_DEFAULT)
    log = lambda s: print(s, flush=True)  # noqa: E731

    files = sorted([*docs.glob("*.pdf"), *docs.glob("*.docx")], key=lambda p: p.name)
    if a.only:
        files = [f for f in files if f.name in set(a.only)]
        missing = set(a.only) - {f.name for f in files}
        if missing:
            log(f"ERROR: not found in {docs}: {sorted(missing)}")
            return 2
    log(f"index set '{a.index_set}': {len(files)} files in {docs}; tier={a.tier} version={a.version} fresh={a.fresh_parse} dry_run={a.dry_run}")

    conn = None if a.dry_run else await asyncpg.connect(os.environ["DATABASE_URL"].replace("postgresql+asyncpg://", "postgresql://"))
    oai = None if a.dry_run else OpenAI(api_key=os.environ["OPENAI_API_KEY"])
    summary: list[dict[str, Any]] = []
    failures = 0
    try:
        for f in files:
            sha = sha256_file(f)
            source_type = "pdf" if f.suffix.lower() == ".pdf" else "docx"
            module = module_of(f.name)
            bkey = build_key_for(parse_key_for(sha, a.tier, a.version), CLEANUP_VERSION if a.clean else None, CHUNKER_VERSION,
                                 a.max_chunk, a.overlap, a.resolve_xrefs, a.embed_input, embed_model, a.apply_repairs)
            if conn is not None and not a.force:
                prev = await conn.fetchrow("SELECT sha256, chunks, build_key FROM assistant_documents WHERE index_set=$1 AND file=$2", a.index_set, f.name)
                if prev and prev["sha256"] == sha and prev["chunks"] > 0 and prev["build_key"] == bkey:
                    log(f"= {f.name}: unchanged file + same build key — skip (use --force to redo)")
                    continue
                if prev and prev["sha256"] == sha and prev["build_key"] != bkey:
                    log(f"~ {f.name}: file unchanged but build key differs (cleanup/chunker/params changed) — rebuilding")
            log(f"> {f.name} [{module}/{source_type}]")
            try:
                pkey = parse_key_for(sha, a.tier, a.version)
                result = None if a.reparse else await parse_store_get(conn, pkey)
                if result is not None:
                    log(f"   accepted parse from the parse store (key {pkey[:12]}…) — parser not called")
                else:
                    result = llamaparse(f, api_key=os.environ.get("LLAMA_CLOUD_API_KEY", ""), tier=a.tier, version=a.version,
                                        fresh=a.fresh_parse, cache_dir=cache_dir, log=log)
                md, page_map = markdown_and_pages(result)
                job_id = (result.get("job") or {}).get("id")
                present, vfield = version_evidence(result)
                log(f"   job={job_id} tier={a.tier} requested_version={a.version} response.metadata.version={'present: ' + str(vfield) if present else 'ABSENT'}")
                await parse_store_put(conn, key=pkey, file=f.name, sha=sha, tier=a.tier, version=a.version,
                                      options={**request_configuration(a.tier, a.version), "disable_cache": bool(a.fresh_parse)},
                                      result=result, pages=len(page_map) if page_map else None)
                clean_report: dict[str, Any] = {"parse_key": pkey, "build_key": bkey,
                                                "build": build_record(tier=a.tier, version=a.version, cleaned=a.clean, resolve=a.resolve_xrefs, max_chunk=a.max_chunk,
                                                                      overlap=a.overlap, embed_mode=a.embed_input, embed_model=embed_model, repairs=a.apply_repairs)}
                xres = xun = 0
                if a.clean or a.resolve_xrefs or a.apply_repairs:
                    pm = page_map if page_map else {1: md}
                    if a.apply_repairs:  # before cleanup/xrefs: the transcription is page content like any other
                        pm, rrep = apply_repairs(pm, sha, f.name, repairs)
                        clean_report["repairs"] = {"version": REPAIR_VERSION, "applied": rrep.applied, "not_found": rrep.not_found, "sha_mismatch": rrep.sha_mismatch}
                        if rrep.applied or rrep.not_found or rrep.sha_mismatch:
                            log(f"   repairs: applied={rrep.applied} not_found={rrep.not_found} sha_mismatch={rrep.sha_mismatch}")
                    if a.clean:
                        pm, crep = clean_pages(pm)
                        clean_report.update(crep.as_dict())
                        (cache_dir / f"{f.stem}.cleanlog.json").write_text(json.dumps(crep.as_dict(), ensure_ascii=False, indent=1), encoding="utf-8")
                        log(f"   cleaned: cover={crep.cover_dropped} toc={crep.toc_pages} header={crep.header_lines} footer={crep.footer_lines} "
                            f"zones={crep.figure_zones} tables rm/kept={crep.tables_removed}/{crep.tables_kept} mermaid={crep.mermaid_removed} "
                            f"callouts={crep.callout_lines} struck={crep.struck_spans} carried_headings={crep.carried_headings} removals_logged={len(crep.removed)}")
                    if a.resolve_xrefs:
                        pm, xrep = resolve_xrefs(pm)
                        xres, xun = len(xrep.resolved), len(xrep.unresolved)
                        clean_report["xrefs"] = {"resolved": xrep.resolved, "unresolved": xrep.unresolved, "chained": xrep.chained}
                        log(f"   xrefs: resolved={xres} unresolved={xun} chained={len(xrep.chained)}")
                        for t, r in xrep.unresolved:
                            log(f"      UNRESOLVED {t[:50]} → {r}")
                    page_map = pm if page_map else None
                    md = "\n\n".join(pm[k] for k in sorted(pm))
                extra = {"llamaparse_tier": a.tier, "llamaparse_version": a.version, "llamaparse_job_id": job_id, "cleaned": bool(a.clean),
                         "cleanup_version": CLEANUP_VERSION if a.clean else None, "chunker_version": CHUNKER_VERSION, "xrefs_resolved": bool(a.resolve_xrefs),
                         "repair_version": REPAIR_VERSION if a.apply_repairs else None}
                chunks = chunks_from_markdown(md=md, source_file=f.name, source_type=source_type, max_chunk_size=a.max_chunk,
                                              chunk_overlap=a.overlap, page_map=page_map, extra_metadata=extra)
                stub = False
                if not chunks:
                    chunks, stub = [title_stub(f.name, source_type)], True
                    log("   image-only → title stub")
                pages = len(page_map) if page_map else None
                short = sum(1 for c in chunks if len(c.text) < 100)
                log(f"   {len(chunks)} chunks, pages={pages}, <100-char chunks={short}")
                if conn is not None and oai is not None:
                    inputs = [embed_input(c, a.embed_input) for c in chunks]
                    vecs, reused = await embed_or_reuse(conn, oai, embed_model, inputs, a.embed_batch, not a.no_reuse_vectors, log)
                    clean_report["vectors_reused"] = reused
                    await store_document(conn, index_set=a.index_set, file=f.name, module=module, sha=sha, source_type=source_type,
                                         chunks=chunks, vectors=vecs, embed_inputs=inputs, pages=pages, stub=stub, tier=a.tier, version=a.version,
                                         embed_model=embed_model, job_id=job_id, cleaned=bool(a.clean), xrefs_resolved=xres, xrefs_unresolved=xun,
                                         clean_report=clean_report)
                    await conn.execute("UPDATE assistant_documents SET parse_key=$1, build_key=$2, cleanup_version=$3, chunker_version=$4 "
                                       "WHERE index_set=$5 AND file=$6", pkey, bkey, CLEANUP_VERSION if a.clean else None, CHUNKER_VERSION, a.index_set, f.name)
                    log(f"   stored ({a.index_set})")
                summary.append({"file": f.name, "chunks": len(chunks), "pages": pages, "short": short, "stub": stub})
            except Exception as e:
                failures += 1
                log(f"   FAILED: {e}")
                summary.append({"file": f.name, "error": str(e)})
        # ── KB pilot: reviewed procedure markdown, indexed as-is (owner brief 14/15-Sep-2026) ──
        if a.kb_dir and conn is not None and oai is not None:
            kb = Path(a.kb_dir)
            for f in sorted(kb.glob("*.md")):
                if f.name.upper() in ("README.MD", "CONFLICTS.MD", "REVIEW.MD"):
                    continue
                md = f.read_text(encoding="utf-8")
                title = next((ln.lstrip("# ").strip() for ln in md.splitlines() if ln.startswith("# ")), f.stem)
                display = f"{a.kb_module.title()} - KB pilot: {title}.md"  # keeps the module prefix convention (citation 'manual' = this name)
                sha = hashlib.sha256(md.encode("utf-8")).hexdigest()
                log(f"> {display} [kb-pilot from {f.name}]")
                # Owner rule (15-Sep-2026): ONE chunk per kb file; the Sources block and the inline provenance tags go to
                # chunk METADATA (kept for citations), not into the embedded/answer text.
                body, _, sources = md.partition("\nSources:")
                tags = re.findall(r"\[(?:manual|screenshot|code|unverified)[^\]]*\]", body)
                clean = re.sub(r"\s*\[(?:manual|screenshot|code|unverified)[^\]]*\]", "", body)
                clean = re.sub(r"[ \t]+\n", "\n", clean).strip() + "\n"
                prov_line = None
                if a.kb_provenance_line:
                    # Prepared input-format correction (owner, 15-Sep-2026): the one-chunk mode moved every [code: …] tag to metadata,
                    # so the answer model no longer sees that code-derived behaviour is revision-specific. This ONE line restores
                    # that qualification in the text the model reads; the file:line references stay in kb_provenance metadata.
                    n_code = sum(1 for t in tags if t.startswith("[code"))
                    n_man = sum(1 for t in tags if t.startswith("[manual") or t.startswith("[screenshot"))
                    rev = re.search(r"origin/replit_dev\s+([0-9a-f]{7,})", sources) or re.search(r"\b([0-9a-f]{9})\b", sources)
                    # Owner wording (15-Sep): no "reviewed" unless a review is recorded in REVIEW.md. Owner confirmation (15-Sep): the
                    # running Technical application is the inspected revision — stated as the owner's confirmation, not as a measured check.
                    prov_line = (f"Provenance note: draft code-derived guidance, not a published manual. {n_man} statement(s) come from the June PMS "
                                 f"manuals; {n_code} statement(s) about roles, switches and automatic generation were inspected in the Technical "
                                 f"application code at repository revision {rev.group(1) if rev else 'recorded in the Sources block'}, which the "
                                 f"application owner has confirmed is the code running in the Technical application. Where this guidance and a "
                                 f"manual differ, say which source says what.")
                    # Insert AFTER the title line so the markdown chunker keeps ONE chunk (a paragraph before the first heading
                    # would become its own chunk and the note would never travel with the procedure).
                    first_nl = clean.find("\n")
                    if clean.startswith("#") and first_nl > 0:
                        clean = clean[:first_nl + 1] + "\n" + prov_line + "\n" + clean[first_nl + 1:]
                    else:
                        clean = prov_line + "\n\n" + clean
                extra = {"source": "kb-pilot", "kb_path": f"kb/{a.kb_module}/work-orders/{f.name}", "kb_sha256": sha, "chunker_version": CHUNKER_VERSION,
                         "kb_sources": sources.strip()[:4000], "kb_provenance": tags[:120], "kb_one_chunk": True, "kb_provenance_line": bool(prov_line)}
                chunks = chunks_from_markdown(md=clean, source_file=display, source_type="md", max_chunk_size=100_000, chunk_overlap=0,
                                              page_map=None, extra_metadata=extra)
                log(f"   one-chunk mode: {len(chunks)} chunk(s), {len(chunks[0].text) if chunks else 0} chars embedded text; {len(tags)} provenance tags + Sources block ({len(sources.strip())} chars) moved to metadata")
                inputs = [embed_input(c, a.embed_input) for c in chunks]
                vecs, reused = await embed_or_reuse(conn, oai, embed_model, inputs, a.embed_batch, not a.no_reuse_vectors, log)
                await store_document(conn, index_set=a.index_set, file=display, module=a.kb_module, sha=sha, source_type="md",
                                     chunks=chunks, vectors=vecs, embed_inputs=inputs, pages=None, stub=False, tier="none", version="kb-pilot",
                                     embed_model=embed_model, clean_report={"source": "kb-pilot", "kb_path": extra["kb_path"], "vectors_reused": reused})
                log(f"   {len(chunks)} chunks stored ({a.index_set}, source=kb-pilot)")
                summary.append({"file": display, "chunks": len(chunks), "source": "kb-pilot"})
        if conn is not None:
            total = await conn.fetchval("SELECT count(*) FROM assistant_chunks WHERE index_set=$1", a.index_set)
            log(f"\nindex set '{a.index_set}' now holds {total} chunks across "
                f"{await conn.fetchval('SELECT count(*) FROM assistant_documents WHERE index_set=$1', a.index_set)} documents")
    finally:
        if conn is not None:
            await conn.close()
    log(json.dumps(summary, indent=1))
    log("DONE" if not failures else f"DONE WITH {failures} FAILURE(S)")
    return 0 if not failures else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
