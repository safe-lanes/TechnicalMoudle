# Before/after preview of the cross-reference repair, on the five scenarios the reviewer named:
# Waitlist export, Monthly tests, Appraisals filters, Stores export, Surveys editing.
#
# Takes the CURRENTLY INDEXED text (xrefs.json, pulled from kb-pilot-e), splits off the quoted source
# body, and re-renders it through the new indexer/xrefs.py:render_resolved(). Nothing is written and
# nothing is indexed — this is for reading before any regeneration.
#
#   python repair_preview.py [scenario-substring]
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[3] / "central-assistant-py" / "indexer"))
import xrefs  # noqa: E402

ROWS = json.loads((HERE / "xrefs.json").read_text(encoding="utf-8"))
HEAD = re.compile(r"\(Cross-reference resolved: the steps for (.+?) [›>] (.+?) are the same as "
                  r"(section [\d.]+ '.+?'(?: under .+?)?(?:, page \d+)?)(\s*\(reached via[^)]*\))?\. "
                  r"They are:\)", re.S)

SCENARIOS = [
    ("Waitlist export", "crewing", "22", "1.2.3.3"),
    ("Monthly alcohol test create", "crewing", "62", "1.8.3.2"),
    ("Appraisals filter", "crewing", "51", "1.7.1.2"),
    ("Stores export", "technical", "44", "1.1.8.6"),
    ("Surveys editing", "technical", "10", "1.1.4.4"),
]


def main() -> None:
    want = sys.argv[1].lower() if len(sys.argv) > 1 else None
    for label, module, page, number in SCENARIOS:
        if want and want not in label.lower():
            continue
        row = next((r for r in ROWS if r["module"] == module and str(r["page"]) == page
                    and (r["section"] or "").startswith(number)), None)
        if row is None:
            print(f"### {label}: not found\n")
            continue
        m = HEAD.search(row["content"])
        if not m:
            print(f"### {label}: header did not parse\n")
            continue
        dest_parent, dest_title, citation, via = m.group(1), m.group(2), m.group(3), (m.group(4) or "")
        body = row["content"][m.end():].strip("\n")
        src_parent = (re.search(r"under (.+?),", citation) or re.search(r"'(.+?)'", citation)).group(1)

        print("=" * 108)
        print(f"### {label}   [{module} p.{page} {row['section']}]")
        print("\n--- BEFORE (as currently indexed) ---")
        print("(Cross-reference resolved: the steps for " + dest_parent + " › " + dest_title
              + " are the same as " + citation + via + ". They are:)")
        print(body[:420].rstrip() + ("\n   …" if len(body) > 420 else ""))
        print("\n--- AFTER (new render) ---")
        print(xrefs.render_resolved(dest_parent=dest_parent, dest_title=dest_title,
                                    src_citation=citation + via, src_parent=src_parent,
                                    body=body)[:1700].rstrip())
        print()


if __name__ == "__main__":
    main()
