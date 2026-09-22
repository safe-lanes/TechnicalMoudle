# Extract the ACTUAL code blocks behind every code claim in the cross-reference work, with file,
# line numbers and the repository revision, so the reviewer can check them without this repo.
#
# The previous pack shipped the first 40 lines of three files — imports, not the rendering branches,
# edit handlers or export functions the report cited. That was not evidence. This writes the cited
# blocks themselves, plus the counting greps, to code-evidence/.
#
#   python collect_code_evidence.py [outdir]
import json
import re
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[4]
OUT = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parent / "code-evidence"

# (claim, file, first line, last line)
BLOCKS = [
    ("Stores and Spares are separate screens, rendered side by side",
     "client/src/pages/TechnicalModule.tsx", 214, 226),
    ("Stores has its own export to stores_<tab>_inventory / _history .xlsx",
     "client/src/pages/stores/Stores.tsx", 859, 912),
    ("Stores LOCATION view controls: vessel selector, Search, All Categories, Stock (data-testid stores-loc-*)",
     "client/src/pages/stores/Stores.tsx", 2690, 2770),
    ("Stores INVENTORY view controls (the viewMode === 'inventory' branch): Search, All Categories, Stock",
     "client/src/pages/stores/Stores.tsx", 2772, 2832),
    ("Stores HISTORY view: search box only",
     "client/src/pages/stores/Stores.tsx", 2855, 2865),
    ("Surveys editable columns: Survey Date, Due Date, 1st Range Date, 2nd Range Date, Postponed (editable: canEditSurvey, DateCellEditor)",
     "client/src/pages/cert-surveys/SurveysPage.tsx", 404, 500),
    ("Spares filter controls: Search, Criticality, Rotation Item, Stock",
     "client/src/pages/spares/SparesNew.tsx", 3695, 3742),
    ("Surveys edits in the grid rather than on another screen",
     "client/src/pages/cert-surveys/SurveysPage.tsx", 104, 112),
    ("Surveys has its own PDF / CSV / Excel export",
     "client/src/pages/cert-surveys/SurveysPage.tsx", 586, 596),
    ("Certificates has its own PDF / CSV / Excel export too",
     "client/src/pages/cert-surveys/CertificatesPage.tsx", 971, 980),
    ("CoC is its own page with its own export",
     "client/src/pages/defects/DefectsCoC.tsx", 418, 428),
    ("CoC records are created through the SHARED defect form, with is_coc set",
     "client/src/pages/defects/DefectFormWizard.tsx", 184, 202),
    ("The one line that causes every defect: the source body is pasted verbatim",
     "central-assistant-py/indexer/xrefs.py", 218, 227),
]

# (claim, pattern, file) -> counted, because an absence is the evidence
COUNTS = [
    ("Certificates page editable columns (each 'editable: canEdit')", "editable: canEdit",
     "client/src/pages/cert-surveys/CertificatesPage.tsx"),
    ("Surveys page editable columns (each 'editable: canEditSurvey')", "editable: canEditSurvey",
     "client/src/pages/cert-surveys/SurveysPage.tsx"),
    ("'Issue Date' anywhere in the Surveys page", "issue date", "client/src/pages/cert-surveys/SurveysPage.tsx"),
    ("'criticality' anywhere in the Stores screen", "criticality", "client/src/pages/stores/Stores.tsx"),
    ("'rotation' anywhere in the Stores screen", "rotation", "client/src/pages/stores/Stores.tsx"),
    ("'Certificates' anywhere in the Surveys page", "certificates",
     "client/src/pages/cert-surveys/SurveysPage.tsx"),
    ("'Add Group' in the Surveys page", "add group", "client/src/pages/cert-surveys/SurveysPage.tsx"),
    ("'Add Group' in the Certificates page", "add group",
     "client/src/pages/cert-surveys/CertificatesPage.tsx"),
    ("'Due Status' in the Surveys page", "due status", "client/src/pages/cert-surveys/SurveysPage.tsx"),
    ("'Due in' in the Surveys page (the control that exists instead)", "due in\\.\\.\\.",
     "client/src/pages/cert-surveys/SurveysPage.tsx"),
]


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    rev = subprocess.run(["git", "-C", str(REPO), "rev-parse", "HEAD"],
                         capture_output=True, text=True).stdout.strip()
    branch = subprocess.run(["git", "-C", str(REPO), "rev-parse", "--abbrev-ref", "HEAD"],
                            capture_output=True, text=True).stdout.strip()

    lines = [f"# Code evidence — repository revision {rev} (branch {branch})", "",
             "Every block below is quoted from the working tree at that revision. Line numbers are "
             "1-based and inclusive.", ""]
    for claim, rel, a, b in BLOCKS:
        p = REPO / rel
        if not p.exists():
            lines += [f"## {claim}", f"`{rel}` — FILE NOT FOUND", ""]
            continue
        src = p.read_text(encoding="utf-8", errors="replace").splitlines()
        snippet = "\n".join(f"{i:>5}  {src[i - 1]}" for i in range(a, min(b, len(src)) + 1))
        lines += [f"## {claim}", f"`{rel}` lines {a}-{b}", "```", snippet, "```", ""]

    lines += ["## Counted evidence — an absence is the point", "",
              "| claim | occurrences |", "|---|---:|"]
    for claim, pat, rel in COUNTS:
        p = REPO / rel
        n = len(re.findall(pat, p.read_text(encoding="utf-8", errors="replace"), re.I)) if p.exists() else -1
        lines.append(f"| {claim} | {n} |")

    lines += ["", "## What the code does NOT establish", "",
              "- The Crewing screens (Appraisals, Crew Promotion, the Annual/Periodic/Monthly/Other/",
              "  Summary drug & alcohol tests, and the Recruited/Waitlist/Rejected crew lists) are **not in",
              "  this repository**. The SAILERP backend holds crew-appraisal entities, but the screens'",
              "  filter chips and buttons are not available to check. Every Crewing destination field list",
              "  is therefore UNRESOLVED and must not be restated by the repair.",
              "- For CoC, a shared creation form establishes only that **creation** transfers. It does not",
              "  establish that every filter, export and permission transfers; those stay UNRESOLVED.",
              "- 'Add Group' does not appear in the Certificates page either, so the manual's Certificates",
              "  filter list is itself stale against the code. The repair must not copy that list into",
              "  Surveys as though it were verified."]

    (OUT / "CODE-EVIDENCE.md").write_text("\n".join(lines), encoding="utf-8")
    (OUT / "revision.json").write_text(json.dumps({"revision": rev, "branch": branch}, indent=1),
                                       encoding="utf-8")
    print(f"wrote {OUT/'CODE-EVIDENCE.md'} · revision {rev[:9]} · {len(BLOCKS)} blocks, {len(COUNTS)} counts")


if __name__ == "__main__":
    main()
