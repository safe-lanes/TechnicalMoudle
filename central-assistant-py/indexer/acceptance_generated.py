"""
Focused checks for the corrected code-derived Technical documents (owner step 4, 14-Sep-2026).
Each case targets a claim that R2 got wrong or overstated and R3 corrected; the judge requires
the corrected statement (must) and fails on the withdrawn wording (must_not), plus a citation to
the generated document. Run exactly like acceptance_answers.py:

  IDENTITY_SIGNING_KEY=... python indexer/acceptance_generated.py --repeat 3 --set live=http://127.0.0.1:8015 --set cand=http://127.0.0.1:8017
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import httpx2 as httpx  # noqa: E402
from acceptance_answers import ask, judge  # noqa: E402

# .2 (after run C, reported): 02 — the official PMS manual p63 also documents the Admin tabs and outranked the generated
#     document; any Technical source is now accepted for the citation. 04/14 — two R3 documents carry the same corrected
#     statement; a citation to either generated document is accepted. 07/10 — the must_not phrase was matched INSIDE the
#     correct negated answer ("cannot do everything an office user…", "changes waiting to go out are shown as a separate
#     count, not as a colour"); must_not now uses the R2 wording that a wrong answer would reproduce. 09 — the official
#     PMS manual §1.1.3.4 answers this question and uses the term 'Vessel Admin'; the case now requires the manual's
#     answer (Operation tab) and no longer forbids that term. Case 08 unchanged.
GEN_SUITE_VERSION = "2026-09-14.2"
NOT_COVERED = ["not covered", "isn't covered", "not documented", "does not cover", "no information"]
# (class, question, module, expected manual substring, pages, must, must_not, source)
CASES: list[tuple[str, str, str, str, tuple[int, ...] | None, list[str], list[str], str]] = [
    ("gen", "In Bulk Data Import for jobs, do I have to fill in the Job Code column?",
     "technical", "Bulk Data Import", None, ["optional", "generated"], NOT_COVERED + ["must be filled", "is rejected"],
     "R3 §1.1.11.3: Job Code optional, generated on import (validationService.ts:217; JobUpload.tsx:50). R2 said blank is rejected."),
    ("gen", "Where do I find Bulk Data Import in the application?",
     "technical", "Technical -", None, ["pms", "admin", "bulk data imp"], NOT_COVERED,
     "R3 §1.1.11.2: PMS → Admin → 'Bulk Data Imp' tab (SideMenuBar.tsx:69; PMSAdmin.tsx:41,75); the official PMS manual §1.1.11 p63 agrees. R2 said Admin → Bulk Data Import."),
    ("gen", "What does the dry-run show for each row in a bulk import, and when do I see the created and updated counts?",
     "technical", "Bulk Data Import", None, ["warning", "error", "after"], NOT_COVERED,
     "R3 §1.1.11.5–6: rows ok/warning/error; created/updated/skipped only after the import (UniformBulkUpload.tsx:79-84,475)."),
    ("gen", "In work-order numbers, what do the vessel code and the segment after it mean, and what does an unplanned work order number look like?",
     "technical", "(Operational)", None, ["vesselcode", "uwo"], NOT_COVERED,
     "R3 §1.1.14.1 and Ship-Side §1.1.13.2: <VESSELCODE>-<JOBCODE>-<COMPONENTCODE>-<YEAR>-<NNN>; unplanned <VESSELCODE>-UWO-… (workOrderNumbering.ts:7-11)."),
    ("gen", "A ship's new work orders still use the old number format without the vessel code. How does the vessel code get onto the ship?",
     "technical", "Recent Updates", None, ["provision"], NOT_COVERED + ["sync masters"],
     "R3 §1.1.14.1: vessel code reaches a ship only through provisioning; 'Sync All' does not (SYNC-ARCHITECTURE.md:24-27). R2 said run Sync Masters."),
    ("gen", "Who can generate work orders from the office, and what happens if the vessel's switch is off?",
     "technical", "Recent Updates", None, ["sail admin", "not enabled"], NOT_COVERED,
     "R3 §1.1.14.6: only a Sail Admin; message says not enabled for the vessel; other roles refused (workOrderGenerationGate.ts:44,141-161)."),
    ("gen", "Can a Head of Department do everything an office user can do for their department?",
     "technical", "Roles", None, ["no", "postponement"], NOT_COVERED + ["yes, a head of department can do everything"],
     "R3 §1.1.12.6: No — Head of Dept = Me/My Team on the dashboard; excluded from postponement approval when no steps configured. R2 claimed full office rights per department."),
    ("gen", "Is Level 2 Reviewer a user role I can assign?",
     "technical", "Roles", None, ["rank"], NOT_COVERED,
     "R3 §1.1.12.1: Level 2 review is driven by the job's 'Level 2 Reviewer (Rank)'; actions for Office/PMS Admin/Sail Admin (schema.ts:1204; JobsFormPage.tsx:1346)."),
    ("gen", "Where is the Me / My Team toggle and who can use it?",
     "technical", "Technical -", None, ["operation tab"], NOT_COVERED + ["only users with the hod role"],
     "Official PMS manual §1.1.3.4 p11 (Operation tab, 'only Vessel Admin users') and R3 §1.1.12.2 (PMS Dashboard Operation tab; Vessel Admin profile = Head of Dept). R2 said 'only HOD' AND 'only Vessel Admin'."),
    ("gen", "On the Fleet Sync Overview, what does an amber status mean?",
     "technical", "Sync", None, ["24 hours"], NOT_COVERED + ["or has changes waiting to go out"],
     "R3 §1.2.2: amber = no sync for more than 24 hours, time-based only (SyncFleetOverview.tsx:134-142). R2 added 'changes waiting to go out'."),
    ("gen", "Does one press of Sync Now clear a long backlog on the ship?",
     "technical", "Sync", None, ["20 cycles"], NOT_COVERED,
     "R3 §1.2.4: stops at 20 cycles / ~60 s / no progress; more than one press may be needed (syncEngine.ts:62-63,595-611). R2 said a single press clears a long outage."),
    ("gen", "If a ship's vessel master data changes, how is the ship refreshed?",
     "technical", "Sync", None, ["provision"], NOT_COVERED,
     "R3 §1.2.10: re-provision from Admin → Ship Provisioning or contact support (SideMenuBar.tsx:98; provisioningService.ts:55)."),
    ("gen", "On the ship, what happens if I enter a running-hours reading lower than the component's current hours when completing a work order?",
     "technical", "Ship-Side", None, ["refused", "back-dated"], NOT_COVERED + ["still saved and the reading is kept"],
     "R3 §1.1.13.2: refused ('Running hours cannot go backward!'); back-dated exception (rhTimelineValidationService.ts:310-311; workOrderCompletionService.ts:257-265). R2 said still saved."),
    ("gen", "Which office screen holds the per-vessel switches such as office work-order generation and running-hours entry?",
     "technical", "(Operational)", None, ["lead time", "grace period"], NOT_COVERED,
     "R3 Roles §1.1.12.9 and Recent Updates §1.1.14.6: 'Lead Time & Grace Period Settings' (PmsVesselSettingsManagement.tsx:402,617). R2 said 'vessel settings'."),
]


async def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--set", action="append", required=True)
    ap.add_argument("--repeat", type=int, default=1)
    ap.add_argument("--dump", default=None)
    args = ap.parse_args()
    key = os.environ["IDENTITY_SIGNING_KEY"]
    sets = [(s.partition("=")[0], s.partition("=")[2]) for s in args.set]
    dump = open(args.dump, "w", encoding="utf-8") if args.dump else None  # noqa: SIM115
    score = dict.fromkeys([n for n, _ in sets], 0)
    matrix: list[tuple[str, dict[str, bool]]] = []
    print(f"generated-docs suite {GEN_SUITE_VERSION} · {len(CASES)} cases · repeat={args.repeat}")
    async with httpx.AsyncClient(timeout=150.0) as c:
        for i, (cls, q, module, manual, page, must, must_not, _src) in enumerate(CASES, 1):
            print(f"\n[{i:02d} {cls}] {q}")
            runs = [await asyncio.gather(*(ask(c, u, key, q, module) for _, u in sets)) for _ in range(args.repeat)]
            row: dict[str, bool] = {}
            for si, (n, _) in enumerate(sets):
                verdicts = [judge(runs[r][si], manual, page, must, must_not, cls) for r in range(args.repeat)]
                if dump:
                    for r in range(args.repeat):
                        dump.write(json.dumps({"suite": "generated", "case": i, "question": q, "set": n, "run": r + 1,
                                               "verdict": {"answer": verdicts[r][0], "citation": verdicts[r][1]}, "response": runs[r][si]}, ensure_ascii=False) + "\n")
                votes = [(a and ct) for a, ct, _at, _ in verdicts]
                ok = sum(votes) * 2 > len(votes)
                score[n] += ok
                row[n] = ok
                print(f"   {n:<14} answer {'✓' if sum(v[0] for v in verdicts) * 2 > len(verdicts) else '✗'}  cite {'✓' if sum(v[1] for v in verdicts) * 2 > len(verdicts) else '✗'}  PASS {'✓' if ok else '✗'} [{sum(votes)}/{len(votes)}]  {verdicts[0][3]}")
            matrix.append((f"{i:02d}", row))
    print(f"\n== per-case (answer ∧ citation), out of {len(CASES)} ==")
    print("   case  " + " ".join(f"{n[:12]:>12}" for n, _ in sets))
    for label, row in matrix:
        print(f"   {label:<5} " + " ".join(f"{('✓' if row[n] else '✗'):>12}" for n, _ in sets))
    for n, _ in sets:
        print(f"   {n:<14} {score[n]}/{len(CASES)}")
    if dump:
        dump.close()
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
