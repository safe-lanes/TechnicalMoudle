# Review ledger — S7 paired run

Every claim in the review population, with a stable id `suite/case/arm/rRUN/cNN`. **READ** verdicts are mine,
from reading the claim against the supplied text. **MACHINE** labels are deterministic rules (verdicts.py);
`auto-supported` has NOT been read and is never reported as verified. Occurrences are listed individually;
grouped findings say how many occurrences they cover.


## Arm F1 — 1255 claim occurrences in the review population

| status | occurrences |
|---|---|
| **READ — supported** | 59 |
| **READ — supported-with-qualification** | 6 |
| **READ — unresolved** | 4 |
| **READ — unsupported** | 3 |
| **READ — contradicted** | 1 |
| machine — UNRESOLVED (not read) | 631 |
| machine — auto-supported (not read) | 495 |
| machine — CHECK-COMPARISON (not read) | 47 |
| machine — CHECK-PERMISSION (not read) | 7 |
| machine — CHECK-NEGATION (not read) | 2 |

## Arm F0 — 1212 claim occurrences in the review population

| status | occurrences |
|---|---|
| **READ — supported** | 37 |
| **READ — supported-with-qualification** | 5 |
| **READ — unsupported** | 1 |
| **READ — unresolved** | 1 |
| machine — UNRESOLVED (not read) | 596 |
| machine — auto-supported (not read) | 499 |
| machine — CHECK-COMPARISON (not read) | 54 |
| machine — CHECK-PERMISSION (not read) | 13 |
| machine — CHECK-NEGATION (not read) | 6 |

## READ verdicts, grouped


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

### SUPPORTED — 12 occurrence(s)
- **claim (representative):** These are the same steps as Spares › How To Apply Filter, section 1.1.7.7, page 47.
- **ids:** `answers/7/F1/r1/c06`, `answers/7/F1/r1/c11`, `answers/7/F1/r2/c07`, `answers/7/F1/r2/c13`, `answers/7/F1/r3/c06`, `answers/7/F1/r3/c11`, `answers/7/F0/r1/c08`, `answers/7/F0/r1/c14` … +4 more
- **evidence:** Technical - PMS User Manual For Office_Sail  — 1.1.8.2 HOW TO APPLY FILTER (p.49) (p.49); Technical - PMS User Manual_Vessel Specific_ — 1.1.8.2 HOW TO APPLY FILTER (p.43) (p.43)
- **note:** restates the manual's own cross-reference; the target section is supplied in the same request

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

### SUPPORTED-WITH-QUALIFICATION — 7 occurrence(s)
- **claim (representative):** An office user can delete a Fleet Sharing record only while it is in Draft status.
- **ids:** `manuals/fs-off-1/F1/r1/c01`, `manuals/fs-off-1/F1/r2/c01`, `manuals/fs-off-1/F1/r2/c03`, `manuals/fs-off-1/F1/r3/c01`, `manuals/fs-off-1/F0/r1/c01`, `manuals/fs-off-1/F0/r2/c01`, `manuals/fs-off-1/F0/r3/c01`
- **evidence:** Audit - Fleet Sharing Manual-OFFICE_R1 (p.5): 'Records can only be deleted while they are in Draft status' and (p.8) 'Users can edit the Fleet Sharing record until it has been submitted.'
- **note:** the rule is stated; the actor 'office user' is inferred from which manual it is, not stated in the sentence

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
- **claim (representative):** The Crew Pool form uses the same steps as the “How to Create a New Crew Record” section (p.
- **ids:** `manuals/crewing-5/F1/r1/c02`, `manuals/crewing-5/F1/r3/c02`, `manuals/crewing-5/F0/r2/c02`, `manuals/crewing-5/F0/r2/c13`, `manuals/crewing-5/F0/r3/c02`
- **evidence:** Crewing - Crewing User Manual R2_10.06.2026 — 1.3.1.5 HOW TO ADD RECORDS TO CREW P (p.29); Crewing - Crewing User Manual R2_10.06.2026 — 1.2.1.3 HOW TO CREATE A NEW CREW REC (p.14)
- **note:** restates the manual's own cross-reference; the target section is supplied in the same request

### SUPPORTED — 5 occurrence(s)
- **claim (representative):** This applies to both Ship and Office procedures.
- **ids:** `manuals/pmsoffice-2/F1/r1/c06`, `manuals/pmsoffice-2/F1/r2/c08`, `manuals/pmsoffice-2/F1/r3/c09`, `manuals/pmsoffice-2/F0/r1/c04`, `manuals/pmsoffice-2/F0/r1/c07`
- **evidence:** 'How to update spares by location' is supplied from BOTH environments — VESSEL §1.1.7.3 (p.39) and OFFICE §1.1.7.4 (p.45) — which is the procedure the claim is about.
- **note:** note: the inventory-transaction sections were supplied from the Vessel manual only, so a claim resting on THOSE applying to Office would be unresolved; these claims do not rest on them

### SUPPORTED-WITH-QUALIFICATION — 4 occurrence(s)
- **claim (representative):** For an authorized Office user:
- **ids:** `manuals/certsurveys-1/F1/r1/c01`, `manuals/certsurveys-1/F1/r3/c02`, `manuals/certsurveys-1/F0/r1/c01`, `manuals/certsurveys-1/F0/r2/c09`
- **evidence:** Technical - Cert. & Surveys For Office §1.2.1 (p.13) 'enables authorized users to…' and §1.2.1.1 'Click on the Admin sub-module'.
- **note:** same qualification: the actor comes from the manual's audience, not the sentence

### SUPPORTED — 4 occurrence(s)
- **claim (representative):** These steps are the same as “How To Export All Defect Report,” section 1.1.4.5, page 17.
- **ids:** `manuals/defects-3/F1/r2/c06`, `manuals/defects-3/F1/r3/c05`, `manuals/defects-3/F0/r2/c05`, `manuals/defects-3/F0/r3/c06`
- **evidence:** Technical - Defects User Manual For Office_S — 1.1.5.5 HOW TO EXPORT ALL COC RECORD (p.20)
- **note:** restates the manual's own cross-reference; the target section is supplied in the same request

### UNRESOLVED — 4 occurrence(s)
- **claim (representative):** This restriction is stated for both vessel and office users.
- **ids:** `manuals/pmsoffice-4/F1/r1/c05`, `manuals/pmsoffice-4/F1/r2/c05`, `manuals/pmsoffice-4/F1/r3/c05`, `manuals/pmsoffice-4/F0/r3/c05`
- **evidence:** The locked-WO restriction is quoted from OFFICE §1.1.5.7 (p.34). The Vessel §1.1.5.7 (p.30) passage is supplied but the engine's best sentence from it does not carry the restriction.
- **note:** cannot be settled from the top passages; the claim may be true but is not established here

### SUPPORTED — 3 occurrence(s)
- **claim (representative):** For the Office instance, the draft code-derived guidance says the vessel’s office work-order generation switch must be enabled; for Ship, no switch is required.
- **ids:** `fresh/fresh-wo-named-1/F1/r2/c14`, `fresh/fresh-wo-named-1/F1/r3/c13`, `fresh/fresh-wo-named-1/F0/r2/c08`
- **evidence:** KB pilot: 'Generate WO' for one job — 'On the SHIP instance: no switch and no role check'.

### SUPPORTED — 3 occurrence(s)
- **claim (representative):** The excerpts do not support that a Head of Department can do everything an office user can do.
- **ids:** `generated/7/F1/r1/c02`, `generated/7/F1/r2/c02`, `generated/7/F1/r3/c02`
- **evidence:** Roles & Permissions §1.1.12.6: 'Head of Dept does not approve postponement requests when no approval steps are configured — that is reserved for office roles.'

### SUPPORTED — 3 occurrence(s)
- **claim (representative):** Ship users cannot modify it.
- **ids:** `manuals/fs-ves-1/F1/r1/c03`, `manuals/fs-ves-1/F1/r3/c03`, `manuals/fs-ves-1/F0/r3/c03`
- **evidence:** Audit - Fleet Sharing Manual-Vessel_R1 (p.5): 'Vessel users cannot modify this information.' 'Ship' and 'vessel' are the same side in this product.

### SUPPORTED — 3 occurrence(s)
- **claim (representative):** The manual explicitly says to follow the same procedure for adding Positive Observations and LAE finding details.
- **ids:** `manuals/hist-3/F1/r1/c02`, `manuals/hist-3/F1/r3/c02`, `manuals/hist-3/F0/r1/c02`
- **evidence:** Audit - History Manual_R1_30.06.2026 — 2.1.4 ADDING ATTACHMENTS (p.10) (p.10); Audit - History Manual_R1_30.06.2026 — Preamble (p.9) (p.9)
- **note:** restates the manual's own cross-reference; the target section is supplied in the same request

### SUPPORTED — 3 occurrence(s)
- **claim (representative):** No user action is required.
- **ids:** `wo/wo-generic-02/F1/r1/c04`, `wo/wo-generic-02/F1/r2/c03`, `wo/wo-generic-02/F1/r3/c03`
- **evidence:** KB pilot: Planned work orders — 'Nothing to do. The ship system runs the job-due scan once every 24 hours'.
- **note:** the engine matched an unrelated pre-planning passage

### SUPPORTED — 2 occurrence(s)
- **claim (representative):** No specific role is required, but normal sign-in and vessel access apply.
- **ids:** `generated/6/F1/r1/c10`, `generated/6/F1/r2/c07`
- **evidence:** KB pilot: How work orders are created — 'No role check on this path (sign-in and vessel access still apply)'.

### SUPPORTED — 2 occurrence(s)
- **claim (representative):** Office: It opens the selected MoC record so you can view, edit, or export it.
- **ids:** `manuals/moc-office-1/F1/r3/c02`, `manuals/moc-office-1/F0/r3/c02`
- **evidence:** Safety - MOC User Manual_Office §3 (p.7) action table: 'View, edit, or export the selected MoC record.'

### SUPPORTED — 2 occurrence(s)
- **claim (representative):** The same process can be used for the selected category—Stores, Lubes, Chemicals, or Others—and for the selected tab—Inventory, Location, or History.
- **ids:** `manuals/pmsvessel-3/F1/r1/c09`, `manuals/pmsvessel-3/F1/r2/c05`
- **evidence:** Technical - PMS User Manual_Vessel Specific_ — 1.1.8.3 HOW TO UPDATE STOCK TRANSACT (p.43); Technical - PMS User Manual For Office_Sail  — 1.1.8.3 HOW TO UPDATE STOCK TRANSACT (p.50)
- **note:** restates the manual's own cross-reference; the target section is supplied in the same request

### UNRESOLVED — 1 occurrence(s)
- **claim (representative):** Office / Sail Admin
- **ids:** `answers/7/F1/r3/c02`
- **evidence:** A two-word heading label carried over from the manual's own heading; it asserts nothing on its own.
- **note:** kept visible rather than dropped, per the reviewer's instruction not to exclude short strings

### SUPPORTED — 1 occurrence(s)
- **claim (representative):** Recruited — uses the same steps as In Progress, section 1.2.1.2, page 13:
- **ids:** `fresh/fresh-crewing-1/F1/r2/c12`
- **evidence:** Crewing - Crewing User Manual R2_10.06.2026 — 1.2.2.4 HOW TO APPLY FILTER (p.21) (p.21); Crewing - Crewing User Manual R2_10.06.2026 — 1.2.4.4 HOW TO APPLY FILTER (p.23) (p.23)
- **note:** restates the manual's own cross-reference; the target section is supplied in the same request

### SUPPORTED — 1 occurrence(s)
- **claim (representative):** It does not require the office generation switch.
- **ids:** `generated/6/F1/r3/c16`
- **evidence:** Read in context: the sentence sits under heading '3. Unplanned work order', and the same answer states correctly under '2. Per-job Generate WO' that 'In the office, the vessel's switch must be ON'.
- **note:** counter-example to the wo-phr-05 conflation: the same distinction stated correctly in another run

### SUPPORTED — 1 occurrence(s)
- **claim (representative):** Section 4.2.2 is not included in the provided excerpts, and the manual does not state that its approval steps are the same as Section 4.1.2.
- **ids:** `manuals/sms-office-1/F1/r3/c01`
- **evidence:** Safety - SMS User Manual_Office_R0_31.01.202 — 4.2.1 Proposal (p.18) (p.18); Safety - SMS User Manual_Office_R0_31.01.202 — 4.1.2 Approval (p.17) (p.17)
- **note:** restates the manual's own cross-reference; the target section is supplied in the same request

### SUPPORTED — 1 occurrence(s)
- **claim (representative):** This requires no active WO for the job.
- **ids:** `manuals/pmsvessel-4/F1/r3/c03`
- **evidence:** Recent Updates §1.1.14.6.3: 'the job must exist, be active and not already have an active work order'.

## Not read

Everything without a READ verdict above carries only a machine label and is **not verified**. The largest
group is `UNRESOLVED` — the engine could not decide (best single passage covers under 70% of the claim's
content words). These remain open.
