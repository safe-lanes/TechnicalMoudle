# Verdicts for all 41 resolved cross-references, recorded by READING each distinct pasted body
# (27 distinct bodies across the 41 entries) and, for the screens in doubt, by tracing the product code.
#
# The reviewer's point that this file answers: a regex flags candidates, it cannot establish
# correctness, and 13 pattern matches neither confirm 13 defects nor clear the other 28.
#
# Classes — an entry can carry more than one:
#   A  navigation      the pasted step tells the user to open the SOURCE sub-module
#   B  record/fields   the instruction text names the SOURCE's record type or its field list
#   C  caption         only the screenshot caption names the source screen; the steps transfer
#   D  clean           no source-specific wording; the steps read correctly where they sit
#
# Code evidence (traced 22-Sep-2026, this repository), which removes the need to ask about these:
#   Stores      client/src/pages/stores/Stores.tsx is its OWN screen with its own filters and its own
#               export (`stores_<tab>_inventory_*.xlsx`, `stores_<tab>_history_*.xlsx`), rendered by
#               TechnicalModule.tsx as <Stores /> beside <Spares />. It does NOT route through Spares.
#   Surveys     client/src/pages/cert-surveys/SurveysPage.tsx edits in the grid (canEditSurvey,
#               CellEditingStoppedEvent) and exports PDF/CSV/Excel itself. No reference to Certificates.
#   CoC         client/src/pages/defects/DefectsCoC.tsx is its own page with its own handleExportPdf;
#               records are created through the shared DefectFormWizard with is_coc set. So the CoC
#               steps DO transfer — only the "Defects Log" captions are wrong.
#
#   python xref_verdicts.py
import json
import re
from pathlib import Path

import xref_review as X

HERE = Path(__file__).resolve().parent

# keyed by the distinct body, listed as the entry indices that share it
VERDICTS = [
    ("In-Progress edit/delete pasted into Recruited, Waitlist, Rejected", [0, 3, 6], "AC",
     "Step 1 is 'Click on ‘In-Progress’ sub-sub module' and the caption reads 'In Progress crew "
     "record table'. These are sibling crew lists and the source sentence says 'apply the same steps', "
     "so the user is sent to a different list."),
    ("In-Progress export pasted into Recruited, Waitlist, Rejected", [1, 4, 7], "AC",
     "Same navigation step and caption; this is the Waitlist case the reviewer raised."),
    ("In-Progress filters pasted into Recruited, Waitlist, Rejected", [2, 5, 8], "D",
     "No navigation, no source naming. The filters listed (Rank Applied, Vessel Type, Nationality, "
     "Status, Manning Agent) are candidate-list filters common to all four lists. Reads correctly."),
    ("Annual D&A create/delete pasted into Periodic, Monthly, Summary", [12, 15, 23], "BC",
     "Instruction says 'create new ANNUAL drug and alcohol record'; caption 'Annual D&A Test interface'. "
     "Reviewer's example. The buttons transfer; the record type named does not."),
    ("Annual D&A review/export pasted into Periodic, Monthly, Summary", [14, 17, 24], "C",
     "Steps are generic (vessel dropdown, History, Export). Only the captions say 'Annual D&A Test'."),
    ("Crew Promotion filters pasted into Periodic, Monthly, Post Incident", [13, 16, 18], "BC",
     "Instruction says 'refine CREW PROMOTION records by Name, PROMOTION RANK, Vessel, Vessel Type, "
     "Nationality, Criteria, Status'. Both the record type AND the field list belong to another screen."),
    ("Crew Promotion filters pasted into Appraisals and Annual", [9, 11], "BC", "Same text as above."),
    ("Crew Promotion filters pasted into Others", [22], "BC", "Same text as above."),
    ("Crew Promotion export pasted into Appraisals and Training Needs", [10, 25], "C",
     "Instruction is generic ('Export CSV'/'Export Excel'); the caption describes the Crew Promotion "
     "dashboard and 'promotion status'."),
    ("Post Incident create pasted into Others", [19], "BC",
     "Instruction says 'enter the required INCIDENT details ... in the POST INCIDENT TEST form'."),
    ("Post Incident edit pasted into Others", [20], "C", "Caption only: 'Post Incident Test screen'."),
    ("Post Incident export pasted into Others", [21], "C", "Caption only."),
    ("Certificates filter pasted into Surveys", [26], "BC",
     "Instruction says 'view vessel-specific CERTIFICATE records' and 'CERTIFICATE due status'."),
    ("Certificates export pasted into Surveys", [27], "BC",
     "Instruction says 'download the displayed CERTIFICATE records in PDF format'. Reviewer's example. "
     "CODE: SurveysPage has its own PDF/CSV/Excel export."),
    ("Certificates edit pasted into Surveys", [28], "ABC",
     "Step 1 is 'Go to the Certificates sub-sub module', every caption is Certificates, and the note "
     "describes certificate status colours. CODE: Surveys edits in its own grid, no Certificates hop."),
    ("Defects Dashboard filter, self-reference", [29], "D",
     "Source and destination are the same sub-module on two pages. Reads correctly."),
    ("Defects Logs steps pasted into Condition of Class (CoC)", [30, 31, 32, 33, 34], "C",
     "CODE: DefectsCoC.tsx is its own page with its own export, and CoC records are created through the "
     "shared DefectFormWizard with is_coc set — so the steps and the 'defect report' wording DO "
     "transfer. Only the captions ('Defects Log interface') name the wrong screen."),
    ("Spares filter pasted into Stores (Office and Vessel manuals)", [35, 38], "AC",
     "Step 1 is 'Click on the Spares sub-sub module'. CODE: Stores is its own screen with its own "
     "filters, so this is wrong, not a genuine screen switch."),
    ("Spares inventory pasted into Stores", [36, 39], "AC",
     "Step 1 navigates to Spares. CODE: Stores maintains its own inventory view."),
    ("Spares export pasted into Stores", [37, 40], "AC",
     "Step 1 navigates to Spares. CODE: Stores exports stores_<tab>_inventory/history .xlsx itself."),
]


def main() -> None:
    ents = [e for e in (X.parse(r) for r in X.ROWS) if e]
    ents.sort(key=lambda e: (e["module"], int(e["page"]), e["section"]))
    seen: dict[int, str] = {}
    for _label, idxs, cls, _why in VERDICTS:
        for i in idxs:
            if i in seen:
                raise SystemExit(f"entry {i} classified twice")
            seen[i] = cls
    missing = sorted(set(range(len(ents))) - set(seen))
    if missing:
        raise SystemExit(f"UNCLASSIFIED entries: {missing}")

    counts = {c: sum(1 for v in seen.values() if c in v) for c in "ABCD"}
    import hashlib
    bodies = {hashlib.md5(re.sub(r"\s+", " ", e["body"]).strip().encode()).hexdigest() for e in ents}
    print(f"{len(ents)} resolved cross-references · {len(bodies)} distinct pasted bodies "
          f"· {len(VERDICTS)} verdict groups, every distinct body read\n")
    print(f"  A navigation to the wrong sub-module      {counts['A']:>3}")
    print(f"  B wrong record type / field list in steps {counts['B']:>3}")
    print(f"  C wrong screen named in the caption only  {counts['C']:>3}")
    print(f"  D clean                                   {counts['D']:>3}")
    affected = sum(1 for v in seen.values() if v != "D")
    print(f"\n  carrying source-specific wording somewhere: {affected} of {len(ents)}")
    print(f"  clean: {sorted(i for i, v in seen.items() if v == 'D')}\n")

    for label, idxs, cls, why in VERDICTS:
        where = ", ".join(f"{ents[i]['module'][:4]} p.{ents[i]['page']}" for i in idxs)
        print(f"[{cls:<3}] {label}")
        print(f"        {where}")
        print(f"        {why}\n")

    out = [{"indices": i, "classes": c, "label": l, "reason": w} for l, i, c, w in VERDICTS]
    (HERE / "xref-verdicts.json").write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")


if __name__ == "__main__":
    main()
