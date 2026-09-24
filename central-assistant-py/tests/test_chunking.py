"""Chunker parity — the port must produce the same sections, pieces, metadata and ids the
original indexer produced (same algorithm, so the re-index is comparable chunk for chunk)."""
import hashlib

from indexer.chunking import (
    build_breadcrumb,
    chunk_text_by_chars,
    chunks_from_markdown,
    split_by_headings,
    stable_slug,
    strip_html_tags,
    title_stub,
)


def test_split_by_headings_keeps_preamble_and_titles():
    md = "intro text\n\n# One\nbody one\n\n## Two\nbody two"
    assert split_by_headings(md) == [("Preamble", "intro text"), ("One", "body one"), ("Two", "body two")]
    assert split_by_headings("no headings at all") == [("Document", "no headings at all")]


def test_chunk_text_by_chars_overlap_and_tail():
    text = "abcdefghij" * 30  # 300 chars
    pieces = chunk_text_by_chars(text, 100, 20)
    assert [len(p) for p in pieces] == [100, 100, 100, 60]  # windows start at 0, 80, 160, 240 (tail = 300-240)
    assert pieces[1].startswith(text[80:90])
    assert chunk_text_by_chars("", 100, 20) == []
    assert chunk_text_by_chars("short", 0, 0) == ["short"]


def test_helpers_match_original():
    assert stable_slug("Fleet Sharing: Office!") == "sec-fleet-sharing-office"
    assert build_breadcrumb("Doc", "Doc") == "Doc"
    assert build_breadcrumb("Doc", "Sec (p.3)") == "Doc > Sec (p.3)"
    assert strip_html_tags("<u>Title</u> <b>x</b>") == "Title x"


def test_pdf_chunks_metadata_and_stable_id():
    page_map = {1: "# Preamble heading\nsome text", 2: "## Steps\nstep text"}
    chunks = chunks_from_markdown(md="", source_file="Audit - X.pdf", source_type="pdf", max_chunk_size=1200, chunk_overlap=150,
                                  page_map=page_map, extra_metadata={"llamaparse_tier": "agentic"})
    assert [c.metadata["page_number"] for c in chunks] == [1, 2]
    c0 = chunks[0]
    assert c0.metadata["file"] == "Audit - X.pdf"
    assert c0.metadata["slug_url"] == "Audit - X.pdf#page=1"
    assert c0.metadata["breadcrumb"] == "Audit - X > Preamble heading (p.1)"
    assert c0.metadata["section_title"] == "Preamble heading"
    assert c0.metadata["llamaparse_tier"] == "agentic" and c0.metadata["chunk_index"] == 0
    h = hashlib.sha1(c0.text.encode()).hexdigest()[:12]
    expected = hashlib.sha1(f"Audit - X.pdf|pdf|Preamble heading|p=1|i=0|{h}".encode()).hexdigest()
    assert c0.id == expected  # the original id scheme, byte for byte


def test_docx_chunks_use_slug_anchor_and_no_page():
    chunks = chunks_from_markdown(md="# Sync\nhow it works", source_file="Technical - Sync.docx", source_type="docx",
                                  max_chunk_size=1200, chunk_overlap=150)
    assert len(chunks) == 1 and "page_number" not in chunks[0].metadata
    assert chunks[0].metadata["slug_url"] == "Technical - Sync.docx#sec-sync"
    assert chunks[0].metadata["breadcrumb"] == "Technical - Sync > Sync"


def test_title_stub_for_image_only_file():
    s = title_stub("Safety - Scan_Only.pdf", "pdf")
    assert s.text == "Safety - Scan Only" and s.metadata["stub"] is True and s.id.startswith("node-")
