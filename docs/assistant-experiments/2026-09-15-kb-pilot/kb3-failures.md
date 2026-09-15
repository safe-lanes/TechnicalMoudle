# Run D3 — every failing work-order run, with the RECONSTRUCTED excerpt text (earlier reconstructed-input report)

**Status of this file (corrected 15-Sep after external review):** this is the earlier reconstructed-input report. The excerpt texts below were reproduced by a separate probe (`probe_kb3.py`) from the same index set and embedding model — they are NOT captures of the requests sent to the model. The probe reproduced `text[:3000]` without headers; the served docs path actually sends each chunk's FULL text with a `[i] (manual — section)` header and `---` separators (the 3,000-character cut applies only to the tool path). For the chunks involved (all ≤ 2,105 characters) the text is the same, but the citation cross-check below shows only that the probe and the runs retrieved the same chunks — it does not prove the exact model input. **The verified evidence is the wire capture of the later diagnostic: `diag-capture.jsonl` (actual request bodies) with `diag-analysis.txt` and `diag-results.json` (REPORT.md §9).** The classifications below stand as reconstructed-input classifications.

Excerpts: top-5 hits of the winning module, reconstructed by probe_kb3.py from the same index and embedding model as the run. One excerpt set per question × set (deterministic retrieval); each run's returned citations are compared with it below (consistency check only).

## Totals
| classification | failing runs |
|---|---|
| ANSWER GENERATION | 15 |
| MIXED | 6 |
| RETRIEVAL | 24 |

## Per-run classification
| case | set | run | classification | note |
|---|---|---|---|---|
| wo-generic-01 | A-kb-base | 1 | RETRIEVAL | none of the dropped items is in the supplied text; also literal must-phrase absent: ['generate wo'] |
| wo-generic-01 | A-kb-base | 2 | RETRIEVAL | none of the dropped items is in the supplied text; also literal must-phrase absent: ['generate wo'] |
| wo-generic-01 | A-kb-base | 3 | RETRIEVAL | none of the dropped items is in the supplied text; also literal must-phrase absent: ['generate wo'] |
| wo-generic-01 | B-kb-pilot | 1 | ANSWER GENERATION | every dropped item is in the supplied text; also literal must-phrase absent: ['generate wo'] |
| wo-generic-01 | B-kb-pilot | 2 | ANSWER GENERATION | every dropped item is in the supplied text; also literal must-phrase absent: ['generate wo'] |
| wo-generic-01 | B-kb-pilot | 3 | ANSWER GENERATION | every dropped item is in the supplied text; also literal must-phrase absent: ['generate wo'] |
| wo-generic-02 | A-kb-base | 1 | RETRIEVAL | none of the dropped items is in the supplied text; also literal must-phrase absent: ['job'] |
| wo-generic-02 | A-kb-base | 2 | RETRIEVAL | none of the dropped items is in the supplied text; also literal must-phrase absent: ['job'] |
| wo-generic-02 | A-kb-base | 3 | RETRIEVAL | none of the dropped items is in the supplied text; also literal must-phrase absent: ['job'] |
| wo-generic-03 | A-kb-base | 1 | RETRIEVAL | none of the dropped items is in the supplied text; also literal must-phrase absent: ['generate wo'] |
| wo-generic-03 | A-kb-base | 2 | RETRIEVAL | none of the dropped items is in the supplied text; also literal must-phrase absent: ['generate wo'] |
| wo-generic-03 | A-kb-base | 3 | RETRIEVAL | none of the dropped items is in the supplied text; also literal must-phrase absent: ['generate wo'] |
| wo-generic-03 | B-kb-pilot | 1 | RETRIEVAL | none of the dropped items is in the supplied text; also literal must-phrase absent: ['generate wo'] |
| wo-generic-03 | B-kb-pilot | 2 | RETRIEVAL | none of the dropped items is in the supplied text; also literal must-phrase absent: ['generate wo'] |
| wo-generic-03 | B-kb-pilot | 3 | RETRIEVAL | none of the dropped items is in the supplied text; also literal must-phrase absent: ['generate wo'] |
| wo-phr-01 | A-kb-base | 1 | RETRIEVAL | none of the dropped items is in the supplied text; also literal must-phrase absent: ['generate wo'] |
| wo-phr-01 | A-kb-base | 2 | RETRIEVAL | none of the dropped items is in the supplied text; also literal must-phrase absent: ['unplanned w.o', 'generate wo'] |
| wo-phr-01 | A-kb-base | 3 | RETRIEVAL | none of the dropped items is in the supplied text; also literal must-phrase absent: ['unplanned w.o', 'generate wo'] |
| wo-phr-01 | B-kb-pilot | 1 | ANSWER GENERATION | every dropped item is in the supplied text |
| wo-phr-01 | B-kb-pilot | 2 | ANSWER GENERATION | every dropped item is in the supplied text |
| wo-phr-01 | B-kb-pilot | 3 | ANSWER GENERATION | every dropped item is in the supplied text |
| wo-phr-02 | A-kb-base | 1 | RETRIEVAL | none of the dropped items is in the supplied text |
| wo-phr-02 | A-kb-base | 2 | RETRIEVAL | none of the dropped items is in the supplied text |
| wo-phr-02 | A-kb-base | 3 | RETRIEVAL | none of the dropped items is in the supplied text |
| wo-phr-02 | B-kb-pilot | 1 | RETRIEVAL | none of the dropped items is in the supplied text |
| wo-phr-02 | B-kb-pilot | 2 | RETRIEVAL | none of the dropped items is in the supplied text |
| wo-phr-02 | B-kb-pilot | 3 | RETRIEVAL | none of the dropped items is in the supplied text |
| wo-phr-03 | A-kb-base | 1 | MIXED | automatic generation: not in text; Generate Now described: not in text; per-job Generate WO described: in text; also literal must-phrase absent: ['generate wo'] |
| wo-phr-03 | A-kb-base | 2 | MIXED | automatic generation: not in text; Generate Now described: not in text; per-job Generate WO described: in text; also literal must-phrase absent: ['generate wo'] |
| wo-phr-03 | A-kb-base | 3 | MIXED | automatic generation: not in text; Generate Now described: not in text; per-job Generate WO described: in text; also literal must-phrase absent: ['generate wo'] |
| wo-phr-03 | B-kb-pilot | 1 | ANSWER GENERATION | every dropped item is in the supplied text; also literal must-phrase absent: ['unplanned w.o', 'generate wo'] |
| wo-phr-03 | B-kb-pilot | 2 | ANSWER GENERATION | every dropped item is in the supplied text; also literal must-phrase absent: ['unplanned w.o', 'generate wo'] |
| wo-phr-03 | B-kb-pilot | 3 | ANSWER GENERATION | every dropped item is in the supplied text; also literal must-phrase absent: ['unplanned w.o', 'generate wo'] |
| wo-phr-04 | A-kb-base | 1 | RETRIEVAL | none of the dropped items is in the supplied text; also literal must-phrase absent: ['generate wo'] |
| wo-phr-04 | A-kb-base | 2 | RETRIEVAL | none of the dropped items is in the supplied text; also literal must-phrase absent: ['generate wo'] |
| wo-phr-04 | A-kb-base | 3 | RETRIEVAL | none of the dropped items is in the supplied text; also literal must-phrase absent: ['generate wo'] |
| wo-phr-04 | B-kb-pilot | 1 | ANSWER GENERATION | every dropped item is in the supplied text; also literal must-phrase absent: ['generate wo'] |
| wo-phr-04 | B-kb-pilot | 2 | ANSWER GENERATION | every dropped item is in the supplied text; also literal must-phrase absent: ['generate wo'] |
| wo-phr-04 | B-kb-pilot | 3 | ANSWER GENERATION | every dropped item is in the supplied text; also literal must-phrase absent: ['generate wo'] |
| wo-phr-05 | A-kb-base | 1 | MIXED | automatic generation: not in text; Generate Now described: not in text; per-job Generate WO described: in text; also literal must-phrase absent: ['generate wo'] |
| wo-phr-05 | A-kb-base | 2 | MIXED | automatic generation: not in text; Generate Now described: not in text; per-job Generate WO described: in text; also literal must-phrase absent: ['generate wo'] |
| wo-phr-05 | A-kb-base | 3 | MIXED | automatic generation: not in text; Generate Now described: not in text; per-job Generate WO described: in text; also literal must-phrase absent: ['unplanned w.o', 'generate wo'] |
| wo-phr-05 | B-kb-pilot | 1 | ANSWER GENERATION | every dropped item is in the supplied text |
| wo-phr-05 | B-kb-pilot | 2 | ANSWER GENERATION | every dropped item is in the supplied text |
| wo-phr-05 | B-kb-pilot | 3 | ANSWER GENERATION | every dropped item is in the supplied text |

## wo-generic-01 · A-kb-base · run 1 → **RETRIEVAL**
- question: How do I create a work order?
- judge: answer=False citation=True rule=False — automatic generation MISSING; pairing ✗: Generate Now not described; per-job Generate WO not described
- classification note: none of the dropped items is in the supplied text; also literal must-phrase absent: ['generate wo']
- citations returned by this run: ['Technical - PMS User Manual For Office_Sail Admin_R2_08.06.2026', 'Technical - PMS User Manual_Vessel Specific_R3_08.07.2026']  (all within the probe's hit list)
- answer (full): To create an unplanned work order, follow these steps: 1. Go to the 'Work Orders' sub-sub module. 2. Select the vessel from the 'Vessel' dropdown. 3. Click on the '+ Unplanned W.O' button to create an unplanned work order. 4. The 'Work Order Form – Unplanned Maintenance' will appear. 5. Enter all required job details in Part A and click Save to store it as a draft. 6. Complete Part B and click Submit Work Order to generate the unplanned work order. Source: Technical - PMS User Manual For Office_Sail Admin_R2_08.06.2026 — 1.1.5.2 HOW TO CREATE AN UNPLANNED WORK ORDER (p.29) and Technical - PMS User Manual_Vessel Specific_R3_08.07.2026 — 1.1.5.2 HOW TO CREATE AN UNPLANNED WORK ORDER (p.24).
- **excerpt text supplied for this question on A-kb-base (identical for runs 1–3):**
  - [1] Technical - PMS User Manual For Office_Sail Admin_R2_08.06.2026.pdf · 1.1.5.2 HOW TO CREATE AN UNPLANNED WORK ORDER (p.29) · 1026 chars · d=0.7926
    ```
    * Go to the 'Work Orders' sub-sub module. (Ref Figure 43)
    
    * Select the vessel from the 'Vessel' dropdown. (Ref Figure 43)
    
    * Click on the '+ Unplanned W\.O' button to create an unplanned work order. (Ref Figure 43)
    
    Screenshot of the Work Orders (W\.O) dashboard showing three steps: 1. Click here to access the 'Work Orders', 2. Click here to select a vessel, and 3. Click here to open an unplanned work order form.
    
    Figure 43
    
    * The 'Work Order Form – Unplanned Maintenance' form below appears after clicking the '+ Unplanned W\.O' button. (Ref Figure 44)
    
    * Enter all required job details in Part A and click Save to store it as a draft. Then complete Part B and click Submit Work Order to generate the unplanned work order. (Ref Figure 44)
    
    Screenshot of the Work Order Form - Unplanned showing the Save button highlighted with "Click the Save button to save it as a draft" and the Submit Work Order button highlighted with "After filling the form, click here to create an unplanned work order."
    
    Figure 44
    
    Page 29 of 64
    ```
  - [2] Technical - PMS User Manual_Vessel Specific_R3_08.07.2026.pdf · 1.1.5.2 HOW TO CREATE AN UNPLANNED WORK ORDER (p.24) · 681 chars · d=0.8107
    ```
    * Go to the 'Work Orders' sub-sub module. (Ref Figure 33)
    
    * Click on the '+ Unplanned W\.O' button to create an unplanned work order. (Ref Figure 33)
    
    screenshot: Work Orders dashboard showing navigation to Work Orders and the Unplanned W\.O button
    
    Figure 33
    
    * The 'Work Order Form – Unplanned Maintenance' form below appears after clicking the '+ Unplanned W\.O' button. (Ref Figure 34)
    
    * Enter all required job details in Part A and click Save to store it as a draft. Then complete Part B and click Submit Work Order to generate the unplanned work order. (Ref Figure 34)
    
    screenshot: Work Order Form - Unplanned showing the Save button and Submit Work Order button
    
    Figure 34
    ```
  - [3] Technical - PMS User Manual For Office_Sail Admin_R2_08.06.2026.pdf · 1.1.5.6 HOW TO COMPLETE THE WORK ORDER (p.32) · 1173 chars · d=0.8373
    ```
    * Go to the 'Work Orders' sub-sub module. (Ref Figure 49)
    
    * Select the vessel from the 'Vessel' dropdown. (Ref Figure 49)
    
    * Click the required status tab (Scheduled, Due, Overdue, Postponed, or Unplanned). (Ref Figure 49)
    
    * Then select the work order by clicking the 'Edit' icon or the table row. (Ref Figure 49)
    
    Screenshot of the Work Orders (W\.O) dashboard with four callout boxes: 1. Click on the 'Work Order'. 2. Click here to select a vessel. 3. Choose the required field from the status tab that needs to be completed. 4. The work order form can be opened by clicking the 'Edit' icon or selecting the table row.
    
    Figure 49
    
    * The 'Work Order Form' appears after clicking the 'Edit' icon. (Ref Figure 50)
    
    * Navigate to 'Part B – Work Completion Record', enter the required information. (Ref Figure 50)
    
    Screenshot of the Part B - Work Completion Record form with three callout boxes: 1. Click here to open the 'Part B' section and enter the required details. 2. From here, the user can upload the docs. 3. Use this section to add or select quick inputs and smart suggestions.
    
    Figure 50
    
    \* To upload RA documents, ensure the radio button is not set to NA or No.
    ```
  - [4] Technical - PMS User Manual_Vessel Specific_R3_08.07.2026.pdf · 1.1.5.6 HOW TO COMPLETE THE WORK ORDER (p.27) · 763 chars · d=0.8382
    ```
    * Go to the 'Work Orders' sub-sub module. (Ref Figure 39)
    
    * Click the required status tab (Scheduled, Due, Overdue, Postponed, or Unplanned). (Ref Figure 39)
    
    * Then select the work order by clicking the 'Edit' icon or the table row. (Ref Figure 39)
    
    screenshot: Work Orders (W\.O) dashboard showing status tabs and work order list with instructional callouts
    
    Figure 39
    
    * The 'Work Order Form' appears after clicking the 'Edit' icon. (Ref Figure 40)
    
    * Navigate to 'Part B – Work Completion Record', enter the required information. (Ref Figure 40)
    
    screenshot: Part B - Work Completion Record form showing risk assessment and work duration fields with instructional callouts
    
    Figure 40
    
    ☞ To upload RA documents, ensure the radio button is not set to NA or No.
    ```
  - [5] Technical - PMS User Manual For Office_Sail Admin_R2_08.06.2026.pdf · Introduction (p.28) · 319 chars · d=0.8502
    ```
    * Work Orders (WO) are a structured instruction used onboard to plan, execute, and record maintenance activities for equipment and systems. It serves as the primary control mechanism to ensure that all maintenance tasks are carried out systematically, safely, and in compliance with company and regulatory requirements.
    ```

## wo-generic-01 · A-kb-base · run 2 → **RETRIEVAL**
- question: How do I create a work order?
- judge: answer=False citation=True rule=False — automatic generation MISSING; pairing ✗: Generate Now not described; per-job Generate WO not described
- classification note: none of the dropped items is in the supplied text; also literal must-phrase absent: ['generate wo']
- citations returned by this run: ['Technical - PMS User Manual For Office_Sail Admin_R2_08.06.2026', 'Technical - PMS User Manual_Vessel Specific_R3_08.07.2026']  (all within the probe's hit list)
- answer (full): To create an unplanned work order, follow these steps: 1. Go to the 'Work Orders' sub-sub module. 2. Select the vessel from the 'Vessel' dropdown. 3. Click on the '+ Unplanned W.O' button to create an unplanned work order. 4. The 'Work Order Form – Unplanned Maintenance' form will appear. 5. Enter all required job details in Part A and click Save to store it as a draft. 6. Complete Part B and click Submit Work Order to generate the unplanned work order. These steps are the same as section 1.1.5.2 in the Technical - PMS User Manual For Office_Sail Admin (page 29) and the Technical - PMS User Manual_Vessel Specific (page 24). Source: Technical - PMS User Manual For Office_Sail Admin (1.1.5.2), Technical - PMS User Manual_Vessel Specific (1.1.5.2)
- excerpt text: same as run 1 of wo-generic-01 on A-kb-base (above)

## wo-generic-01 · A-kb-base · run 3 → **RETRIEVAL**
- question: How do I create a work order?
- judge: answer=False citation=True rule=False — automatic generation MISSING; pairing ✗: Generate Now not described; per-job Generate WO not described
- classification note: none of the dropped items is in the supplied text; also literal must-phrase absent: ['generate wo']
- citations returned by this run: ['Technical - PMS User Manual For Office_Sail Admin_R2_08.06.2026', 'Technical - PMS User Manual_Vessel Specific_R3_08.07.2026']  (all within the probe's hit list)
- answer (full): To create an unplanned work order, follow these steps: 1. Go to the 'Work Orders' sub-sub module. 2. Select the vessel from the 'Vessel' dropdown. 3. Click on the '+ Unplanned W.O' button to create an unplanned work order. 4. The 'Work Order Form – Unplanned Maintenance' form will appear. 5. Enter all required job details in Part A and click Save to store it as a draft. 6. Complete Part B and click Submit Work Order to generate the unplanned work order. Source: Technical - PMS User Manual For Office_Sail Admin_R2_08.06.2026 — 1.1.5.2 HOW TO CREATE AN UNPLANNED WORK ORDER (p.29) and Technical - PMS User Manual_Vessel Specific_R3_08.07.2026 — 1.1.5.2 HOW TO CREATE AN UNPLANNED WORK ORDER (p.24).
- excerpt text: same as run 1 of wo-generic-01 on A-kb-base (above)

## wo-generic-01 · B-kb-pilot · run 1 → **ANSWER GENERATION**
- question: How do I create a work order?
- judge: answer=False citation=True rule=False — automatic generation MISSING; pairing ✗: Generate Now not described; per-job Generate WO not described
- classification note: every dropped item is in the supplied text; also literal must-phrase absent: ['generate wo']
- citations returned by this run: ['Technical - KB pilot: How work orders are created — the three ways to create a work order.md', 'Technical - PMS User Manual For Office_Sail Admin_R2_08.06.2026', 'Technical - PMS User Manual_Vessel Specific_R3_08.07.2026']  (all within the probe's hit list)
- answer (full): To create an unplanned work order, follow these steps: 1. Go to the 'Work Orders' sub-sub module. 2. Select the vessel from the 'Vessel' dropdown. 3. Click on the '+ Unplanned W.O' button to create an unplanned work order. 4. The 'Work Order Form – Unplanned Maintenance' form will appear. 5. Enter all required job details in Part A and click Save to store it as a draft. 6. Complete Part B and click Submit Work Order to generate the unplanned work order. These steps are the same as section 1.1.5.2 in the Technical - PMS User Manual For Office (page 29) and the Technical - PMS User Manual_Vessel Specific (page 24). Source: Technical - PMS User Manual For Office, section 1.1.5.2; Technical - PMS User Manual_Vessel Specific, section 1.1.5.2.
- **excerpt text supplied for this question on B-kb-pilot (identical for runs 1–3):**
  - [1] Technical - PMS User Manual For Office_Sail Admin_R2_08.06.2026.pdf · 1.1.5.2 HOW TO CREATE AN UNPLANNED WORK ORDER (p.29) · 1026 chars · d=0.7926
    ```
    * Go to the 'Work Orders' sub-sub module. (Ref Figure 43)
    
    * Select the vessel from the 'Vessel' dropdown. (Ref Figure 43)
    
    * Click on the '+ Unplanned W\.O' button to create an unplanned work order. (Ref Figure 43)
    
    Screenshot of the Work Orders (W\.O) dashboard showing three steps: 1. Click here to access the 'Work Orders', 2. Click here to select a vessel, and 3. Click here to open an unplanned work order form.
    
    Figure 43
    
    * The 'Work Order Form – Unplanned Maintenance' form below appears after clicking the '+ Unplanned W\.O' button. (Ref Figure 44)
    
    * Enter all required job details in Part A and click Save to store it as a draft. Then complete Part B and click Submit Work Order to generate the unplanned work order. (Ref Figure 44)
    
    Screenshot of the Work Order Form - Unplanned showing the Save button highlighted with "Click the Save button to save it as a draft" and the Submit Work Order button highlighted with "After filling the form, click here to create an unplanned work order."
    
    Figure 44
    
    Page 29 of 64
    ```
  - [2] Technical - PMS User Manual_Vessel Specific_R3_08.07.2026.pdf · 1.1.5.2 HOW TO CREATE AN UNPLANNED WORK ORDER (p.24) · 681 chars · d=0.8107
    ```
    * Go to the 'Work Orders' sub-sub module. (Ref Figure 33)
    
    * Click on the '+ Unplanned W\.O' button to create an unplanned work order. (Ref Figure 33)
    
    screenshot: Work Orders dashboard showing navigation to Work Orders and the Unplanned W\.O button
    
    Figure 33
    
    * The 'Work Order Form – Unplanned Maintenance' form below appears after clicking the '+ Unplanned W\.O' button. (Ref Figure 34)
    
    * Enter all required job details in Part A and click Save to store it as a draft. Then complete Part B and click Submit Work Order to generate the unplanned work order. (Ref Figure 34)
    
    screenshot: Work Order Form - Unplanned showing the Save button and Submit Work Order button
    
    Figure 34
    ```
  - [3] Technical - KB pilot: How work orders are created — the three ways to create a work order.md · How work orders are created — the three ways to create a work order · 2044 chars · d=0.825
    ```
    Applies to: Both
    Who can do it (role): Depends on the way — (1) planned: nobody, the ship system creates them; office 'Generate Now': Sail Admin only; (2) per-job 'Generate WO': no role check; (3) unplanned: no role check. Normal sign-in and vessel access apply to all.
    Prerequisites (switches, settings, job/component state): Office 'Generate Now' and office per-job 'Generate WO' both need the vessel's 'office work-order generation' switch ON (off by default, set by a Sail Admin on 'Lead Time & Grace Period Settings'). Unplanned needs no switch. A job with an active work order cannot get another one.
    Steps:
    1. Planned (scheduled) work orders — generated by the system from each job's frequency and next due date. ON THE SHIP: automatic, once a day, no user action. IN THE OFFICE: nothing runs automatically; a Sail Admin can click 'Generate Now' on the Work Orders screen for one vessel, only if that vessel's switch is on. Details: planned-wo-ship-daily-scan.md and office-generate-now.md.
    2. One job on demand — Components → (Office: select the vessel) → open the component → Part C → 'Generate WO' → choose the reason (Planning / Breakdown / Other). No role check on this path (sign-in and vessel access still apply); in the office only if the vessel switch is on; the job must be active and must not already have an active work order. Details: office-generate-wo-per-job.md.
    3. Unplanned work — Work Orders → (Office: select the vessel) → '+ Unplanned W.O' → Part A, Save → Part B, Submit Work Order. No role check on this path, no switch. Details: unplanned-wo.md.
    Exceptions / edge cases: The Sail Admin requirement belongs to 'Generate Now' only; it does not apply to per-job 'Generate WO' or to unplanned work orders.
    Where the manual differs: The June manuals describe only ways 2 and 3 and state no office conditions; automatic ship generation and 'Generate Now' are absent from them. See CONFLICTS.md.
    Related procedures: planned-wo-ship-daily-scan.md · office-generate-now.md · office-generate-wo-per-job.md · unplanned-wo.md
    ```
  - [4] Technical - PMS User Manual For Office_Sail Admin_R2_08.06.2026.pdf · 1.1.5.6 HOW TO COMPLETE THE WORK ORDER (p.32) · 1173 chars · d=0.8373
    ```
    * Go to the 'Work Orders' sub-sub module. (Ref Figure 49)
    
    * Select the vessel from the 'Vessel' dropdown. (Ref Figure 49)
    
    * Click the required status tab (Scheduled, Due, Overdue, Postponed, or Unplanned). (Ref Figure 49)
    
    * Then select the work order by clicking the 'Edit' icon or the table row. (Ref Figure 49)
    
    Screenshot of the Work Orders (W\.O) dashboard with four callout boxes: 1. Click on the 'Work Order'. 2. Click here to select a vessel. 3. Choose the required field from the status tab that needs to be completed. 4. The work order form can be opened by clicking the 'Edit' icon or selecting the table row.
    
    Figure 49
    
    * The 'Work Order Form' appears after clicking the 'Edit' icon. (Ref Figure 50)
    
    * Navigate to 'Part B – Work Completion Record', enter the required information. (Ref Figure 50)
    
    Screenshot of the Part B - Work Completion Record form with three callout boxes: 1. Click here to open the 'Part B' section and enter the required details. 2. From here, the user can upload the docs. 3. Use this section to add or select quick inputs and smart suggestions.
    
    Figure 50
    
    \* To upload RA documents, ensure the radio button is not set to NA or No.
    ```
  - [5] Technical - PMS User Manual_Vessel Specific_R3_08.07.2026.pdf · 1.1.5.6 HOW TO COMPLETE THE WORK ORDER (p.27) · 763 chars · d=0.8382
    ```
    * Go to the 'Work Orders' sub-sub module. (Ref Figure 39)
    
    * Click the required status tab (Scheduled, Due, Overdue, Postponed, or Unplanned). (Ref Figure 39)
    
    * Then select the work order by clicking the 'Edit' icon or the table row. (Ref Figure 39)
    
    screenshot: Work Orders (W\.O) dashboard showing status tabs and work order list with instructional callouts
    
    Figure 39
    
    * The 'Work Order Form' appears after clicking the 'Edit' icon. (Ref Figure 40)
    
    * Navigate to 'Part B – Work Completion Record', enter the required information. (Ref Figure 40)
    
    screenshot: Part B - Work Completion Record form showing risk assessment and work duration fields with instructional callouts
    
    Figure 40
    
    ☞ To upload RA documents, ensure the radio button is not set to NA or No.
    ```

## wo-generic-01 · B-kb-pilot · run 2 → **ANSWER GENERATION**
- question: How do I create a work order?
- judge: answer=False citation=True rule=False — automatic generation MISSING; pairing ✗: Generate Now not described; per-job Generate WO not described
- classification note: every dropped item is in the supplied text; also literal must-phrase absent: ['generate wo']
- citations returned by this run: ['Technical - KB pilot: How work orders are created — the three ways to create a work order.md', 'Technical - PMS User Manual For Office_Sail Admin_R2_08.06.2026', 'Technical - PMS User Manual_Vessel Specific_R3_08.07.2026']  (all within the probe's hit list)
- answer (full): To create an unplanned work order, follow these steps: 1. Go to the 'Work Orders' sub-sub module. 2. Select the vessel from the 'Vessel' dropdown. 3. Click on the '+ Unplanned W.O' button to create an unplanned work order. 4. The 'Work Order Form – Unplanned Maintenance' will appear. 5. Enter all required job details in Part A and click Save to store it as a draft. 6. Complete Part B and click Submit Work Order to generate the unplanned work order. These steps are the same as in section 1.1.5.2 of the PMS User Manual for Office (page 29) and the Vessel Specific manual (page 24). Source: Technical - PMS User Manual For Office_Sail Admin_R2_08.06.2026, section 1.1.5.2; Technical - PMS User Manual_Vessel Specific_R3_08.07.2026, section 1.1.5.2.
- excerpt text: same as run 1 of wo-generic-01 on B-kb-pilot (above)

## wo-generic-01 · B-kb-pilot · run 3 → **ANSWER GENERATION**
- question: How do I create a work order?
- judge: answer=False citation=True rule=False — automatic generation MISSING; pairing ✗: Generate Now not described; per-job Generate WO not described
- classification note: every dropped item is in the supplied text; also literal must-phrase absent: ['generate wo']
- citations returned by this run: ['Technical - KB pilot: How work orders are created — the three ways to create a work order.md', 'Technical - PMS User Manual For Office_Sail Admin_R2_08.06.2026', 'Technical - PMS User Manual_Vessel Specific_R3_08.07.2026']  (all within the probe's hit list)
- answer (full): To create an unplanned work order, follow these steps: 1. Go to the 'Work Orders' sub-sub module. 2. Select the vessel from the 'Vessel' dropdown. 3. Click on the '+ Unplanned W.O' button to create an unplanned work order. 4. The 'Work Order Form – Unplanned Maintenance' form will appear. 5. Enter all required job details in Part A and click Save to store it as a draft. 6. Complete Part B and click Submit Work Order to generate the unplanned work order. These steps are the same as in section 1.1.5.2 of the PMS User Manual for Office (page 29) and the Vessel Specific Manual (page 24). Source: Technical - PMS User Manual For Office_Sail Admin_R2_08.06.2026, section 1.1.5.2; Technical - PMS User Manual_Vessel Specific_R3_08.07.2026, section 1.1.5.2.
- excerpt text: same as run 1 of wo-generic-01 on B-kb-pilot (above)

## wo-generic-02 · A-kb-base · run 1 → **RETRIEVAL**
- question: How are planned work orders created in PMS — do I have to create them myself?
- judge: answer=False citation=True rule=False — automatic generation MISSING; user need not create MISSING
- classification note: none of the dropped items is in the supplied text; also literal must-phrase absent: ['job']
- citations returned by this run: ['Technical - PMS User Manual For Office_Sail Admin_R2_08.06.2026', 'Technical - PMS User Manual_Vessel Specific_R3_08.07.2026']  (all within the probe's hit list)
- answer (full): The process for creating planned work orders is not covered in the Technical documentation. Source: Not applicable.
- **excerpt text supplied for this question on A-kb-base (identical for runs 1–3):**
  - [1] Technical - PMS User Manual For Office_Sail Admin_R2_08.06.2026.pdf · 1.1.5.2 HOW TO CREATE AN UNPLANNED WORK ORDER (p.29) · 1026 chars · d=0.8314
    ```
    * Go to the 'Work Orders' sub-sub module. (Ref Figure 43)
    
    * Select the vessel from the 'Vessel' dropdown. (Ref Figure 43)
    
    * Click on the '+ Unplanned W\.O' button to create an unplanned work order. (Ref Figure 43)
    
    Screenshot of the Work Orders (W\.O) dashboard showing three steps: 1. Click here to access the 'Work Orders', 2. Click here to select a vessel, and 3. Click here to open an unplanned work order form.
    
    Figure 43
    
    * The 'Work Order Form – Unplanned Maintenance' form below appears after clicking the '+ Unplanned W\.O' button. (Ref Figure 44)
    
    * Enter all required job details in Part A and click Save to store it as a draft. Then complete Part B and click Submit Work Order to generate the unplanned work order. (Ref Figure 44)
    
    Screenshot of the Work Order Form - Unplanned showing the Save button highlighted with "Click the Save button to save it as a draft" and the Submit Work Order button highlighted with "After filling the form, click here to create an unplanned work order."
    
    Figure 44
    
    Page 29 of 64
    ```
  - [2] Technical - PMS User Manual_Vessel Specific_R3_08.07.2026.pdf · 1.1.5.2 HOW TO CREATE AN UNPLANNED WORK ORDER (p.24) · 681 chars · d=0.8349
    ```
    * Go to the 'Work Orders' sub-sub module. (Ref Figure 33)
    
    * Click on the '+ Unplanned W\.O' button to create an unplanned work order. (Ref Figure 33)
    
    screenshot: Work Orders dashboard showing navigation to Work Orders and the Unplanned W\.O button
    
    Figure 33
    
    * The 'Work Order Form – Unplanned Maintenance' form below appears after clicking the '+ Unplanned W\.O' button. (Ref Figure 34)
    
    * Enter all required job details in Part A and click Save to store it as a draft. Then complete Part B and click Submit Work Order to generate the unplanned work order. (Ref Figure 34)
    
    screenshot: Work Order Form - Unplanned showing the Save button and Submit Work Order button
    
    Figure 34
    ```
  - [3] Technical - PMS User Manual_Vessel Specific_R3_08.07.2026.pdf · 1.1.5.3 HOW TO PRE-PLAN THE WORK ORDER (p.25) · 820 chars · d=0.8367
    ```
    * Go to the 'Work Orders' sub-sub module. (Ref Figure 35)
    
    * Click the 'Planner' button to re-plan the Work Order. (Ref Figure 35)
    
    screenshot: Work Orders (W\.O) interface showing the Work orders module selected and the Planner button highlighted with instructional callouts.
    
    <a id="figure-35"></a>Figure 35
    
    * The 'Work Order Planner' page below appears after clicking the 'Planner' button. (Ref Figure 36)
    
    * The user can select multiple records as per the required work order using the checkbox. (Ref Figure 36)
    
    * Click the 'Planned Date' field and select the required date to update the planned date for the selected work order. (Ref Figure 36)
    
    screenshot: Work Order Planner interface showing multiple work orders selected and the Planned Date field with instructional callouts.
    
    <a id="figure-36"></a>Figure 36
    ```
  - [4] Technical - PMS User Manual For Office_Sail Admin_R2_08.06.2026.pdf · 1.1.5.3 HOW TO PRE-PLAN THE WORK ORDER (p.30) · 837 chars · d=0.8428
    ```
    * Go to the 'Work Orders' sub-sub module. (Ref Figure 45)
    
    * Select the vessel from the 'Vessel' dropdown. (Ref Figure 45)
    
    * Click the 'Planner' button to re-plan the Work Order. (Ref Figure 45)
    
    Screenshot of Work Orders (W\.O) interface showing how to access work orders, select a vessel, and open the Work Order Planner.
    
    <a id="figure-45"></a>Figure 45
    
    * The 'Work Order Planner' page below appears after clicking the 'Planner' button. (Ref Figure 46)
    
    * The user can select multiple records as per the required work order using the checkbox. (Ref Figure 46)
    
    * Click the 'Planned Date' field and select the required date to update the planned date for the selected work order. (Ref Figure 46)
    
    Screenshot of Work Order Planner interface showing how to select work orders and assign a planned date.
    
    <a id="figure-46"></a>Figure 46
    ```
  - [5] Technical - PMS User Manual For Office_Sail Admin_R2_08.06.2026.pdf · Introduction (p.28) · 319 chars · d=0.8775
    ```
    * Work Orders (WO) are a structured instruction used onboard to plan, execute, and record maintenance activities for equipment and systems. It serves as the primary control mechanism to ensure that all maintenance tasks are carried out systematically, safely, and in compliance with company and regulatory requirements.
    ```

## wo-generic-02 · A-kb-base · run 2 → **RETRIEVAL**
- question: How are planned work orders created in PMS — do I have to create them myself?
- judge: answer=False citation=True rule=False — automatic generation MISSING; user need not create MISSING
- classification note: none of the dropped items is in the supplied text; also literal must-phrase absent: ['job']
- citations returned by this run: ['Technical - PMS User Manual For Office_Sail Admin_R2_08.06.2026', 'Technical - PMS User Manual_Vessel Specific_R3_08.07.2026']  (all within the probe's hit list)
- answer (full): The process for creating planned work orders is not covered in the Technical documentation. Source: Not applicable.
- excerpt text: same as run 1 of wo-generic-02 on A-kb-base (above)

## wo-generic-02 · A-kb-base · run 3 → **RETRIEVAL**
- question: How are planned work orders created in PMS — do I have to create them myself?
- judge: answer=False citation=True rule=False — automatic generation MISSING; user need not create MISSING
- classification note: none of the dropped items is in the supplied text; also literal must-phrase absent: ['job']
- citations returned by this run: ['Technical - PMS User Manual For Office_Sail Admin_R2_08.06.2026', 'Technical - PMS User Manual_Vessel Specific_R3_08.07.2026']  (all within the probe's hit list)
- answer (full): The process for creating planned work orders is not covered in the Technical documentation. Source: Technical - PMS User Manual For Office_Sail Admin_R2_08.06.2026.
- excerpt text: same as run 1 of wo-generic-02 on A-kb-base (above)

## wo-generic-03 · A-kb-base · run 1 → **RETRIEVAL**
- question: How to create work order in PMS?
- judge: answer=False citation=True rule=False — automatic generation MISSING; pairing ✗: Generate Now not described; per-job Generate WO not described
- classification note: none of the dropped items is in the supplied text; also literal must-phrase absent: ['generate wo']
- citations returned by this run: ['Technical - PMS User Manual For Office_Sail Admin_R2_08.06.2026', 'Technical - PMS User Manual_Vessel Specific_R3_08.07.2026']  (all within the probe's hit list)
- answer (full): To create an unplanned work order in PMS, follow these steps: 1. Go to the 'Work Orders' sub-sub module. 2. Select the vessel from the 'Vessel' dropdown. 3. Click on the '+ Unplanned W.O' button to create an unplanned work order. 4. The 'Work Order Form – Unplanned Maintenance' will appear. 5. Enter all required job details in Part A and click Save to store it as a draft. 6. Complete Part B and click Submit Work Order to generate the unplanned work order. These steps are the same as those in section 1.1.5.2 (page 29). Source: Technical - PMS User Manual For Office_Sail Admin_R2_08.06.2026, section 1.1.5.2.
- **excerpt text supplied for this question on A-kb-base (identical for runs 1–3):**
  - [1] Technical - PMS User Manual For Office_Sail Admin_R2_08.06.2026.pdf · Introduction (p.28) · 319 chars · d=0.7328
    ```
    * Work Orders (WO) are a structured instruction used onboard to plan, execute, and record maintenance activities for equipment and systems. It serves as the primary control mechanism to ensure that all maintenance tasks are carried out systematically, safely, and in compliance with company and regulatory requirements.
    ```
  - [2] Technical - PMS User Manual For Office_Sail Admin_R2_08.06.2026.pdf · 1.1.5.2 HOW TO CREATE AN UNPLANNED WORK ORDER (p.29) · 1026 chars · d=0.7514
    ```
    * Go to the 'Work Orders' sub-sub module. (Ref Figure 43)
    
    * Select the vessel from the 'Vessel' dropdown. (Ref Figure 43)
    
    * Click on the '+ Unplanned W\.O' button to create an unplanned work order. (Ref Figure 43)
    
    Screenshot of the Work Orders (W\.O) dashboard showing three steps: 1. Click here to access the 'Work Orders', 2. Click here to select a vessel, and 3. Click here to open an unplanned work order form.
    
    Figure 43
    
    * The 'Work Order Form – Unplanned Maintenance' form below appears after clicking the '+ Unplanned W\.O' button. (Ref Figure 44)
    
    * Enter all required job details in Part A and click Save to store it as a draft. Then complete Part B and click Submit Work Order to generate the unplanned work order. (Ref Figure 44)
    
    Screenshot of the Work Order Form - Unplanned showing the Save button highlighted with "Click the Save button to save it as a draft" and the Submit Work Order button highlighted with "After filling the form, click here to create an unplanned work order."
    
    Figure 44
    
    Page 29 of 64
    ```
  - [3] Technical - PMS User Manual For Office_Sail Admin_R2_08.06.2026.pdf · 1.1.5.6 HOW TO COMPLETE THE WORK ORDER (p.32) · 1173 chars · d=0.7731
    ```
    * Go to the 'Work Orders' sub-sub module. (Ref Figure 49)
    
    * Select the vessel from the 'Vessel' dropdown. (Ref Figure 49)
    
    * Click the required status tab (Scheduled, Due, Overdue, Postponed, or Unplanned). (Ref Figure 49)
    
    * Then select the work order by clicking the 'Edit' icon or the table row. (Ref Figure 49)
    
    Screenshot of the Work Orders (W\.O) dashboard with four callout boxes: 1. Click on the 'Work Order'. 2. Click here to select a vessel. 3. Choose the required field from the status tab that needs to be completed. 4. The work order form can be opened by clicking the 'Edit' icon or selecting the table row.
    
    Figure 49
    
    * The 'Work Order Form' appears after clicking the 'Edit' icon. (Ref Figure 50)
    
    * Navigate to 'Part B – Work Completion Record', enter the required information. (Ref Figure 50)
    
    Screenshot of the Part B - Work Completion Record form with three callout boxes: 1. Click here to open the 'Part B' section and enter the required details. 2. From here, the user can upload the docs. 3. Use this section to add or select quick inputs and smart suggestions.
    
    Figure 50
    
    \* To upload RA documents, ensure the radio button is not set to NA or No.
    ```
  - [4] Technical - PMS User Manual_Vessel Specific_R3_08.07.2026.pdf · 1.1.5.2 HOW TO CREATE AN UNPLANNED WORK ORDER (p.24) · 681 chars · d=0.7877
    ```
    * Go to the 'Work Orders' sub-sub module. (Ref Figure 33)
    
    * Click on the '+ Unplanned W\.O' button to create an unplanned work order. (Ref Figure 33)
    
    screenshot: Work Orders dashboard showing navigation to Work Orders and the Unplanned W\.O button
    
    Figure 33
    
    * The 'Work Order Form – Unplanned Maintenance' form below appears after clicking the '+ Unplanned W\.O' button. (Ref Figure 34)
    
    * Enter all required job details in Part A and click Save to store it as a draft. Then complete Part B and click Submit Work Order to generate the unplanned work order. (Ref Figure 34)
    
    screenshot: Work Order Form - Unplanned showing the Save button and Submit Work Order button
    
    Figure 34
    ```
  - [5] Technical - PMS User Manual_Vessel Specific_R3_08.07.2026.pdf · Introduction (p.23) · 318 chars · d=0.7931
    ```
    * Work Orders (WO) is a structured instruction used onboard to plan, execute, and record maintenance activities for equipment and systems. It serves as the primary control mechanism to ensure that all maintenance tasks are carried out systematically, safely, and in compliance with company and regulatory requirements.
    ```

## wo-generic-03 · A-kb-base · run 2 → **RETRIEVAL**
- question: How to create work order in PMS?
- judge: answer=False citation=True rule=False — automatic generation MISSING; pairing ✗: Generate Now not described; per-job Generate WO not described
- classification note: none of the dropped items is in the supplied text; also literal must-phrase absent: ['generate wo']
- citations returned by this run: ['Technical - PMS User Manual For Office_Sail Admin_R2_08.06.2026', 'Technical - PMS User Manual_Vessel Specific_R3_08.07.2026']  (all within the probe's hit list)
- answer (full): To create an unplanned work order in PMS, follow these steps: 1. Go to the 'Work Orders' sub-sub module. 2. Select the vessel from the 'Vessel' dropdown. 3. Click on the '+ Unplanned W.O' button to create an unplanned work order. 4. The 'Work Order Form – Unplanned Maintenance' will appear. 5. Enter all required job details in Part A and click Save to store it as a draft. 6. Complete Part B and click Submit Work Order to generate the unplanned work order. These steps are the same as in section 1.1.5.2 (page 29) of the manual. Source: Technical - PMS User Manual For Office_Sail Admin_R2_08.06.2026 — 1.1.5.2 HOW TO CREATE AN UNPLANNED WORK ORDER (p.29)
- excerpt text: same as run 1 of wo-generic-03 on A-kb-base (above)

## wo-generic-03 · A-kb-base · run 3 → **RETRIEVAL**
- question: How to create work order in PMS?
- judge: answer=False citation=True rule=False — automatic generation MISSING; pairing ✗: Generate Now not described; per-job Generate WO not described
- classification note: none of the dropped items is in the supplied text; also literal must-phrase absent: ['generate wo']
- citations returned by this run: ['Technical - PMS User Manual For Office_Sail Admin_R2_08.06.2026', 'Technical - PMS User Manual_Vessel Specific_R3_08.07.2026']  (all within the probe's hit list)
- answer (full): To create an unplanned work order in PMS, follow these steps: 1. Go to the 'Work Orders' sub-sub module. 2. Select the vessel from the 'Vessel' dropdown. 3. Click on the '+ Unplanned W.O' button to create an unplanned work order. 4. The 'Work Order Form – Unplanned Maintenance' will appear. 5. Enter all required job details in Part A and click Save to store it as a draft. 6. Complete Part B and click Submit Work Order to generate the unplanned work order. These steps are the same as section 1.1.5.2 (page 29) in the manual. Source: Technical - PMS User Manual For Office_Sail Admin_R2_08.06.2026 — 1.1.5.2 HOW TO CREATE AN UNPLANNED WORK ORDER (p.29)
- excerpt text: same as run 1 of wo-generic-03 on A-kb-base (above)

## wo-generic-03 · B-kb-pilot · run 1 → **RETRIEVAL**
- question: How to create work order in PMS?
- judge: answer=False citation=True rule=False — automatic generation MISSING; pairing ✗: Generate Now not described; per-job Generate WO not described
- classification note: none of the dropped items is in the supplied text; also literal must-phrase absent: ['generate wo']
- citations returned by this run: ['Technical - PMS User Manual For Office_Sail Admin_R2_08.06.2026', 'Technical - PMS User Manual_Vessel Specific_R3_08.07.2026']  (all within the probe's hit list)
- answer (full): To create an unplanned work order in PMS, follow these steps: 1. Go to the 'Work Orders' sub-sub module. 2. Select the vessel from the 'Vessel' dropdown. 3. Click on the '+ Unplanned W.O' button to create an unplanned work order. 4. The 'Work Order Form – Unplanned Maintenance' will appear. 5. Enter all required job details in Part A and click Save to store it as a draft. 6. Complete Part B and click Submit Work Order to generate the unplanned work order. These steps are the same as in section 1.1.5.2 (page 29) of the manual. Source: Technical - PMS User Manual For Office_Sail Admin_R2_08.06.2026 — 1.1.5.2 HOW TO CREATE AN UNPLANNED WORK ORDER (p.29)
- **excerpt text supplied for this question on B-kb-pilot (identical for runs 1–3):**
  - [1] Technical - PMS User Manual For Office_Sail Admin_R2_08.06.2026.pdf · Introduction (p.28) · 319 chars · d=0.7328
    ```
    * Work Orders (WO) are a structured instruction used onboard to plan, execute, and record maintenance activities for equipment and systems. It serves as the primary control mechanism to ensure that all maintenance tasks are carried out systematically, safely, and in compliance with company and regulatory requirements.
    ```
  - [2] Technical - PMS User Manual For Office_Sail Admin_R2_08.06.2026.pdf · 1.1.5.2 HOW TO CREATE AN UNPLANNED WORK ORDER (p.29) · 1026 chars · d=0.7514
    ```
    * Go to the 'Work Orders' sub-sub module. (Ref Figure 43)
    
    * Select the vessel from the 'Vessel' dropdown. (Ref Figure 43)
    
    * Click on the '+ Unplanned W\.O' button to create an unplanned work order. (Ref Figure 43)
    
    Screenshot of the Work Orders (W\.O) dashboard showing three steps: 1. Click here to access the 'Work Orders', 2. Click here to select a vessel, and 3. Click here to open an unplanned work order form.
    
    Figure 43
    
    * The 'Work Order Form – Unplanned Maintenance' form below appears after clicking the '+ Unplanned W\.O' button. (Ref Figure 44)
    
    * Enter all required job details in Part A and click Save to store it as a draft. Then complete Part B and click Submit Work Order to generate the unplanned work order. (Ref Figure 44)
    
    Screenshot of the Work Order Form - Unplanned showing the Save button highlighted with "Click the Save button to save it as a draft" and the Submit Work Order button highlighted with "After filling the form, click here to create an unplanned work order."
    
    Figure 44
    
    Page 29 of 64
    ```
  - [3] Technical - PMS User Manual For Office_Sail Admin_R2_08.06.2026.pdf · 1.1.5.6 HOW TO COMPLETE THE WORK ORDER (p.32) · 1173 chars · d=0.7731
    ```
    * Go to the 'Work Orders' sub-sub module. (Ref Figure 49)
    
    * Select the vessel from the 'Vessel' dropdown. (Ref Figure 49)
    
    * Click the required status tab (Scheduled, Due, Overdue, Postponed, or Unplanned). (Ref Figure 49)
    
    * Then select the work order by clicking the 'Edit' icon or the table row. (Ref Figure 49)
    
    Screenshot of the Work Orders (W\.O) dashboard with four callout boxes: 1. Click on the 'Work Order'. 2. Click here to select a vessel. 3. Choose the required field from the status tab that needs to be completed. 4. The work order form can be opened by clicking the 'Edit' icon or selecting the table row.
    
    Figure 49
    
    * The 'Work Order Form' appears after clicking the 'Edit' icon. (Ref Figure 50)
    
    * Navigate to 'Part B – Work Completion Record', enter the required information. (Ref Figure 50)
    
    Screenshot of the Part B - Work Completion Record form with three callout boxes: 1. Click here to open the 'Part B' section and enter the required details. 2. From here, the user can upload the docs. 3. Use this section to add or select quick inputs and smart suggestions.
    
    Figure 50
    
    \* To upload RA documents, ensure the radio button is not set to NA or No.
    ```
  - [4] Technical - PMS User Manual_Vessel Specific_R3_08.07.2026.pdf · 1.1.5.2 HOW TO CREATE AN UNPLANNED WORK ORDER (p.24) · 681 chars · d=0.7877
    ```
    * Go to the 'Work Orders' sub-sub module. (Ref Figure 33)
    
    * Click on the '+ Unplanned W\.O' button to create an unplanned work order. (Ref Figure 33)
    
    screenshot: Work Orders dashboard showing navigation to Work Orders and the Unplanned W\.O button
    
    Figure 33
    
    * The 'Work Order Form – Unplanned Maintenance' form below appears after clicking the '+ Unplanned W\.O' button. (Ref Figure 34)
    
    * Enter all required job details in Part A and click Save to store it as a draft. Then complete Part B and click Submit Work Order to generate the unplanned work order. (Ref Figure 34)
    
    screenshot: Work Order Form - Unplanned showing the Save button and Submit Work Order button
    
    Figure 34
    ```
  - [5] Technical - PMS User Manual_Vessel Specific_R3_08.07.2026.pdf · Introduction (p.23) · 318 chars · d=0.7931
    ```
    * Work Orders (WO) is a structured instruction used onboard to plan, execute, and record maintenance activities for equipment and systems. It serves as the primary control mechanism to ensure that all maintenance tasks are carried out systematically, safely, and in compliance with company and regulatory requirements.
    ```

## wo-generic-03 · B-kb-pilot · run 2 → **RETRIEVAL**
- question: How to create work order in PMS?
- judge: answer=False citation=True rule=False — automatic generation MISSING; pairing ✗: Generate Now not described; per-job Generate WO not described
- classification note: none of the dropped items is in the supplied text; also literal must-phrase absent: ['generate wo']
- citations returned by this run: ['Technical - PMS User Manual For Office_Sail Admin_R2_08.06.2026', 'Technical - PMS User Manual_Vessel Specific_R3_08.07.2026']  (all within the probe's hit list)
- answer (full): To create an unplanned work order in PMS, follow these steps: 1. Go to the 'Work Orders' sub-sub module. 2. Select the vessel from the 'Vessel' dropdown. 3. Click on the '+ Unplanned W.O' button to create an unplanned work order. 4. The 'Work Order Form – Unplanned Maintenance' will appear. 5. Enter all required job details in Part A and click Save to store it as a draft. 6. Complete Part B and click Submit Work Order to generate the unplanned work order. These steps are the same as those in section 1.1.5.2 (page 29) of the manual. Source: Technical - PMS User Manual For Office_Sail Admin_R2_08.06.2026 — 1.1.5.2 HOW TO CREATE AN UNPLANNED WORK ORDER (p.29)
- excerpt text: same as run 1 of wo-generic-03 on B-kb-pilot (above)

## wo-generic-03 · B-kb-pilot · run 3 → **RETRIEVAL**
- question: How to create work order in PMS?
- judge: answer=False citation=True rule=False — automatic generation MISSING; pairing ✗: Generate Now not described; per-job Generate WO not described
- classification note: none of the dropped items is in the supplied text; also literal must-phrase absent: ['generate wo']
- citations returned by this run: ['Technical - PMS User Manual For Office_Sail Admin_R2_08.06.2026', 'Technical - PMS User Manual_Vessel Specific_R3_08.07.2026']  (all within the probe's hit list)
- answer (full): To create an unplanned work order in PMS, follow these steps: 1. Go to the 'Work Orders' sub-sub module. 2. Select the vessel from the 'Vessel' dropdown. 3. Click on the '+ Unplanned W.O' button to create an unplanned work order. 4. The 'Work Order Form – Unplanned Maintenance' will appear. 5. Enter all required job details in Part A and click Save to store it as a draft. 6. Complete Part B and click Submit Work Order to generate the unplanned work order. These steps are the same as in section 1.1.5.2 (page 29) of the manual. Source: Technical - PMS User Manual For Office_Sail Admin_R2_08.06.2026, section 1.1.5.2.
- excerpt text: same as run 1 of wo-generic-03 on B-kb-pilot (above)

## wo-phr-01 · A-kb-base · run 1 → **RETRIEVAL**
- question: What are the different ways to create a work order in PMS?
- judge: answer=False citation=True rule=False — automatic generation MISSING; pairing ✗: Generate Now not described; per-job Generate WO not described
- classification note: none of the dropped items is in the supplied text; also literal must-phrase absent: ['generate wo']
- citations returned by this run: ['Technical - PMS User Manual For Office_Sail Admin_R2_08.06.2026', 'Technical - PMS User Manual_Vessel Specific_R3_08.07.2026']  (all within the probe's hit list)
- answer (full): The different ways to create a work order in PMS are: 1. **Create an Unplanned Work Order**: - Go to the 'Work Orders' sub-sub module. - Select the vessel from the 'Vessel' dropdown. - Click on the '+ Unplanned W.O' button to create an unplanned work order. - Enter all required job details in Part A and click Save to store it as a draft. - Complete Part B and click Submit Work Order to generate the unplanned work order. 2. **(Note: The documentation does not specify other types of work orders beyond unplanned work orders.)** Source: Technical - PMS User Manual For Office_Sail Admin_R2_08.06.2026, sections 1.1.5.2; Technical - PMS User Manual_Vessel Specific_R3_08.07.2026, sections 1.1.5.2.
- **excerpt text supplied for this question on A-kb-base (identical for runs 1–3):**
  - [1] Technical - PMS User Manual For Office_Sail Admin_R2_08.06.2026.pdf · Introduction (p.28) · 319 chars · d=0.8108
    ```
    * Work Orders (WO) are a structured instruction used onboard to plan, execute, and record maintenance activities for equipment and systems. It serves as the primary control mechanism to ensure that all maintenance tasks are carried out systematically, safely, and in compliance with company and regulatory requirements.
    ```
  - [2] Technical - PMS User Manual For Office_Sail Admin_R2_08.06.2026.pdf · 1.1.5.2 HOW TO CREATE AN UNPLANNED WORK ORDER (p.29) · 1026 chars · d=0.8423
    ```
    * Go to the 'Work Orders' sub-sub module. (Ref Figure 43)
    
    * Select the vessel from the 'Vessel' dropdown. (Ref Figure 43)
    
    * Click on the '+ Unplanned W\.O' button to create an unplanned work order. (Ref Figure 43)
    
    Screenshot of the Work Orders (W\.O) dashboard showing three steps: 1. Click here to access the 'Work Orders', 2. Click here to select a vessel, and 3. Click here to open an unplanned work order form.
    
    Figure 43
    
    * The 'Work Order Form – Unplanned Maintenance' form below appears after clicking the '+ Unplanned W\.O' button. (Ref Figure 44)
    
    * Enter all required job details in Part A and click Save to store it as a draft. Then complete Part B and click Submit Work Order to generate the unplanned work order. (Ref Figure 44)
    
    Screenshot of the Work Order Form - Unplanned showing the Save button highlighted with "Click the Save button to save it as a draft" and the Submit Work Order button highlighted with "After filling the form, click here to create an unplanned work order."
    
    Figure 44
    
    Page 29 of 64
    ```
  - [3] Technical - PMS User Manual_Vessel Specific_R3_08.07.2026.pdf · 1.1.5.2 HOW TO CREATE AN UNPLANNED WORK ORDER (p.24) · 681 chars · d=0.8654
    ```
    * Go to the 'Work Orders' sub-sub module. (Ref Figure 33)
    
    * Click on the '+ Unplanned W\.O' button to create an unplanned work order. (Ref Figure 33)
    
    screenshot: Work Orders dashboard showing navigation to Work Orders and the Unplanned W\.O button
    
    Figure 33
    
    * The 'Work Order Form – Unplanned Maintenance' form below appears after clicking the '+ Unplanned W\.O' button. (Ref Figure 34)
    
    * Enter all required job details in Part A and click Save to store it as a draft. Then complete Part B and click Submit Work Order to generate the unplanned work order. (Ref Figure 34)
    
    screenshot: Work Order Form - Unplanned showing the Save button and Submit Work Order button
    
    Figure 34
    ```
  - [4] Technical - PMS User Manual_Vessel Specific_R3_08.07.2026.pdf · Introduction (p.23) · 318 chars · d=0.8664
    ```
    * Work Orders (WO) is a structured instruction used onboard to plan, execute, and record maintenance activities for equipment and systems. It serves as the primary control mechanism to ensure that all maintenance tasks are carried out systematically, safely, and in compliance with company and regulatory requirements.
    ```
  - [5] Technical - PMS User Manual For Office_Sail Admin_R2_08.06.2026.pdf · 1.1.5.6 HOW TO COMPLETE THE WORK ORDER (p.32) · 1173 chars · d=0.8681
    ```
    * Go to the 'Work Orders' sub-sub module. (Ref Figure 49)
    
    * Select the vessel from the 'Vessel' dropdown. (Ref Figure 49)
    
    * Click the required status tab (Scheduled, Due, Overdue, Postponed, or Unplanned). (Ref Figure 49)
    
    * Then select the work order by clicking the 'Edit' icon or the table row. (Ref Figure 49)
    
    Screenshot of the Work Orders (W\.O) dashboard with four callout boxes: 1. Click on the 'Work Order'. 2. Click here to select a vessel. 3. Choose the required field from the status tab that needs to be completed. 4. The work order form can be opened by clicking the 'Edit' icon or selecting the table row.
    
    Figure 49
    
    * The 'Work Order Form' appears after clicking the 'Edit' icon. (Ref Figure 50)
    
    * Navigate to 'Part B – Work Completion Record', enter the required information. (Ref Figure 50)
    
    Screenshot of the Part B - Work Completion Record form with three callout boxes: 1. Click here to open the 'Part B' section and enter the required details. 2. From here, the user can upload the docs. 3. Use this section to add or select quick inputs and smart suggestions.
    
    Figure 50
    
    \* To upload RA documents, ensure the radio button is not set to NA or No.
    ```

## wo-phr-01 · A-kb-base · run 2 → **RETRIEVAL**
- question: What are the different ways to create a work order in PMS?
- judge: answer=False citation=True rule=False — automatic generation MISSING; pairing ✗: Generate Now not described; per-job Generate WO not described
- classification note: none of the dropped items is in the supplied text; also literal must-phrase absent: ['unplanned w.o', 'generate wo']
- citations returned by this run: ['Technical - PMS User Manual For Office_Sail Admin_R2_08.06.2026', 'Technical - PMS User Manual_Vessel Specific_R3_08.07.2026']  (all within the probe's hit list)
- answer (full): The different ways to create a work order in PMS are as follows: 1. **Unplanned Work Order**: - Go to the 'Work Orders' sub-sub module. - Select the vessel from the 'Vessel' dropdown. - Click on the '+ Unplanned W\.O' button to create an unplanned work order. - The 'Work Order Form – Unplanned Maintenance' form appears. - Enter all required job details in Part A and click Save to store it as a draft. - Complete Part B and click Submit Work Order to generate the unplanned work order. (Cross-reference resolved: the steps for creating an unplanned work order are the same as section 1.1.5.2 in the Vessel Specific manual, page 24.) Source: Technical - PMS User Manual For Office_Sail Admin_R2_08.06.2026 — 1.1.5.2; Technical - PMS User Manual_Vessel Specific_R3_08.07.2026 — 1.1.5.2.
- excerpt text: same as run 1 of wo-phr-01 on A-kb-base (above)

## wo-phr-01 · A-kb-base · run 3 → **RETRIEVAL**
- question: What are the different ways to create a work order in PMS?
- judge: answer=False citation=True rule=False — automatic generation MISSING; pairing ✗: Generate Now not described; per-job Generate WO not described
- classification note: none of the dropped items is in the supplied text; also literal must-phrase absent: ['unplanned w.o', 'generate wo']
- citations returned by this run: ['Technical - PMS User Manual For Office_Sail Admin_R2_08.06.2026', 'Technical - PMS User Manual_Vessel Specific_R3_08.07.2026']  (all within the probe's hit list)
- answer (full): The different ways to create a work order in PMS are as follows: 1. **Create an Unplanned Work Order:** - Go to the 'Work Orders' sub-sub module. - Select the vessel from the 'Vessel' dropdown. - Click on the '+ Unplanned W\.O' button to create an unplanned work order. - Enter all required job details in Part A and click Save to store it as a draft. - Complete Part B and click Submit Work Order to generate the unplanned work order. (Cross-reference resolved: the steps for creating an unplanned work order are the same as section 1.1.5.2 in the Vessel Specific manual, page 24.) Source: Technical - PMS User Manual For Office_Sail Admin_R2_08.06.2026, sections 1.1.5.2; Technical - PMS User Manual_Vessel Specific_R3_08.07.2026, sections 1.1.5.2.
- excerpt text: same as run 1 of wo-phr-01 on A-kb-base (above)

## wo-phr-01 · B-kb-pilot · run 1 → **ANSWER GENERATION**
- question: What are the different ways to create a work order in PMS?
- judge: answer=True citation=True rule=False — automatic generation ✓; pairing ✗: Generate WO block lacks the vessel switch
- classification note: every dropped item is in the supplied text
- citations returned by this run: ['Technical - KB pilot: How work orders are created — the three ways to create a work order.md', 'Technical - PMS User Manual For Office_Sail Admin_R2_08.06.2026', 'Technical - PMS User Manual_Vessel Specific_R3_08.07.2026']  (all within the probe's hit list)
- answer (full): 1. **Planned (scheduled) work orders**: - Automatically generated by the system based on each job's frequency and next due date. - On the ship, this occurs once a day without user action. - In the office, a Sail Admin can click 'Generate Now' on the Work Orders screen if the vessel's switch is ON. 2. **One job on demand**: - Navigate to Components → select the vessel → open the component → Part C → click 'Generate WO' → choose the reason (Planning / Breakdown / Other). - No role check applies, but the job must be active and not already have an active work order. 3. **Unplanned work**: - Go to Work Orders → select the vessel → click '+ Unplanned W.O' → enter details in Part A and click Save → complete Part B and click Submit Work Order. - No role check applies, and no switch is needed. Source: [1] (Technical - KB pilot: How work orders are created — the three ways to create a work order.md)
- **excerpt text supplied for this question on B-kb-pilot (identical for runs 1–3):**
  - [1] Technical - KB pilot: How work orders are created — the three ways to create a work order.md · How work orders are created — the three ways to create a work order · 2044 chars · d=0.7935
    ```
    Applies to: Both
    Who can do it (role): Depends on the way — (1) planned: nobody, the ship system creates them; office 'Generate Now': Sail Admin only; (2) per-job 'Generate WO': no role check; (3) unplanned: no role check. Normal sign-in and vessel access apply to all.
    Prerequisites (switches, settings, job/component state): Office 'Generate Now' and office per-job 'Generate WO' both need the vessel's 'office work-order generation' switch ON (off by default, set by a Sail Admin on 'Lead Time & Grace Period Settings'). Unplanned needs no switch. A job with an active work order cannot get another one.
    Steps:
    1. Planned (scheduled) work orders — generated by the system from each job's frequency and next due date. ON THE SHIP: automatic, once a day, no user action. IN THE OFFICE: nothing runs automatically; a Sail Admin can click 'Generate Now' on the Work Orders screen for one vessel, only if that vessel's switch is on. Details: planned-wo-ship-daily-scan.md and office-generate-now.md.
    2. One job on demand — Components → (Office: select the vessel) → open the component → Part C → 'Generate WO' → choose the reason (Planning / Breakdown / Other). No role check on this path (sign-in and vessel access still apply); in the office only if the vessel switch is on; the job must be active and must not already have an active work order. Details: office-generate-wo-per-job.md.
    3. Unplanned work — Work Orders → (Office: select the vessel) → '+ Unplanned W.O' → Part A, Save → Part B, Submit Work Order. No role check on this path, no switch. Details: unplanned-wo.md.
    Exceptions / edge cases: The Sail Admin requirement belongs to 'Generate Now' only; it does not apply to per-job 'Generate WO' or to unplanned work orders.
    Where the manual differs: The June manuals describe only ways 2 and 3 and state no office conditions; automatic ship generation and 'Generate Now' are absent from them. See CONFLICTS.md.
    Related procedures: planned-wo-ship-daily-scan.md · office-generate-now.md · office-generate-wo-per-job.md · unplanned-wo.md
    ```
  - [2] Technical - PMS User Manual For Office_Sail Admin_R2_08.06.2026.pdf · Introduction (p.28) · 319 chars · d=0.8108
    ```
    * Work Orders (WO) are a structured instruction used onboard to plan, execute, and record maintenance activities for equipment and systems. It serves as the primary control mechanism to ensure that all maintenance tasks are carried out systematically, safely, and in compliance with company and regulatory requirements.
    ```
  - [3] Technical - PMS User Manual For Office_Sail Admin_R2_08.06.2026.pdf · 1.1.5.2 HOW TO CREATE AN UNPLANNED WORK ORDER (p.29) · 1026 chars · d=0.8423
    ```
    * Go to the 'Work Orders' sub-sub module. (Ref Figure 43)
    
    * Select the vessel from the 'Vessel' dropdown. (Ref Figure 43)
    
    * Click on the '+ Unplanned W\.O' button to create an unplanned work order. (Ref Figure 43)
    
    Screenshot of the Work Orders (W\.O) dashboard showing three steps: 1. Click here to access the 'Work Orders', 2. Click here to select a vessel, and 3. Click here to open an unplanned work order form.
    
    Figure 43
    
    * The 'Work Order Form – Unplanned Maintenance' form below appears after clicking the '+ Unplanned W\.O' button. (Ref Figure 44)
    
    * Enter all required job details in Part A and click Save to store it as a draft. Then complete Part B and click Submit Work Order to generate the unplanned work order. (Ref Figure 44)
    
    Screenshot of the Work Order Form - Unplanned showing the Save button highlighted with "Click the Save button to save it as a draft" and the Submit Work Order button highlighted with "After filling the form, click here to create an unplanned work order."
    
    Figure 44
    
    Page 29 of 64
    ```
  - [4] Technical - PMS User Manual_Vessel Specific_R3_08.07.2026.pdf · 1.1.5.2 HOW TO CREATE AN UNPLANNED WORK ORDER (p.24) · 681 chars · d=0.8654
    ```
    * Go to the 'Work Orders' sub-sub module. (Ref Figure 33)
    
    * Click on the '+ Unplanned W\.O' button to create an unplanned work order. (Ref Figure 33)
    
    screenshot: Work Orders dashboard showing navigation to Work Orders and the Unplanned W\.O button
    
    Figure 33
    
    * The 'Work Order Form – Unplanned Maintenance' form below appears after clicking the '+ Unplanned W\.O' button. (Ref Figure 34)
    
    * Enter all required job details in Part A and click Save to store it as a draft. Then complete Part B and click Submit Work Order to generate the unplanned work order. (Ref Figure 34)
    
    screenshot: Work Order Form - Unplanned showing the Save button and Submit Work Order button
    
    Figure 34
    ```
  - [5] Technical - PMS User Manual_Vessel Specific_R3_08.07.2026.pdf · Introduction (p.23) · 318 chars · d=0.8664
    ```
    * Work Orders (WO) is a structured instruction used onboard to plan, execute, and record maintenance activities for equipment and systems. It serves as the primary control mechanism to ensure that all maintenance tasks are carried out systematically, safely, and in compliance with company and regulatory requirements.
    ```

## wo-phr-01 · B-kb-pilot · run 2 → **ANSWER GENERATION**
- question: What are the different ways to create a work order in PMS?
- judge: answer=True citation=True rule=False — automatic generation ✓; pairing ✗: Generate WO block lacks the vessel switch
- classification note: every dropped item is in the supplied text
- citations returned by this run: ['Technical - KB pilot: How work orders are created — the three ways to create a work order.md', 'Technical - PMS User Manual For Office_Sail Admin_R2_08.06.2026', 'Technical - PMS User Manual_Vessel Specific_R3_08.07.2026']  (all within the probe's hit list)
- answer (full): 1. **Planned (scheduled) work orders**: - Generated automatically by the system from each job's frequency and next due date on the ship once a day, with no user action required. - In the office, a Sail Admin can click 'Generate Now' on the Work Orders screen for one vessel, only if that vessel's switch is ON. 2. **One job on demand**: - Navigate to Components → (Office: select the vessel) → open the component → Part C → click 'Generate WO' → choose the reason (Planning / Breakdown / Other). - No role check applies, but the job must be active and must not already have an active work order. 3. **Unplanned work**: - Go to Work Orders → (Office: select the vessel) → click '+ Unplanned W.O' → enter details in Part A and click Save → complete Part B and click Submit Work Order. - No role check applies, and no switch is needed. Source: [1] (How work orders are created — the three ways to create a work order)
- excerpt text: same as run 1 of wo-phr-01 on B-kb-pilot (above)

## wo-phr-01 · B-kb-pilot · run 3 → **ANSWER GENERATION**
- question: What are the different ways to create a work order in PMS?
- judge: answer=True citation=True rule=False — automatic generation ✓; pairing ✗: Generate WO block lacks the vessel switch
- classification note: every dropped item is in the supplied text
- citations returned by this run: ['Technical - KB pilot: How work orders are created — the three ways to create a work order.md', 'Technical - PMS User Manual For Office_Sail Admin_R2_08.06.2026', 'Technical - PMS User Manual_Vessel Specific_R3_08.07.2026']  (all within the probe's hit list)
- answer (full): 1. **Planned (scheduled) work orders**: - Generated automatically by the system once a day on the ship. - In the office, a Sail Admin can click 'Generate Now' on the Work Orders screen if the vessel's switch is ON. 2. **One job on demand**: - Navigate to Components → (Office: select the vessel) → open the component → Part C → click 'Generate WO' → choose the reason (Planning / Breakdown / Other). 3. **Unplanned work**: - Go to Work Orders → (Office: select the vessel) → click '+ Unplanned W.O' → fill out Part A, Save → complete Part B, Submit Work Order. Source: [1] (Technical - KB pilot: How work orders are created)
- excerpt text: same as run 1 of wo-phr-01 on B-kb-pilot (above)

## wo-phr-02 · A-kb-base · run 1 → **RETRIEVAL**
- question: I need to raise a work order for a pump — how do I do that?
- judge: answer=True citation=True rule=False — unplanned procedure ✓; note of the other ways MISSING
- classification note: none of the dropped items is in the supplied text
- citations returned by this run: ['Technical - PMS User Manual For Office_Sail Admin_R2_08.06.2026', 'Technical - PMS User Manual_Vessel Specific_R3_08.07.2026']  (all within the probe's hit list)
- answer (full): 1. Go to the 'Work Orders' sub-sub module. 2. Select the vessel from the 'Vessel' dropdown. 3. Click on the '+ Unplanned W.O' button to create an unplanned work order. 4. The 'Work Order Form – Unplanned Maintenance' form will appear. 5. Enter all required job details in Part A and click Save to store it as a draft. 6. Complete Part B and click Submit Work Order to generate the unplanned work order. Source: Technical - PMS User Manual For Office_Sail Admin_R2_08.06.2026 — 1.1.5.2 HOW TO CREATE AN UNPLANNED WORK ORDER (p.29)
- **excerpt text supplied for this question on A-kb-base (identical for runs 1–3):**
  - [1] Technical - PMS User Manual For Office_Sail Admin_R2_08.06.2026.pdf · 1.1.5.2 HOW TO CREATE AN UNPLANNED WORK ORDER (p.29) · 1026 chars · d=1.0135
    ```
    * Go to the 'Work Orders' sub-sub module. (Ref Figure 43)
    
    * Select the vessel from the 'Vessel' dropdown. (Ref Figure 43)
    
    * Click on the '+ Unplanned W\.O' button to create an unplanned work order. (Ref Figure 43)
    
    Screenshot of the Work Orders (W\.O) dashboard showing three steps: 1. Click here to access the 'Work Orders', 2. Click here to select a vessel, and 3. Click here to open an unplanned work order form.
    
    Figure 43
    
    * The 'Work Order Form – Unplanned Maintenance' form below appears after clicking the '+ Unplanned W\.O' button. (Ref Figure 44)
    
    * Enter all required job details in Part A and click Save to store it as a draft. Then complete Part B and click Submit Work Order to generate the unplanned work order. (Ref Figure 44)
    
    Screenshot of the Work Order Form - Unplanned showing the Save button highlighted with "Click the Save button to save it as a draft" and the Submit Work Order button highlighted with "After filling the form, click here to create an unplanned work order."
    
    Figure 44
    
    Page 29 of 64
    ```
  - [2] Technical - PMS User Manual_Vessel Specific_R3_08.07.2026.pdf · 1.1.5.2 HOW TO CREATE AN UNPLANNED WORK ORDER (p.24) · 681 chars · d=1.0188
    ```
    * Go to the 'Work Orders' sub-sub module. (Ref Figure 33)
    
    * Click on the '+ Unplanned W\.O' button to create an unplanned work order. (Ref Figure 33)
    
    screenshot: Work Orders dashboard showing navigation to Work Orders and the Unplanned W\.O button
    
    Figure 33
    
    * The 'Work Order Form – Unplanned Maintenance' form below appears after clicking the '+ Unplanned W\.O' button. (Ref Figure 34)
    
    * Enter all required job details in Part A and click Save to store it as a draft. Then complete Part B and click Submit Work Order to generate the unplanned work order. (Ref Figure 34)
    
    screenshot: Work Order Form - Unplanned showing the Save button and Submit Work Order button
    
    Figure 34
    ```
  - [3] Technical - PMS User Manual_Vessel Specific_R3_08.07.2026.pdf · 1.1.5.6 HOW TO COMPLETE THE WORK ORDER (p.27) · 763 chars · d=1.0503
    ```
    * Go to the 'Work Orders' sub-sub module. (Ref Figure 39)
    
    * Click the required status tab (Scheduled, Due, Overdue, Postponed, or Unplanned). (Ref Figure 39)
    
    * Then select the work order by clicking the 'Edit' icon or the table row. (Ref Figure 39)
    
    screenshot: Work Orders (W\.O) dashboard showing status tabs and work order list with instructional callouts
    
    Figure 39
    
    * The 'Work Order Form' appears after clicking the 'Edit' icon. (Ref Figure 40)
    
    * Navigate to 'Part B – Work Completion Record', enter the required information. (Ref Figure 40)
    
    screenshot: Part B - Work Completion Record form showing risk assessment and work duration fields with instructional callouts
    
    Figure 40
    
    ☞ To upload RA documents, ensure the radio button is not set to NA or No.
    ```
  - [4] Technical - PMS User Manual For Office_Sail Admin_R2_08.06.2026.pdf · 1.1.5.6 HOW TO COMPLETE THE WORK ORDER (p.32) · 1173 chars · d=1.0545
    ```
    * Go to the 'Work Orders' sub-sub module. (Ref Figure 49)
    
    * Select the vessel from the 'Vessel' dropdown. (Ref Figure 49)
    
    * Click the required status tab (Scheduled, Due, Overdue, Postponed, or Unplanned). (Ref Figure 49)
    
    * Then select the work order by clicking the 'Edit' icon or the table row. (Ref Figure 49)
    
    Screenshot of the Work Orders (W\.O) dashboard with four callout boxes: 1. Click on the 'Work Order'. 2. Click here to select a vessel. 3. Choose the required field from the status tab that needs to be completed. 4. The work order form can be opened by clicking the 'Edit' icon or selecting the table row.
    
    Figure 49
    
    * The 'Work Order Form' appears after clicking the 'Edit' icon. (Ref Figure 50)
    
    * Navigate to 'Part B – Work Completion Record', enter the required information. (Ref Figure 50)
    
    Screenshot of the Part B - Work Completion Record form with three callout boxes: 1. Click here to open the 'Part B' section and enter the required details. 2. From here, the user can upload the docs. 3. Use this section to add or select quick inputs and smart suggestions.
    
    Figure 50
    
    \* To upload RA documents, ensure the radio button is not set to NA or No.
    ```
  - [5] Technical - PMS User Manual_Vessel Specific_R3_08.07.2026.pdf · Introduction (p.23) · 318 chars · d=1.0579
    ```
    * Work Orders (WO) is a structured instruction used onboard to plan, execute, and record maintenance activities for equipment and systems. It serves as the primary control mechanism to ensure that all maintenance tasks are carried out systematically, safely, and in compliance with company and regulatory requirements.
    ```

## wo-phr-02 · A-kb-base · run 2 → **RETRIEVAL**
- question: I need to raise a work order for a pump — how do I do that?
- judge: answer=True citation=True rule=False — unplanned procedure ✓; note of the other ways MISSING
- classification note: none of the dropped items is in the supplied text
- citations returned by this run: ['Technical - PMS User Manual For Office_Sail Admin_R2_08.06.2026', 'Technical - PMS User Manual_Vessel Specific_R3_08.07.2026']  (all within the probe's hit list)
- answer (full): To raise a work order for a pump, follow these steps: 1. Go to the 'Work Orders' sub-sub module. 2. Select the vessel from the 'Vessel' dropdown. 3. Click on the '+ Unplanned W.O' button to create an unplanned work order. 4. The 'Work Order Form – Unplanned Maintenance' form will appear. 5. Enter all required job details in Part A and click Save to store it as a draft. 6. Then complete Part B and click Submit Work Order to generate the unplanned work order. Source: Technical - PMS User Manual For Office_Sail Admin_R2_08.06.2026 — 1.1.5.2 HOW TO CREATE AN UNPLANNED WORK ORDER (p.29) and Technical - PMS User Manual_Vessel Specific_R3_08.07.2026 — 1.1.5.2 HOW TO CREATE AN UNPLANNED WORK ORDER (p.24).
- excerpt text: same as run 1 of wo-phr-02 on A-kb-base (above)

## wo-phr-02 · A-kb-base · run 3 → **RETRIEVAL**
- question: I need to raise a work order for a pump — how do I do that?
- judge: answer=True citation=True rule=False — unplanned procedure ✓; note of the other ways MISSING
- classification note: none of the dropped items is in the supplied text
- citations returned by this run: ['Technical - PMS User Manual For Office_Sail Admin_R2_08.06.2026', 'Technical - PMS User Manual_Vessel Specific_R3_08.07.2026']  (all within the probe's hit list)
- answer (full): To raise a work order for a pump, follow these steps: 1. Go to the 'Work Orders' sub-sub module. 2. Select the vessel from the 'Vessel' dropdown. 3. Click on the '+ Unplanned W.O' button to create an unplanned work order. 4. The 'Work Order Form – Unplanned Maintenance' form will appear. 5. Enter all required job details in Part A and click Save to store it as a draft. 6. Complete Part B and click Submit Work Order to generate the unplanned work order. Source: Technical - PMS User Manual For Office_Sail Admin_R2_08.06.2026 — 1.1.5.2 HOW TO CREATE AN UNPLANNED WORK ORDER (p.29) and Technical - PMS User Manual_Vessel Specific_R3_08.07.2026 — 1.1.5.2 HOW TO CREATE AN UNPLANNED WORK ORDER (p.24).
- excerpt text: same as run 1 of wo-phr-02 on A-kb-base (above)

## wo-phr-02 · B-kb-pilot · run 1 → **RETRIEVAL**
- question: I need to raise a work order for a pump — how do I do that?
- judge: answer=True citation=True rule=False — unplanned procedure ✓; note of the other ways MISSING
- classification note: none of the dropped items is in the supplied text
- citations returned by this run: ["Technical - KB pilot: Create an unplanned work order ('+ Unplanned W.O').md", 'Technical - PMS User Manual For Office_Sail Admin_R2_08.06.2026', 'Technical - PMS User Manual_Vessel Specific_R3_08.07.2026']  (all within the probe's hit list)
- answer (full): To create an unplanned work order for a pump, follow these steps: 1. Go to the 'Work Orders' sub-sub module. 2. Select the vessel from the 'Vessel' dropdown. 3. Click on the '+ Unplanned W.O' button to create an unplanned work order. 4. The 'Work Order Form – Unplanned Maintenance' will appear. Enter all required job details in Part A and click 'Save' to store it as a draft. 5. Complete Part B and click 'Submit Work Order' to generate the unplanned work order. Source: Technical - PMS User Manual For Office_Sail Admin_R2_08.06.2026 — 1.1.5.2 HOW TO CREATE AN UNPLANNED WORK ORDER (p.29) and Technical - PMS User Manual_Vessel Specific_R3_08.07.2026 — 1.1.5.2 HOW TO CREATE AN UNPLANNED WORK ORDER (p.24).
- **excerpt text supplied for this question on B-kb-pilot (identical for runs 1–3):**
  - [1] Technical - PMS User Manual For Office_Sail Admin_R2_08.06.2026.pdf · 1.1.5.2 HOW TO CREATE AN UNPLANNED WORK ORDER (p.29) · 1026 chars · d=1.0135
    ```
    * Go to the 'Work Orders' sub-sub module. (Ref Figure 43)
    
    * Select the vessel from the 'Vessel' dropdown. (Ref Figure 43)
    
    * Click on the '+ Unplanned W\.O' button to create an unplanned work order. (Ref Figure 43)
    
    Screenshot of the Work Orders (W\.O) dashboard showing three steps: 1. Click here to access the 'Work Orders', 2. Click here to select a vessel, and 3. Click here to open an unplanned work order form.
    
    Figure 43
    
    * The 'Work Order Form – Unplanned Maintenance' form below appears after clicking the '+ Unplanned W\.O' button. (Ref Figure 44)
    
    * Enter all required job details in Part A and click Save to store it as a draft. Then complete Part B and click Submit Work Order to generate the unplanned work order. (Ref Figure 44)
    
    Screenshot of the Work Order Form - Unplanned showing the Save button highlighted with "Click the Save button to save it as a draft" and the Submit Work Order button highlighted with "After filling the form, click here to create an unplanned work order."
    
    Figure 44
    
    Page 29 of 64
    ```
  - [2] Technical - PMS User Manual_Vessel Specific_R3_08.07.2026.pdf · 1.1.5.2 HOW TO CREATE AN UNPLANNED WORK ORDER (p.24) · 681 chars · d=1.0188
    ```
    * Go to the 'Work Orders' sub-sub module. (Ref Figure 33)
    
    * Click on the '+ Unplanned W\.O' button to create an unplanned work order. (Ref Figure 33)
    
    screenshot: Work Orders dashboard showing navigation to Work Orders and the Unplanned W\.O button
    
    Figure 33
    
    * The 'Work Order Form – Unplanned Maintenance' form below appears after clicking the '+ Unplanned W\.O' button. (Ref Figure 34)
    
    * Enter all required job details in Part A and click Save to store it as a draft. Then complete Part B and click Submit Work Order to generate the unplanned work order. (Ref Figure 34)
    
    screenshot: Work Order Form - Unplanned showing the Save button and Submit Work Order button
    
    Figure 34
    ```
  - [3] Technical - PMS User Manual_Vessel Specific_R3_08.07.2026.pdf · 1.1.5.6 HOW TO COMPLETE THE WORK ORDER (p.27) · 763 chars · d=1.0503
    ```
    * Go to the 'Work Orders' sub-sub module. (Ref Figure 39)
    
    * Click the required status tab (Scheduled, Due, Overdue, Postponed, or Unplanned). (Ref Figure 39)
    
    * Then select the work order by clicking the 'Edit' icon or the table row. (Ref Figure 39)
    
    screenshot: Work Orders (W\.O) dashboard showing status tabs and work order list with instructional callouts
    
    Figure 39
    
    * The 'Work Order Form' appears after clicking the 'Edit' icon. (Ref Figure 40)
    
    * Navigate to 'Part B – Work Completion Record', enter the required information. (Ref Figure 40)
    
    screenshot: Part B - Work Completion Record form showing risk assessment and work duration fields with instructional callouts
    
    Figure 40
    
    ☞ To upload RA documents, ensure the radio button is not set to NA or No.
    ```
  - [4] Technical - KB pilot: Create an unplanned work order ('+ Unplanned W.O').md · Create an unplanned work order ('+ Unplanned W.O') · 1572 chars · d=1.053
    ```
    Applies to: Both
    Who can do it (role): No role or switch check was found on this path; normal authentication and vessel access still apply (the user must be signed in and able to open the Work Orders page for that vessel).
    Prerequisites (switches, settings, job/component state):
    - None — no vessel switch is involved.
    - On the office instance a vessel must be selected from the 'Vessel' dropdown first.
    Steps:
    1. Go to the 'Work Orders' sub-sub-module.
    2. Office: select the vessel from the 'Vessel' dropdown. (The Vessel manual omits this step: on the ship the vessel is fixed.)
    3. Click the '+ Unplanned W.O' button (top right of the Work Orders screen, next to 'Planner' and 'Export').
    4. The 'Work Order Form – Unplanned Maintenance' opens. Enter the required job details in Part A and click 'Save' (top right) to store it as a draft.
    5. Complete Part B (Work Completion Record: work carried out, running hours, spare parts consumed) and click 'Submit Work Order' at the bottom of the form to create the unplanned work order.
    6. The work order appears under the 'Unplanned' tab; its number is <VESSELCODE>-UWO-<COMPONENTCODE>-<YEAR>-<NNN>.
    Exceptions / edge cases:
    - None recorded in this pilot. (An open question about running-hours readings on the unplanned form's Part B is logged in REVIEW.md, not stated here.)
    Where the manual differs:
    - None found for the steps themselves. The Vessel manual has no 'select vessel' step (ship instance is single-vessel).
    Related procedures: planned-wo-ship-daily-scan.md · office-generate-now.md · office-generate-wo-per-job.md
    ```
  - [5] Technical - PMS User Manual For Office_Sail Admin_R2_08.06.2026.pdf · 1.1.5.6 HOW TO COMPLETE THE WORK ORDER (p.32) · 1173 chars · d=1.0545
    ```
    * Go to the 'Work Orders' sub-sub module. (Ref Figure 49)
    
    * Select the vessel from the 'Vessel' dropdown. (Ref Figure 49)
    
    * Click the required status tab (Scheduled, Due, Overdue, Postponed, or Unplanned). (Ref Figure 49)
    
    * Then select the work order by clicking the 'Edit' icon or the table row. (Ref Figure 49)
    
    Screenshot of the Work Orders (W\.O) dashboard with four callout boxes: 1. Click on the 'Work Order'. 2. Click here to select a vessel. 3. Choose the required field from the status tab that needs to be completed. 4. The work order form can be opened by clicking the 'Edit' icon or selecting the table row.
    
    Figure 49
    
    * The 'Work Order Form' appears after clicking the 'Edit' icon. (Ref Figure 50)
    
    * Navigate to 'Part B – Work Completion Record', enter the required information. (Ref Figure 50)
    
    Screenshot of the Part B - Work Completion Record form with three callout boxes: 1. Click here to open the 'Part B' section and enter the required details. 2. From here, the user can upload the docs. 3. Use this section to add or select quick inputs and smart suggestions.
    
    Figure 50
    
    \* To upload RA documents, ensure the radio button is not set to NA or No.
    ```

## wo-phr-02 · B-kb-pilot · run 2 → **RETRIEVAL**
- question: I need to raise a work order for a pump — how do I do that?
- judge: answer=True citation=True rule=False — unplanned procedure ✓; note of the other ways MISSING
- classification note: none of the dropped items is in the supplied text
- citations returned by this run: ["Technical - KB pilot: Create an unplanned work order ('+ Unplanned W.O').md", 'Technical - PMS User Manual For Office_Sail Admin_R2_08.06.2026', 'Technical - PMS User Manual_Vessel Specific_R3_08.07.2026']  (all within the probe's hit list)
- answer (full): 1. Go to the 'Work Orders' sub-sub module. 2. Select the vessel from the 'Vessel' dropdown. 3. Click on the '+ Unplanned W.O' button to create an unplanned work order. 4. The 'Work Order Form – Unplanned Maintenance' will appear. Enter all required job details in Part A and click Save to store it as a draft. 5. Complete Part B and click Submit Work Order to generate the unplanned work order. Source: Technical - PMS User Manual For Office_Sail Admin_R2_08.06.2026 — 1.1.5.2 HOW TO CREATE AN UNPLANNED WORK ORDER (p.29) and Technical - PMS User Manual_Vessel Specific_R3_08.07.2026 — 1.1.5.2 HOW TO CREATE AN UNPLANNED WORK ORDER (p.24).
- excerpt text: same as run 1 of wo-phr-02 on B-kb-pilot (above)

## wo-phr-02 · B-kb-pilot · run 3 → **RETRIEVAL**
- question: I need to raise a work order for a pump — how do I do that?
- judge: answer=True citation=True rule=False — unplanned procedure ✓; note of the other ways MISSING
- classification note: none of the dropped items is in the supplied text
- citations returned by this run: ["Technical - KB pilot: Create an unplanned work order ('+ Unplanned W.O').md", 'Technical - PMS User Manual For Office_Sail Admin_R2_08.06.2026', 'Technical - PMS User Manual_Vessel Specific_R3_08.07.2026']  (all within the probe's hit list)
- answer (full): To create an unplanned work order for a pump, follow these steps: 1. Go to the 'Work Orders' sub-sub module. 2. Select the vessel from the 'Vessel' dropdown. 3. Click on the '+ Unplanned W.O' button to create an unplanned work order. 4. The 'Work Order Form – Unplanned Maintenance' will appear. Enter all required job details in Part A and click 'Save' to store it as a draft. 5. Complete Part B and click 'Submit Work Order' to generate the unplanned work order. Source: Technical - PMS User Manual For Office_Sail Admin_R2_08.06.2026, section 1.1.5.2; Technical - PMS User Manual_Vessel Specific_R3_08.07.2026, section 1.1.5.2.
- excerpt text: same as run 1 of wo-phr-02 on B-kb-pilot (above)

## wo-phr-03 · A-kb-base · run 1 → **MIXED**
- question: Do I create work orders myself or does the system create them?
- judge: answer=False citation=True rule=False — automatic generation MISSING; pairing ✗: Generate Now not described; per-job Generate WO not described
- classification note: automatic generation: not in text; Generate Now described: not in text; per-job Generate WO described: in text; also literal must-phrase absent: ['generate wo']
- citations returned by this run: ['Technical - PMS User Manual For Office_Sail Admin_R2_08.06.2026', 'Technical - PMS User Manual_Vessel Specific_R3_08.07.2026']  (all within the probe's hit list)
- answer (full): The process for creating work orders is manual, as users can create them themselves. Here are the steps to create an unplanned work order: 1. Go to the 'Work Orders' sub-sub module. 2. Select the vessel from the 'Vessel' dropdown. 3. Click on the '+ Unplanned W.O' button to create an unplanned work order. 4. The 'Work Order Form – Unplanned Maintenance' form will appear. 5. Enter all required job details in Part A and click Save to store it as a draft. 6. Complete Part B and click Submit Work Order to generate the unplanned work order. Source: Technical - PMS User Manual For Office_Sail Admin_R2_08.06.2026 — 1.1.5.2 HOW TO CREATE AN UNPLANNED WORK ORDER (p.29) and Technical - PMS User Manual_Vessel Specific_R3_08.07.2026 — 1.1.5.2 HOW TO CREATE AN UNPLANNED WORK ORDER (p.24).
- **excerpt text supplied for this question on A-kb-base (identical for runs 1–3):**
  - [1] Technical - PMS User Manual For Office_Sail Admin_R2_08.06.2026.pdf · Introduction (p.28) · 319 chars · d=0.9497
    ```
    * Work Orders (WO) are a structured instruction used onboard to plan, execute, and record maintenance activities for equipment and systems. It serves as the primary control mechanism to ensure that all maintenance tasks are carried out systematically, safely, and in compliance with company and regulatory requirements.
    ```
  - [2] Technical - PMS User Manual_Vessel Specific_R3_08.07.2026.pdf · Introduction (p.23) · 318 chars · d=0.9668
    ```
    * Work Orders (WO) is a structured instruction used onboard to plan, execute, and record maintenance activities for equipment and systems. It serves as the primary control mechanism to ensure that all maintenance tasks are carried out systematically, safely, and in compliance with company and regulatory requirements.
    ```
  - [3] Technical - PMS User Manual For Office_Sail Admin_R2_08.06.2026.pdf · 1.1.5.2 HOW TO CREATE AN UNPLANNED WORK ORDER (p.29) · 1026 chars · d=0.9838
    ```
    * Go to the 'Work Orders' sub-sub module. (Ref Figure 43)
    
    * Select the vessel from the 'Vessel' dropdown. (Ref Figure 43)
    
    * Click on the '+ Unplanned W\.O' button to create an unplanned work order. (Ref Figure 43)
    
    Screenshot of the Work Orders (W\.O) dashboard showing three steps: 1. Click here to access the 'Work Orders', 2. Click here to select a vessel, and 3. Click here to open an unplanned work order form.
    
    Figure 43
    
    * The 'Work Order Form – Unplanned Maintenance' form below appears after clicking the '+ Unplanned W\.O' button. (Ref Figure 44)
    
    * Enter all required job details in Part A and click Save to store it as a draft. Then complete Part B and click Submit Work Order to generate the unplanned work order. (Ref Figure 44)
    
    Screenshot of the Work Order Form - Unplanned showing the Save button highlighted with "Click the Save button to save it as a draft" and the Submit Work Order button highlighted with "After filling the form, click here to create an unplanned work order."
    
    Figure 44
    
    Page 29 of 64
    ```
  - [4] Technical - PMS User Manual_Vessel Specific_R3_08.07.2026.pdf · 1.1.5.2 HOW TO CREATE AN UNPLANNED WORK ORDER (p.24) · 681 chars · d=0.9841
    ```
    * Go to the 'Work Orders' sub-sub module. (Ref Figure 33)
    
    * Click on the '+ Unplanned W\.O' button to create an unplanned work order. (Ref Figure 33)
    
    screenshot: Work Orders dashboard showing navigation to Work Orders and the Unplanned W\.O button
    
    Figure 33
    
    * The 'Work Order Form – Unplanned Maintenance' form below appears after clicking the '+ Unplanned W\.O' button. (Ref Figure 34)
    
    * Enter all required job details in Part A and click Save to store it as a draft. Then complete Part B and click Submit Work Order to generate the unplanned work order. (Ref Figure 34)
    
    screenshot: Work Order Form - Unplanned showing the Save button and Submit Work Order button
    
    Figure 34
    ```
  - [5] Technical - PMS User Manual For Office_Sail Admin_R2_08.06.2026.pdf · TECHNICAL USER MANUAL (p.18) · 1051 chars · d=1.0151
    ```
    * In the Part C section, users can view all associated jobs for the component, including Task type, frequency, and last/next due dates. (Ref Figure 22)
    * The user can click the 'Generate WO' button to create a WO manually for the selected component. (Ref Figure 22)
    
    Screenshot of the Components interface showing component details and a list of jobs. A callout box labeled "1" points to the jobs section, and a callout box labeled "2" points to the 'Generate WO' button.
    
    <u>Figure 22</u>
    
    * The screen below appears after clicking the 'Generate WO' button. (Ref Figure 23)
    * Choose the appropriate reason for generating the work order from the listed options (Ref Figure 23), and the Work Order will be generated.
    
    Screenshot of the 'Generate Work Order' pop-up window over the Components interface. A callout box points to the pop-up, indicating where to choose a reason for the Work Order.
    
    <u>Figure 23</u>
    
    [!NOTE]
    Ensure that there is no active WO for the same selected job, as the system does not allow the generation of duplicate work orders.
    ```

## wo-phr-03 · A-kb-base · run 2 → **MIXED**
- question: Do I create work orders myself or does the system create them?
- judge: answer=False citation=True rule=False — automatic generation MISSING; pairing ✗: Generate Now not described; per-job Generate WO not described
- classification note: automatic generation: not in text; Generate Now described: not in text; per-job Generate WO described: in text; also literal must-phrase absent: ['generate wo']
- citations returned by this run: ['Technical - PMS User Manual For Office_Sail Admin_R2_08.06.2026', 'Technical - PMS User Manual_Vessel Specific_R3_08.07.2026']  (all within the probe's hit list)
- answer (full): The system allows users to create work orders manually. Here are the steps to create an unplanned work order: 1. Go to the 'Work Orders' sub-sub module. 2. Select the vessel from the 'Vessel' dropdown. 3. Click on the '+ Unplanned W.O' button to create an unplanned work order. 4. The 'Work Order Form – Unplanned Maintenance' form will appear. 5. Enter all required job details in Part A and click Save to store it as a draft. 6. Complete Part B and click Submit Work Order to generate the unplanned work order. Source: Technical - PMS User Manual For Office_Sail Admin_R2_08.06.2026 — 1.1.5.2 HOW TO CREATE AN UNPLANNED WORK ORDER (p.29) and Technical - PMS User Manual_Vessel Specific_R3_08.07.2026 — 1.1.5.2 HOW TO CREATE AN UNPLANNED WORK ORDER (p.24).
- excerpt text: same as run 1 of wo-phr-03 on A-kb-base (above)

## wo-phr-03 · A-kb-base · run 3 → **MIXED**
- question: Do I create work orders myself or does the system create them?
- judge: answer=False citation=True rule=False — automatic generation MISSING; pairing ✗: Generate Now not described; per-job Generate WO not described
- classification note: automatic generation: not in text; Generate Now described: not in text; per-job Generate WO described: in text; also literal must-phrase absent: ['generate wo']
- citations returned by this run: ['Technical - PMS User Manual For Office_Sail Admin_R2_08.06.2026', 'Technical - PMS User Manual_Vessel Specific_R3_08.07.2026']  (all within the probe's hit list)
- answer (full): The process for creating work orders can be done manually by users. Here are the steps to create an unplanned work order: 1. Go to the 'Work Orders' sub-sub module. 2. Select the vessel from the 'Vessel' dropdown. 3. Click on the '+ Unplanned W.O' button to create an unplanned work order. 4. The 'Work Order Form – Unplanned Maintenance' form will appear. 5. Enter all required job details in Part A and click Save to store it as a draft. 6. Complete Part B and click Submit Work Order to generate the unplanned work order. This process is the same for both the Office and Vessel Specific manuals. Source: Technical - PMS User Manual For Office_Sail Admin_R2_08.06.2026 — 1.1.5.2, Technical - PMS User Manual_Vessel Specific_R3_08.07.2026 — 1.1.5.2.
- excerpt text: same as run 1 of wo-phr-03 on A-kb-base (above)

## wo-phr-03 · B-kb-pilot · run 1 → **ANSWER GENERATION**
- question: Do I create work orders myself or does the system create them?
- judge: answer=False citation=True rule=False — automatic generation ✓; pairing ✗: Generate Now not described; per-job Generate WO not described
- classification note: every dropped item is in the supplied text; also literal must-phrase absent: ['unplanned w.o', 'generate wo']
- citations returned by this run: ['Technical - KB pilot: How work orders are created — the three ways to create a work order.md', "Technical - KB pilot: Planned work orders — generated automatically by the ship's daily job-due scan.md", 'Technical - PMS User Manual For Office_Sail Admin_R2_08.06.2026', 'Technical - PMS User Manual_Vessel Specific_R3_08.07.2026']  (all within the probe's hit list)
- answer (full): 1. Planned (scheduled) work orders are created automatically by the ship system once a day, based on each job's frequency and next due date. 2. For per-job work orders, you can generate them manually in the office if the vessel's switch is on. 3. Unplanned work orders can also be created manually without any role check or switch requirement. Source: [1] (How work orders are created), [3] (Planned work orders — generated automatically by the ship's daily job-due scan)
- **excerpt text supplied for this question on B-kb-pilot (identical for runs 1–3):**
  - [1] Technical - KB pilot: How work orders are created — the three ways to create a work order.md · How work orders are created — the three ways to create a work order · 2044 chars · d=0.8425
    ```
    Applies to: Both
    Who can do it (role): Depends on the way — (1) planned: nobody, the ship system creates them; office 'Generate Now': Sail Admin only; (2) per-job 'Generate WO': no role check; (3) unplanned: no role check. Normal sign-in and vessel access apply to all.
    Prerequisites (switches, settings, job/component state): Office 'Generate Now' and office per-job 'Generate WO' both need the vessel's 'office work-order generation' switch ON (off by default, set by a Sail Admin on 'Lead Time & Grace Period Settings'). Unplanned needs no switch. A job with an active work order cannot get another one.
    Steps:
    1. Planned (scheduled) work orders — generated by the system from each job's frequency and next due date. ON THE SHIP: automatic, once a day, no user action. IN THE OFFICE: nothing runs automatically; a Sail Admin can click 'Generate Now' on the Work Orders screen for one vessel, only if that vessel's switch is on. Details: planned-wo-ship-daily-scan.md and office-generate-now.md.
    2. One job on demand — Components → (Office: select the vessel) → open the component → Part C → 'Generate WO' → choose the reason (Planning / Breakdown / Other). No role check on this path (sign-in and vessel access still apply); in the office only if the vessel switch is on; the job must be active and must not already have an active work order. Details: office-generate-wo-per-job.md.
    3. Unplanned work — Work Orders → (Office: select the vessel) → '+ Unplanned W.O' → Part A, Save → Part B, Submit Work Order. No role check on this path, no switch. Details: unplanned-wo.md.
    Exceptions / edge cases: The Sail Admin requirement belongs to 'Generate Now' only; it does not apply to per-job 'Generate WO' or to unplanned work orders.
    Where the manual differs: The June manuals describe only ways 2 and 3 and state no office conditions; automatic ship generation and 'Generate Now' are absent from them. See CONFLICTS.md.
    Related procedures: planned-wo-ship-daily-scan.md · office-generate-now.md · office-generate-wo-per-job.md · unplanned-wo.md
    ```
  - [2] Technical - PMS User Manual For Office_Sail Admin_R2_08.06.2026.pdf · Introduction (p.28) · 319 chars · d=0.9497
    ```
    * Work Orders (WO) are a structured instruction used onboard to plan, execute, and record maintenance activities for equipment and systems. It serves as the primary control mechanism to ensure that all maintenance tasks are carried out systematically, safely, and in compliance with company and regulatory requirements.
    ```
  - [3] Technical - KB pilot: Planned work orders — generated automatically by the ship's daily job-due scan.md · Planned work orders — generated automatically by the ship's daily job-due scan · 1952 chars · d=0.9586
    ```
    Applies to: Vessel
    Who can do it (role): None — no user action. Planned (scheduled) work orders are created by the ship system itself.
    Prerequisites (switches, settings, job/component state):
    - The instance must be a ship instance; the scan does not run on the office (shore) instance.
    - The job must be active and attached to a component, with a frequency and a next due date (the job schedule shown in Components → Part C).
    - The job must not already have an active work order — one active work order per job at a time.
    Steps:
    1. Nothing to do. The ship system runs the job-due scan once every 24 hours by default (interval configurable through JOB_DUE_SCAN_INTERVAL_MS) and creates a work order for every job that is due.
    2. To see the result, open the 'Work Orders' sub-sub-module and use the status tabs: Scheduled (jobs planned with a future due date), Due (due within the current period), Overdue (past due date, not completed).
    3. The work-order number is prefixed with the vessel code: <VESSELCODE>-<JOBCODE>-<COMPONENTCODE>-<YEAR>-<NNN>.
    Exceptions / edge cases:
    - If a job already has an active work order, the scan does not create another one for it.
    - A work order can be generated ahead of the scan for one job with 'Generate WO' on the Components page — see office-generate-wo-per-job.md.
    - On the office instance no scan runs. Office-side generation is done by a user in one of two ways: 'Generate Now' for a whole vessel (Sail Admin AND the vessel switch) — see office-generate-now.md — or per-job 'Generate WO' from Components (the vessel switch) — see office-generate-wo-per-job.md.
    Where the manual differs:
    - The June manuals do not describe automatic generation at all. They describe the Scheduled / Due / Overdue tabs and the job frequency / next due date but never say that the system creates the work orders. Recorded in CONFLICTS.md.
    Related procedures: office-generate-now.md · office-generate-wo-per-job.md · unplanned-wo.md
    ```
  - [4] Technical - PMS User Manual_Vessel Specific_R3_08.07.2026.pdf · Introduction (p.23) · 318 chars · d=0.9668
    ```
    * Work Orders (WO) is a structured instruction used onboard to plan, execute, and record maintenance activities for equipment and systems. It serves as the primary control mechanism to ensure that all maintenance tasks are carried out systematically, safely, and in compliance with company and regulatory requirements.
    ```
  - [5] Technical - PMS User Manual For Office_Sail Admin_R2_08.06.2026.pdf · 1.1.5.2 HOW TO CREATE AN UNPLANNED WORK ORDER (p.29) · 1026 chars · d=0.9838
    ```
    * Go to the 'Work Orders' sub-sub module. (Ref Figure 43)
    
    * Select the vessel from the 'Vessel' dropdown. (Ref Figure 43)
    
    * Click on the '+ Unplanned W\.O' button to create an unplanned work order. (Ref Figure 43)
    
    Screenshot of the Work Orders (W\.O) dashboard showing three steps: 1. Click here to access the 'Work Orders', 2. Click here to select a vessel, and 3. Click here to open an unplanned work order form.
    
    Figure 43
    
    * The 'Work Order Form – Unplanned Maintenance' form below appears after clicking the '+ Unplanned W\.O' button. (Ref Figure 44)
    
    * Enter all required job details in Part A and click Save to store it as a draft. Then complete Part B and click Submit Work Order to generate the unplanned work order. (Ref Figure 44)
    
    Screenshot of the Work Order Form - Unplanned showing the Save button highlighted with "Click the Save button to save it as a draft" and the Submit Work Order button highlighted with "After filling the form, click here to create an unplanned work order."
    
    Figure 44
    
    Page 29 of 64
    ```

## wo-phr-03 · B-kb-pilot · run 2 → **ANSWER GENERATION**
- question: Do I create work orders myself or does the system create them?
- judge: answer=False citation=True rule=False — automatic generation ✓; pairing ✗: Generate Now not described; per-job Generate WO not described
- classification note: every dropped item is in the supplied text; also literal must-phrase absent: ['unplanned w.o', 'generate wo']
- citations returned by this run: ['Technical - KB pilot: How work orders are created — the three ways to create a work order.md', "Technical - KB pilot: Planned work orders — generated automatically by the ship's daily job-due scan.md", 'Technical - PMS User Manual For Office_Sail Admin_R2_08.06.2026', 'Technical - PMS User Manual_Vessel Specific_R3_08.07.2026']  (all within the probe's hit list)
- answer (full): 1. Planned (scheduled) work orders are created automatically by the ship system once a day, based on each job's frequency and next due date. 2. For per-job work orders, you can generate them manually in the office if the vessel's switch is on. 3. Unplanned work orders can also be created manually without any role check or switch requirement. Source: [1] (How work orders are created — the three ways to create a work order), [3] (Planned work orders — generated automatically by the ship's daily job-due scan)
- excerpt text: same as run 1 of wo-phr-03 on B-kb-pilot (above)

## wo-phr-03 · B-kb-pilot · run 3 → **ANSWER GENERATION**
- question: Do I create work orders myself or does the system create them?
- judge: answer=False citation=True rule=False — automatic generation ✓; pairing ✗: Generate Now not described; per-job Generate WO not described
- classification note: every dropped item is in the supplied text; also literal must-phrase absent: ['unplanned w.o', 'generate wo']
- citations returned by this run: ['Technical - KB pilot: How work orders are created — the three ways to create a work order.md', "Technical - KB pilot: Planned work orders — generated automatically by the ship's daily job-due scan.md", 'Technical - PMS User Manual For Office_Sail Admin_R2_08.06.2026', 'Technical - PMS User Manual_Vessel Specific_R3_08.07.2026']  (all within the probe's hit list)
- answer (full): 1. Planned (scheduled) work orders are created automatically by the ship system once a day, based on each job's frequency and next due date. 2. For per-job work orders, you can generate them manually in the office if the vessel's switch is ON. 3. Unplanned work orders can also be created manually without any role check or switch requirement. Source: [1] (How work orders are created — the three ways to create a work order), [3] (Planned work orders — generated automatically by the ship's daily job-due scan).
- excerpt text: same as run 1 of wo-phr-03 on B-kb-pilot (above)

## wo-phr-04 · A-kb-base · run 1 → **RETRIEVAL**
- question: Steps to create a new work order
- judge: answer=False citation=True rule=False — automatic generation MISSING; pairing ✗: Generate Now not described; per-job Generate WO not described
- classification note: none of the dropped items is in the supplied text; also literal must-phrase absent: ['generate wo']
- citations returned by this run: ['Technical - PMS User Manual For Office_Sail Admin_R2_08.06.2026', 'Technical - PMS User Manual_Vessel Specific_R3_08.07.2026']  (all within the probe's hit list)
- answer (full): To create a new unplanned work order, follow these steps: 1. Go to the 'Work Orders' sub-sub module. 2. Select the vessel from the 'Vessel' dropdown. 3. Click on the '+ Unplanned W.O' button to create an unplanned work order. 4. The 'Work Order Form – Unplanned Maintenance' form will appear. 5. Enter all required job details in Part A and click Save to store it as a draft. 6. Complete Part B and click Submit Work Order to generate the unplanned work order. Source: Technical - PMS User Manual For Office_Sail Admin_R2_08.06.2026, section 1.1.5.2; Technical - PMS User Manual_Vessel Specific_R3_08.07.2026, section 1.1.5.2.
- **excerpt text supplied for this question on A-kb-base (identical for runs 1–3):**
  - [1] Technical - PMS User Manual For Office_Sail Admin_R2_08.06.2026.pdf · 1.1.5.2 HOW TO CREATE AN UNPLANNED WORK ORDER (p.29) · 1026 chars · d=0.827
    ```
    * Go to the 'Work Orders' sub-sub module. (Ref Figure 43)
    
    * Select the vessel from the 'Vessel' dropdown. (Ref Figure 43)
    
    * Click on the '+ Unplanned W\.O' button to create an unplanned work order. (Ref Figure 43)
    
    Screenshot of the Work Orders (W\.O) dashboard showing three steps: 1. Click here to access the 'Work Orders', 2. Click here to select a vessel, and 3. Click here to open an unplanned work order form.
    
    Figure 43
    
    * The 'Work Order Form – Unplanned Maintenance' form below appears after clicking the '+ Unplanned W\.O' button. (Ref Figure 44)
    
    * Enter all required job details in Part A and click Save to store it as a draft. Then complete Part B and click Submit Work Order to generate the unplanned work order. (Ref Figure 44)
    
    Screenshot of the Work Order Form - Unplanned showing the Save button highlighted with "Click the Save button to save it as a draft" and the Submit Work Order button highlighted with "After filling the form, click here to create an unplanned work order."
    
    Figure 44
    
    Page 29 of 64
    ```
  - [2] Technical - PMS User Manual_Vessel Specific_R3_08.07.2026.pdf · 1.1.5.2 HOW TO CREATE AN UNPLANNED WORK ORDER (p.24) · 681 chars · d=0.8394
    ```
    * Go to the 'Work Orders' sub-sub module. (Ref Figure 33)
    
    * Click on the '+ Unplanned W\.O' button to create an unplanned work order. (Ref Figure 33)
    
    screenshot: Work Orders dashboard showing navigation to Work Orders and the Unplanned W\.O button
    
    Figure 33
    
    * The 'Work Order Form – Unplanned Maintenance' form below appears after clicking the '+ Unplanned W\.O' button. (Ref Figure 34)
    
    * Enter all required job details in Part A and click Save to store it as a draft. Then complete Part B and click Submit Work Order to generate the unplanned work order. (Ref Figure 34)
    
    screenshot: Work Order Form - Unplanned showing the Save button and Submit Work Order button
    
    Figure 34
    ```
  - [3] Technical - PMS User Manual_Vessel Specific_R3_08.07.2026.pdf · 1.1.5.6 HOW TO COMPLETE THE WORK ORDER (p.27) · 763 chars · d=0.8486
    ```
    * Go to the 'Work Orders' sub-sub module. (Ref Figure 39)
    
    * Click the required status tab (Scheduled, Due, Overdue, Postponed, or Unplanned). (Ref Figure 39)
    
    * Then select the work order by clicking the 'Edit' icon or the table row. (Ref Figure 39)
    
    screenshot: Work Orders (W\.O) dashboard showing status tabs and work order list with instructional callouts
    
    Figure 39
    
    * The 'Work Order Form' appears after clicking the 'Edit' icon. (Ref Figure 40)
    
    * Navigate to 'Part B – Work Completion Record', enter the required information. (Ref Figure 40)
    
    screenshot: Part B - Work Completion Record form showing risk assessment and work duration fields with instructional callouts
    
    Figure 40
    
    ☞ To upload RA documents, ensure the radio button is not set to NA or No.
    ```
  - [4] Technical - PMS User Manual For Office_Sail Admin_R2_08.06.2026.pdf · 1.1.5.6 HOW TO COMPLETE THE WORK ORDER (p.32) · 1173 chars · d=0.8689
    ```
    * Go to the 'Work Orders' sub-sub module. (Ref Figure 49)
    
    * Select the vessel from the 'Vessel' dropdown. (Ref Figure 49)
    
    * Click the required status tab (Scheduled, Due, Overdue, Postponed, or Unplanned). (Ref Figure 49)
    
    * Then select the work order by clicking the 'Edit' icon or the table row. (Ref Figure 49)
    
    Screenshot of the Work Orders (W\.O) dashboard with four callout boxes: 1. Click on the 'Work Order'. 2. Click here to select a vessel. 3. Choose the required field from the status tab that needs to be completed. 4. The work order form can be opened by clicking the 'Edit' icon or selecting the table row.
    
    Figure 49
    
    * The 'Work Order Form' appears after clicking the 'Edit' icon. (Ref Figure 50)
    
    * Navigate to 'Part B – Work Completion Record', enter the required information. (Ref Figure 50)
    
    Screenshot of the Part B - Work Completion Record form with three callout boxes: 1. Click here to open the 'Part B' section and enter the required details. 2. From here, the user can upload the docs. 3. Use this section to add or select quick inputs and smart suggestions.
    
    Figure 50
    
    \* To upload RA documents, ensure the radio button is not set to NA or No.
    ```
  - [5] Technical - PMS User Manual For Office_Sail Admin_R2_08.06.2026.pdf · 1.1.5.1 HOW TO ACCESS WORK ORDERS (W. O) (p.28) · 1166 chars · d=0.9569
    ```
    * Click the ‘Work Orders’ sub-sub-module to view all the work orders. (Ref Figure 42)
    
    * Select the vessel from the ‘Vessel’ dropdown. (Ref Figure 42)
    
    * Click the required status tab (Scheduled, Due, Overdue, Postponed, Unplanned, Pending Approval, and Completed) to view the corresponding work orders' status. (Ref Figure 42)
    
    Screenshot of the Work Orders (W\.O) interface showing navigation steps: 1. Click here to access the 'Work Orders', 2. Click here to select a vessel, 3. Select a status tab to display the corresponding 'Work Orders'. A red note points to a postponement icon.
    
    Figure 42
    
    * Hand icon **Scheduled**: Jobs that have been planned and have a future due date.
    * **Due**: Jobs that are due within the current period.
    * **Overdue**: Jobs past their due date that have not been completed.
    * **Postponed**: Jobs that have been deferred with an approved justification.
    * **Unplanned**: Details of unplanned work orders will be displayed in this section.
    * **Pending Approval**: All submitted work order details will be displayed here for HOD approval.
    * **Completed**: Fully executed and approved ‘Work Order’ details will be displayed in this tab.
    ```

## wo-phr-04 · A-kb-base · run 2 → **RETRIEVAL**
- question: Steps to create a new work order
- judge: answer=False citation=True rule=False — automatic generation MISSING; pairing ✗: Generate Now not described; per-job Generate WO not described
- classification note: none of the dropped items is in the supplied text; also literal must-phrase absent: ['generate wo']
- citations returned by this run: ['Technical - PMS User Manual For Office_Sail Admin_R2_08.06.2026', 'Technical - PMS User Manual_Vessel Specific_R3_08.07.2026']  (all within the probe's hit list)
- answer (full): To create a new unplanned work order, follow these steps: 1. Go to the 'Work Orders' sub-sub module. 2. Select the vessel from the 'Vessel' dropdown. 3. Click on the '+ Unplanned W.O' button to create an unplanned work order. 4. The 'Work Order Form – Unplanned Maintenance' form will appear. 5. Enter all required job details in Part A and click Save to store it as a draft. 6. Complete Part B and click Submit Work Order to generate the unplanned work order. Source: Technical - PMS User Manual For Office_Sail Admin_R2_08.06.2026 — 1.1.5.2 HOW TO CREATE AN UNPLANNED WORK ORDER (p.29) and Technical - PMS User Manual_Vessel Specific_R3_08.07.2026 — 1.1.5.2 HOW TO CREATE AN UNPLANNED WORK ORDER (p.24)
- excerpt text: same as run 1 of wo-phr-04 on A-kb-base (above)

## wo-phr-04 · A-kb-base · run 3 → **RETRIEVAL**
- question: Steps to create a new work order
- judge: answer=False citation=True rule=False — automatic generation MISSING; pairing ✗: Generate Now not described; per-job Generate WO not described
- classification note: none of the dropped items is in the supplied text; also literal must-phrase absent: ['generate wo']
- citations returned by this run: ['Technical - PMS User Manual For Office_Sail Admin_R2_08.06.2026', 'Technical - PMS User Manual_Vessel Specific_R3_08.07.2026']  (all within the probe's hit list)
- answer (full): To create a new unplanned work order, follow these steps: 1. Go to the 'Work Orders' sub-sub module. 2. Select the vessel from the 'Vessel' dropdown. 3. Click on the '+ Unplanned W.O' button to create an unplanned work order. 4. The 'Work Order Form – Unplanned Maintenance' form will appear. 5. Enter all required job details in Part A and click Save to store it as a draft. 6. Complete Part B and click Submit Work Order to generate the unplanned work order. Source: Technical - PMS User Manual For Office_Sail Admin_R2_08.06.2026, section 1.1.5.2; Technical - PMS User Manual_Vessel Specific_R3_08.07.2026, section 1.1.5.2.
- excerpt text: same as run 1 of wo-phr-04 on A-kb-base (above)

## wo-phr-04 · B-kb-pilot · run 1 → **ANSWER GENERATION**
- question: Steps to create a new work order
- judge: answer=False citation=True rule=False — automatic generation MISSING; pairing ✗: Generate Now not described; per-job Generate WO not described
- classification note: every dropped item is in the supplied text; also literal must-phrase absent: ['generate wo']
- citations returned by this run: ['Technical - KB pilot: How work orders are created — the three ways to create a work order.md', 'Technical - PMS User Manual For Office_Sail Admin_R2_08.06.2026', 'Technical - PMS User Manual_Vessel Specific_R3_08.07.2026']  (all within the probe's hit list)
- answer (full): 1. Go to the 'Work Orders' sub-sub module. 2. Select the vessel from the 'Vessel' dropdown. 3. Click on the '+ Unplanned W.O' button to create an unplanned work order. 4. The 'Work Order Form – Unplanned Maintenance' form will appear. 5. Enter all required job details in Part A and click Save to store it as a draft. 6. Complete Part B and click Submit Work Order to generate the unplanned work order. (Source: Technical - PMS User Manual For Office_Sail Admin_R2_08.06.2026, section 1.1.5.2; Technical - PMS User Manual_Vessel Specific_R3_08.07.2026, section 1.1.5.2)
- **excerpt text supplied for this question on B-kb-pilot (identical for runs 1–3):**
  - [1] Technical - PMS User Manual For Office_Sail Admin_R2_08.06.2026.pdf · 1.1.5.2 HOW TO CREATE AN UNPLANNED WORK ORDER (p.29) · 1026 chars · d=0.827
    ```
    * Go to the 'Work Orders' sub-sub module. (Ref Figure 43)
    
    * Select the vessel from the 'Vessel' dropdown. (Ref Figure 43)
    
    * Click on the '+ Unplanned W\.O' button to create an unplanned work order. (Ref Figure 43)
    
    Screenshot of the Work Orders (W\.O) dashboard showing three steps: 1. Click here to access the 'Work Orders', 2. Click here to select a vessel, and 3. Click here to open an unplanned work order form.
    
    Figure 43
    
    * The 'Work Order Form – Unplanned Maintenance' form below appears after clicking the '+ Unplanned W\.O' button. (Ref Figure 44)
    
    * Enter all required job details in Part A and click Save to store it as a draft. Then complete Part B and click Submit Work Order to generate the unplanned work order. (Ref Figure 44)
    
    Screenshot of the Work Order Form - Unplanned showing the Save button highlighted with "Click the Save button to save it as a draft" and the Submit Work Order button highlighted with "After filling the form, click here to create an unplanned work order."
    
    Figure 44
    
    Page 29 of 64
    ```
  - [2] Technical - PMS User Manual_Vessel Specific_R3_08.07.2026.pdf · 1.1.5.2 HOW TO CREATE AN UNPLANNED WORK ORDER (p.24) · 681 chars · d=0.8394
    ```
    * Go to the 'Work Orders' sub-sub module. (Ref Figure 33)
    
    * Click on the '+ Unplanned W\.O' button to create an unplanned work order. (Ref Figure 33)
    
    screenshot: Work Orders dashboard showing navigation to Work Orders and the Unplanned W\.O button
    
    Figure 33
    
    * The 'Work Order Form – Unplanned Maintenance' form below appears after clicking the '+ Unplanned W\.O' button. (Ref Figure 34)
    
    * Enter all required job details in Part A and click Save to store it as a draft. Then complete Part B and click Submit Work Order to generate the unplanned work order. (Ref Figure 34)
    
    screenshot: Work Order Form - Unplanned showing the Save button and Submit Work Order button
    
    Figure 34
    ```
  - [3] Technical - PMS User Manual_Vessel Specific_R3_08.07.2026.pdf · 1.1.5.6 HOW TO COMPLETE THE WORK ORDER (p.27) · 763 chars · d=0.8486
    ```
    * Go to the 'Work Orders' sub-sub module. (Ref Figure 39)
    
    * Click the required status tab (Scheduled, Due, Overdue, Postponed, or Unplanned). (Ref Figure 39)
    
    * Then select the work order by clicking the 'Edit' icon or the table row. (Ref Figure 39)
    
    screenshot: Work Orders (W\.O) dashboard showing status tabs and work order list with instructional callouts
    
    Figure 39
    
    * The 'Work Order Form' appears after clicking the 'Edit' icon. (Ref Figure 40)
    
    * Navigate to 'Part B – Work Completion Record', enter the required information. (Ref Figure 40)
    
    screenshot: Part B - Work Completion Record form showing risk assessment and work duration fields with instructional callouts
    
    Figure 40
    
    ☞ To upload RA documents, ensure the radio button is not set to NA or No.
    ```
  - [4] Technical - KB pilot: How work orders are created — the three ways to create a work order.md · How work orders are created — the three ways to create a work order · 2044 chars · d=0.853
    ```
    Applies to: Both
    Who can do it (role): Depends on the way — (1) planned: nobody, the ship system creates them; office 'Generate Now': Sail Admin only; (2) per-job 'Generate WO': no role check; (3) unplanned: no role check. Normal sign-in and vessel access apply to all.
    Prerequisites (switches, settings, job/component state): Office 'Generate Now' and office per-job 'Generate WO' both need the vessel's 'office work-order generation' switch ON (off by default, set by a Sail Admin on 'Lead Time & Grace Period Settings'). Unplanned needs no switch. A job with an active work order cannot get another one.
    Steps:
    1. Planned (scheduled) work orders — generated by the system from each job's frequency and next due date. ON THE SHIP: automatic, once a day, no user action. IN THE OFFICE: nothing runs automatically; a Sail Admin can click 'Generate Now' on the Work Orders screen for one vessel, only if that vessel's switch is on. Details: planned-wo-ship-daily-scan.md and office-generate-now.md.
    2. One job on demand — Components → (Office: select the vessel) → open the component → Part C → 'Generate WO' → choose the reason (Planning / Breakdown / Other). No role check on this path (sign-in and vessel access still apply); in the office only if the vessel switch is on; the job must be active and must not already have an active work order. Details: office-generate-wo-per-job.md.
    3. Unplanned work — Work Orders → (Office: select the vessel) → '+ Unplanned W.O' → Part A, Save → Part B, Submit Work Order. No role check on this path, no switch. Details: unplanned-wo.md.
    Exceptions / edge cases: The Sail Admin requirement belongs to 'Generate Now' only; it does not apply to per-job 'Generate WO' or to unplanned work orders.
    Where the manual differs: The June manuals describe only ways 2 and 3 and state no office conditions; automatic ship generation and 'Generate Now' are absent from them. See CONFLICTS.md.
    Related procedures: planned-wo-ship-daily-scan.md · office-generate-now.md · office-generate-wo-per-job.md · unplanned-wo.md
    ```
  - [5] Technical - PMS User Manual For Office_Sail Admin_R2_08.06.2026.pdf · 1.1.5.6 HOW TO COMPLETE THE WORK ORDER (p.32) · 1173 chars · d=0.8689
    ```
    * Go to the 'Work Orders' sub-sub module. (Ref Figure 49)
    
    * Select the vessel from the 'Vessel' dropdown. (Ref Figure 49)
    
    * Click the required status tab (Scheduled, Due, Overdue, Postponed, or Unplanned). (Ref Figure 49)
    
    * Then select the work order by clicking the 'Edit' icon or the table row. (Ref Figure 49)
    
    Screenshot of the Work Orders (W\.O) dashboard with four callout boxes: 1. Click on the 'Work Order'. 2. Click here to select a vessel. 3. Choose the required field from the status tab that needs to be completed. 4. The work order form can be opened by clicking the 'Edit' icon or selecting the table row.
    
    Figure 49
    
    * The 'Work Order Form' appears after clicking the 'Edit' icon. (Ref Figure 50)
    
    * Navigate to 'Part B – Work Completion Record', enter the required information. (Ref Figure 50)
    
    Screenshot of the Part B - Work Completion Record form with three callout boxes: 1. Click here to open the 'Part B' section and enter the required details. 2. From here, the user can upload the docs. 3. Use this section to add or select quick inputs and smart suggestions.
    
    Figure 50
    
    \* To upload RA documents, ensure the radio button is not set to NA or No.
    ```

## wo-phr-04 · B-kb-pilot · run 2 → **ANSWER GENERATION**
- question: Steps to create a new work order
- judge: answer=False citation=True rule=False — automatic generation MISSING; pairing ✗: Generate Now not described; per-job Generate WO not described
- classification note: every dropped item is in the supplied text; also literal must-phrase absent: ['generate wo']
- citations returned by this run: ['Technical - KB pilot: How work orders are created — the three ways to create a work order.md', 'Technical - PMS User Manual For Office_Sail Admin_R2_08.06.2026', 'Technical - PMS User Manual_Vessel Specific_R3_08.07.2026']  (all within the probe's hit list)
- answer (full): 1. Go to the 'Work Orders' sub-sub module. 2. Select the vessel from the 'Vessel' dropdown. 3. Click on the '+ Unplanned W.O' button to create an unplanned work order. 4. The 'Work Order Form – Unplanned Maintenance' form will appear. 5. Enter all required job details in Part A and click Save to store it as a draft. 6. Complete Part B and click Submit Work Order to generate the unplanned work order. Source: Technical - PMS User Manual For Office_Sail Admin_R2_08.06.2026 — 1.1.5.2 HOW TO CREATE AN UNPLANNED WORK ORDER (p.29) and Technical - PMS User Manual_Vessel Specific_R3_08.07.2026 — 1.1.5.2 HOW TO CREATE AN UNPLANNED WORK ORDER (p.24).
- excerpt text: same as run 1 of wo-phr-04 on B-kb-pilot (above)

## wo-phr-04 · B-kb-pilot · run 3 → **ANSWER GENERATION**
- question: Steps to create a new work order
- judge: answer=False citation=True rule=False — automatic generation MISSING; pairing ✗: Generate Now not described; per-job Generate WO not described
- classification note: every dropped item is in the supplied text; also literal must-phrase absent: ['generate wo']
- citations returned by this run: ['Technical - KB pilot: How work orders are created — the three ways to create a work order.md', 'Technical - PMS User Manual For Office_Sail Admin_R2_08.06.2026', 'Technical - PMS User Manual_Vessel Specific_R3_08.07.2026']  (all within the probe's hit list)
- answer (full): 1. Go to the 'Work Orders' sub-sub module. 2. Select the vessel from the 'Vessel' dropdown. 3. Click on the '+ Unplanned W.O' button to create an unplanned work order. 4. The 'Work Order Form – Unplanned Maintenance' form will appear. 5. Enter all required job details in Part A and click Save to store it as a draft. 6. Complete Part B and click Submit Work Order to generate the unplanned work order. (Source: Technical - PMS User Manual For Office_Sail Admin_R2_08.06.2026 — 1.1.5.2 HOW TO CREATE AN UNPLANNED WORK ORDER, p.29)
- excerpt text: same as run 1 of wo-phr-04 on B-kb-pilot (above)

## wo-phr-05 · A-kb-base · run 1 → **MIXED**
- question: How do work orders get created in the Technical module?
- judge: answer=False citation=True rule=False — automatic generation MISSING; pairing ✗: Generate Now not described; per-job Generate WO not described
- classification note: automatic generation: not in text; Generate Now described: not in text; per-job Generate WO described: in text; also literal must-phrase absent: ['generate wo']
- citations returned by this run: ['Technical - PMS User Manual For Office_Sail Admin_R2_08.06.2026', 'Technical - PMS User Manual_Vessel Specific_R3_08.07.2026']  (all within the probe's hit list)
- answer (full): To create work orders in the Technical module, follow these steps: 1. Go to the 'Work Orders' sub-sub module. 2. Select the vessel from the 'Vessel' dropdown. 3. Click on the '+ Unplanned W.O' button to create an unplanned work order. 4. The 'Work Order Form – Unplanned Maintenance' form will appear. 5. Enter all required job details in Part A and click Save to store it as a draft. 6. Complete Part B and click Submit Work Order to generate the unplanned work order. These steps are the same as those in section 1.1.5.2 (page 29) of the manual. Source: Technical - PMS User Manual For Office_Sail Admin_R2_08.06.2026, sections 1.1.5.2 and 1.1.5.6.
- **excerpt text supplied for this question on A-kb-base (identical for runs 1–3):**
  - [1] Technical - PMS User Manual For Office_Sail Admin_R2_08.06.2026.pdf · 1.1.5.2 HOW TO CREATE AN UNPLANNED WORK ORDER (p.29) · 1026 chars · d=0.887
    ```
    * Go to the 'Work Orders' sub-sub module. (Ref Figure 43)
    
    * Select the vessel from the 'Vessel' dropdown. (Ref Figure 43)
    
    * Click on the '+ Unplanned W\.O' button to create an unplanned work order. (Ref Figure 43)
    
    Screenshot of the Work Orders (W\.O) dashboard showing three steps: 1. Click here to access the 'Work Orders', 2. Click here to select a vessel, and 3. Click here to open an unplanned work order form.
    
    Figure 43
    
    * The 'Work Order Form – Unplanned Maintenance' form below appears after clicking the '+ Unplanned W\.O' button. (Ref Figure 44)
    
    * Enter all required job details in Part A and click Save to store it as a draft. Then complete Part B and click Submit Work Order to generate the unplanned work order. (Ref Figure 44)
    
    Screenshot of the Work Order Form - Unplanned showing the Save button highlighted with "Click the Save button to save it as a draft" and the Submit Work Order button highlighted with "After filling the form, click here to create an unplanned work order."
    
    Figure 44
    
    Page 29 of 64
    ```
  - [2] Technical - PMS User Manual For Office_Sail Admin_R2_08.06.2026.pdf · Introduction (p.28) · 319 chars · d=0.8977
    ```
    * Work Orders (WO) are a structured instruction used onboard to plan, execute, and record maintenance activities for equipment and systems. It serves as the primary control mechanism to ensure that all maintenance tasks are carried out systematically, safely, and in compliance with company and regulatory requirements.
    ```
  - [3] Technical - PMS User Manual For Office_Sail Admin_R2_08.06.2026.pdf · TECHNICAL USER MANUAL (p.18) · 1051 chars · d=0.9005
    ```
    * In the Part C section, users can view all associated jobs for the component, including Task type, frequency, and last/next due dates. (Ref Figure 22)
    * The user can click the 'Generate WO' button to create a WO manually for the selected component. (Ref Figure 22)
    
    Screenshot of the Components interface showing component details and a list of jobs. A callout box labeled "1" points to the jobs section, and a callout box labeled "2" points to the 'Generate WO' button.
    
    <u>Figure 22</u>
    
    * The screen below appears after clicking the 'Generate WO' button. (Ref Figure 23)
    * Choose the appropriate reason for generating the work order from the listed options (Ref Figure 23), and the Work Order will be generated.
    
    Screenshot of the 'Generate Work Order' pop-up window over the Components interface. A callout box points to the pop-up, indicating where to choose a reason for the Work Order.
    
    <u>Figure 23</u>
    
    [!NOTE]
    Ensure that there is no active WO for the same selected job, as the system does not allow the generation of duplicate work orders.
    ```
  - [4] Technical - PMS User Manual_Vessel Specific_R3_08.07.2026.pdf · 1.1.5.2 HOW TO CREATE AN UNPLANNED WORK ORDER (p.24) · 681 chars · d=0.9042
    ```
    * Go to the 'Work Orders' sub-sub module. (Ref Figure 33)
    
    * Click on the '+ Unplanned W\.O' button to create an unplanned work order. (Ref Figure 33)
    
    screenshot: Work Orders dashboard showing navigation to Work Orders and the Unplanned W\.O button
    
    Figure 33
    
    * The 'Work Order Form – Unplanned Maintenance' form below appears after clicking the '+ Unplanned W\.O' button. (Ref Figure 34)
    
    * Enter all required job details in Part A and click Save to store it as a draft. Then complete Part B and click Submit Work Order to generate the unplanned work order. (Ref Figure 34)
    
    screenshot: Work Order Form - Unplanned showing the Save button and Submit Work Order button
    
    Figure 34
    ```
  - [5] Technical - PMS User Manual For Office_Sail Admin_R2_08.06.2026.pdf · 1.1.5.6 HOW TO COMPLETE THE WORK ORDER (p.32) · 1173 chars · d=0.9153
    ```
    * Go to the 'Work Orders' sub-sub module. (Ref Figure 49)
    
    * Select the vessel from the 'Vessel' dropdown. (Ref Figure 49)
    
    * Click the required status tab (Scheduled, Due, Overdue, Postponed, or Unplanned). (Ref Figure 49)
    
    * Then select the work order by clicking the 'Edit' icon or the table row. (Ref Figure 49)
    
    Screenshot of the Work Orders (W\.O) dashboard with four callout boxes: 1. Click on the 'Work Order'. 2. Click here to select a vessel. 3. Choose the required field from the status tab that needs to be completed. 4. The work order form can be opened by clicking the 'Edit' icon or selecting the table row.
    
    Figure 49
    
    * The 'Work Order Form' appears after clicking the 'Edit' icon. (Ref Figure 50)
    
    * Navigate to 'Part B – Work Completion Record', enter the required information. (Ref Figure 50)
    
    Screenshot of the Part B - Work Completion Record form with three callout boxes: 1. Click here to open the 'Part B' section and enter the required details. 2. From here, the user can upload the docs. 3. Use this section to add or select quick inputs and smart suggestions.
    
    Figure 50
    
    \* To upload RA documents, ensure the radio button is not set to NA or No.
    ```

## wo-phr-05 · A-kb-base · run 2 → **MIXED**
- question: How do work orders get created in the Technical module?
- judge: answer=False citation=True rule=False — automatic generation MISSING; pairing ✗: Generate Now not described; per-job Generate WO not described
- classification note: automatic generation: not in text; Generate Now described: not in text; per-job Generate WO described: in text; also literal must-phrase absent: ['generate wo']
- citations returned by this run: ['Technical - PMS User Manual For Office_Sail Admin_R2_08.06.2026', 'Technical - PMS User Manual_Vessel Specific_R3_08.07.2026']  (all within the probe's hit list)
- answer (full): To create work orders in the Technical module, follow these steps: 1. Go to the 'Work Orders' sub-sub module. 2. Select the vessel from the 'Vessel' dropdown. 3. Click on the '+ Unplanned W.O' button to create an unplanned work order. 4. The 'Work Order Form – Unplanned Maintenance' form will appear. 5. Enter all required job details in Part A and click Save to store it as a draft. 6. Complete Part B and click Submit Work Order to generate the unplanned work order. These steps are the same as section 1.1.5.2 (page 29) of the manual. Source: Technical - PMS User Manual For Office_Sail Admin_R2_08.06.2026 — 1.1.5.2 HOW TO CREATE AN UNPLANNED WORK ORDER (p.29)
- excerpt text: same as run 1 of wo-phr-05 on A-kb-base (above)

## wo-phr-05 · A-kb-base · run 3 → **MIXED**
- question: How do work orders get created in the Technical module?
- judge: answer=False citation=True rule=False — automatic generation MISSING; pairing ✗: Generate Now not described; per-job Generate WO not described
- classification note: automatic generation: not in text; Generate Now described: not in text; per-job Generate WO described: in text; also literal must-phrase absent: ['unplanned w.o', 'generate wo']
- citations returned by this run: ['Technical - PMS User Manual For Office_Sail Admin_R2_08.06.2026', 'Technical - PMS User Manual_Vessel Specific_R3_08.07.2026']  (all within the probe's hit list)
- answer (full): To create work orders in the Technical module, follow these steps: 1. Go to the 'Work Orders' sub-sub module. 2. Select the vessel from the 'Vessel' dropdown. 3. Click on the '+ Unplanned W\.O' button to create an unplanned work order. 4. The 'Work Order Form – Unplanned Maintenance' will appear. 5. Enter all required job details in Part A and click Save to store it as a draft. 6. Complete Part B and click Submit Work Order to generate the unplanned work order. These steps are the same as those outlined in section 1.1.5.2 of the manual (page 29). Source: Technical - PMS User Manual For Office_Sail Admin_R2_08.06.2026, section 1.1.5.2.
- excerpt text: same as run 1 of wo-phr-05 on A-kb-base (above)

## wo-phr-05 · B-kb-pilot · run 1 → **ANSWER GENERATION**
- question: How do work orders get created in the Technical module?
- judge: answer=True citation=True rule=False — automatic generation ✓; pairing ✗: Generate WO block lacks the vessel switch
- classification note: every dropped item is in the supplied text
- citations returned by this run: ['Technical - KB pilot: How work orders are created — the three ways to create a work order.md', 'Technical - PMS User Manual For Office_Sail Admin_R2_08.06.2026', 'Technical - PMS User Manual_Vessel Specific_R3_08.07.2026']  (all within the probe's hit list)
- answer (full): 1. **Planned (scheduled) work orders**: - Generated automatically by the system from each job's frequency and next due date on the ship, once a day, with no user action required. - In the office, a Sail Admin can click 'Generate Now' on the Work Orders screen for one vessel, only if that vessel's switch is ON. 2. **One job on demand**: - Navigate to Components → (Office: select the vessel) → open the component → Part C → click 'Generate WO' → choose the reason (Planning / Breakdown / Other). - No role check applies, but the job must be active and must not already have an active work order. 3. **Unplanned work**: - Go to Work Orders → (Office: select the vessel) → click '+ Unplanned W.O' → enter job details in Part A and click Save → complete Part B and click Submit Work Order. Source: [1] How work orders are created — the three ways to create a work order, [2] PMS User Manual For Office_Sail Admin_R2_08.06.2026, [5] PMS User Manual_Vessel Specific_R3_08.07.2026.
- **excerpt text supplied for this question on B-kb-pilot (identical for runs 1–3):**
  - [1] Technical - KB pilot: How work orders are created — the three ways to create a work order.md · How work orders are created — the three ways to create a work order · 2044 chars · d=0.8429
    ```
    Applies to: Both
    Who can do it (role): Depends on the way — (1) planned: nobody, the ship system creates them; office 'Generate Now': Sail Admin only; (2) per-job 'Generate WO': no role check; (3) unplanned: no role check. Normal sign-in and vessel access apply to all.
    Prerequisites (switches, settings, job/component state): Office 'Generate Now' and office per-job 'Generate WO' both need the vessel's 'office work-order generation' switch ON (off by default, set by a Sail Admin on 'Lead Time & Grace Period Settings'). Unplanned needs no switch. A job with an active work order cannot get another one.
    Steps:
    1. Planned (scheduled) work orders — generated by the system from each job's frequency and next due date. ON THE SHIP: automatic, once a day, no user action. IN THE OFFICE: nothing runs automatically; a Sail Admin can click 'Generate Now' on the Work Orders screen for one vessel, only if that vessel's switch is on. Details: planned-wo-ship-daily-scan.md and office-generate-now.md.
    2. One job on demand — Components → (Office: select the vessel) → open the component → Part C → 'Generate WO' → choose the reason (Planning / Breakdown / Other). No role check on this path (sign-in and vessel access still apply); in the office only if the vessel switch is on; the job must be active and must not already have an active work order. Details: office-generate-wo-per-job.md.
    3. Unplanned work — Work Orders → (Office: select the vessel) → '+ Unplanned W.O' → Part A, Save → Part B, Submit Work Order. No role check on this path, no switch. Details: unplanned-wo.md.
    Exceptions / edge cases: The Sail Admin requirement belongs to 'Generate Now' only; it does not apply to per-job 'Generate WO' or to unplanned work orders.
    Where the manual differs: The June manuals describe only ways 2 and 3 and state no office conditions; automatic ship generation and 'Generate Now' are absent from them. See CONFLICTS.md.
    Related procedures: planned-wo-ship-daily-scan.md · office-generate-now.md · office-generate-wo-per-job.md · unplanned-wo.md
    ```
  - [2] Technical - PMS User Manual For Office_Sail Admin_R2_08.06.2026.pdf · 1.1.5.2 HOW TO CREATE AN UNPLANNED WORK ORDER (p.29) · 1026 chars · d=0.887
    ```
    * Go to the 'Work Orders' sub-sub module. (Ref Figure 43)
    
    * Select the vessel from the 'Vessel' dropdown. (Ref Figure 43)
    
    * Click on the '+ Unplanned W\.O' button to create an unplanned work order. (Ref Figure 43)
    
    Screenshot of the Work Orders (W\.O) dashboard showing three steps: 1. Click here to access the 'Work Orders', 2. Click here to select a vessel, and 3. Click here to open an unplanned work order form.
    
    Figure 43
    
    * The 'Work Order Form – Unplanned Maintenance' form below appears after clicking the '+ Unplanned W\.O' button. (Ref Figure 44)
    
    * Enter all required job details in Part A and click Save to store it as a draft. Then complete Part B and click Submit Work Order to generate the unplanned work order. (Ref Figure 44)
    
    Screenshot of the Work Order Form - Unplanned showing the Save button highlighted with "Click the Save button to save it as a draft" and the Submit Work Order button highlighted with "After filling the form, click here to create an unplanned work order."
    
    Figure 44
    
    Page 29 of 64
    ```
  - [3] Technical - PMS User Manual For Office_Sail Admin_R2_08.06.2026.pdf · Introduction (p.28) · 319 chars · d=0.8977
    ```
    * Work Orders (WO) are a structured instruction used onboard to plan, execute, and record maintenance activities for equipment and systems. It serves as the primary control mechanism to ensure that all maintenance tasks are carried out systematically, safely, and in compliance with company and regulatory requirements.
    ```
  - [4] Technical - PMS User Manual For Office_Sail Admin_R2_08.06.2026.pdf · TECHNICAL USER MANUAL (p.18) · 1051 chars · d=0.9005
    ```
    * In the Part C section, users can view all associated jobs for the component, including Task type, frequency, and last/next due dates. (Ref Figure 22)
    * The user can click the 'Generate WO' button to create a WO manually for the selected component. (Ref Figure 22)
    
    Screenshot of the Components interface showing component details and a list of jobs. A callout box labeled "1" points to the jobs section, and a callout box labeled "2" points to the 'Generate WO' button.
    
    <u>Figure 22</u>
    
    * The screen below appears after clicking the 'Generate WO' button. (Ref Figure 23)
    * Choose the appropriate reason for generating the work order from the listed options (Ref Figure 23), and the Work Order will be generated.
    
    Screenshot of the 'Generate Work Order' pop-up window over the Components interface. A callout box points to the pop-up, indicating where to choose a reason for the Work Order.
    
    <u>Figure 23</u>
    
    [!NOTE]
    Ensure that there is no active WO for the same selected job, as the system does not allow the generation of duplicate work orders.
    ```
  - [5] Technical - PMS User Manual_Vessel Specific_R3_08.07.2026.pdf · 1.1.5.2 HOW TO CREATE AN UNPLANNED WORK ORDER (p.24) · 681 chars · d=0.9042
    ```
    * Go to the 'Work Orders' sub-sub module. (Ref Figure 33)
    
    * Click on the '+ Unplanned W\.O' button to create an unplanned work order. (Ref Figure 33)
    
    screenshot: Work Orders dashboard showing navigation to Work Orders and the Unplanned W\.O button
    
    Figure 33
    
    * The 'Work Order Form – Unplanned Maintenance' form below appears after clicking the '+ Unplanned W\.O' button. (Ref Figure 34)
    
    * Enter all required job details in Part A and click Save to store it as a draft. Then complete Part B and click Submit Work Order to generate the unplanned work order. (Ref Figure 34)
    
    screenshot: Work Order Form - Unplanned showing the Save button and Submit Work Order button
    
    Figure 34
    ```

## wo-phr-05 · B-kb-pilot · run 2 → **ANSWER GENERATION**
- question: How do work orders get created in the Technical module?
- judge: answer=True citation=True rule=False — automatic generation ✓; pairing ✗: Generate WO block lacks the vessel switch
- classification note: every dropped item is in the supplied text
- citations returned by this run: ['Technical - KB pilot: How work orders are created — the three ways to create a work order.md', 'Technical - PMS User Manual For Office_Sail Admin_R2_08.06.2026', 'Technical - PMS User Manual_Vessel Specific_R3_08.07.2026']  (all within the probe's hit list)
- answer (full): 1. **Planned (scheduled) work orders**: - Generated automatically by the system from each job's frequency and next due date. - ON THE SHIP: automatic, once a day, no user action required. - IN THE OFFICE: A Sail Admin can click 'Generate Now' on the Work Orders screen for one vessel, only if that vessel's switch is ON. 2. **One job on demand**: - Navigate to Components → (Office: select the vessel) → open the component → Part C → click 'Generate WO' → choose the reason (Planning / Breakdown / Other). - No role check applies; the job must be active and must not already have an active work order. 3. **Unplanned work**: - Go to Work Orders → (Office: select the vessel) → click '+ Unplanned W.O' → enter details in Part A and click Save → complete Part B and click Submit Work Order. Source: [1] How work orders are created — the three ways to create a work order.
- excerpt text: same as run 1 of wo-phr-05 on B-kb-pilot (above)

## wo-phr-05 · B-kb-pilot · run 3 → **ANSWER GENERATION**
- question: How do work orders get created in the Technical module?
- judge: answer=True citation=True rule=False — automatic generation ✓; pairing ✗: Generate WO block lacks the vessel switch
- classification note: every dropped item is in the supplied text
- citations returned by this run: ['Technical - KB pilot: How work orders are created — the three ways to create a work order.md', 'Technical - PMS User Manual For Office_Sail Admin_R2_08.06.2026', 'Technical - PMS User Manual_Vessel Specific_R3_08.07.2026']  (all within the probe's hit list)
- answer (full): 1. **Planned (scheduled) work orders**: - Generated automatically by the system from each job's frequency and next due date on the ship once a day, with no user action required. - In the office, a Sail Admin can click 'Generate Now' on the Work Orders screen for one vessel, only if that vessel's switch is ON. 2. **One job on demand**: - Navigate to Components → (Office: select the vessel) → open the component → Part C → click 'Generate WO' → choose the reason (Planning / Breakdown / Other). - No role check applies, but the job must be active and must not already have an active work order. 3. **Unplanned work**: - Go to Work Orders → (Office: select the vessel) → click '+ Unplanned W.O' → enter details in Part A and click Save → complete Part B and click Submit Work Order. Source: [1] (How work orders are created — the three ways to create a work order), [2] (HOW TO CREATE AN UNPLANNED WORK ORDER), [4] (Technical User Manual).
- excerpt text: same as run 1 of wo-phr-05 on B-kb-pilot (above)
