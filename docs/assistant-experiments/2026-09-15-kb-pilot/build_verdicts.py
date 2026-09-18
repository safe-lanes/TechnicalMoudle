# Build the per-run verdict record for ALL 171 stored D4 manual-coverage runs (owner brief 18-Sep, item 1).
# Sources merged here:
#   - computed from stored evidence: case, run, expected manual+pages, whether the expected source was among the five
#     supplied excerpts, which supplied excerpt carries the required phrases, the citation list, the automatic verdict;
#   - the full-text review (four reviewers over the UNTRUNCATED pack review-d4-pack-full.txt), recorded below as a
#     per-case default plus per-run overrides;
#   - my own adjudication of every disputed or defect run, noted in ADJUDICATED.
# No service or model calls.
import json
import os
import re
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
CASES = json.load(open(os.path.join(HERE, "..", "..", "..", "central-assistant-py", "indexer", "manual_cases.json"), encoding="utf-8"))
BY_ID = {c["id"]: c for c in CASES}

# ── per-case default verdict from the full-text review: (verdict, citation_assessment, defect_class, reason) ──
DEFAULT = {
    "fs-off-1": ("correct", "supports", "none", "Draft-only deletion rule reproduced from the supplied Fleet Sharing Office p.5 excerpt."),
    "fs-off-2": ("correct", "supports", "none", "Add-action steps match the supplied §3.2 Actions p.6 excerpt; expected source cited, though not first."),
    "fs-ves-1": ("correct", "supports", "none", "Read-only Step 1 restriction matches the supplied Vessel p.5 excerpt."),
    "fs-ves-2": ("correct", "supports", "none", "Close-out steps (Date Completed, attachments, Submit) match the supplied Vessel p.6 excerpt."),
    "hist-1": ("wrong", "unsupported", "routing_defect", "Routed to Technical: all five excerpts are PMS work-order-review text; the Audit History Review page (p.16, indexed) was never a candidate, so the answer describes the wrong module's review field."),
    "hist-2": ("correct_paraphrase", "supports", "none", "Pencil icon described as opening the record for editing — the action-icon table's wording in other words."),
    "hist-3": ("correct", "supports", "none", "Confirms the attachment procedure applies to Positive Observation and LAE findings, per the p.10 note."),
    "prep-1": ("correct", "supports", "none", "Creation steps and the email-notification note both appear in the supplied §3.1 p.13 excerpt."),
    "prep-2": ("correct", "supports", "none", "Locked fields and the removal of vessel answers match the supplied §2.7 p.11 excerpt."),
    "prep-3": ("correct_paraphrase", "supports", "none", "Add/view/download/delete all supported by the supplied §4.3.4 p.19 excerpt ('uploaded attachments … can be viewed, downloaded, or deleted'); the preferred p.20 screenshot chunk was not retrieved but nothing in the answer is unsupported."),
    "inc-1": ("correct_paraphrase", "supports", "none", "Office-only closeout conveyed in other words; supported by the supplied Part K p.18 excerpt."),
    "inc-2": ("correct", "supports", "none", "Overdue-action meaning reproduced from the supplied p.19 excerpt."),
    "inc-3": ("correct", "supports", "none", "Method 2 sequence-of-events steps match the supplied p.9 excerpt."),
    "fn-1": ("correct", "supports", "none", "Submit-after-all-dates condition matches the supplied Vessel p.7 note."),
    "fn-2": ("correct", "supports", "none", "Discussion-record steps match the supplied Vessel p.6 excerpt."),
    "ll-1": ("correct_paraphrase", "supports", "none", "View-only restriction for vessel users conveyed in other words; supported by the supplied p.6 excerpt."),
    "ll-2": ("correct", "supports", "none", "Discussion and submission steps match the supplied p.7 excerpt."),
    "nm-1": ("correct", "supports", "none", "Directs the user to the Significant Near Miss form per the supplied p.8 note."),
    "nm-2": ("correct_paraphrase", "supports", "none", "Office-only closeout restriction conveyed in other words; supported by the supplied p.11 excerpt."),
    "nm-3": ("correct", "supports", "none", "Actions-due indicator meaning matches the supplied p.11 excerpt."),
    "crewing-1": ("correct", "supports", "none", "New-crew button and Save Draft both match the supplied p.14 excerpt."),
    "crewing-2": ("correct", "supports_but_not_first", "none", "Admin-created-and-released form requirement matches the supplied p.48 excerpt; the answer's source line lists another page first."),
    "crewing-3": ("correct", "supports", "none", "Colour meanings match the supplied p.39 excerpt."),
    "crewing-4": ("correct", "supports", "none", "Compliance check matches the supplied p.41 annotation."),
    "crewing-5": ("correct", "supports", "none", "Cross-reference resolved to the In-Progress steps exactly as the supplied p.29 note directs; the reproduced steps are the In-Progress ones from p.14, not a widened scope."),
    "crewing-6": ("correct", "supports", "none", "New training record steps match the supplied p.110 excerpt."),
    "moc-office-1": ("correct", "supports", "none", "Office view/edit/export versus Vessel view-attachments contrast matches the two supplied table excerpts."),
    "moc-office-2": ("correct", "supports", "none", "Link → RA form → stored in the corresponding RA sub-module, supported by the supplied MoC p.13 and Risk Assessment §3 p.6 excerpts."),
    "moc-vessel-1": ("correct", "supports", "none", "'Not Approved' outcome matches the supplied Vessel Part D p.11 note; correctly avoids the Part B 'Not Processed' rule."),
    "moc-vessel-2": ("correct", "supports", "none", "Part A steps match the supplied Vessel p.6 excerpt."),
    "master-review-1": ("correct", "supports", "none", "Add Attachment / View Attachments / Edit Record match the supplied p.6 action-icon table."),
    "master-review-2": ("honest_limit_correct", "unsupported", "retrieval_defect", "Declines honestly: the Part E / Office Closeout chunk (Master Review p.11) is indexed but was displaced from the five excerpts by the lexical rescue."),
    "ra-office-1": ("correct", "supports", "none", "One approval level per rank, edit the existing record — matches the supplied p.25 excerpt."),
    "ra-office-2": ("correct", "supports", "none", "All six hazard categories match the supplied Figure 15 transcription (Office p.13)."),
    "ra-office-3": ("correct_paraphrase", "supports", "none", "Filtering the same across the three sections, with differing field sets — supported by the supplied p.7 excerpt."),
    "ra-vessel-1": ("correct", "supports", "none", "Generic RA library view-only for vessel users; the Office edit action is correctly scoped out."),
    "ra-vessel-2": ("correct", "supports", "none", "Three creation routes match the supplied Vessel p.10 excerpt."),
    "sms-office-1": ("correct", "wrong_page", "retrieval_defect", "States honestly that section 4.2.2's own text was not supplied and gives the 4.1.2 steps it did receive; the expected chunk (SMS Office p.21) is indexed but was not retrieved."),
    "sms-office-2": ("correct", "supports", "none", "Is-Form folder behaviour matches the supplied p.15 excerpt."),
    "sms-office-3": ("correct", "supports", "none", "Document reference 'Doc 4.2.03' matches the supplied §3.1.6 p.10 excerpt."),
    "safety-meeting-1": ("correct", "supports", "none", "Parts B and C follow the Monthly Safety Meeting form and Part D is office-only, per the supplied §2.2 p.18 excerpt."),
    "safety-meeting-2": ("correct", "supports", "none", "Carried-forward advisory behaviour matches the supplied Part C p.13 note."),
    "certsurveys-1": ("correct_paraphrase", "supports", "none", "Add-certificate steps and the auto-generated Master ID match the supplied p.17/p.18 excerpts."),
    "certsurveys-2": ("correct_paraphrase", "supports", "none", "Asterisk-marked mandatory fields must be completed before saving — matches the supplied p.18 excerpt."),
    "certsurveys-3": ("correct_paraphrase", "supports", "none", "Resolves the cross-reference correctly: survey attachments follow the certificate steps, exactly the operation the p.11 note covers."),
    "defects-1": ("correct_paraphrase", "supports", "none", "Row-level Edit icon and the view-then-edit route both match the supplied p.16 excerpt."),
    "defects-2": ("correct", "supports", "none", "Submit saves and forwards to the next workflow stage — matches the supplied p.15 excerpt."),
    "defects-3": ("correct_paraphrase", "supports", "none", "Bulk export of Condition of Class records matches the supplied p.20 excerpt with its resolved cross-reference."),
    "pmsoffice-1": ("correct_paraphrase", "supports_but_not_first", "none", "Due and Overdue definitions match the supplied p.28 excerpt; the expected page is cited second."),
    "pmsoffice-2": ("correct_paraphrase", "supports_but_not_first", "none", "ROB cannot be changed without selecting a location — matches the supplied p.45 excerpt, cited fourth."),
    "pmsoffice-3": ("correct", "supports", "none", "Drag-and-drop component move matches the supplied p.26 excerpt."),
    "pmsoffice-4": ("correct_paraphrase", "supports_but_not_first", "none", "Locked work orders need Tech Superintendent acknowledgement then HOD approval — matches the supplied p.34 banner."),
    "pmsoffice-5": ("honest_limit_correct", "supports", "retrieval_defect", "Office dashboard filters correct; states honestly that the vessel-side dashboard was not supplied. That section exists and is indexed (Vessel manual p.9, 'select the required criticality level') but was not retrieved."),
    "pmsvessel-1": ("correct_paraphrase", "supports_but_not_first", "none", "Stores item categories match the supplied Vessel p.42 excerpt; 'Stores' itself honestly flagged as not further described."),
    "pmsvessel-2": ("correct_paraphrase", "supports", "none", "Change request not available to a vessel user, only to the head of department — matches the supplied p.47 excerpt."),
    "pmsvessel-3": ("correct_paraphrase", "supports", "none", "Resolves the cross-reference: Stores has its own entry button and then follows the Spares steps."),
    "pmsvessel-4": ("correct_paraphrase", "supports_but_not_first", "none", "Duplicate work order refused; both the published manuals and the draft guidance are named."),
}

# ── per-run overrides, each adjudicated by me against the full excerpt text ──
OVERRIDE = {
    ("hist-3", 1): ("partial", "supports", "procedural_mistake",
                    "ADJUDICATED defect: step 3 still says 'Enter the Negative observation' although the question is about a Positive Observation or LAE finding, and the Observation / Positive Finding / LAE page toggle in the supplied p.9 screenshot text is omitted. Runs 2 and 3 generalise the step correctly."),
    ("certsurveys-3", 2): ("honest_limit_but_evidence_supplied", "unsupported", "false_claim_of_missing_evidence",
                           "ADJUDICATED defect: the answer says the manual 'does not establish whether the survey process is identical or different', but the supplied p.11 excerpt says 'refer to the Certificates sub-sub-module for the add or view attachment and follow the same steps' — the cross-reference covers exactly the asked operation (add or view attachment), so the claimed limitation is false."),
    ("pmsvessel-3", 2): ("partial", "supports", "false_claim_of_missing_evidence",
                         "ADJUDICATED defect (milder than first reported): the answer quotes the 'refer to Spares and follow the same steps' direction and then contradicts itself with 'the excerpts do not fully document whether the Stores form operates identically to the Spares form'. Internally inconsistent; runs 1 and 3 state it cleanly."),
    ("pmsoffice-5", 3): ("partial", "supports", "unsupported_comparison",
                         "ADJUDICATED defect: asserts 'the vessel-side set is not the same as the PMS Dashboard set' by comparing the Office dashboard with the vessel REPORTS screen, a different screen, and drops the caveat runs 1 and 2 include. The vessel dashboard filter section exists and is indexed but was not supplied to this run."),
    ("safety-meeting-1", 1): ("partial", "supports", "false_claim_of_missing_evidence",
                              "ADJUDICATED defect: the closing sentence 'the provided excerpts do not include the detailed Monthly Safety Meeting instructions' is false — supplied excerpt [4] (Part B, p.11) gives exactly those steps (unresolved actions in B1.1, + Add Action, Save). The routing part of the answer is correct."),
    ("safety-meeting-1", 2): ("partial", "supports", "false_claim_of_missing_evidence",
                              "ADJUDICATED defect: same false statement about Part B as run 1, with the same supplied p.11 excerpt available. Run 3 uses that excerpt correctly."),
    ("moc-office-2", 2): ("correct", "supports_but_not_first", "none",
                          "ADJUDICATED not a defect: the Office RA / Vessel RA mapping is supported by supplied excerpt [5] (Risk Assessment §3 p.6); the answer's own source line cites only MoC p.13, so the citation is incomplete rather than wrong."),
    ("pmsvessel-4", 3): ("correct_paraphrase", "supports", "none",
                         "ADJUDICATED not a defect: the source list labels the draft code-derived guidance separately from the two manuals, and both sources state the same rule, so no misattribution occurs. Runs 1 and 2 additionally attribute per claim in the prose, which is better practice."),
    ("hist-1", 1): None, ("hist-1", 2): None, ("hist-1", 3): None,
}


def page_of(section):
    m = re.search(r"\(p\.(\d+)\)", str(section or ""))
    return int(m.group(1)) if m else None


def captures(path):
    out = defaultdict(list)
    for line in open(os.path.join(HERE, path), encoding="utf-8"):
        rec = json.loads(line)
        if "chat/completions" not in rec.get("url", ""):
            continue
        body = json.loads(rec["body"])
        user = next((m["content"] for m in body.get("messages", []) if m.get("role") == "user"), "")
        q = user.rsplit("\n\nQuestion: ", 1)[-1].strip() if "\n\nQuestion: " in user else ""
        block = user.split("Manual excerpts:\n\n", 1)[-1].rsplit("\n\nQuestion:", 1)[0]
        ex = []
        for part in block.split("\n\n---\n\n"):
            head, _, txt = part.partition("\n")
            m = re.match(r"\[(\d+)\] \((.+?) — (.+)\)$", head)
            if m:
                ex.append({"file": m.group(2), "section": m.group(3), "text": txt})
        out[q].append(ex)
    return out


rows = [json.loads(l) for l in open(os.path.join(HERE, "s4c-manuals-dump.jsonl"), encoding="utf-8") if l.strip()]
rows = [r for r in rows if r["set"] == "D4-rescue"]
cap = captures("s4-d4-capture.jsonl")
used = defaultdict(int)
order = [c["id"] for c in CASES]
rows.sort(key=lambda r: (order.index(r["case"]), r["run"]))

records = []
for r in rows:
    c = BY_ID[r["case"]]
    key = (r["case"], r["run"])
    v = OVERRIDE.get(key) or DEFAULT[r["case"]]
    q = c["question"]
    ex = cap[q][used[q]] if used[q] < len(cap.get(q, [])) else []
    used[q] += 1
    expected_supplied = [i + 1 for i, e in enumerate(ex)
                         if c["file"].rsplit(".", 1)[0].lower() in e["file"].lower() and (not c["pages"] or page_of(e["section"]) in c["pages"])]
    carrying = [i + 1 for i, e in enumerate(ex) if c["must"] and all(m.lower() in e["text"].lower() for m in c["must"])]
    cits = [f"{ci.get('manual')} — {ci.get('section')}" for ci in (r["response"].get("citations") or [])]
    records.append({
        "case": r["case"], "kind": c["kind"], "run": r["run"],
        "verdict": v[0], "citation_assessment": v[1], "defect_class": v[2], "reason": v[3],
        "expected_source": f"{c['file']} p{c['pages']}",
        "expected_source_supplied_as_excerpt": expected_supplied or None,
        "excerpts_carrying_all_required_phrases": carrying or None,
        "citations_shown": cits,
        "automatic_verdict": {"answer": r["verdict"]["answer"], "citation": r["verdict"]["citation"], "support": r["verdict"]["support"]},
    })

by_case = defaultdict(list)
for x in records:
    by_case[x["case"]].append(x)
clean = {"none"}
summary = {
    "runs": len(records),
    "by_verdict": dict(sorted(defaultdict(int, {v: sum(1 for x in records if x["verdict"] == v) for v in {x["verdict"] for x in records}}).items())),
    "by_defect_class": dict(sorted({d: sum(1 for x in records if x["defect_class"] == d) for d in {x["defect_class"] for x in records}}.items())),
    "runs_with_answer_defect": sorted(f"{x['case']} r{x['run']}" for x in records if x["defect_class"] in
                                      {"procedural_mistake", "unsupported_comparison", "false_claim_of_missing_evidence", "other_answer_defect"}),
    "runs_with_retrieval_or_routing_defect": sorted(f"{x['case']} r{x['run']}" for x in records if x["defect_class"] in {"retrieval_defect", "routing_defect"}),
    "cases_clean_in_all_three_runs": sorted(cid for cid, rs in by_case.items() if all(x["defect_class"] in clean for x in rs)),
}
summary["cases_clean_count"] = len(summary["cases_clean_in_all_three_runs"])
out = {"what": "Per-run verdicts for all 171 stored D4 manual-coverage runs, judged against the UNTRUNCATED excerpts.",
       "summary": summary, "records": records}
json.dump(out, open(os.path.join(HERE, "review-d4-verdicts-full.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(json.dumps(summary, ensure_ascii=False, indent=1))
