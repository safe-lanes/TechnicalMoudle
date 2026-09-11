"""
LlamaParse markdown → chunks. A faithful port of the pipeline that produced the current
907 chunks (rag/dev/tools/indexer_unified_refactored.py, Mar-2026):

  split each page's markdown by headings (`#`..`######`), keep text before the first
  heading as "Preamble" → cut each section into ~max_chars pieces with overlap →
  one chunk per piece with metadata file / slug_url / breadcrumb / section_title /
  source_type / page_number / chunk_index, and a content-derived sha1 id.

Same algorithm, same ids for the same input — so a re-index can be compared chunk for
chunk with the migrated set. Deliberately NOT "improved" here: chunking changes are a
measured step, not a side effect of the rewrite.
"""
from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

_HEADING_RE = re.compile(r"^(#{1,6})\s+(.*)\s*$", re.MULTILINE)
_TAG_RE = re.compile(r"<[^>]+>")


@dataclass
class Chunk:
    id: str
    text: str
    metadata: dict[str, Any] = field(default_factory=dict)


def stable_slug(s: str) -> str:
    s = (s or "untitled").strip().lower()
    s = re.sub(r"[^\w\s-]", "", s)
    s = re.sub(r"[-\s]+", "-", s)
    return f"sec-{s[:50]}" if s else "sec-untitled"


def build_breadcrumb(doc: str, section: str) -> str:
    doc = doc.replace(".html", "")
    if not section or section == doc:
        return doc
    return f"{doc} > {section}"


def stable_node_id(file: str, section_id: str, chunk_index: int = 0) -> str:
    return f"node-{hashlib.sha1(f'{file}::{section_id}::{chunk_index}'.encode()).hexdigest()}"


def strip_html_tags(text: str) -> str:
    return _TAG_RE.sub("", text).strip() if text else text


def split_by_headings(md: str) -> list[tuple[str, str]]:
    """[(title, content_md)]; text before the first heading is kept as 'Preamble'."""
    matches = list(_HEADING_RE.finditer(md))
    if not matches:
        return [("Document", md)]
    sections: list[tuple[str, str]] = []
    for i, m in enumerate(matches):
        title = m.group(2).strip() or "Section"
        start = m.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(md)
        sections.append((title, md[start:end].strip()))
    prefix = md[: matches[0].start()].strip()
    if prefix:
        sections.insert(0, ("Preamble", prefix))
    return sections


def chunk_text_by_chars(text: str, max_chars: int, overlap_chars: int) -> list[str]:
    text = (text or "").strip()
    if not text:
        return []
    if max_chars <= 0:
        return [text]
    out: list[str] = []
    i, n = 0, len(text)
    while i < n:
        j = min(i + max_chars, n)
        piece = text[i:j].strip()
        if piece:
            out.append(piece)
        if j >= n:
            break
        i = max(0, j - max(0, overlap_chars))
    return out


def chunks_from_markdown(*, md: str, source_file: str, source_type: str, max_chunk_size: int, chunk_overlap: int,
                         extra_metadata: dict[str, Any] | None = None, page_map: dict[int, str] | None = None) -> list[Chunk]:
    extra_metadata = extra_metadata or {}
    chunks: list[Chunk] = []

    def add(text: str, section_title: str, page_number: int | None, chunk_index: int) -> None:
        page = int(page_number) if page_number is not None else 0
        clean = strip_html_tags(section_title)
        if source_type == "pdf":
            slug_url = f"{source_file}#page={page}" if page else source_file
            crumb = f"{clean} (p.{page})" if page else clean
        else:
            slug_url = f"{source_file}#{stable_slug(clean)}"
            crumb = clean
        meta: dict[str, Any] = {
            "file": source_file, "slug_url": slug_url, "breadcrumb": build_breadcrumb(Path(source_file).stem, crumb),
            "section_title": clean, "source_type": source_type, "chunk_index": chunk_index,
        }
        if page_number is not None:
            meta["page_number"] = page
        meta.update(extra_metadata)
        h = hashlib.sha1(text.encode("utf-8", errors="ignore")).hexdigest()[:12]
        base = f"{source_file}|{source_type}|{section_title}|p={page}|i={chunk_index}|{h}"
        chunks.append(Chunk(id=hashlib.sha1(base.encode("utf-8")).hexdigest(), text=text, metadata=meta))

    if page_map:
        for page_no in sorted(page_map):
            sections = split_by_headings(page_map[page_no]) or [("Page", page_map[page_no])]
            idx = 0
            for title, body in sections:
                for piece in chunk_text_by_chars(body, max_chunk_size, chunk_overlap):
                    add(piece, title, page_no, idx)
                    idx += 1
        return chunks
    idx = 0
    for title, body in split_by_headings(md):
        for piece in chunk_text_by_chars(body, max_chunk_size, chunk_overlap):
            add(piece, title, None, idx)
            idx += 1
    return chunks


def title_stub(source_file: str, source_type: str) -> Chunk:
    """Image-only file → a single title stub so the document is at least findable by name."""
    title = Path(source_file).stem.replace("_", " ")
    sid = stable_slug(title)
    return Chunk(id=stable_node_id(source_file, sid, 0), text=title, metadata={
        "file": source_file, "slug_url": source_file if source_type == "pdf" else f"{source_file}#{sid}",
        "breadcrumb": build_breadcrumb(Path(source_file).stem, title), "section_title": title,
        "source_type": source_type, "chunk_index": 0, "is_complete_section": True, "stub": True,
    })
