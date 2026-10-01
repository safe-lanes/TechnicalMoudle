"""TRACKED (30-Sep / 1-Oct-2026): Jeevan's four chatbot cases as the knowledge pilot's drafts and acceptance cases.

Run as the DEV TEST accounts (never as "Jeevan (pilot)"): devtest-tech-1 (Technical trainer) and devtest-user (ordinary
Sail Admin), through pilot shore A like verify_kb_pilot.py.

Phases:
  before   ordinary user asks each original question through the widget path (tool loop) with NO entry served
  seed     the drafts are created, or their pending draft is UPDATED to the content below (history is kept)
  preview  "Test draft" with the original question — the same tool-loop path as the widget, draft visible only here
  served   PILOT-TEST revisions of ALL entries below are published (open points marked "PILOT TEST ONLY — not confirmed
           by Jeevan"), the ordinary user asks the four questions through the widget path, then every entry is RETIRED
           and a fresh draft with all points open again is saved — Jeevan finds drafts waiting for his confirmation.
The fifth entry (a correction of the manuals' Gear-icon note) is published with the others because the RH answers drew
the reversed "cascaded to all child components" sentence from it (review finding 1-Oct-2026).

Facts and their evidence class: docs/assistant-experiments/2026-09-30-kb-pilot/APP-BEHAVIOUR-VERIFIED.md.
Output: docs/assistant-experiments/2026-09-30-kb-pilot/four-examples-<time>.json — answers are assessed by READING them;
the check lists below are a reading aid, not the verdict."""
from __future__ import annotations

import json
import re
import sys
import time
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).parent))
from verify_kb_pilot import M, User  # noqa: E402

OUT = M / "docs/assistant-experiments/2026-09-30-kb-pilot"
PILOT_TEST = "PILOT TEST ONLY — not confirmed by Jeevan"
PREP = ("Prepared by development from the application code and pilot tests (30-Sep / 1-Oct-2026) for Jeevan's review. "
        "Jeevan has not authored or confirmed this entry.")
OFFICE_MANUAL_GEAR = "2ad2877ec7da31994dcc0523919c00eb4aa455f9"   # Office manual p.40 — Gear steps + reversed note
VESSEL_MANUAL_GEAR = "3e5bd2bb5b823ac7f7aeaabaff607b9af272a0c3"   # Vessel manual p.34 — same

ENTRIES: list[dict[str, Any]] = [
    {
        "question": "How to delete the jobs",
        "check": {"must": [r"delete", r"trash", r"sail admin", r"hidden", r"work order"],
                  "never": [r"only[^.]{0,40}(sail admin|client admin)[^.]{0,40}(can|may|are able)", r"(can|may) (only )?be deleted (only )?by"]},
        "draft": {
            "module": "technical", "kind": "procedure", "scope": "global", "title": "Deleting a job",
            "body": (
                "To delete a job:\n"
                "1. Open the job so that the Job form is shown (for example from the component's job list).\n"
                "2. Click the red Delete (trash) button at the top of the Job form. It is not shown while the job is opened "
                "in Modify or Edit mode.\n"
                "3. Confirm in the Delete Job dialog.\n\n"
                "What happens: the job is hidden from the normal Office and Vessel job views and cannot be restored through "
                "normal editing. Its existing work orders and maintenance history are kept and still appear in the work orders "
                "list.\n\n"
                "The Delete button is available to Sail Admin and Client Admin users.\n\n"
                "Deactivate instead of delete: to stop using a job while keeping it available to the office, use Deactivate "
                "Job. In the Component Register, open the component, click the red icon next to the job in its Jobs table and "
                "confirm. The job no longer appears for vessel and department users; any active work orders for it continue "
                "to completion.\n\n"
                "Modify PMS change requests have no change type for deleting a job."),
            "appliesTo": {"userTypes": ["Office"], "roles": [], "conditions": "", "appVersion": ""},
            "evidence": [
                {"cls": "code", "reference": "client/src/pages/pms/JobsFormPage.tsx:1032-1041", "note": "Delete button; shown to Sail Admin / Client Admin; hidden in Modify/Edit mode (screen rule)"},
                {"cls": "code", "reference": "client/src/pages/pms/JobsFormPage.tsx:1971-1973", "note": "Delete Job dialog text"},
                {"cls": "code", "reference": "Runtime test 1-Oct-2026, test shore", "note": "a job with 34 work orders (Due, Completed, Pending Approval, Postponement Approved) was deleted: job deleted+inactive, all 34 work orders unchanged and still listed; restored"},
                {"cls": "code", "reference": "client/src/components/ComponentRegisterAddEdit.tsx:2135-2139", "note": "Deactivate Job dialog text (read)"},
            ],
            "openPoints": [
                {"text": "Which should users normally be told to use: Delete Job or Deactivate Job?"},
                {"text": "Should vessel users be told to ask the office (or raise a change request) to remove a job?"},
                {"text": "Is 'open the job from the component's job list' the navigation wording users know?"},
            ],
            "internalNotes": (PREP + " Intended rule: Delete shown to Sail Admin / Client Admin (screen). Observed: delete is a soft "
                              "delete, work orders kept (PROVEN 1-Oct). Application defect (logged for development, not for users): "
                              "the server accepted DELETE /jobs from a request forwarding Vessel User (mock identity)."),
            "changeNote": "Content revised after review 1-Oct-2026 (work-order retention now runtime-tested)",
        },
    },
    {
        "question": "How to deactivate any components",
        "check": {"must": [r"is active", r"no", r"save", r"job"], "never": [r"(refus|block|prevent|stop)\w*[^.]{0,60}(child|sub-?component)"]},
        "draft": {
            "module": "technical", "kind": "procedure", "scope": "global", "title": "Deactivating a component",
            "body": (
                "To deactivate a component:\n"
                "1. Open the component in the Component Register and switch to Edit.\n"
                "2. Set Is Active to \"No (Inactive)\".\n"
                "3. Save.\n\n"
                "Before you deactivate it:\n"
                "- Deactivate or delete the active jobs linked to the component. While active jobs are linked, deactivation is "
                "refused with the message \"Component cannot be deleted because N active Job(s) are linked…\".\n"
                "- Deal with the spares linked to the component.\n"
                "- Deactivate its sub-components (child components) first, and check them yourself: do not rely on the "
                "application to stop you if a sub-component is still active.\n\n"
                "What happens: a component deactivated in the office is no longer shown on the vessel. Open work orders "
                "continue."),
            "appliesTo": {"userTypes": ["Office"], "roles": [], "conditions": "User with edit permission for components.", "appVersion": ""},
            "evidence": [
                {"cls": "code", "reference": "client/src/components/ComponentRegisterAddEdit.tsx:1619-1623, 938-959", "note": "Is Active field; saving No calls the deactivate action"},
                {"cls": "code", "reference": "Runtime test 30-Sep-2026, test shore", "note": "a component with 6 active jobs was refused with the 'active Job(s) are linked' message"},
                {"cls": "manual", "reference": "Technical manual (3 passages)", "note": "items deactivated in the office disappear on the vessel"},
            ],
            "openPoints": [
                {"text": "Should the guidance tell users to deactivate sub-components first? (The application's own check for active sub-components did not stop a deactivation on the pilot data — logged for development.)"},
                {"text": "Should users be told that linked spares block deactivation? (Read in the code; not tested at runtime — no suitable test component.)"},
                {"text": "Can a vessel request deactivation through a change request? Today that path skips the jobs/spares checks."},
            ],
            "internalNotes": (PREP + " Intended rule (code): refuse while active sub-components, active jobs or active spares are linked. "
                              "Observed: jobs check works (PROVEN); spares check not exercised (READ); sub-component check did NOT stop "
                              "a parent with 16 active children (PROVEN, restored) — application defect logged for development: the "
                              "check compares parent_id with the parent's id, the data stores the parent's component code. Other "
                              "defects logged: no server permission check on the deactivate endpoint; change-request apply skips the checks."),
            "changeNote": "Content revised after review 1-Oct-2026 (sub-component check not presented as enforced)",
        },
    },
    {
        "question": "What are types of RH Counter type",
        "check": {"must": [r"master", r"inherited", r"not rh driven"],
                  "never": [r"non-inherited type\b(?! such)", r"inherited[^.]{0,80}cascad\w*[^.]{0,40}child"]},
        "draft": {
            "module": "technical", "kind": "faq", "scope": "global", "title": "Running Hours (RH) counter types",
            "body": (
                "A component has one of three Running Hours (RH) counter types:\n\n"
                "- Master (RH Owner): the component owns its RH counter. Master components are the ones shown on the "
                "Running Hrs page. When you update a Master component's RH, the increase is also applied to the Inherited "
                "components linked to that Master.\n"
                "- Inherited (Uses Master Counter): the component has no counter of its own; it takes its RH from the Master "
                "component it is linked to (on the same vessel, which must be selected).\n"
                "- Not RH Driven: the component does not use running hours (the default). Its RH fields are cleared and no "
                "RH reading is needed when a work order for it is completed.\n\n"
                "Updates pass from a Master to its Inherited components. There is no other counter type (for example, there "
                "is no \"Non-inherited\" type)."),
            "appliesTo": {"userTypes": ["Office", "Ship"], "roles": [], "conditions": "", "appVersion": ""},
            "evidence": [
                {"cls": "code", "reference": "shared/schema.ts:261, 355", "note": "rh_counter_type: MASTER / INHERITED / NOT_RH_DRIVEN (default)"},
                {"cls": "code", "reference": "RunningHoursConditionPanel.tsx:66-68", "note": "labels shown to users"},
                {"cls": "code", "reference": "server/postgresStorage.ts cascadeRunningHoursUpdate (Master → INHERITED components with rh_master_component_id = the Master)", "note": "direction of the cascade (read)"},
                {"cls": "code", "reference": "runningHoursService.ts:289-291, 836-857; woCompletionRhRequirement.ts:10-11", "note": "Running Hrs lists Masters; master required; no RH at completion"},
            ],
            "openPoints": [
                {"text": "Is this the wording users should see for the three types?"},
            ],
            "internalNotes": (PREP + " The manuals' note 'For components with an Inherited RH type, updates are cascaded to all child "
                              "components' reverses the direction; it is replaced by the entry 'Updating the running hours of one "
                              "component (Gear icon)'. Data point: 30 components on the pilot vessel carry the legacy spelling "
                              "'NOT RH DRIVEN' (69 use NOT_RH_DRIVEN)."),
            "changeNote": "Content revised after review 1-Oct-2026 (Master → Inherited direction stated)",
        },
    },
    {
        "question": "What are RH validations available when updating RH",
        "check": {"must": [r"lower", r"(one|1) (update|reading)[^.]{0,30}(per|a|each) day", r"25", r"earlier", r"future"],
                  "never": [r"inherited[^.]{0,80}cascad\w*[^.]{0,40}child"],
                  "future_on_screen": True},
        "draft": {
            "module": "technical", "kind": "validation", "scope": "global", "title": "Running Hours (RH) validations when updating RH",
            "body": (
                "When you update the Running Hours (RH) of a component, the application checks the reading.\n\n"
                "Always checked:\n"
                "- The new reading cannot be lower than the latest reading (\"Current Reading … cannot be lower than the latest "
                "Running Hours value …\"). Exceptions: a meter replacement, or a reset for renewal.\n"
                "- The result cannot be negative.\n\n"
                "Checked when the vessel's RH validation is ON (the default — a vessel whose setting was never saved counts as ON):\n"
                "- The reading date cannot be earlier than the component's last RH update.\n"
                "- Only one update per component per day (\"Same-day update already performed. Only one update of max 25 hours "
                "is allowed per day.\").\n"
                "- The increase cannot be more than 25 hours per day since the last update (for example, one day after the last "
                "update at most 25 hours more).\n"
                "- A Sail Admin can override these three limits.\n\n"
                "Checked by the Update RH screen itself (the screen will not let you continue):\n"
                "- On the Update RH screen, a date is required and the date cannot be in the future.\n"
                "- On the Update RH screen, a reading of zero needs a renewal confirmation.\n"
                "- On the Update RH screen, a meter replacement needs the old meter's final reading.\n\n"
                "Bulk Update RH: a date is required, and zero is refused (use the individual update for that).\n\n"
                "RH is updated on Master components; the increase is also applied to the Inherited components linked to that Master."),
            "appliesTo": {"userTypes": ["Office", "Ship"], "roles": [], "conditions": "", "appVersion": ""},
            "evidence": [
                {"cls": "code", "reference": "server/modules/running-hours/utils/rhValidation.ts:70-80, 126-232", "note": "lower, back-dated, same-day, 25 h/day rules and Sail Admin override"},
                {"cls": "code", "reference": "Runtime test 30-Sep-2026, test shore", "note": "lower refused, same-day refused, +26 h next day refused, back-dated refused, missing setting = ON"},
                {"cls": "code", "reference": "client/src/pages/pms/RunningHours.tsx:1030-1110, 1367-1411", "note": "screen checks: date required, no future date, zero/renewal, meter replacement; bulk update (read)"},
                {"cls": "manual", "reference": "Technical manual 1.1.6.3", "note": "'Running hours cannot go backward!'"},
            ],
            "openPoints": [
                {"text": "Is 25 hours per day intended (rather than 24)?"},
                {"text": "Bulk update has no future-date check, and 'Old Meter Final' is shown to Sail Admin only — are both intended?"},
                {"text": "Should users be told that a Sail Admin can override the limits?"},
            ],
            "internalNotes": (PREP + " Intended rule: no future date (screen). Observed: the server endpoint ACCEPTS a future-dated reading "
                              "(PROVEN) — application defect logged for development; the guidance therefore says the SCREEN refuses it. "
                              "Also logged: a request forwarding Vessel User with the admin-override flag bypassed the same-day / 25 h "
                              "limits (mock identity)."),
            "changeNote": "Content revised after review 1-Oct-2026 (future date stated as a screen check)",
        },
    },
    {
        "question": None,  # correction entry: no original question; published with the others for the served test
        "check": {},
        "draft": {
            "module": "technical", "kind": "correction", "scope": "global",
            "title": "Updating the running hours of one component (Gear icon)",
            "body": (
                "To update the running hours of one component:\n"
                "1. Open Running Hrs.\n"
                "2. Click the Gear icon of the component.\n"
                "3. Enter the details in the Update Running Hours window.\n"
                "4. Click Save.\n\n"
                "Only Master components are listed on the Running Hrs page. When you update a Master component, the increase is "
                "also applied to the Inherited components linked to that Master (components that take their running hours from "
                "it)."),
            "appliesTo": {"userTypes": ["Office", "Ship"], "roles": [], "conditions": "", "appVersion": ""},
            "evidence": [
                {"cls": "manual", "reference": "PMS User Manual for Office p.40; PMS User Manual Vessel Specific p.34", "note": "Gear icon steps"},
                {"cls": "code", "reference": "server/postgresStorage.ts cascadeRunningHoursUpdate; runningHoursService.ts:289-291", "note": "Master → Inherited direction; Running Hrs lists Masters (read)"},
            ],
            "openPoints": [
                {"text": "The manuals say \"For components with an Inherited RH type, updates are cascaded to all child components\". Confirm that this entry's wording replaces that note."},
            ],
            "supersedes": [
                {"chunkId": OFFICE_MANUAL_GEAR, "file": "Technical - PMS User Manual For Office_Sail Admin_R2_08.06.2026", "section": "TECHNICAL USER MANUAL (p.40)"},
                {"chunkId": VESSEL_MANUAL_GEAR, "file": "Technical - PMS User Manual_Vessel Specific_R3_08.07.2026", "section": "TECHNICAL USER MANUAL (p.34)"},
            ],
            "internalNotes": (PREP + " Created after review 1-Oct-2026: the RH answers combined the correct Master → Inherited direction with "
                              "the manuals' reversed note (traced to the two passages this entry replaces)."),
            "changeNote": "New correction entry (review 1-Oct-2026)",
        },
    },
]


def check(case: dict[str, Any], text: str) -> dict[str, Any]:
    low = (text or "").lower()
    c = case["check"]
    out = {"missing": [m for m in c.get("must", []) if not re.search(m, low)],
           "forbidden": [n for n in c.get("never", []) if re.search(n, low)]}
    if c.get("future_on_screen"):
        lines = [ln for ln in low.splitlines() if "future" in ln]
        out["future_without_screen_qualifier"] = [ln.strip()[:160] for ln in lines if "screen" not in ln]
    return out


def main() -> int:
    trainer = User("devtest-tech-1", "pilot", "DEV TEST Technical trainer 1")
    user = User("devtest-user", "pilot", "DEV TEST ordinary Sail Admin")
    trainer.sign_in()
    phases = set(sys.argv[1:]) or {"before", "seed", "preview", "served"}
    report: dict[str, Any] = {"at": time.strftime("%Y-%m-%d %H:%M:%S"), "cases": []}
    existing = {e["title"]: e for e in trainer.kb("GET", "/entries?module=technical")[1]}
    ids: dict[str, str] = {}
    for case in ENTRIES:
        d = case["draft"]
        row: dict[str, Any] = {"question": case["question"], "title": d["title"]}
        if "before" in phases and case["question"]:
            r = user.chat(case["question"])
            row["before"] = {"response": r.get("response"), "tools": r.get("toolsUsed"), "check": check(case, r.get("response") or "")}
        eid = existing[d["title"]]["id"] if d["title"] in existing else ""
        if "seed" in phases:
            if eid:
                s, b = trainer.kb("PUT", f"/entries/{eid}/draft", d)
            else:
                s, b = trainer.kb("POST", "/entries", d)
                eid = b.get("entry", {}).get("id", "")
            row["seeded"] = s
        ids[d["title"]] = eid
        row["entryId"] = eid
        if "preview" in phases and eid and case["question"]:
            s, b = trainer.kb("POST", f"/entries/{eid}/preview/ask", {"question": case["question"]})
            row["preview"] = {"status": s, "draftRetrieved": b.get("draftRetrieved"), "toolsUsed": b.get("toolsUsed"), "path": b.get("path"),
                              "response": b.get("response"), "check": check(case, b.get("response") or "")}
        report["cases"].append(row)
    if "served" in phases:
        for case in ENTRIES:  # publish ALL pilot-test revisions first (the correction entry must be live for the RH answers)
            d, eid = case["draft"], ids[case["draft"]["title"]]
            test = {**d, "openPoints": [{**p, "resolved": True, "resolution": PILOT_TEST} for p in d["openPoints"]],
                    "changeNote": "Pilot test revision — " + PILOT_TEST}
            trainer.kb("PUT", f"/entries/{eid}/draft", test)
            s, b = trainer.kb("POST", f"/entries/{eid}/publish", {"changeNote": "Pilot test publish — " + PILOT_TEST})
            print("published", d["title"], s, b.get("error", ""))
        for case, row in zip(ENTRIES, report["cases"], strict=True):
            if not case["question"]:
                continue
            r = user.chat(case["question"])
            ro = user.chat(case["question"], route_only=True)
            row["served"] = {"response": r.get("response"), "tools": r.get("toolsUsed"), "check": check(case, r.get("response") or ""),
                             "routeOnlyCitations": [c.get("manual", "") + " — " + c.get("section", "") for c in ro.get("citations") or []]}
        for case in ENTRIES:
            d, eid = case["draft"], ids[case["draft"]["title"]]
            trainer.kb("POST", f"/entries/{eid}/retire", {"reason": "end of pilot test — back to draft for Jeevan"})
            trainer.kb("PUT", f"/entries/{eid}/draft", {**d, "changeNote": "Draft for Jeevan's review (after the pilot test)"})
    for row in report["cases"]:
        print(f"== {row['question'] or row['title']}")
        for k in ("before", "preview", "served"):
            if k in row:
                print(f"-- {k}: check={row[k].get('check')}\n{str(row[k].get('response'))[:900]}\n")
    OUT.mkdir(parents=True, exist_ok=True)
    f = OUT / f"four-examples-{time.strftime('%Y%m%d-%H%M%S')}.json"
    f.write_text(json.dumps(report, indent=1, ensure_ascii=False), encoding="utf-8")
    print("written", f)
    return 0


if __name__ == "__main__":
    sys.exit(main())
