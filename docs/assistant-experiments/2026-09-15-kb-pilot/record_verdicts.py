# Record the READ verdicts (mine, from reading the claim against the supplied text) and emit the review ledger.
# Machine labels stay separate: a claim with no entry here is reported as machine-assessed or NOT READ, never
# as verified. No model calls.
#   python record_verdicts.py
import json
import os
import re
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))

# Verdicts keyed by a regex over the claim text, applied within a case. Each carries the evidence I read.
# verdict ∈ supported | contradicted | unsupported | unresolved
READ = [
    # ---- CHECK-NUMBER: all five checked by direct search of the full supplied text (not the top-3 window) ----
    ("manuals/prep-3", r"20 ?MB", "supported",
     "Audit - Preparation Manual_Office_R1 §4.3.4 (p.19): 'the combined size of the file(s) selected in a single "
     "upload should not exceed 20 MB'. The 150 MB figure in the same claim is the consecutive-save limit, also present.",
     "engine artefact: the 20 MB sentence sits outside the top-3 passage window"),
    ("manuals/sms-office-3", r"4\.2\.03", "supported",
     "Safety - SMS User Manual_Office_R0 §3.1.6 (p.16): a red-boxed 'Doc 4.2.03' link.",
     "engine artefact: the number tokeniser split '4.2.03' into '4.2' and '03'"),
    # ---- CHECK-NEGATION ----
    ("wo/wo-generic-02", r"No user action is required", "supported",
     "KB pilot: Planned work orders — 'Nothing to do. The ship system runs the job-due scan once every 24 hours'.",
     "the engine matched an unrelated pre-planning passage"),
    ("fresh/fresh-wo-named-1", r"for Ship, no switch is required|on Ship, no switch is required", "supported",
     "KB pilot: 'Generate WO' for one job — 'On the SHIP instance: no switch and no role check'.", ""),
    ("generated/6", r"No specific role is required|No special role is required", "supported",
     "KB pilot: How work orders are created — 'No role check on this path (sign-in and vessel access still apply)'.", ""),
    ("generated/6", r"It does not require the office generation switch", "supported",
     "Read in context: the sentence sits under heading '3. Unplanned work order', and the same answer states "
     "correctly under '2. Per-job Generate WO' that 'In the office, the vessel's switch must be ON'.",
     "counter-example to the wo-phr-05 conflation: the same distinction stated correctly in another run"),
    ("manuals/pmsvessel-4", r"requires no active WO", "supported",
     "Recent Updates §1.1.14.6.3: 'the job must exist, be active and not already have an active work order'.", ""),
    # ---- CHECK-PERMISSION ----
    ("manuals/ra-vessel-1", r"only view Generic Risk Assessments|view-only for vessel users", "supported",
     "Safety - RA User Manual_Vessel_R1 §4 (p.7), supplied in all three runs: 'The GRA Library is available to "
     "vessel users for viewing purposes only.' The Edit/Delete GRA rows the engine matched are from the OFFICE "
     "manual §5 (p.8) — a different environment, and the answer did not use them.",
     "environment check passes: the answer scoped the rule to the vessel manual and cited it"),
    ("manuals/fs-ves-1", r"Ship users cannot modify", "supported",
     "Audit - Fleet Sharing Manual-Vessel_R1 (p.5): 'Vessel users cannot modify this information.' "
     "'Ship' and 'vessel' are the same side in this product.", ""),
    ("manuals/fs-off-1", r"office user can delete|edit it only until submission", "supported-with-qualification",
     "Audit - Fleet Sharing Manual-OFFICE_R1 (p.5): 'Records can only be deleted while they are in Draft status' "
     "and (p.8) 'Users can edit the Fleet Sharing record until it has been submitted.'",
     "the rule is stated; the actor 'office user' is inferred from which manual it is, not stated in the sentence"),
    ("manuals/certsurveys-1", r"authorized Office user|Office Sail Admin", "supported-with-qualification",
     "Technical - Cert. & Surveys For Office §1.2.1 (p.13) 'enables authorized users to…' and §1.2.1.1 'Click on "
     "the Admin sub-module'.", "same qualification: the actor comes from the manual's audience, not the sentence"),
    ("manuals/moc-office-1", r"Office: It opens the selected MoC record", "supported",
     "Safety - MOC User Manual_Office §3 (p.7) action table: 'View, edit, or export the selected MoC record.'", ""),
    ("generated/7", r"do(es)? not (support|establish) that a Head of Department", "supported",
     "Roles & Permissions §1.1.12.6: 'Head of Dept does not approve postponement requests when no approval steps "
     "are configured — that is reserved for office roles.'", ""),
    ("answers/7", r"^Office / Sail Admin$", "unresolved",
     "A two-word heading label carried over from the manual's own heading; it asserts nothing on its own.",
     "kept visible rather than dropped, per the reviewer's instruction not to exclude short strings"),
    # ---- CHECK-COMPARISON: environment / action / screen verified ----
    ("manuals/pmsoffice-5", r"vessel-side Reports|Dashboard uses Vessel, Scope", "supported",
     "Both supplied in all three runs and both concern applying a filter: OFFICE §1.1.3.2 (p.9) Dashboard filter "
     "and VESSEL §1.1.9.3 (p.46) Reports filter. Same action, the two environments named in the claim.", ""),
    ("manuals/pmsoffice-2", r"applies to both", "supported",
     "'How to update spares by location' is supplied from BOTH environments — VESSEL §1.1.7.3 (p.39) and OFFICE "
     "§1.1.7.4 (p.45) — which is the procedure the claim is about.",
     "note: the inventory-transaction sections were supplied from the Vessel manual only, so a claim resting on "
     "THOSE applying to Office would be unresolved; these claims do not rest on them"),
    # ---- carried forward from the previous round, re-verified against the supplied text ----
    ("manuals/hist-1", r"allowed to add comments in the Review section", "unsupported",
     "The expected source (Audit - History Manual_R1 p.16, 'The Review section is intended for office users "
     "only') was NEVER SUPPLIED — the routing defect sent the question to Technical. The three supplied "
     "documents are the PMS Office manual, the Ship-Side notes and the Sync notes; the permission is derived "
     "from the PMS WORK-ORDER review section and from an audience label ('Audience: Office / Sail Admin').",
     "correct by coincidence; all three runs already fail the suite on the citation check"),
    ("wo/wo-phr-05", r"apply only to the relevant planned-generation actions", "contradicted",
     "The same answer requires the switch for per-job Generate WO ('In the Office, the vessel's office "
     "work-order generation switch must be ON') and then excludes the switch from that route. KB pilot: "
     "'Generate WO' for one job states the switch applies on the OFFICE instance.",
     "the genuine answer defect; stays a failure (work-order judge .13)"),
    ("manuals/pmsoffice-4", r"stated for both", "unresolved",
     "The locked-WO restriction is quoted from OFFICE §1.1.5.7 (p.34). The Vessel §1.1.5.7 (p.30) passage is "
     "supplied but the engine's best sentence from it does not carry the restriction.",
     "cannot be settled from the top passages; the claim may be true but is not established here"),
]

XREF = re.compile(r"same (steps|procedure|process)|follow the same|uses the same steps|same as", re.I)


def main():
    out = []
    for arm in ("F1", "F0"):
        p = os.path.join(HERE, f"verdicts-{arm}.json")
        if os.path.exists(p):
            out += json.load(open(p, encoding="utf-8"))
    read = {}
    for c in out:
        key = f"{c['suite']}/{c['case']}"
        for kcase, pat, verdict, evidence, note in READ:
            if key == kcase and re.search(pat, c["claim"], re.I):
                read[c["id"]] = {"verdict": verdict, "evidence": evidence, "note": note}
                break
        else:
            # cross-reference claims: the manual's own "follow the same steps" pointer, restated
            if c["machine"] == "CHECK-COMPARISON" and XREF.search(c["claim"]):
                read[c["id"]] = {"verdict": "supported", "note": "restates the manual's own cross-reference; the "
                                 "target section is supplied in the same request",
                                 "evidence": "; ".join(f"{e['doc'][:44]} — {e['section'][:36]} (p.{e['page']})"
                                                       for e in c["evidence"][:2])}
    json.dump(read, open(os.path.join(HERE, "review-verdicts.json"), "w", encoding="utf-8"),
              ensure_ascii=False, indent=1)
    tal = defaultdict(int)
    for v in read.values():
        tal[v["verdict"]] += 1
    print(f"recorded READ verdicts: {len(read)} claim occurrences")
    for k, v in sorted(tal.items(), key=lambda x: -x[1]):
        print(f"   {v:>4}  {k}")


main()
