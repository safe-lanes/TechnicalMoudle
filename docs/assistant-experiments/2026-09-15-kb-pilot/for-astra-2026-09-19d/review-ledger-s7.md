<stdin>:24: SyntaxWarning: invalid escape sequence '\*'
# Review ledger — S7 paired run (v2, 19-Sep)

Stable id `suite/case/arm/rRUN/cNN`. **READ** verdicts are mine, from reading the claim against the
supplied text; each carries the document/section/page. **MACHINE** labels are deterministic rules
(`verdicts.py`); `auto-supported` has **not** been read and is never reported as verified.

> **Coverage, stated first.** The previous version of this ledger said "all 123 risk claims read".
> That was wrong: 73 (F1) + 44 (F0) = 117 were recorded and F1 alone left 56 CHECK-* claims unread.
> Corrected here. Current coverage is below, and what remains unread is named.


## Arm F1 — 1255 occurrences in the review population

**Risk categories (CHECK-\*): 123 occurrences, 122 READ, 1 still unread.**
**Total READ on this arm: 150.**

| status | occurrences |
|---|---|
| **READ — supported** | 129 |
| **READ — unresolved** | 9 |
| **READ — supported-with-qualification** | 8 |
| **READ — unsupported** | 3 |
| **READ — contradicted** | 1 |
| machine — UNRESOLVED (NOT read, NOT verified) | 617 |
| machine — auto-supported (NOT read, NOT verified) | 487 |
| machine — CHECK-NEGATION (NOT read, NOT verified) | 1 |

Still unread on this arm:

- `generated/6/F1/r1/c15` (CHECK-NEGATION) — No specific role or office-generation switch is required; normal sign-in and vessel access still apply.

## Arm F0 — 1212 occurrences in the review population

**Risk categories (CHECK-\*): 112 occurrences, 109 READ, 3 still unread.**
**Total READ on this arm: 127.**

| status | occurrences |
|---|---|
| **READ — supported** | 103 |
| **READ — supported-with-qualification** | 13 |
| **READ — unsupported** | 6 |
| **READ — unresolved** | 5 |
| machine — UNRESOLVED (NOT read, NOT verified) | 586 |
| machine — auto-supported (NOT read, NOT verified) | 496 |
| machine — CHECK-COMPARISON (NOT read, NOT verified) | 2 |
| machine — CHECK-PERMISSION (NOT read, NOT verified) | 1 |

Still unread on this arm:

- `generated/6/F0/r2/c17` (CHECK-PERMISSION) — The role and switch details are from draft, code-derived guidance verified against application revision cf5241
- `manuals/hist-3/F0/r3/c13` (CHECK-COMPARISON) — A separate supported process is importing a JSON file: inspection and observation details—including Positive a
- `manuals/pmsvessel-1/F0/r3/c06` (CHECK-COMPARISON) — These categories are available in the Store sub-module for both Office and Vessel users.

## READ verdicts, grouped by finding


### CONTRADICTED — 1 occurrence(s)
- **claim (representative):** The draft code-derived guidance says the Office switch and Sail Admin restriction apply only to the relevant planned-generation actions, not to per-job Generate WO or unplanned work orders.
- **ids:** `wo/wo-phr-05/F1/r3/c26`
- **evidence:** The same answer requires the switch for per-job Generate WO ('In the Office, the vessel's office work-order generation switch must be ON') and then excludes the switch from that route. KB pilot: 'Generate WO' for one job states the switch applies on the OFFICE instance.
- **note:** the genuine answer defect; stays a failure (work-order judge .13)

### UNSUPPORTED — 4 occurrence(s)
- **claim (representative):** Only the Office / Sail Admin is allowed to add comments in the Review section.
- **ids:** `manuals/hist-1/F1/r1/c01`, `manuals/hist-1/F1/r2/c01`, `manuals/hist-1/F1/r3/c01`, `manuals/hist-1/F0/r2/c01`
- **evidence:** The expected source (Audit - History Manual_R1 p.16, 'The Review section is intended for office users only') was NEVER SUPPLIED — the routing defect sent the question to Technical. The three supplied documents are the PMS Office manual, the Ship-Side notes and the Sync notes; the permission is derived from the PMS WORK-ORDER review section and from an audience label ('Audience: Office / Sail Admin').
- **note:** correct by coincidence; all three runs already fail the suite on the citation check

### UNSUPPORTED — 2 occurrence(s)
- **claim (representative):** The same recording steps are also documented for a Lesson Learnt.
- **ids:** `manuals/fn-2/F0/r1/c08`, `manuals/fn-2/F0/r3/c08`
- **evidence:** 'Lesson Learnt' does not appear anywhere in the supplied excerpts for this question. The supplied text covers the Fleet Notification discussion record only.
- **note:** NEW FINDING on F0: a second form asserted to share the procedure, with no supplied passage about it.

### UNSUPPORTED — 2 occurrence(s)
- **claim (representative):** If mandatory fields are blank, the record cannot be saved.
- **ids:** `manuals/certsurveys-2/F0/r1/c08`, `manuals/certsurveys-2/F0/r2/c06`
- **evidence:** The supplied text carries a 'Mandatory field' marker and the save-icon callout, but NO statement that the record cannot be saved while a mandatory field is blank. Searched the full supplied text for 'cannot be saved', 'not be saved', 'required fields' — none present.
- **note:** NEW FINDING on F0: a field marker turned into a save rule. Same shape as the hist-1 audience-label error.

### UNSUPPORTED — 1 occurrence(s)
- **claim (representative):** The Office user reviews the record, enters comments in Reviewer Comments if required, and clicks Reviewed or Reopen.
- **ids:** `manuals/hist-1/F0/r3/c02`
- **evidence:** Same root cause as the other hist-1 claims: the Audit History manual was never supplied; the steps come from the PMS work-order review section.
- **note:** F0 carries the same defect — routing is unaffected by the document change

### UNRESOLVED — 4 occurrence(s)
- **claim (representative):** This restriction is stated for both vessel and office users.
- **ids:** `manuals/pmsoffice-4/F1/r1/c05`, `manuals/pmsoffice-4/F1/r2/c05`, `manuals/pmsoffice-4/F1/r3/c05`, `manuals/pmsoffice-4/F0/r3/c05`
- **evidence:** The locked-WO restriction is quoted from OFFICE §1.1.5.7 (p.34). The Vessel §1.1.5.7 (p.30) passage is supplied but the engine's best sentence from it does not carry the restriction.
- **note:** cannot be settled from the top passages; the claim may be true but is not established here

### UNRESOLVED — 2 occurrence(s)
- **claim (representative):** Both use the new-document change-request process:
- **ids:** `answers/3/F1/r1/c04`, `answers/3/F1/r3/c02`
- **evidence:** A list lead-in introducing the two paths; the substance is in the items beneath it.
- **note:** retained for visibility

### UNRESOLVED — 1 occurrence(s)
- **claim (representative):** Office / Sail Admin
- **ids:** `answers/7/F1/r3/c02`
- **evidence:** A two-word heading label carried over from the manual's own heading; it asserts nothing on its own.
- **note:** kept visible rather than dropped, per the reviewer's instruction not to exclude short strings

### UNRESOLVED — 1 occurrence(s)
- **claim (representative):** In the Office Certificates screen, you can:
- **ids:** `fresh/fresh-technical-1/F1/r1/c01`
- **evidence:** A list lead-in; the content is in the items beneath it, scored separately.
- **note:** retained rather than dropped, per the instruction not to exclude by length or trailing colon

### UNRESOLVED — 1 occurrence(s)
- **claim (representative):** <NNN> is the running sequence, which continues across both old and new numbering formats.
- **ids:** `generated/4/F1/r1/c07`
- **evidence:** The numbering formats are supplied (Recent Updates 1.1.14.1, Ship-Side preamble) but neither states that the sequence CONTINUES across the old and new formats.
- **note:** an inference the supplied text does not carry

### UNRESOLVED — 1 occurrence(s)
- **claim (representative):** This procedure is also documented for both Ship and Office.
- **ids:** `manuals/pmsoffice-2/F1/r2/c15`
- **evidence:** The two supplied passages for the inventory-transaction procedure are BOTH from the Vessel manual (1.1.7.2 p.38, 1.1.8.5 p.44). No Office passage for that procedure was supplied.
- **note:** distinct from the 'update spares by location' claims, which ARE supplied from both environments

### UNRESOLVED — 1 occurrence(s)
- **claim (representative):** Existing older work orders retain their original numbers, and the sequence continues across both formats.
- **ids:** `generated/4/F0/r2/c06`
- **evidence:** The two numbering formats are supplied but neither states that the sequence CONTINUES across them.
- **note:** same inference as the F1 occurrence

### UNRESOLVED — 1 occurrence(s)
- **claim (representative):** This applies in both Office and Ship documentation.
- **ids:** `manuals/pmsoffice-2/F0/r2/c10`
- **evidence:** Same as the F1 occurrence: no Office passage for the inventory-transaction procedure was supplied.

### UNRESOLVED — 1 occurrence(s)
- **claim (representative):** This restriction applies in both the vessel-specific and Office approval flows.
- **ids:** `manuals/pmsoffice-4/F0/r1/c05`
- **evidence:** Same as the F1 occurrence: the restriction is quoted from the Office manual; the Vessel passage is supplied but does not carry it.

### UNRESOLVED — 1 occurrence(s)
- **claim (representative):** On the PMS Dashboard (Office), you can filter by:
- **ids:** `manuals/pmsoffice-5/F0/r3/c01`
- **evidence:** A list lead-in; the filter names are in the items beneath it.
- **note:** retained for visibility

### SUPPORTED-WITH-QUALIFICATION — 7 occurrence(s)
- **claim (representative):** An office user can delete a Fleet Sharing record only while it is in Draft status.
- **ids:** `manuals/fs-off-1/F1/r1/c01`, `manuals/fs-off-1/F1/r2/c01`, `manuals/fs-off-1/F1/r2/c03`, `manuals/fs-off-1/F1/r3/c01`, `manuals/fs-off-1/F0/r1/c01`, `manuals/fs-off-1/F0/r2/c01`, `manuals/fs-off-1/F0/r3/c01`
- **evidence:** Audit - Fleet Sharing Manual-OFFICE_R1 (p.5): 'Records can only be deleted while they are in Draft status' and (p.8) 'Users can edit the Fleet Sharing record until it has been submitted.'
- **note:** the rule is stated; the actor 'office user' is inferred from which manual it is, not stated in the sentence

### SUPPORTED-WITH-QUALIFICATION — 4 occurrence(s)
- **claim (representative):** For an authorized Office user:
- **ids:** `manuals/certsurveys-1/F1/r1/c01`, `manuals/certsurveys-1/F1/r3/c02`, `manuals/certsurveys-1/F0/r1/c01`, `manuals/certsurveys-1/F0/r2/c09`
- **evidence:** Technical - Cert. & Surveys For Office §1.2.1 (p.13) 'enables authorized users to…' and §1.2.1.1 'Click on the Admin sub-module'.
- **note:** same qualification: the actor comes from the manual's audience, not the sentence

### SUPPORTED-WITH-QUALIFICATION — 4 occurrence(s)
- **claim (representative):** The dashboard and vessel-side filters are different.
- **ids:** `manuals/pmsoffice-5/F0/r1/c02`, `manuals/pmsoffice-5/F0/r1/c12`, `manuals/pmsoffice-5/F0/r2/c02`, `manuals/pmsoffice-5/F0/r3/c06`
- **evidence:** Both filter sets are supplied and differ as stated.
- **note:** the comparison crosses BOTH screen and environment, so it cannot attribute the difference to either

### SUPPORTED-WITH-QUALIFICATION — 2 occurrence(s)
- **claim (representative):** The separate “+ New Entry” button creates a training need record, not a Training Matrix record.
- **ids:** `manuals/crewing-6/F1/r3/c03`, `manuals/crewing-6/F0/r1/c04`
- **evidence:** Crewing Manual (p.88-89): the '+ New Entry' button and 'Click Save to create the training need record'.
- **note:** the contrast 'not a Training Matrix record' is the answer's inference, not stated

### SUPPORTED-WITH-QUALIFICATION — 2 occurrence(s)
- **claim (representative):** A separate Training Needs process uses “+ New Entry”, followed by “Save”, but that creates a training need rather than a Training Matrix record.
- **ids:** `manuals/crewing-6/F0/r2/c04`, `manuals/crewing-6/F0/r3/c04`
- **evidence:** Crewing (p.88-89) documents '+ New Entry' and 'Save to create the training need record'.
- **note:** the contrast with the Training Matrix is the answer's inference

### SUPPORTED-WITH-QUALIFICATION — 1 occurrence(s)
- **claim (representative):** For an Office user, add an action item as follows:
- **ids:** `manuals/fs-off-2/F1/r1/c01`
- **evidence:** FS Office 3.2 (p.6): 'This section allows users to create and manage actions'; FS Vessel Step 3 (p.6) also supplied.
- **note:** actor inferred from which manual it is, not stated in the sentence

### SUPPORTED-WITH-QUALIFICATION — 1 occurrence(s)
- **claim (representative):** For the Stores sub-module, the filtering steps differ slightly between Office and Ship:
- **ids:** `answers/7/F0/r3/c01`
- **evidence:** PMS Office 1.1.8.2 (p.49) and PMS Vessel 1.1.8.2 (p.43) both supplied.
- **note:** 'differ slightly' is a judgement about degree that the passages do not state

### SUPPORTED — 12 occurrence(s)
- **claim (representative):** These are the same steps as Spares › How To Apply Filter, section 1.1.7.7, page 47.
- **ids:** `answers/7/F1/r1/c06`, `answers/7/F1/r1/c11`, `answers/7/F1/r2/c07`, `answers/7/F1/r2/c13`, `answers/7/F1/r3/c06`, `answers/7/F1/r3/c11`, `answers/7/F0/r1/c08`, `answers/7/F0/r1/c14` … +4 more
- **evidence:** Technical - PMS User Manual For Office_Sail  — 1.1.8.2 HOW TO APPLY FILTER (p.49) (p.49); Technical - PMS User Manual_Vessel Specific_ — 1.1.8.2 HOW TO APPLY FILTER (p.43) (p.43)
- **note:** restates the manual's own cross-reference; the target section is supplied in the same request

### SUPPORTED — 10 occurrence(s)
- **claim (representative):** The three-way list, including automatic generation and the Office switch/role conditions, comes from draft code-derived guidance based partly on application code revision cf5241ad6.
- **ids:** `fresh/fresh-wo-broad-1/F1/r1/c24`, `wo/wo-generic-03/F1/r1/c30`, `wo/wo-generic-03/F1/r2/c27`, `wo/wo-generic-03/F1/r3/c27`, `wo/wo-phr-03/F1/r1/c19`, `wo/wo-phr-03/F1/r2/c20`, `wo/wo-phr-05/F1/r2/c24`, `wo/wo-generic-03/F0/r2/c24` … +2 more
- **evidence:** Provenance note present verbatim in the supplied KB text.

### SUPPORTED — 10 occurrence(s)
- **claim (representative):** It is not a completely separate procedure for each section, but the available filter options vary.
- **ids:** `manuals/ra-office-3/F1/r1/c02`, `manuals/ra-office-3/F1/r1/c12`, `manuals/ra-office-3/F1/r2/c01`, `manuals/ra-office-3/F1/r2/c13`, `manuals/ra-office-3/F1/r3/c01`, `manuals/ra-office-3/F1/r3/c02`, `manuals/ra-office-3/F1/r3/c11`, `manuals/ra-office-3/F0/r1/c01` … +2 more
- **evidence:** RA Office 4 (p.7), verbatim: 'The filtering functionality is same across the Generic RA Library, Office RA, and Vessels RA sections. The available filter options vary depending on the selected section.'

### SUPPORTED — 8 occurrence(s)
- **claim (representative):** If the approver needs a different Approval Level, edit the existing approver record instead of creating a new one.
- **ids:** `manuals/ra-office-1/F1/r1/c03`, `manuals/ra-office-1/F1/r2/c03`, `manuals/ra-office-1/F1/r3/c03`, `manuals/ra-office-1/F1/r3/c04`, `manuals/ra-office-1/F1/r3/c06`, `manuals/ra-office-1/F0/r1/c03`, `manuals/ra-office-1/F0/r2/c03`, `manuals/ra-office-1/F0/r3/c03`
- **evidence:** RA Office 8 Key Personnel (p.25) and Approval Level Configuration (p.24), both supplied.

### SUPPORTED — 7 occurrence(s)
- **claim (representative):** To create a COC defect record, follow the same steps as “How To Create A New Defect” under Defects Logs, section 1.1.4.3, page 15:
- **ids:** `answers/9/F1/r1/c01`, `answers/9/F1/r2/c01`, `answers/9/F1/r3/c01`, `answers/9/F0/r1/c01`, `answers/9/F0/r1/c06`, `answers/9/F0/r2/c06`, `answers/9/F0/r3/c01`
- **evidence:** Technical - Defects User Manual For Office_S — 1.1.5.2 HOW TO CREATE A NEW COC DEFE (p.19); Technical - Defects User Manual For Office_S — 1.1.5.4 HOW TO VIEW AND EDIT COC DEF (p.19)
- **note:** restates the manual's own cross-reference; the target section is supplied in the same request

### SUPPORTED — 7 occurrence(s)
- **claim (representative):** For Rejected and Recruited candidates, the steps are the same as In Progress, section 1.2.1.2, page 13.
- **ids:** `fresh/fresh-crewing-1/F1/r1/c09`, `fresh/fresh-crewing-1/F1/r2/c07`, `fresh/fresh-crewing-1/F1/r3/c10`, `fresh/fresh-crewing-1/F0/r1/c10`, `fresh/fresh-crewing-1/F0/r2/c06`, `fresh/fresh-crewing-1/F0/r3/c01`, `fresh/fresh-crewing-1/F0/r3/c06`
- **evidence:** Crewing - Crewing User Manual R2_10.06.2026 — 1.2.4.4 HOW TO APPLY FILTER (p.23) (p.23); Crewing - Crewing User Manual R2_10.06.2026 — 1.2.2.4 HOW TO APPLY FILTER (p.21) (p.21)
- **note:** restates the manual's own cross-reference; the target section is supplied in the same request

### SUPPORTED — 7 occurrence(s)
- **claim (representative):** As a vessel user, you can only view Generic Risk Assessments in the Generic RA Library; you cannot edit them there.
- **ids:** `manuals/ra-vessel-1/F1/r1/c01`, `manuals/ra-vessel-1/F1/r1/c04`, `manuals/ra-vessel-1/F1/r2/c01`, `manuals/ra-vessel-1/F1/r3/c01`, `manuals/ra-vessel-1/F0/r1/c01`, `manuals/ra-vessel-1/F0/r2/c01`, `manuals/ra-vessel-1/F0/r2/c04`
- **evidence:** Safety - RA User Manual_Vessel_R1 §4 (p.7), supplied in all three runs: 'The GRA Library is available to vessel users for viewing purposes only.' The Edit/Delete GRA rows the engine matched are from the OFFICE manual §5 (p.8) — a different environment, and the answer did not use them.
- **note:** environment check passes: the answer scoped the rule to the vessel manual and cited it

### SUPPORTED — 6 occurrence(s)
- **claim (representative):** These steps are the same as In Progress, section 1.2.1.5, page 19.
- **ids:** `answers/8/F1/r1/c05`, `answers/8/F1/r2/c01`, `answers/8/F1/r3/c05`, `answers/8/F0/r1/c02`, `answers/8/F0/r2/c05`, `answers/8/F0/r3/c01`
- **evidence:** Crewing - Crewing User Manual R2_10.06.2026 — 1.2.3.3 HOW TO EXPORT CREW DETAILS ( (p.22); Crewing - Crewing User Manual R2_10.06.2026 — 1.2.4.3 HOW TO EXPORT CREW DETAILS ( (p.23)
- **note:** restates the manual's own cross-reference; the target section is supplied in the same request

### SUPPORTED — 6 occurrence(s)
- **claim (representative):** Duplicate checking applies only when a Job Code is supplied together with a Component Code for the selected vessel.
- **ids:** `generated/1/F1/r1/c04`, `generated/1/F1/r2/c04`, `generated/1/F1/r3/c04`, `generated/1/F0/r1/c04`, `generated/1/F0/r2/c04`, `generated/1/F0/r3/c04`
- **evidence:** Bulk Data Import: 'Duplicate checking applies only to rows that supply a Job Code together with a Component Code for the selected vessel.'

### SUPPORTED — 6 occurrence(s)
- **claim (representative):** Alternatively, the Sail Admin can contact Support to re-provision or update the ship.
- **ids:** `generated/12/F1/r1/c06`, `generated/12/F1/r2/c04`, `generated/12/F1/r3/c04`, `generated/12/F0/r1/c03`, `generated/12/F0/r2/c09`, `generated/12/F0/r3/c06`
- **evidence:** Sync (Operational) 1.2.10: 'a Sail Admin re-provisions the ship from Admin to Ship Provisioning, or contacts support.'

### SUPPORTED — 6 occurrence(s)
- **claim (representative):** Multiple attachments may be added to one question.
- **ids:** `manuals/prep-3/F1/r1/c12`, `manuals/prep-3/F1/r2/c04`, `manuals/prep-3/F1/r3/c03`, `manuals/prep-3/F0/r1/c03`, `manuals/prep-3/F0/r2/c06`, `manuals/prep-3/F0/r3/c03`
- **evidence:** Audit Preparation 4.3.4 (p.19): 'Multiple attachments can be uploaded for a selected question.'

### SUPPORTED — 6 occurrence(s)
- **claim (representative):** The combined size of files selected in one upload must not exceed 20 MB, and attachments added between consecutive saves or synchronizations should not exceed 150 MB.
- **ids:** `manuals/prep-3/F1/r1/c13`, `manuals/prep-3/F1/r2/c06`, `manuals/prep-3/F1/r3/c04`, `manuals/prep-3/F0/r1/c04`, `manuals/prep-3/F0/r2/c07`, `manuals/prep-3/F0/r3/c04`
- **evidence:** Audit - Preparation Manual_Office_R1 §4.3.4 (p.19): 'the combined size of the file(s) selected in a single upload should not exceed 20 MB'. The 150 MB figure in the same claim is the consecutive-save limit, also present.
- **note:** engine artefact: the 20 MB sentence sits outside the top-3 passage window

### SUPPORTED — 6 occurrence(s)
- **claim (representative):** The hyperlinking example shows a link to the specific document reference “Doc 4.2.03.”
- **ids:** `manuals/sms-office-3/F1/r1/c01`, `manuals/sms-office-3/F1/r2/c01`, `manuals/sms-office-3/F1/r3/c01`, `manuals/sms-office-3/F0/r1/c01`, `manuals/sms-office-3/F0/r2/c01`, `manuals/sms-office-3/F0/r3/c01`
- **evidence:** Safety - SMS User Manual_Office_R0 §3.1.6 (p.16): a red-boxed 'Doc 4.2.03' link.
- **note:** engine artefact: the number tokeniser split '4.2.03' into '4.2' and '03'

### SUPPORTED — 6 occurrence(s)
- **claim (representative):** Therefore, the vessel-side Reports filters are not the same set as the Office PMS Dashboard filters.
- **ids:** `manuals/pmsoffice-5/F1/r1/c15`, `manuals/pmsoffice-5/F1/r1/c16`, `manuals/pmsoffice-5/F1/r2/c06`, `manuals/pmsoffice-5/F1/r2/c11`, `manuals/pmsoffice-5/F1/r3/c06`, `manuals/pmsoffice-5/F1/r3/c11`
- **evidence:** Both supplied in all three runs and both concern applying a filter: OFFICE §1.1.3.2 (p.9) Dashboard filter and VESSEL §1.1.9.3 (p.46) Reports filter. Same action, the two environments named in the claim.

### SUPPORTED — 5 occurrence(s)
- **claim (representative):** The manual states that a new component can also be added by clicking the “+ Add Component” button.
- **ids:** `answers/11/F1/r1/c02`, `answers/11/F1/r2/c02`, `answers/11/F0/r1/c02`, `answers/11/F0/r2/c02`, `answers/11/F0/r3/c02`
- **evidence:** PMS Office 1.1.4.3 (p.24) note inside Figure 35: a new component can also be added with '+ Add Component'.

### SUPPORTED — 5 occurrence(s)
- **claim (representative):** The manual explicitly says to follow the same attachment-and-save procedure for Positive Observations and LAE finding details.
- **ids:** `manuals/hist-3/F1/r3/c02`, `manuals/hist-3/F0/r1/c09`, `manuals/hist-3/F0/r1/c10`, `manuals/hist-3/F0/r2/c02`, `manuals/hist-3/F0/r3/c12`
- **evidence:** Audit History 2.1.4 (p.10) and the Document block (p.13), both supplied; the manual states 'Follow the above procedure for adding Positive Observations and LAE finding details.'

### SUPPORTED — 5 occurrence(s)
- **claim (representative):** The Crew Pool form uses the same steps as the “How to Create a New Crew Record” section (p.
- **ids:** `manuals/crewing-5/F1/r1/c02`, `manuals/crewing-5/F1/r3/c02`, `manuals/crewing-5/F0/r2/c02`, `manuals/crewing-5/F0/r2/c13`, `manuals/crewing-5/F0/r3/c02`
- **evidence:** Crewing - Crewing User Manual R2_10.06.2026 — 1.3.1.5 HOW TO ADD RECORDS TO CREW P (p.29); Crewing - Crewing User Manual R2_10.06.2026 — 1.2.1.3 HOW TO CREATE A NEW CREW REC (p.14)
- **note:** restates the manual's own cross-reference; the target section is supplied in the same request

### SUPPORTED — 5 occurrence(s)
- **claim (representative):** Yes, it differs:
- **ids:** `manuals/moc-office-1/F1/r1/c01`, `manuals/moc-office-1/F1/r2/c01`, `manuals/moc-office-1/F1/r3/c01`, `manuals/moc-office-1/F0/r1/c03`, `manuals/moc-office-1/F0/r3/c01`
- **evidence:** MOC Office 3 (p.7) and MOC Vessel 2 (p.5) action tables both supplied; they list different actions.

### SUPPORTED — 5 occurrence(s)
- **claim (representative):** This applies to both Ship and Office procedures.
- **ids:** `manuals/pmsoffice-2/F1/r1/c06`, `manuals/pmsoffice-2/F1/r2/c08`, `manuals/pmsoffice-2/F1/r3/c09`, `manuals/pmsoffice-2/F0/r1/c04`, `manuals/pmsoffice-2/F0/r1/c07`
- **evidence:** 'How to update spares by location' is supplied from BOTH environments — VESSEL §1.1.7.3 (p.39) and OFFICE §1.1.7.4 (p.45) — which is the procedure the claim is about.
- **note:** note: the inventory-transaction sections were supplied from the Vessel manual only, so a claim resting on THOSE applying to Office would be unresolved; these claims do not rest on them

### SUPPORTED — 5 occurrence(s)
- **claim (representative):** They therefore do not document a separate, complete Stores procedure.
- **ids:** `manuals/pmsvessel-3/F0/r1/c08`, `manuals/pmsvessel-3/F0/r2/c08`, `manuals/pmsvessel-3/F0/r3/c03`, `manuals/pmsvessel-3/F0/r3/c06`, `manuals/pmsvessel-3/F0/r3/c14`
- **evidence:** PMS Vessel 1.1.8.3 (p.43) and PMS Office 1.1.8.3 (p.50) both supplied; the Store section cross-references Spares and the downstream Spares steps are not reproduced.

### SUPPORTED — 4 occurrence(s)
- **claim (representative):** The second way is to use the Date / Time / Description fields:
- **ids:** `manuals/inc-3/F1/r1/c01`, `manuals/inc-3/F1/r2/c01`, `manuals/inc-3/F1/r3/c01`, `manuals/inc-3/F0/r3/c01`
- **evidence:** Incident manual Part D, verbatim: 'METHOD 2: Use the Date / Time / Description section to enter details of sequence of events.'

### SUPPORTED — 4 occurrence(s)
- **claim (representative):** Parts B and C: The Add SM form does not provide separate instructions here.
- **ids:** `manuals/safety-meeting-1/F1/r1/c02`, `manuals/safety-meeting-1/F1/r2/c02`, `manuals/safety-meeting-1/F1/r3/c06`, `manuals/safety-meeting-1/F0/r1/c02`
- **evidence:** Safety Meeting Manual 2.2 (p.18): 'Follow the instructions provided in the Monthly Safety Meeting form to complete Part B and Part C of the Additional Safety Meeting form.'

### SUPPORTED — 4 occurrence(s)
- **claim (representative):** Follow the instructions in the Monthly Safety Meeting form.
- **ids:** `manuals/safety-meeting-1/F1/r2/c03`, `manuals/safety-meeting-1/F0/r1/c03`, `manuals/safety-meeting-1/F0/r2/c05`, `manuals/safety-meeting-1/F0/r3/c05`
- **evidence:** Safety Meeting 2.2 (p.18), verbatim instruction to follow the Monthly Safety Meeting form for Parts B and C.

### SUPPORTED — 4 occurrence(s)
- **claim (representative):** These steps are the same as “How To Export All Defect Report,” section 1.1.4.5, page 17.
- **ids:** `manuals/defects-3/F1/r2/c06`, `manuals/defects-3/F1/r3/c05`, `manuals/defects-3/F0/r2/c05`, `manuals/defects-3/F0/r3/c06`
- **evidence:** Technical - Defects User Manual For Office_S — 1.1.5.5 HOW TO EXPORT ALL COC RECORD (p.20)
- **note:** restates the manual's own cross-reference; the target section is supplied in the same request

### SUPPORTED — 4 occurrence(s)
- **claim (representative):** Normal sign-in and vessel access also apply, and a job with an active work order cannot receive another one.
- **ids:** `wo/wo-generic-02/F1/r1/c08`, `wo/wo-generic-02/F1/r2/c08`, `wo/wo-generic-02/F1/r2/c10`, `wo/wo-generic-02/F1/r3/c10`
- **evidence:** KB pilot: How work orders are created — the three ways, plus PMS Office 1.1.5.2 (p.29).

### SUPPORTED — 3 occurrence(s)
- **claim (representative):** This applies to both the Office and Vessel/Ship manuals.
- **ids:** `answers/10/F1/r1/c05`, `answers/10/F1/r2/c04`, `answers/10/F0/r3/c05`
- **evidence:** MOC Office 6 (p.11) and MOC Vessel 5 (p.7) both supplied — same section, both environments.

### SUPPORTED — 3 occurrence(s)
- **claim (representative):** For the Office instance, the draft code-derived guidance says the vessel’s office work-order generation switch must be enabled; for Ship, no switch is required.
- **ids:** `fresh/fresh-wo-named-1/F1/r2/c14`, `fresh/fresh-wo-named-1/F1/r3/c13`, `fresh/fresh-wo-named-1/F0/r2/c08`
- **evidence:** KB pilot: 'Generate WO' for one job — 'On the SHIP instance: no switch and no role check'.

### SUPPORTED — 3 occurrence(s)
- **claim (representative):** The excerpts do not support that a Head of Department can do everything an office user can do.
- **ids:** `generated/7/F1/r1/c02`, `generated/7/F1/r2/c02`, `generated/7/F1/r3/c02`
- **evidence:** Roles & Permissions §1.1.12.6: 'Head of Dept does not approve postponement requests when no approval steps are configured — that is reserved for office roles.'

### SUPPORTED — 3 occurrence(s)
- **claim (representative):** Auto-sync, when enabled on the ship, is the other supported way to continue synchronization.
- **ids:** `generated/11/F1/r3/c05`, `generated/11/F0/r1/c07`, `generated/11/F0/r3/c05`
- **evidence:** Sync manual: 'Auto-sync runs on the ship when enabled in the ship's Auto-Sync Settings.'

### SUPPORTED — 3 occurrence(s)
- **claim (representative):** Ship users cannot modify it.
- **ids:** `manuals/fs-ves-1/F1/r1/c03`, `manuals/fs-ves-1/F1/r3/c03`, `manuals/fs-ves-1/F0/r3/c03`
- **evidence:** Audit - Fleet Sharing Manual-Vessel_R1 (p.5): 'Vessel users cannot modify this information.' 'Ship' and 'vessel' are the same side in this product.

### SUPPORTED — 3 occurrence(s)
- **claim (representative):** For a Positive Observation or LAE finding, use the same Upload, Save, and Inspection steps for the corresponding finding details.
- **ids:** `manuals/hist-3/F1/r3/c11`, `manuals/hist-3/F1/r3/c12`, `manuals/hist-3/F1/r3/c13`
- **evidence:** Audit History Manual 2.1.4 (p.10) and the Document block (p.13) both supplied — this case routes to audit correctly, unlike hist-1.

### SUPPORTED — 3 occurrence(s)
- **claim (representative):** However, the provided survey excerpt does not reproduce the actual survey steps, so it is not possible to confirm from this documentation whether the process is different from certificates.
- **ids:** `manuals/certsurveys-3/F1/r1/c02`, `manuals/certsurveys-3/F1/r2/c11`, `manuals/certsurveys-3/F1/r3/c02`
- **evidence:** Supplied text carries the pointer 'Refer to the Certificates sub-sub-module ... and follow the same steps' but not the Certificates steps themselves — the limitation is accurate.

### SUPPORTED — 3 occurrence(s)
- **claim (representative):** No user action is required.
- **ids:** `wo/wo-generic-02/F1/r1/c04`, `wo/wo-generic-02/F1/r2/c03`, `wo/wo-generic-02/F1/r3/c03`
- **evidence:** KB pilot: Planned work orders — 'Nothing to do. The ship system runs the job-due scan once every 24 hours'.
- **note:** the engine matched an unrelated pre-planning passage

### SUPPORTED — 3 occurrence(s)
- **claim (representative):** Both.
- **ids:** `wo/wo-phr-03/F1/r2/c01`, `wo/wo-phr-03/F1/r3/c01`, `wo/wo-phr-03/F0/r1/c01`
- **evidence:** Both KB files supplied: 'How work orders are created' and 'Planned work orders — ship daily scan'.

### SUPPORTED — 3 occurrence(s)
- **claim (representative):** The documentation does not say that a Head of Department can do everything an Office user can do.
- **ids:** `generated/7/F0/r2/c02`, `generated/7/F0/r3/c02`, `generated/7/F0/r3/c07`
- **evidence:** Roles & Permissions 1.1.12.6: 'Head of Dept does not approve postponement requests when no approval steps are configured — that is reserved for office roles.'

### SUPPORTED — 3 occurrence(s)
- **claim (representative):** The excerpts do not state that the process is different from certificates.
- **ids:** `manuals/certsurveys-3/F0/r1/c08`, `manuals/certsurveys-3/F0/r2/c02`, `manuals/certsurveys-3/F0/r3/c02`
- **evidence:** Accurate limitation: the Surveys section carries only the pointer to Certificates.

### SUPPORTED — 2 occurrence(s)
- **claim (representative):** These categories are shown as tabs in the hazard-selection window for both Office and Vessel risk assessments.
- **ids:** `answers/5/F1/r3/c08`, `answers/5/F0/r1/c08`
- **evidence:** RA Office (p.13) and RA Vessel 8 (p.12) both supplied.

### SUPPORTED — 2 occurrence(s)
- **claim (representative):** The draft code-derived guidance says this path has no Sail Admin role requirement; the published manuals present the action without these conditions.
- **ids:** `fresh/fresh-wo-named-1/F1/r1/c15`, `fresh/fresh-wo-named-1/F1/r2/c15`
- **evidence:** KB 'Generate WO' for one job: 'Who can do it (role): No role check on this path.'

### SUPPORTED — 2 occurrence(s)
- **claim (representative):** No specific role is required, but normal sign-in and vessel access apply.
- **ids:** `generated/6/F1/r1/c10`, `generated/6/F1/r2/c07`
- **evidence:** KB pilot: How work orders are created — 'No role check on this path (sign-in and vessel access still apply)'.

### SUPPORTED — 2 occurrence(s)
- **claim (representative):** The manual explicitly says to follow the same procedure for adding Positive Observations and LAE finding details.
- **ids:** `manuals/hist-3/F1/r1/c02`, `manuals/hist-3/F0/r1/c02`
- **evidence:** Audit - History Manual_R1_30.06.2026 — 2.1.4 ADDING ATTACHMENTS (p.10) (p.10); Audit - History Manual_R1_30.06.2026 — Preamble (p.9) (p.9)
- **note:** restates the manual's own cross-reference; the target section is supplied in the same request

### SUPPORTED — 2 occurrence(s)
- **claim (representative):** Office: It opens the selected MoC record so you can view, edit, or export it.
- **ids:** `manuals/moc-office-1/F1/r3/c02`, `manuals/moc-office-1/F0/r3/c02`
- **evidence:** Safety - MOC User Manual_Office §3 (p.7) action table: 'View, edit, or export the selected MoC record.'

### SUPPORTED — 2 occurrence(s)
- **claim (representative):** The same process can be used for the selected category—Stores, Lubes, Chemicals, or Others—and for the selected tab—Inventory, Location, or History.
- **ids:** `manuals/pmsvessel-3/F1/r1/c09`, `manuals/pmsvessel-3/F1/r2/c05`
- **evidence:** Technical - PMS User Manual_Vessel Specific_ — 1.1.8.3 HOW TO UPDATE STOCK TRANSACT (p.43); Technical - PMS User Manual For Office_Sail  — 1.1.8.3 HOW TO UPDATE STOCK TRANSACT (p.50)
- **note:** restates the manual's own cross-reference; the target section is supplied in the same request

### SUPPORTED — 2 occurrence(s)
- **claim (representative):** The manuals describe this process for both Vessel and Office use; the Office manual provides the detailed transaction-entry and save steps.
- **ids:** `manuals/pmsvessel-3/F1/r1/c14`, `manuals/pmsvessel-3/F1/r2/c14`
- **evidence:** PMS Vessel 1.1.8.3 (p.43) and PMS Office 1.1.8.3 (p.50) — the same section from both environments.

### SUPPORTED — 2 occurrence(s)
- **claim (representative):** The provided documentation does not fully establish a separate, complete Store procedure beyond its reference to Spares.
- **ids:** `manuals/pmsvessel-3/F1/r2/c15`, `manuals/pmsvessel-3/F1/r3/c13`
- **evidence:** Accurate limitation: the Store section cross-references Spares and the excerpts do not reproduce the downstream Spares steps.

### SUPPORTED — 2 occurrence(s)
- **claim (representative):** In the office: planned work orders are not generated automatically.
- **ids:** `wo/wo-generic-02/F1/r2/c05`, `wo/wo-generic-02/F0/r1/c04`
- **evidence:** KB pilot: How work orders are created — 'IN THE OFFICE: nothing runs automatically; a Sail Admin can click Generate Now ... only if that vessel's switch is on.'

### SUPPORTED — 2 occurrence(s)
- **claim (representative):** The June manuals describe the action as unconditional, except that they also require no active duplicate work order; this differs from the code-derived guidance.
- **ids:** `fresh/fresh-wo-named-1/F0/r1/c15`, `fresh/fresh-wo-named-1/F0/r3/c16`
- **evidence:** KB 'Generate WO' for one job plus the June Office manual passage, both supplied.

### SUPPORTED — 2 occurrence(s)
- **claim (representative):** The vessel switch is not required.
- **ids:** `generated/6/F0/r2/c15`, `generated/6/F0/r3/c16`
- **evidence:** Read in context: both sentences sit under the unplanned-work-order heading in their answers, and the same answers state the switch requirement correctly under the per-job heading.

### SUPPORTED — 2 occurrence(s)
- **claim (representative):** Do not create a new approver record for the same Position/Rank.
- **ids:** `manuals/ra-office-1/F0/r1/c06`, `manuals/ra-office-1/F0/r2/c06`
- **evidence:** RA Office 8 Key Personnel (p.25) and Approval Level Configuration (p.24).

### SUPPORTED — 2 occurrence(s)
- **claim (representative):** This applies in both Office and Ship instances.
- **ids:** `manuals/pmsvessel-4/F0/r1/c03`, `manuals/pmsvessel-4/F0/r3/c03`
- **evidence:** Recent Updates 1.1.14.6.3 and the KB per-job file, both supplied, state the office and ship conditions.

### SUPPORTED — 2 occurrence(s)
- **claim (representative):** It creates a work order when the job is active, attached to a component, has a frequency and next due date, and has no active work order already.
- **ids:** `wo/wo-phr-03/F0/r1/c05`, `wo/wo-phr-03/F0/r2/c04`
- **evidence:** KB pilot: Planned work orders — 'The job must be active and attached to a component, with a frequency and a next due date ... must not already have an active work order.'

### SUPPORTED — 1 occurrence(s)
- **claim (representative):** It does not provide separate steps for that button.
- **ids:** `answers/11/F1/r2/c03`
- **evidence:** PMS Office 1.1.4.3 (p.24) describes adding a component; the note about the '+ Add Component' button gives no separate step list.

### SUPPORTED — 1 occurrence(s)
- **claim (representative):** Recruited — uses the same steps as In Progress, section 1.2.1.2, page 13:
- **ids:** `fresh/fresh-crewing-1/F1/r2/c12`
- **evidence:** Crewing - Crewing User Manual R2_10.06.2026 — 1.2.2.4 HOW TO APPLY FILTER (p.21) (p.21); Crewing - Crewing User Manual R2_10.06.2026 — 1.2.4.4 HOW TO APPLY FILTER (p.23) (p.23)
- **note:** restates the manual's own cross-reference; the target section is supplied in the same request

### SUPPORTED — 1 occurrence(s)
- **claim (representative):** If the switch is OFF, this office generation path cannot be used; the excerpt does not specify a separate error message.
- **ids:** `generated/6/F1/r1/c13`
- **evidence:** The refusal message in the supplied text belongs to the 'Generate Now' KB file; no message is given for the per-job route, which is what the sentence is about.

### SUPPORTED — 1 occurrence(s)
- **claim (representative):** The role and switch behavior above comes from draft, code-derived guidance rather than a published manual.
- **ids:** `generated/6/F1/r1/c19`
- **evidence:** The KB files carry the provenance note verbatim in the supplied text.

### SUPPORTED — 1 occurrence(s)
- **claim (representative):** It does not require the office generation switch.
- **ids:** `generated/6/F1/r3/c16`
- **evidence:** Read in context: the sentence sits under heading '3. Unplanned work order', and the same answer states correctly under '2. Per-job Generate WO' that 'In the office, the vessel's switch must be ON'.
- **note:** counter-example to the wo-phr-05 conflation: the same distinction stated correctly in another run

### SUPPORTED — 1 occurrence(s)
- **claim (representative):** The same non-decrease rule also applies to direct ship/office entries and synchronization; synchronization reconciles readings by date, with the latest date winning and a same-date tie going to the ship.
- **ids:** `generated/13/F1/r2/c06`
- **evidence:** Ship-Side notes 1.1.13.2, verbatim: 'reconciled by reading date — the latest date wins; a same-date tie goes to the ship.'

### SUPPORTED — 1 occurrence(s)
- **claim (representative):** Section 4.2.2 is not included in the provided excerpts, and the manual does not state that its approval steps are the same as Section 4.1.2.
- **ids:** `manuals/sms-office-1/F1/r3/c01`
- **evidence:** Checked the full supplied text: no '4.2.2', no 'same as 4.1.2', no 'refer to 4.1'. The limitation the answer states is accurate.
- **note:** CORRECTION: the earlier auto-verdict called this 'restates the manual's own cross-reference; the target section is supplied' — self-contradictory and wrong. The XREF rule fired on 'same as' inside a negation.

### SUPPORTED — 1 occurrence(s)
- **claim (representative):** This requires no active WO for the job.
- **ids:** `manuals/pmsvessel-4/F1/r3/c03`
- **evidence:** Recent Updates §1.1.14.6.3: 'the job must exist, be active and not already have an active work order'.

### SUPPORTED — 1 occurrence(s)
- **claim (representative):** The June manuals document the unplanned-work-order procedure and state that they cover only the on-demand and unplanned ways; the provided published excerpts show the unplanned procedure but do not provide the separate per-job procedure.
- **ids:** `wo/wo-phr-01/F1/r3/c25`
- **evidence:** KB 'How work orders are created' states the manuals cover only ways 2 and 3; PMS Office 1.1.5.2 (p.29) is the unplanned procedure.

### SUPPORTED — 1 occurrence(s)
- **claim (representative):** The draft guidance says the Sail Admin check was inspected in application code and was not measured against a running installation.
- **ids:** `wo/wo-phr-04/F1/r3/c06`
- **evidence:** KB text: 'Read from the source code; not measured against a running installation.'

### SUPPORTED — 1 occurrence(s)
- **claim (representative):** The published manual describes the same navigation and reason selection, and warns that duplicate active work orders are not allowed; it does not state the office switch condition.
- **ids:** `wo/wo-phr-05/F1/r1/c18`
- **evidence:** PMS Office (p.18) describes the Components Part C route and the reason choice; the KB file supplies the switch condition the manual omits, which is what the sentence says.

### SUPPORTED — 1 occurrence(s)
- **claim (representative):** This applies in both the Office and Vessel/Ship manuals.
- **ids:** `answers/10/F0/r1/c02`
- **evidence:** MOC Office 6 (p.11) and MOC Vessel 5 (p.7) both supplied.

### SUPPORTED — 1 occurrence(s)
- **claim (representative):** Yes, its function differs between the manuals.
- **ids:** `manuals/moc-office-1/F0/r2/c03`
- **evidence:** MOC Office 3 (p.7) and MOC Vessel 2 (p.5) action tables both supplied.

### SUPPORTED — 1 occurrence(s)
- **claim (representative):** So, the process is shared, but each section may present different filtering options.
- **ids:** `manuals/ra-office-3/F0/r2/c12`
- **evidence:** RA Office 4 (p.7): 'The filtering functionality is same across ... The available filter options vary'.

### SUPPORTED — 1 occurrence(s)
- **claim (representative):** As a vessel user, you can only look at Generic Risk Assessments in the Generic RA Library; editing is not available there.
- **ids:** `manuals/ra-vessel-1/F0/r3/c01`
- **evidence:** RA Vessel 4 (p.7): 'The GRA Library is available to vessel users for viewing purposes only.'

### SUPPORTED — 1 occurrence(s)
- **claim (representative):** The supplied vessel manual documents only the first two Spares steps; it does not provide the later transaction-mode, quantity, or save steps.
- **ids:** `manuals/pmsvessel-3/F0/r1/c15`
- **evidence:** Accurate limitation about what the Vessel passage contains.

### SUPPORTED — 1 occurrence(s)
- **claim (representative):** The Office manual includes vessel selection, while the Vessel Specific manual does not include that step.
- **ids:** `wo/wo-generic-01/F0/r3/c25`
- **evidence:** PMS Office 1.1.5.2 (p.29) has 'Select the vessel from the Vessel dropdown'; the Vessel manual 1.1.5.2 (p.24) step list omits it. Both supplied.

### SUPPORTED — 1 occurrence(s)
- **claim (representative):** The draft code-derived guidance is broader than the published June manuals: the manuals describe the on-demand and unplanned procedures, while the draft guidance also describes automatic ship generation and office Generate Now, and adds the office conditions.
- **ids:** `wo/wo-phr-01/F0/r2/c24`
- **evidence:** The KB file states the manuals cover only ways 2 and 3; both supplied.

## Not read — explicitly not verified

Every occurrence without a READ verdict carries only a machine label. The two large groups are
`UNRESOLVED` (the engine could not decide) and `auto-supported` (a rule fired, nobody read it). Neither
is evidence of support. This is open item C4.
