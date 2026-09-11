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
import sys
import time
from pathlib import Path
from typing import Any

import asyncpg
import httpx2 as httpx
from openai import OpenAI

sys.path.insert(0, str(Path(__file__).resolve().parent))
from chunking import Chunk, chunks_from_markdown, title_stub  # noqa: E402

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


# ── LlamaParse v2 ───────────────────────────────────────────────────────────────────
def llamaparse(path: Path, *, api_key: str, tier: str, version: str, fresh: bool, cache_dir: Path, log) -> dict[str, Any]:
    cache_dir.mkdir(parents=True, exist_ok=True)
    key = hashlib.sha256(f"{sha256_file(path)}|tier={tier}|ver={version}|nocache={int(fresh)}".encode()).hexdigest()[:24]
    result_f = cache_dir / f"{path.stem}__{key}.result.json"
    # The on-disk cache key includes the fresh flag, so a --fresh-parse result is reused by a
    # later --fresh-parse run (a failed/dry run never costs a second LlamaCloud parse).
    if result_f.exists():
        log(f"   cached LlamaParse result for {path.name} ({result_f.name})")
        return json.loads(result_f.read_text(encoding="utf-8"))
    if not api_key:
        raise RuntimeError("LLAMA_CLOUD_API_KEY missing")
    configuration = {
        "tier": tier, "version": version, "disable_cache": bool(fresh),
        "output_options": {"markdown": {"annotate_links": True, "tables": {"merge_continued_tables": True}}, "extract_printed_page_number": True},
        "processing_control": {"timeouts": {"base_in_seconds": 300, "extra_time_per_page_in_seconds": 30}},
    }
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
def embed_all(client: OpenAI, model: str, texts: list[str], batch: int, log) -> list[list[float]]:
    out: list[list[float]] = []
    for i in range(0, len(texts), batch):
        r = client.embeddings.create(model=model, input=texts[i:i + batch])
        out.extend(list(d.embedding) for d in sorted(r.data, key=lambda d: d.index))
        log(f"   embedded {min(i + batch, len(texts))}/{len(texts)}")
    return out


async def store_document(conn: asyncpg.Connection, *, index_set: str, file: str, module: str, sha: str, source_type: str,
                         chunks: list[Chunk], embeddings: list[list[float]], pages: int | None, stub: bool, tier: str, version: str,
                         embed_model: str) -> None:
    rows = []
    for c, e in zip(chunks, embeddings, strict=True):
        m = dict(c.metadata)
        m["module"] = module
        pn = m.get("page_number")
        rows.append((index_set, c.id, module, file, m.get("section_title"), m.get("breadcrumb"),
                     str(pn) if pn is not None else None, int(m.get("chunk_index") or 0), c.text, json.dumps(m),
                     "[" + ",".join(repr(float(x)) for x in e) + "]"))
    async with conn.transaction():
        await conn.execute("DELETE FROM assistant_chunks WHERE index_set=$1 AND file=$2", index_set, file)
        await conn.executemany(
            "INSERT INTO assistant_chunks (index_set, id, module, file, section_title, breadcrumb, page_number, chunk_index, content, metadata, embedding) "
            "VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::vector)", rows)
        await conn.execute(
            "INSERT INTO assistant_documents (index_set, file, module, sha256, source_type, chunks, pages, stub, parser, parser_tier, parser_version, embed_model, indexed_at) "
            "VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'llamaparse-v2',$9,$10,$11,now()) "
            "ON CONFLICT (index_set, file) DO UPDATE SET module=EXCLUDED.module, sha256=EXCLUDED.sha256, source_type=EXCLUDED.source_type, "
            "chunks=EXCLUDED.chunks, pages=EXCLUDED.pages, stub=EXCLUDED.stub, parser=EXCLUDED.parser, parser_tier=EXCLUDED.parser_tier, "
            "parser_version=EXCLUDED.parser_version, embed_model=EXCLUDED.embed_model, indexed_at=now()",
            index_set, file, module, sha, source_type, len(chunks), pages, stub, tier, version, embed_model)


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
    a = ap.parse_args()

    docs = Path(a.documents)
    cache_dir = Path(a.cache_dir) if a.cache_dir else docs.parent / "llamaparse_cache"
    embed_model = os.environ.get("EMBED_MODEL", "text-embedding-3-large")
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
            if conn is not None and not a.force:
                prev = await conn.fetchrow("SELECT sha256, chunks FROM assistant_documents WHERE index_set=$1 AND file=$2", a.index_set, f.name)
                if prev and prev["sha256"] == sha and prev["chunks"] > 0:
                    log(f"= {f.name}: unchanged ({prev['chunks']} chunks) — skip (use --force to redo)")
                    continue
            log(f"> {f.name} [{module}/{source_type}]")
            try:
                result = llamaparse(f, api_key=os.environ.get("LLAMA_CLOUD_API_KEY", ""), tier=a.tier, version=a.version,
                                    fresh=a.fresh_parse, cache_dir=cache_dir, log=log)
                md, page_map = markdown_and_pages(result)
                chunks = chunks_from_markdown(md=md, source_file=f.name, source_type=source_type, max_chunk_size=a.max_chunk,
                                              chunk_overlap=a.overlap, page_map=page_map,
                                              extra_metadata={"llamaparse_tier": a.tier, "llamaparse_version": a.version})
                stub = False
                if not chunks:
                    chunks, stub = [title_stub(f.name, source_type)], True
                    log("   image-only → title stub")
                pages = len(page_map) if page_map else None
                short = sum(1 for c in chunks if len(c.text) < 100)
                log(f"   {len(chunks)} chunks, pages={pages}, <100-char chunks={short}")
                if conn is not None and oai is not None:
                    embs = embed_all(oai, embed_model, [c.text for c in chunks], a.embed_batch, log)
                    await store_document(conn, index_set=a.index_set, file=f.name, module=module, sha=sha, source_type=source_type,
                                         chunks=chunks, embeddings=embs, pages=pages, stub=stub, tier=a.tier, version=a.version, embed_model=embed_model)
                    log(f"   stored ({a.index_set})")
                summary.append({"file": f.name, "chunks": len(chunks), "pages": pages, "short": short, "stub": stub})
            except Exception as e:
                failures += 1
                log(f"   FAILED: {e}")
                summary.append({"file": f.name, "error": str(e)})
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
