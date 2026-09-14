"""Pre-chunk cleanup + cross-reference resolution — behaviour on synthetic manual pages
shaped like the real parses (agentic captions, cost_effective OCR tables, callouts)."""
from indexer.clean_markdown import clean_pages
from indexer.xrefs import is_pointer, resolve_xrefs

COVER = "Blue water texture\n\n# TECHNICAL USER MANUAL\n\nsail logo\n\nBlue water texture"
TOC = "# TECHNICAL USER MANUAL\n\n## Table of Contents\n\n**1.1 PMS** 4\n* 1.1.1 Opening Screen 5\n* 1.1.2 How to Filter 6\n* 1.1.3 Spares 7\n* 1.1.4 Stores 9"
PAGE_CE = ("# TECHNICAL USER MANUAL\n\n## 1.1.1 OPENING SCREEN\n\n* <u>Upon login, the screen below is seen. (Ref Figure 1)</u>\n"
           "* Click on the 'Audit' module. <u>(Ref Figure 1)</u>\n\n![Dashboard](dashboard.png)\n\nThis screen is seen upon Login credentials.\n\n"
           "Click on Audit module.\n\n**Figure 1**\n\n<table>\n<tr><th>Year</th><th>SIRE</th></tr>\n<tr><td>2025</td><td>4</td></tr>\n</table>\n\n"
           "```mermaid\ngraph TD\n  N0[1. Click here] --> N1[Select]\n```\n\nPage 5 of 64")
PAGE_AG = ("# TECHNICAL USER MANUAL\n\n* In Part D the users can view the maintenance history. (Ref Figure 26)\n\n"
           "Screenshot of the software interface showing the maintenance history section with callouts: 1. From here...\n\nFigure 26\n\n"
           "## 1.1.5 PERMISSION MATRIX\n\nThe matrix below is authoritative.\n\n<table>\n<tr><th>Role</th><th>Can approve</th></tr>\n<tr><td>Master</td><td>Yes</td></tr>\n</table>")


def test_cover_toc_header_footer_and_figure_zone_removed_genuine_table_kept():
    pages, rep = clean_pages({1: COVER, 2: TOC, 3: PAGE_CE, 4: PAGE_AG})
    assert rep.cover_dropped and rep.toc_pages == [2]
    assert 1 not in pages and 2 not in pages  # nothing but decoration / TOC entries on them
    assert {r.rule for r in rep.removed} >= {"cover-image", "toc-entry", "page-footer", "figure-zone-table", "mermaid", "figure-caption"}
    assert all(r.page in (1, 2, 3, 4) and r.text for r in rep.removed)  # every removal logged with its page
    p3 = pages[3]
    assert "TECHNICAL USER MANUAL" not in p3 and "Page 5 of 64" not in p3
    assert "Figure 1" not in p3 and "<table>" not in p3 and "mermaid" not in p3 and "dashboard.png" not in p3
    assert "Click on Audit module" not in p3 and "This screen is seen" not in p3
    assert "Upon login, the screen below is seen." in p3 and "Click on the 'Audit' module." in p3  # instruction kept, tags + (Ref Figure) gone
    assert "<u>" not in p3 and "(Ref Figure 1)" not in p3
    p4 = pages[4]
    assert "Screenshot of the software" not in p4 and "Figure 26" not in p4
    assert "PERMISSION MATRIX" in p4 and "<table>" in p4 and "Master" in p4  # genuine table outside a figure zone is KEPT
    assert rep.tables_removed == 1 and rep.tables_kept == 1 and rep.mermaid_removed == 1


def test_cover_with_revision_text_keeps_the_text():
    pages, rep = clean_pages({1: "Blue water texture\n\n# SAFETY MANUAL\n\nRevision No. 3 — 12.05.2026\n\nsail logo", 2: "## 1 Intro\n\nbody"})
    assert "Revision No. 3" in pages[1] and "Blue water" not in pages[1]


def test_toc_page_with_extra_paragraph_keeps_the_paragraph():
    toc = "## Table of Contents\n\n* 1.1 Opening Screen 5\n* 1.2 How to Filter 6\n* 1.3 Spares 7\n* 1.4 Stores 9\n* 1.5 Reports 11\n\nThis manual applies to Office users only."
    pages, rep = clean_pages({1: toc, 2: "## 1.1 Opening Screen\n\nbody"})
    assert "applies to Office users" in pages[1] and "Opening Screen 5" not in pages[1]


def test_notes_in_figure_zone_and_sentence_after_caption_are_kept():
    md = ("## 6. Part B\n\n* Select No if no further assessment is required. (See Figure 8)\n\n"
          "**Note:** If No is selected, the MoC will be marked as Not Processed.\n\n```mermaid\ngraph TD\n A-->B\n```\n\nFigure 8\n\n"
          "Click on any gauge or chart segment to navigate directly to the corresponding filtered view.\n\n**1. Click here to save.**\n\nFigure 9")
    pages, rep = clean_pages({3: md})
    p = pages[3]
    assert "Not Processed" in p and "Click on any gauge or chart segment" in p
    assert "mermaid" not in p and "Click here to save" not in p and "Figure 8" not in p


def test_genuine_table_inside_figure_zone_is_kept_but_screenshot_grid_is_removed():
    md = ("## 3. Severity\n\n* Classify the incident using the matrix below. (See Figure 7)\n\n"
          "<table>\n<tr><th>Severity Level</th><th>Personnel Injury</th></tr>\n"
          "<tr><td>5 - Catastrophic</td><td>Fatality or permanent total disability of one or more persons</td></tr>\n</table>\n\n"
          "<table>\n<tr><th>Report Id</th><th>Date</th><th>Vessel</th></tr>\n<tr><td>NM-0012</td><td>18/03/2026</td><td>Vessel 5</td></tr>\n</table>\n\n"
          "Figure 7")
    pages, rep = clean_pages({7: md})
    p = pages[7]
    assert "permanent total disability" in p          # genuine matrix (sentence cells) survives the zone
    assert "NM-0012" not in p                          # screenshot grid (short cells) goes
    assert rep.tables_kept == 1 and rep.tables_removed == 1


def test_unique_callout_is_kept_duplicate_callout_is_removed():
    md = ("## Figure 20\n\n**Use the available filters to refine the displayed observations**\n\n**Click here to export the data**\n\n"
          "<table>\n<tr><td>Obs</td><td>Q1</td></tr>\n</table>\n\n**Click 'Save' to save the updates.**\n\nFigure 20\n\n"
          "* Click 'Save' to save the updates after entering vessel comments.")
    pages, rep = clean_pages({15: md})
    p = pages[15]
    assert "export the data" in p                       # unique on the page → kept
    assert "refine the displayed observations" in p     # unique → kept
    assert "Click 'Save' to save the updates.\n" not in p and p.count("save the updates") == 1  # duplicate of the bullet → removed
    assert any(r.rule == "KEPT-unique-callout" for r in rep.removed)


def test_instruction_inside_agentic_caption_is_salvaged_duplicate_callouts_are_not():
    md = ("## 1.1.4.3 HOW TO ADD COMPONENTS\n\n* Click on the 'Add Component' button. (Ref Figure 34)\n\n"
          "Screenshot of the Components screen showing the Add Component button. Annotated with: 1. Click here for the Add Component button.\n\nFigure 34\n\n"
          "* Click the 'Save' button to save the component information. (Ref Figure 35)\n\n"
          "Screenshot of the Add Component screen showing the Save button. Annotated with: 1. Click here to save the component information. "
          "A red note box states: Note: A new component can also be added by clicking the '+ Add Component' button.\n\nFigure 35")
    pages, rep = clean_pages({24: md})
    p = pages[24]
    assert "can also be added by clicking the '+ Add Component' button" in p   # instruction inside the caption survives
    assert "Screenshot of the Components screen" not in p                        # the description itself does not
    assert "Click here for the Add Component button" not in p                   # duplicate of the bullet → not salvaged
    assert any(r.rule == "caption-salvaged" for r in rep.removed)


def test_struck_through_content_is_removed_not_unwrapped():
    pages, rep = clean_pages({1: "## Steps\n\n* Click Save. <s>Then click Submit twice.</s>\n* ~~Old rule: approve without review.~~ New rule: review first."})
    p = pages[1]
    assert "Submit twice" not in p and "approve without review" not in p and "review first" in p
    assert rep.struck_spans == 2 and any(r.rule == "struck-through" for r in rep.removed)


def test_header_removed_and_last_heading_carried_to_continuation_page():
    pages, rep = clean_pages({1: "# TECHNICAL USER MANUAL\n\n## 1.1.4 HOW TO ADD COMPONENTS\n\n* step one",
                              2: "# TECHNICAL USER MANUAL\n\n* step two continues here",
                              3: "# TECHNICAL USER MANUAL\n\n## 1.1.5 NEXT\n\n* other"})
    assert "TECHNICAL USER MANUAL" not in pages[2]
    assert pages[2].startswith("## 1.1.4 HOW TO ADD COMPONENTS")  # carried, so page-2 chunks keep their section
    assert pages[3].startswith("## 1.1.5 NEXT") and rep.carried_headings == 1 and rep.header_lines == 3


MANUAL = {
    5: "## 1.1.7 SPARES\n\n### 1.1.7.2 HOW TO APPLY FILTER\n\n* Click the 'Filter' button.\n* Choose the criteria and click 'Apply'.\n\n### 1.1.7.6 HOW TO EXPORT SPARES\n\n* Click 'Export' to download the list.",
    9: "## 1.1.8 STORES\n\n### 1.1.8.2 HOW TO APPLY FILTER\n\n* Refer to the 'Spares' sub-sub-module for the filter process and apply the same steps.\n\n### 1.1.8.6 HOW TO EXPORT STORE ITEMS\n\n* Refer to the 'Spares' sub-sub-module and follow the same steps.\n\n### 1.1.8.7 HOW TO ARCHIVE\n\n* Refer to the 'Warehouse' sub-sub-module and follow the same steps.",
    12: "## 1.1.9 CONSUMABLES\n\n### 1.1.9.2 HOW TO APPLY FILTER\n\n* Refer to the 'Stores' sub-sub-module for the filter process and apply the same steps.",
}


def test_is_pointer():
    assert is_pointer("* Refer to the ‘In—Progress’ sub-sub-module for edit and delete process and apply the same steps.") == "In—Progress"
    long_body = "* Click the button.\n" + "* Fill every field in the form and save the record before continuing.\n" * 4 + "* Refer to the 'Spares' sub-sub-module for details."
    assert is_pointer(long_body) is None  # bodies with real steps are not pointers
    assert is_pointer("* Click 'Filter'.") is None


def test_resolves_appends_target_steps_and_reports_edges():
    out, rep = resolve_xrefs(MANUAL)
    resolved = dict(rep.resolved)
    assert resolved["1.1.8.2 HOW TO APPLY FILTER"] == "1.1.7.2 HOW TO APPLY FILTER"
    assert resolved["1.1.8.6 HOW TO EXPORT STORE ITEMS"] == "1.1.7.6 HOW TO EXPORT SPARES"
    assert "Choose the criteria and click 'Apply'." in out[9]
    assert "(Cross-reference resolved: the steps for Stores › How To Apply Filter are the same as section 1.1.7.2 'How To Apply Filter' under Spares, page 5. They are:)" in out[9]  # honest attribution, both sides named
    # the pointer's own sentence is kept, and the appended text lands inside the pointer section (before the next heading)
    assert out[9].index("Refer to the 'Spares'") < out[9].index("Choose the criteria") < out[9].index("### 1.1.8.6")
    # dead end: no 'Warehouse' section
    assert any(t == "1.1.8.7 HOW TO ARCHIVE" and "no section named 'Warehouse'" in r for t, r in rep.unresolved)
    # chain: Consumables → Stores (itself a pointer) → Spares
    assert resolved["1.1.9.2 HOW TO APPLY FILTER"] == "1.1.7.2 HOW TO APPLY FILTER"
    assert any(t == "1.1.9.2 HOW TO APPLY FILTER" for t, _ in rep.chained)
    assert "Choose the criteria" in out[12]


def test_cycle_is_unresolved_not_infinite():
    pages = {1: "## 1.1 ALPHA\n\n### 1.1.1 HOW TO FILTER\n\n* Refer to the 'Bravo' sub-module for the filter process.\n\n## 1.2 BRAVO\n\n### 1.2.1 HOW TO FILTER\n\n* Refer to the 'Alpha' sub-module for the filter process."}
    out, rep = resolve_xrefs(pages)
    assert len(rep.resolved) == 0 and len(rep.unresolved) == 2 and all("cycle" in r for _, r in rep.unresolved)
    assert out == pages
