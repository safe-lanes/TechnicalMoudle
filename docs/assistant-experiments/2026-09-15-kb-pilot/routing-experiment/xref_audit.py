# Audit of every resolved cross-reference in kb-pilot-e (reviewer, 21-Sep-2026).
#
# My first pass used one regex ("Click on the X sub-sub module") and reported 7 affected chunks. The
# reviewer found an eighth the regex could not see — Technical p.10 §1.1.4.4 begins "Go to the
# 'Certificates' sub-sub module". So this inspects ALL 41 instead of pattern-matching one phrasing.
#
# For each chunk the resolver produced:
#   destination = the section the chunk belongs to        ("the steps for <DEST> > ...")
#   source      = the section the steps were copied from  ("... under <SOURCE>, page N")
# and then looks for any navigation instruction in the pasted body that names the SOURCE sub-module.
#
# IMPORTANT, and the reason this must not be a global rename: some procedures genuinely require
# switching screens. Stores inventory really is maintained from the Spares screen. So each hit is
# classified, not corrected, and the ones needing a product decision are marked as such.
#
#   python xref_audit.py
import json
import re
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROWS = json.loads((HERE / "xrefs.json").read_text(encoding="utf-8"))

HEAD = re.compile(r"the steps for (.+?) [›>] (.+?) are the same as section ([\d.]+) '(.+?)' under (.+?), page (\d+)",
                  re.I | re.S)
# any instruction that tells the user to go to / click on a named sub-module
# The manuals use CURLY quotes and en/em dashes. The first version of this pattern only allowed ASCII
# quotes, so it silently missed every Crewing case and reported 4 instead of the true count — the same
# instrument failure this audit exists to catch. self_test() below pins a case known to misdirect.
Q = "[‘’“”'\"]?"
DASH = "[-‐-―]"
NAV = re.compile(r"(?:click(?:\s+on)?|go to|open|navigate to)\s+(?:the\s+)?" + Q +
                 r"([A-Za-z][A-Za-z ‐-―\-/&]{1,28}?)" + Q +
                 r"\s*sub\s*" + DASH + r"?\s*sub\s*" + DASH + r"?\s*module", re.I)


def norm(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", (s or "").lower()).strip()


def self_test() -> None:
    """Known-answer cases. Crewing p.22 1.2.3.3 was read by hand and DOES misdirect; a pattern that
    cannot see it is not fit to count."""
    must_hit = "* Click on the ‘In-Progress’ sub—sub module. (Ref Figure 18)"
    must_hit2 = "* Go to the 'Certificates' sub-sub module. (Ref Figure 8)"
    must_miss = "* Click on the ‘Filter’ button. (Ref Figure 8)"
    for text, expect in ((must_hit, True), (must_hit2, True), (must_miss, False)):
        got = bool(NAV.search(text))
        if got != expect:
            raise SystemExit(f"NAV pattern self-test FAILED on: {text[:60]!r} (got {got}, want {expect})")
    print("NAV pattern self-test: passed (detects curly-quote and straight-quote navigation, "
          "ignores button clicks)\n")


def main() -> None:
    self_test()
    misdirect, clean, unparsed = [], [], []
    for r in ROWS:
        c = r["content"]
        m = HEAD.search(c)
        if not m:
            unparsed.append(r)
            continue
        dest_mod, dest_act, _sec, _title, src_mod, src_page = [x.strip() for x in m.groups()]
        body = c[m.end():]
        navs = [n.strip() for n in NAV.findall(body)]
        # a navigation naming the SOURCE sub-module, inside a section that belongs to the DESTINATION
        bad = [n for n in navs if norm(n) == norm(src_mod) and norm(src_mod) != norm(dest_mod)]
        row = {"module": r["module"], "page": r["page"], "section": (r["section"] or "")[:44],
               "dest": dest_mod, "act": dest_act[:40], "src": src_mod, "src_page": src_page,
               "navs": navs, "bad": bad}
        (misdirect if bad else clean).append(row)

    print(f"{len(ROWS)} chunks carry a resolved cross-reference\n")
    print(f"A. MISDIRECTING — the pasted steps tell the user to open the SOURCE sub-module "
          f"while the section is about the DESTINATION: {len(misdirect)}")
    for r in sorted(misdirect, key=lambda x: (x["module"], int(x["page"]))):
        print(f"   {r['module']:<9} p.{r['page']:<3} {r['section']:<44} {r['dest']} -> told to open '{r['bad'][0]}'")

    print(f"\nB. NO SUB-MODULE NAVIGATION in the pasted steps (start at a button/field): {len(clean)}")
    for r in sorted(clean, key=lambda x: (x["module"], int(x["page"])))[:50]:
        first = r["navs"][0] if r["navs"] else "-"
        print(f"   {r['module']:<9} p.{r['page']:<3} {r['section']:<44} nav={first}")

    if unparsed:
        print(f"\nC. HEADER NOT PARSED — needs reading by hand: {len(unparsed)}")
        for r in unparsed:
            print(f"   {r['module']} p.{r['page']} {(r['section'] or '')[:50]}")

    print("\nNOTE: group A is NOT automatically wrong. Some procedures genuinely require switching")
    print("screens — Stores inventory is maintained from the Spares screen. Each entry needs a")
    print("product decision: reused steps (rename the destination) vs real navigation (keep).")


if __name__ == "__main__":
    main()
