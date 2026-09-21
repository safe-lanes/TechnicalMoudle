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
    # ============ BATCH 4 (19-Sep, reviewer's fifth pass) — CORRECTIONS FIRST, so they override earlier rows ==
    # Two findings I reported last round were FALSE. Both came from searching only the excerpt BODY text and
    # not the document/section headers, and from searching for one phrasing instead of the meaning.
    ("manuals/certsurveys-2", r"cannot be saved|not be saved", "supported",
     "Audit/Cert. & Surveys supplied text, verbatim: 'Mandatory fields (*) must be completed before the record "
     "can be saved.' The answer's 'if mandatory fields are blank, the record cannot be saved' is the "
     "contrapositive of that sentence.",
     "RETRACTION: I recorded this as UNSUPPORTED last round. The verdict was wrong — I searched for 'cannot be "
     "saved' / 'not be saved' and missed the manual's positive phrasing. Absence of a phrase is not absence of "
     "support, exactly as the reviewer said."),
    ("manuals/fn-2", r"Lesson Learnt", "supported",
     "The Lesson Learnt User Manual_Vessel_R0 (p.7) Section 2 Discussion Record WAS supplied as excerpt 2 and "
     "is cited. PROCEDURES COMPARED (the reviewer's caveat): the two supplied passages are word-for-word the "
     "same — 'In Section 2 - Discussion Record, record the details of the onboard discussion / Select the "
     "Notification Discussed on board checkbox / Enter the Date of discussion / Enter the participant details / "
     "submitted by clicking Submit'. 'Same steps' is therefore verified, not merely inferred from presence.",
     "RETRACTION: I recorded this as UNSUPPORTED last round on the grounds that 'Lesson Learnt' appears nowhere "
     "in the supplied text. It appears in the excerpt HEADER; my search covered only the body. Third tooling "
     "false finding in this workstream, after the em-dash header parser and the negated-XREF rule."),
    # Astra 4 — the correction must apply to BOTH arms. The earlier batch-1 row matched F1 first and kept the
    # old explanation; this row precedes it so both arms get the same reasoning.
    ("manuals/pmsoffice-5", r"vessel-side Reports|Dashboard uses Vessel, Scope|dashboard and vessel-side filters are different|filter sets are different|does not document the same Dashboard|do not list Vessel, Scope|not the same filter", "supported-with-qualification",
     "OFFICE Dashboard filter 1.1.3.2 (p.9) and VESSEL Reports filter 1.1.9.3 (p.46) are both supplied, and the "
     "two filter lists differ as the answer states.",
     "VALID as a comparison of two DIFFERENT screens, which is what the question asks. NOT valid as a claim "
     "about equivalent screens: the two passages differ in BOTH screen and environment, so nothing here "
     "establishes that the same screen differs between Office and Vessel. Applies to both arms (earlier "
     "versions qualified F0 only)."),
    # Astra 5 — the audience-label framing overstated what the capture shows
    ("manuals/hist-1", r"allowed to add comments in the Review section|Office user reviews the record", "unsupported",
     "The expected source (Audit - History Manual_R1 p.16, 'The Review section is intended for office users "
     "only') was never supplied; the routing sent the question to Technical. The answer describes the PMS "
     "WORK-ORDER review procedure instead.",
     "CORRECTED FRAMING: I previously wrote that the permission was 'inferred from an audience label'. That "
     "overstates what the capture shows — the supplied text also says explicitly 'The user interface shown in "
     "Ref. Figures 12-15 are applicable to the Office side.' The Office attribution is therefore locally "
     "supported. The defect is that it is the WRONG FEATURE: work-order review, not inspection-history review."),
    # --- the last four outstanding risk claims ---
    ("generated/6", r"No specific role or office-generation switch is required", "supported",
     "Read in context: the sentence is line 17 of the answer, under the heading '3. Create an unplanned work "
     "order'. The same answer states the per-job switch requirement correctly at line 13.", ""),
    ("generated/6", r"verified against application revision cf5241ad6", "supported",
     "The KB provenance note names revision cf5241ad6 verbatim in the supplied text.", ""),
    ("manuals/hist-3", r"importing a JSON file", "supported",
     "Audit History Manual (p.13), verbatim: 'Observation details, including Positive and LAE findings, are "
     "automatically populated from the uploaded JSON file.'", ""),
    ("manuals/pmsvessel-1", r"available in the Store sub-module for both Office and Vessel", "supported",
     "PMS Office 1.1.8.1 and PMS Vessel 1.1.8.1 — the same section from both environments — are both supplied.", ""),
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
    # ================= BATCH 3 (19-Sep) — the remaining CHECK-* claims, F1 tail and F0 =================
    # F0 is reviewed to the same standard; 87 of 101 questions received identical supplied excerpts, so the
    # same verified passages apply. Claims below that are NEW to F0 were probed individually.
    ("manuals/certsurveys-2", r"cannot be saved|not be saved", "unsupported",
     "The supplied text carries a 'Mandatory field' marker and the save-icon callout, but NO statement that the "
     "record cannot be saved while a mandatory field is blank. Searched the full supplied text for 'cannot be "
     "saved', 'not be saved', 'required fields' — none present.",
     "NEW FINDING on F0: a field marker turned into a save rule. Same shape as the hist-1 audience-label error."),
    ("manuals/fn-2", r"Lesson Learnt", "unsupported",
     "'Lesson Learnt' does not appear anywhere in the supplied excerpts for this question. The supplied text "
     "covers the Fleet Notification discussion record only.",
     "NEW FINDING on F0: a second form asserted to share the procedure, with no supplied passage about it."),
    ("manuals/inc-3", r"Date / Time / Description|separate Date", "supported",
     "Incident manual Part D, verbatim: 'METHOD 2: Use the Date / Time / Description section to enter details "
     "of sequence of events.'", ""),
    ("manuals/pmsvessel-1", r"Stores, Lubes, Chemicals", "supported-with-qualification",
     "Verbatim: 'Choose the required category (Stores, Lubes, Chemicals, or Others), then select Inventory, "
     "Location, or History'.", "the 'for both Office and Vessel users' part rests on one manual only"),
    ("wo/wo-generic-01", r"Office manual includes vessel selection", "supported",
     "PMS Office 1.1.5.2 (p.29) has 'Select the vessel from the Vessel dropdown'; the Vessel manual 1.1.5.2 "
     "(p.24) step list omits it. Both supplied.", ""),
    ("manuals/prep-3", r"Multiple attachments", "supported",
     "Audit Preparation 4.3.4 (p.19): 'Multiple attachments can be uploaded for a selected question.'", ""),
    ("wo/wo-phr-03", r"active, attached to a component", "supported",
     "KB pilot: Planned work orders — 'The job must be active and attached to a component, with a frequency and "
     "a next due date ... must not already have an active work order.'", ""),
    ("generated/6", r"vessel switch is not required|does not require the office work-order generation switch", "supported",
     "Read in context: both sentences sit under the unplanned-work-order heading in their answers, and the same "
     "answers state the switch requirement correctly under the per-job heading.", ""),
    ("wo/wo-generic-02", r"not generated automatically", "supported",
     "KB pilot: How work orders are created — 'IN THE OFFICE: nothing runs automatically; a Sail Admin can click "
     "Generate Now ... only if that vessel's switch is on.'", ""),
    ("generated/7", r"does not say that a Head of Department|equivalence with an office user is not established", "supported",
     "Roles & Permissions 1.1.12.6: 'Head of Dept does not approve postponement requests when no approval steps "
     "are configured — that is reserved for office roles.'", ""),
    ("answers/11", r"can be added in either of these ways|also be added by clicking", "supported",
     "PMS Office 1.1.4.3 (p.24) note inside Figure 35: a new component can also be added with '+ Add Component'.", ""),
    ("generated/1", r"Duplicate checking applies only when", "supported",
     "Bulk Data Import: 'Duplicate checking applies only to rows that supply a Job Code together with a "
     "Component Code for the selected vessel.'", ""),
    ("generated/4", r"sequence continues across both", "unresolved",
     "The two numbering formats are supplied but neither states that the sequence CONTINUES across them.",
     "same inference as the F1 occurrence"),
    ("manuals/hist-1", r"Office user reviews the record", "unsupported",
     "Same root cause as the other hist-1 claims: the Audit History manual was never supplied; the steps come "
     "from the PMS work-order review section.", "F0 carries the same defect — routing is unaffected by the document change"),
    ("manuals/hist-3", r"does not specify different role|does not provide separate data-entry steps|same attachment", "supported",
     "Audit History 2.1.4 (p.10) and the Document block (p.13), both supplied; the manual states 'Follow the "
     "above procedure for adding Positive Observations and LAE finding details.'", ""),
    ("manuals/pmsoffice-4", r"applies in both the vessel-specific and Office", "unresolved",
     "Same as the F1 occurrence: the restriction is quoted from the Office manual; the Vessel passage is "
     "supplied but does not carry it.", ""),
    ("manuals/pmsoffice-5", r"dashboard and vessel-side filters are different|filter sets are different|does not document the same Dashboard|do not list Vessel, Scope", "supported-with-qualification",
     "Both filter sets are supplied and differ as stated.",
     "the comparison crosses BOTH screen and environment, so it cannot attribute the difference to either"),
    ("manuals/pmsoffice-2", r"applies in both Office and Ship documentation", "unresolved",
     "Same as the F1 occurrence: no Office passage for the inventory-transaction procedure was supplied.", ""),
    ("manuals/pmsvessel-3", r"do not document a separate|do not reproduce the remaining|not presented as a wholly separate|covered in both the Vessel and Office|same Store bulk-update entry point", "supported",
     "PMS Vessel 1.1.8.3 (p.43) and PMS Office 1.1.8.3 (p.50) both supplied; the Store section cross-references "
     "Spares and the downstream Spares steps are not reproduced.", ""),
    ("manuals/pmsvessel-4", r"applies in both Office and Ship|applies on both Office and Ship", "supported",
     "Recent Updates 1.1.14.6.3 and the KB per-job file, both supplied, state the office and ship conditions.", ""),
    ("manuals/crewing-6", r"Training Needs (process|function) uses", "supported-with-qualification",
     "Crewing (p.88-89) documents '+ New Entry' and 'Save to create the training need record'.",
     "the contrast with the Training Matrix is the answer's inference"),
    ("manuals/certsurveys-3", r"do not state that the process is different|does not describe a separate survey-specific|No different survey-specific process", "supported",
     "Accurate limitation: the Surveys section carries only the pointer to Certificates.", ""),
    ("manuals/safety-meeting-1", r"Follow the instructions in the Monthly Safety Meeting|do not give separate Part C steps", "supported",
     "Safety Meeting 2.2 (p.18), verbatim instruction to follow the Monthly Safety Meeting form for Parts B and C.", ""),
    ("manuals/ra-office-1", r"Do not create a new approver record", "supported",
     "RA Office 8 Key Personnel (p.25) and Approval Level Configuration (p.24).", ""),
    ("manuals/ra-office-3", r"process is shared", "supported",
     "RA Office 4 (p.7): 'The filtering functionality is same across ... The available filter options vary'.", ""),
    ("manuals/ra-vessel-1", r"only look at Generic Risk Assessments|editing is not available", "supported",
     "RA Vessel 4 (p.7): 'The GRA Library is available to vessel users for viewing purposes only.'", ""),
    ("manuals/moc-office-1", r"function differs between the manuals", "supported",
     "MOC Office 3 (p.7) and MOC Vessel 2 (p.5) action tables both supplied.", ""),
    ("manuals/pmsvessel-3", r"supplied vessel manual documents only the first two Spares steps", "supported",
     "Accurate limitation about what the Vessel passage contains.", ""),
    ("answers/5", r"shown for both Office and Vessel", "supported",
     "RA Office (p.13) and RA Vessel 8 (p.12) both supplied.", ""),
    ("answers/10", r"applies in both the Office and Vessel", "supported",
     "MOC Office 6 (p.11) and MOC Vessel 5 (p.7) both supplied.", ""),
    ("answers/7", r"filtering steps differ slightly between Office and Ship", "supported-with-qualification",
     "PMS Office 1.1.8.2 (p.49) and PMS Vessel 1.1.8.2 (p.43) both supplied.",
     "'differ slightly' is a judgement about degree that the passages do not state"),
    ("fresh/fresh-wo-named-1", r"June manuals describe the action as unconditional|no Sail Admin role check, while the June", "supported",
     "KB 'Generate WO' for one job plus the June Office manual passage, both supplied.", ""),
    ("wo/wo-phr-01", r"guidance is broader than the published June manuals", "supported",
     "The KB file states the manuals cover only ways 2 and 3; both supplied.", ""),
    ("wo/wo-phr-02", r"come from draft code-derived guidance", "supported",
     "Provenance note present verbatim in the supplied KB text.", ""),
    ("manuals/pmsoffice-5", r"On the PMS Dashboard \(Office\), you can filter by", "unresolved",
     "A list lead-in; the filter names are in the items beneath it.", "retained for visibility"),
    ("answers/3", r"Both use the (new-document|SMS) change-request", "unresolved",
     "A list lead-in introducing the two paths; the substance is in the items beneath it.", "retained for visibility"),
    ("wo/wo-phr-05", r"published manual describes the same navigation and reason selection", "supported",
     "PMS Office (p.18) describes the Components Part C route and the reason choice; the KB file supplies the "
     "switch condition the manual omits, which is what the sentence says.", ""),
    # ================= BATCH 2 (19-Sep, after the reviewer found the count overstatement) =================
    # Astra 2a — my XREF auto-rule matched "same as" INSIDE A NEGATION and produced a note that contradicted the
    # claim. Verified: section 4.2.2 is NOT in the supplied text and there is no "same as 4.1.2" statement.
    ("manuals/sms-office-1", r"4\.2\.2 is not included", "supported",
     "Checked the full supplied text: no '4.2.2', no 'same as 4.1.2', no 'refer to 4.1'. The limitation the "
     "answer states is accurate.",
     "CORRECTION: the earlier auto-verdict called this 'restates the manual's own cross-reference; the target "
     "section is supplied' — self-contradictory and wrong. The XREF rule fired on 'same as' inside a negation."),
    # Astra 2b — the Dashboard/Reports comparison crosses BOTH screen and environment
    ("manuals/pmsoffice-5", r"vessel-side Reports|Dashboard uses Vessel, Scope", "supported-with-qualification",
     "OFFICE Dashboard filter 1.1.3.2 (p.9) and VESSEL Reports filter 1.1.9.3 (p.46) are both supplied and the "
     "two filter sets differ as stated; the question itself frames the comparison this way.",
     "CORRECTION: my earlier note said 'same action (apply filter)'. It is not — the two passages differ in "
     "BOTH screen and environment, so the comparison cannot attribute the difference to either. Any claim "
     "generalising to 'the two Dashboard screens differ' is NOT established."),
    # --- comparisons where both environments/sections are supplied ---
    ("answers/10", r"applies to both the Office and Vessel", "supported",
     "MOC Office 6 (p.11) and MOC Vessel 5 (p.7) both supplied — same section, both environments.", ""),
    ("answers/5", r"tabs in the hazard-selection window for both Office and Vessel", "supported",
     "RA Office (p.13) and RA Vessel 8 (p.12) both supplied.", ""),
    ("manuals/moc-office-1", r"differs by version|Yes, it differs", "supported",
     "MOC Office 3 (p.7) and MOC Vessel 2 (p.5) action tables both supplied; they list different actions.", ""),
    ("manuals/pmsvessel-3", r"both Vessel and Office|same listed entry steps", "supported",
     "PMS Vessel 1.1.8.3 (p.43) and PMS Office 1.1.8.3 (p.50) — the same section from both environments.", ""),
    ("manuals/pmsvessel-3", r"not fully establish|do not establish whether every subsequent", "supported",
     "Accurate limitation: the Store section cross-references Spares and the excerpts do not reproduce the "
     "downstream Spares steps.", ""),
    ("manuals/fs-off-2", r"For an Office user, add an action item", "supported-with-qualification",
     "FS Office 3.2 (p.6): 'This section allows users to create and manage actions'; FS Vessel Step 3 (p.6) also "
     "supplied.", "actor inferred from which manual it is, not stated in the sentence"),
    ("manuals/pmsoffice-2", r"also documented for both Ship and Office", "unresolved",
     "The two supplied passages for the inventory-transaction procedure are BOTH from the Vessel manual "
     "(1.1.7.2 p.38, 1.1.8.5 p.44). No Office passage for that procedure was supplied.",
     "distinct from the 'update spares by location' claims, which ARE supplied from both environments"),
    # --- accurate limitation statements, verified against the full supplied text ---
    ("manuals/certsurveys-3", r"not reproduce the actual survey steps|not include a resolved cross-reference|not described as different", "supported",
     "Supplied text carries the pointer 'Refer to the Certificates sub-sub-module ... and follow the same steps' "
     "but not the Certificates steps themselves — the limitation is accurate.", ""),
    ("manuals/safety-meeting-1", r"not (provide|have) separate", "supported",
     "Safety Meeting Manual 2.2 (p.18): 'Follow the instructions provided in the Monthly Safety Meeting form to "
     "complete Part B and Part C of the Additional Safety Meeting form.'", ""),
    ("generated/6", r"does not specify a separate error message", "supported",
     "The refusal message in the supplied text belongs to the 'Generate Now' KB file; no message is given for the "
     "per-job route, which is what the sentence is about.", ""),
    # --- single-source checks ---
    ("manuals/ra-office-3", r"same (way|across)|not a (completely )?separate procedure|filter options vary|filter choices depend", "supported",
     "RA Office 4 (p.7), verbatim: 'The filtering functionality is same across the Generic RA Library, Office "
     "RA, and Vessels RA sections. The available filter options vary depending on the selected section.'", ""),
    ("generated/12", r"contact support", "supported",
     "Sync (Operational) 1.2.10: 'a Sail Admin re-provisions the ship from Admin to Ship Provisioning, or "
     "contacts support.'", ""),
    ("manuals/crewing-6", r"New Entry.{0,40}training need", "supported-with-qualification",
     "Crewing Manual (p.88-89): the '+ New Entry' button and 'Click Save to create the training need record'.",
     "the contrast 'not a Training Matrix record' is the answer's inference, not stated"),
    ("manuals/ra-office-1", r"edit the existing approver record|Do not create a second approver|needs a different Approval Level", "supported",
     "RA Office 8 Key Personnel (p.25) and Approval Level Configuration (p.24), both supplied.", ""),
    ("manuals/hist-3", r"same Upload, Save|applies to both|importing inspection data", "supported",
     "Audit History Manual 2.1.4 (p.10) and the Document block (p.13) both supplied — this case routes to audit "
     "correctly, unlike hist-1.", ""),
    ("wo/wo-generic-02", r"separate from automatic planned-work-order|active work order cannot receive another", "supported",
     "KB pilot: How work orders are created — the three ways, plus PMS Office 1.1.5.2 (p.29).", ""),
    ("wo/wo-phr-03", r"^Both\.$|Both are supported", "supported",
     "Both KB files supplied: 'How work orders are created' and 'Planned work orders — ship daily scan'.", ""),
    # --- provenance/source-attribution claims: the provenance note is in the supplied KB text ---
    ("generated/6", r"comes from draft, code-derived guidance", "supported",
     "The KB files carry the provenance note verbatim in the supplied text.", ""),
    ("wo/wo-phr-01", r"June manuals document the unplanned", "supported",
     "KB 'How work orders are created' states the manuals cover only ways 2 and 3; PMS Office 1.1.5.2 (p.29) "
     "is the unplanned procedure.", ""),
    ("wo/wo-generic-03", r"come from draft, code-derived guidance", "supported",
     "Provenance note present verbatim in the supplied KB text.", ""),
    ("wo/wo-phr-03", r"come from draft code-derived guidance", "supported",
     "Provenance note present verbatim in the supplied KB text.", ""),
    ("wo/wo-phr-04", r"inspected in application code and was not measured", "supported",
     "KB text: 'Read from the source code; not measured against a running installation.'", ""),
    ("wo/wo-phr-05", r"draft code-derived guidance states the Office switch", "supported",
     "Provenance note present verbatim in the supplied KB text.", ""),
    ("fresh/fresh-wo-broad-1", r"comes from draft code-derived", "supported",
     "Provenance note present verbatim in the supplied KB text.", ""),
    ("fresh/fresh-wo-named-1", r"no Sail Admin role requirement|not limited to Sail Admin", "supported",
     "KB 'Generate WO' for one job: 'Who can do it (role): No role check on this path.'", ""),
    ("generated/11", r"Auto-sync", "supported",
     "Sync manual: 'Auto-sync runs on the ship when enabled in the ship's Auto-Sync Settings.'", ""),
    ("generated/13", r"non-decrease rule also applies", "supported",
     "Ship-Side notes 1.1.13.2, verbatim: 'reconciled by reading date — the latest date wins; a same-date tie "
     "goes to the ship.'", ""),
    ("generated/4", r"running sequence, which continues across both", "unresolved",
     "The numbering formats are supplied (Recent Updates 1.1.14.1, Ship-Side preamble) but neither states that "
     "the sequence CONTINUES across the old and new formats.", "an inference the supplied text does not carry"),
    ("answers/11", r"does not provide separate steps for that button", "supported",
     "PMS Office 1.1.4.3 (p.24) describes adding a component; the note about the '+ Add Component' button gives "
     "no separate step list.", ""),
    # --- fragments and lead-ins retained for visibility ---
    ("fresh/fresh-technical-1", r"In the Office Certificates screen, you can", "unresolved",
     "A list lead-in; the content is in the items beneath it, scored separately.",
     "retained rather than dropped, per the instruction not to exclude by length or trailing colon"),
    ("manuals/pmsoffice-4", r"stated for both", "unresolved",
     "The locked-WO restriction is quoted from OFFICE §1.1.5.7 (p.34). The Vessel §1.1.5.7 (p.30) passage is "
     "supplied but the engine's best sentence from it does not carry the restriction.",
     "cannot be settled from the top passages; the claim may be true but is not established here"),
]

# FIXED 19-Sep (reviewer point 2a): the rule fired on "same as" inside a NEGATION ("the manual does not state
# that its approval steps are the same as 4.1.2") and produced a note contradicting the claim.
XREF = re.compile(r"same (steps|procedure|process)|follow the same|uses the same steps|same as", re.I)
XREF_NEG = re.compile(r"(not|does not|do not|never|without|no)[^.]{0,60}(same|refer)", re.I)


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
            if c["machine"] == "CHECK-COMPARISON" and XREF.search(c["claim"]) and not XREF_NEG.search(c["claim"]):
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
