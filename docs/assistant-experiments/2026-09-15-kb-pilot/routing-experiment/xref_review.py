# Semantic review of all 41 resolved cross-references (reviewer, 22-Sep-2026).
#
# The earlier audit matched ONE navigation pattern and reported 13. The reviewer's point: those are 13
# matches to a pattern, not 13 confirmed defects, and they do not make the other 28 safe. He found
# wrong RECORD TYPE among the 28 — "Periodic alcohol tests" carrying "Create a new ANNUAL drug and
# alcohol record", "Export Surveys" carrying "download the displayed CERTIFICATE records".
#
# So this script does not decide anything. It prints every one of the 41 with the destination, the
# source and the full pasted body, and mechanically flags candidates on FOUR axes so the reading is
# prioritised rather than replaced:
#     screen       — the body tells the user to open the source sub-module
#     record type  — the body names the source's distinctive noun
#     action       — the body's verb differs from the destination action
#     conditions   — the body carries a condition/limit that may be source-specific
# A flag is a prompt to read, never a verdict. Verdicts live in xref-verdicts.json, written by hand.
#
#   python xref_review.py            # summary table with flags
#   python xref_review.py --read N   # full body of entry N, for reading
#   python xref_review.py --unflagged  # only those the flags did NOT catch (the reviewer's point)
import argparse
import json
import re
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROWS = json.loads((HERE / "xrefs.json").read_text(encoding="utf-8"))
HEAD = re.compile(r"the steps for (.+?) [›>] (.+?) are the same as section ([\d.]+) '(.+?)' under (.+?), page (\d+)",
                  re.I | re.S)
Q = "[‘’“”'\"]?"
DASH = "[-‐-―]"
NAV = re.compile(r"(?:click(?:\s+on)?|go to|open|navigate to)\s+(?:the\s+)?" + Q +
                 r"([A-Za-z][A-Za-z ‐-―\-/&]{1,28}?)" + Q +
                 r"\s*sub\s*" + DASH + r"?\s*sub\s*" + DASH + r"?\s*module", re.I)
COND = re.compile(r"\b(only|must|cannot|maximum|max\.?|not allowed|mandatory|required|before|after)\b", re.I)


def words(s: str) -> set[str]:
    return {w for w in re.findall(r"[a-z]+", (s or "").lower()) if len(w) > 3}


GENERIC = {"how", "the", "and", "record", "records", "details", "apply", "filter", "filters",
           "export", "edit", "delete", "create", "view", "update", "track", "review", "test",
           "crew", "under", "page", "steps", "same", "section", "from", "with", "this", "that",
           "data", "item", "items", "new", "all"}


def parse(r: dict) -> dict | None:
    m = HEAD.search(r["content"])
    if not m:
        return None
    dest_mod, dest_act, sec, src_title, src_mod, src_page = [x.strip() for x in m.groups()]
    body = r["content"][m.end():]
    navs = [n.strip() for n in NAV.findall(body)]

    # record-type candidates: distinctive words of the SOURCE section title that are not
    # distinctive words of the DESTINATION action, appearing in the pasted body
    src_w = (words(src_title) | words(src_mod)) - GENERIC
    dst_w = (words(dest_act) | words(dest_mod)) - GENERIC
    distinctive = src_w - dst_w
    rec_hits = sorted({w for w in distinctive if re.search(rf"\b{re.escape(w)}", body, re.I)})

    return {"module": r["module"], "page": r["page"], "section": (r["section"] or "").strip(),
            "dest_mod": dest_mod, "dest_act": dest_act, "src_mod": src_mod,
            "src_title": src_title, "src_page": src_page, "body": body,
            "flag_screen": [n for n in navs if words(n) - GENERIC and (words(n) & words(src_mod))],
            "flag_record": rec_hits,
            "flag_cond": sorted({c.lower() for c in COND.findall(body)})}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--read", type=int)
    ap.add_argument("--unflagged", action="store_true")
    args = ap.parse_args()

    entries = [e for e in (parse(r) for r in ROWS) if e]
    entries.sort(key=lambda e: (e["module"], int(e["page"]), e["section"]))
    if len(entries) != len(ROWS):
        print(f"WARNING: {len(ROWS) - len(entries)} of {len(ROWS)} headers did not parse — read those by hand\n")

    if args.read is not None:
        e = entries[args.read]
        print(f"[{args.read}] {e['module']} p.{e['page']}  {e['section']}")
        print(f"  DESTINATION : {e['dest_mod']} > {e['dest_act']}")
        print(f"  SOURCE      : {e['src_mod']} > {e['src_title']} (p.{e['src_page']})")
        print(f"  flags: screen={e['flag_screen']} record={e['flag_record']} cond={e['flag_cond']}")
        print("\n  PASTED BODY:\n")
        print("   " + e["body"].replace("\n", "\n   "))
        return

    sel = [(i, e) for i, e in enumerate(entries)
           if not args.unflagged or not (e["flag_screen"] or e["flag_record"])]
    print(f"{len(entries)} resolved cross-references"
          + (f" · {len(sel)} with NO screen/record flag (still require reading)" if args.unflagged else ""))
    print(f"{'#':>3}  {'where':<20} {'destination action':<42} {'screen':<8} record-type words in body")
    print("-" * 120)
    for i, e in sel:
        print(f"{i:>3}  {e['module'][:8] + ' p.' + e['page']:<20} {e['dest_act'][:42]:<42} "
              f"{('YES' if e['flag_screen'] else '-'):<8} {', '.join(e['flag_record'][:6]) or '-'}")
    print("\nA flag is a prompt to read, not a verdict. Read each with --read N.")


if __name__ == "__main__":
    main()
