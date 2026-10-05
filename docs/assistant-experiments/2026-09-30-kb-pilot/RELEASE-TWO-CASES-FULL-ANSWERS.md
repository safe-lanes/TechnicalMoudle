# Release regression — the two cases in full (5 Oct 2026)

BASE = today's live image (v7-r2) + live settings · REL = release image + release settings. Same copy of the live index
(`kb-xref-e`), nothing published. Excerpts below are the indexed text the chatbot is given (from the database), not
the PDF. Both arms cited the **same sections** in every run of both cases.

## Classification (by me; READ)

| Case · run | Required by the judge | What the answer did | Class |
|---|---|---|---|
| fresh-audit-1 · REL run 2 | "mandatory" | Says "Complete all inspection-detail fields marked with \*", then Save / Upload / Next correctly (plus Vessel / Inspection Type and the SIRE/CDI path). Manual: "Complete all mandatory fields marked with (\*)". The instruction and the marker are kept; the word "mandatory" is not. | **Different wording** — no fact missing |
| certsurveys-1 · REL run 1 | "master id" | All user steps present and correct (Admin → Ship's Certificates → Edit → New → enter details → Save → Yes, Reorder / No, Keep at End). Manual p.18: "The system adds a new editable row at the bottom of the table with an auto-generated Master ID." The answer says only "In the new editable row…". | **Actual omission** of one stated fact (informational; no user action depends on it; nothing wrong stated) |
| certsurveys-1 · BASE run 3 and REL run 2 (both judged PASS) | — | Place the Master ID at **Save** ("creates the record with an auto-generated Master ID" / "assigns … on Save"); the manual says the row gets the ID when **New** is clicked. | **Small inaccuracy the judge does not detect** — one run on each side |

Supporting excerpt that the certsurveys answers draw on (cited by every run as "TECHNICAL USER MANUAL (p.18)"):

```text
* The screen below appears after clicking the 'Edit' button. (Ref Figure 21)
* Click the 'New' button to add a new certificate record. (Ref Figure 21)
* The screen below appears after clicking the 'New' button. (Ref Figure 22)
* The system adds a new editable row at the bottom of the table with an auto-generated Master ID. (Ref Figure 22)
* Enter the required details, including Certificate Name, Category, Group, Requirement/Reference, Applicable to Company, and Certificate Label. (Ref Figure 22)
* Click the 'Save' icon to create the new certificate record, then click 'Yes, Reorder' to move it to the selected Category and Group section or 'No, Keep at End' to retain its position at the end of the table. (Ref Figure 22)
☞ Mandatory fields (*) must be completed before the record can be saved.
☞ Follow the same procedure to create new records in the 'Company' and 'Vessel' tabs.
```

---


## fresh-audit-1 (mandatory fields)

**Question:** After I create an inspection record in Audit History, what do the Save, Upload and Next buttons do, and which fields must I complete?

**What the case requires** (must appear in the answer body): ['mandatory', 'save', 'upload'] · must not: ['not covered', 'not documented', 'does not describe']

**Case evidence (from the manual):** An inspection record will be created. Complete all mandatory fields marked with (*). Click Save to save the inspection details. Click Upload to attach the required supporting documents. Click Next to proceed to the Observation page and enter the observation details, as applicable.

### Supporting manual excerpts (as indexed — the text the chatbot is given)

**Audit - History Manual_R1_30.06.2026.pdf · Audit - History Manual_R1_30.06.2026 > 2.1.1 INSPECTION RECORD PAGE: (p.8) · p.8**

```text
* An inspection record will be created. Complete all mandatory fields marked with (**\***).

* <u>Click **Save** to save the inspection details.</u>

* <u>Click **Upload** to attach the required supporting documents.</u>

* <u>Click **Next** to proceed to the **Observation** page and enter the observation details, as</u> applicable. (See **Figure 6.**)

screenshot: SIRE 2.0 BETA Inspection Details form with annotations pointing to Save, Next, and Upload buttons

Figure 6

<mark>All attachments related to the inspection record are displayed under the Upload icon.</mark>
```

**Audit - History Manual_R1_30.06.2026.pdf · Audit - History Manual_R1_30.06.2026 > 3.1 INSPECTION PAGE: (p.14) · p.14**

```text
* An inspection record will be created. Complete all mandatory fields marked with **(\*)**.

* <u>Click **Save** to save the inspection details.</u>

* <u>Click **Upload** to attach the required supporting attachments.</u>

* <u>Click **Next** to proceed to the **Observation** page and enter the observation details, as</u> applicable. (See **Figure 17.**)
```

**Audit - History Manual_R1_30.06.2026.pdf · Audit - History Manual_R1_30.06.2026 > 2.1 METHOD 1: MANUAL DATA ENTRY (p.7) · p.7**

```text
* Click **+ New Record** to add an inspection record. (See **Figure 4.**)

screenshot: SIRE 2.0 History page showing the + New Record button

Figure 4

* <u>Select the **Vessel** from the dropdown menu.</u>

* <u>Select the desired **Inspection Type** from the dropdown menu.</u>

* Click **Add New** to create the inspection record. (See **Figure 5.**)

screenshot: Manual Data Entry modal with Vessel and Inspection Type dropdowns and Add New button

Figure 5
```

**Audit - History Manual_R1_30.06.2026.pdf · Audit - History Manual_R1_30.06.2026 > 2.2 METHOD 2: - SIRE\CDI UPLOAD (p.11) · p.11**

```text
* Click **New Record** to create a new inspection record. (See **Figure 11.**)

screenshot: SAIL application interface showing the History tab and a highlighted "+ New Record" button with a callout "Click here to add new inspection."

Figure 11

* <u>Select **SIRE 2.0 JSON**, **CDI XML**, or **SIRE XML** from the dropdown, as applicable.</u>

* <u>Click **Choose File**. The system prompts the user to select the required file from the storage</u> <u>location.</u>

* <u>Click **Upload** to upload the selected file.</u>

* An inspection record will be automatically created in **SAIL**. (See **Figure 12.**)

screenshot: New Record dialog box showing a dropdown for file type selection, a "CHOOSE FILE" button, and an "UPLOAD" button with instructional callouts.

Figure 12
```

### BASE run 1 — verdict {"answer": true, "module": true, "citation": true}

```text
For a **manually entered inspection record**:

1. Complete all mandatory fields marked with an asterisk (**\***). The excerpts do not specify the individual field names.
2. Click **Save** to save the inspection details.
3. Click **Upload** to attach the required supporting documents or attachments. These attachments are displayed under the Upload icon.
4. Click **Next** to proceed to the **Observation** page and enter the observation details, as applicable.

For a **SIRE 2.0 JSON, CDI XML, or SIRE XML upload**, the inspection and observation details are imported automatically and the record is created. Click **Upload** to add supporting attachments manually if required; the excerpts do not state that **Save** or **Next** are used for this upload process.

**Source:** Manual data entry — *Audit - History Manual_R1_30.06.2026*, §2.1.1 “Inspection Record Page,” p.8; inspection page — §3.1, p.14. SIRE/CDI upload — §2.2 “Method 2: SIRE\CDI Upload,” p.11; *Document*, p.13.
```

Citations: Audit - History Manual_R1_30.06.2026 — 2.1.1 INSPECTION RECORD PAGE: (p.8); Audit - History Manual_R1_30.06.2026 — 3.1 INSPECTION PAGE: (p.14); Audit - History Manual_R1_30.06.2026 — 2.2 METHOD 2: - SIRE\CDI UPLOAD (p.11); Audit - History Manual_R1_30.06.2026 — 2.1 METHOD 1: MANUAL DATA ENTRY (p.7); Audit - History Manual_R1_30.06.2026 — Document (p.13)

### BASE run 2 — verdict {"answer": true, "module": true, "citation": true}

```text
After creating an inspection record:

- **Manual data entry:** Complete all mandatory fields marked **(*)**.
  1. Click **Save** to save the inspection details.
  2. Click **Upload** to attach the required supporting documents.
  3. Click **Next** to proceed to the **Observation** page and enter observation details, as applicable.

- **SIRE/CDI upload:** The inspection and observation details are automatically imported and the inspection record is created. Click **Upload** to add supporting attachments manually, if required. The excerpts do not specify additional Save or Next actions for this upload process.

**Source:** Manual Data Entry, §2.1 and Inspection Record Page, §2.1.1 (p.8); SIRE/CDI Upload, §2.2 (p.11); Document, p.13; Inspection Page, §3.1 (p.14).
```

Citations: Audit - History Manual_R1_30.06.2026 — 2.1.1 INSPECTION RECORD PAGE: (p.8); Audit - History Manual_R1_30.06.2026 — 3.1 INSPECTION PAGE: (p.14); Audit - History Manual_R1_30.06.2026 — 2.2 METHOD 2: - SIRE\CDI UPLOAD (p.11); Audit - History Manual_R1_30.06.2026 — 2.1 METHOD 1: MANUAL DATA ENTRY (p.7); Audit - History Manual_R1_30.06.2026 — Document (p.13)

### BASE run 3 — verdict {"answer": true, "module": true, "citation": true}

```text
Audit History supports two ways to create an inspection record:

1. **Manual data entry**
   1. Click **+ New Record**.
   2. Select the **Vessel** and **Inspection Type**.
   3. Click **Add New**.
   4. Complete all inspection-detail fields marked with **\***.
   5. Click **Save** to save the inspection details.
   6. Click **Upload** to attach supporting documents or attachments.
   7. Click **Next** to open the **Observation** page and enter observation details, as applicable.

2. **SIRE/CDI file upload**
   1. Click **New Record**.
   2. Select **SIRE 2.0 JSON**, **CDI XML**, or **SIRE XML**, as applicable.
   3. Choose the required file and click **Upload**.
   4. The inspection record is created automatically, with the inspection and observation details imported. Upload any additional supporting attachments manually, if required.

For a manually entered record, the required fields are the fields marked **\***; the initial record also requires selecting the **Vessel** and **Inspection Type**.

**Source:**  
- Manual data entry — *Audit - History Manual_R1_30.06.2026*, §2.1 Method 1, p.7; §2.1.1 Inspection Record Page, p.8.  
- SIRE/CDI upload — *Audit - History Manual_R1_30.06.2026*, §2.2 Method 2, p.11; Document, p.13.
```

Citations: Audit - History Manual_R1_30.06.2026 — 2.1.1 INSPECTION RECORD PAGE: (p.8); Audit - History Manual_R1_30.06.2026 — 3.1 INSPECTION PAGE: (p.14); Audit - History Manual_R1_30.06.2026 — 2.2 METHOD 2: - SIRE\CDI UPLOAD (p.11); Audit - History Manual_R1_30.06.2026 — 2.1 METHOD 1: MANUAL DATA ENTRY (p.7); Audit - History Manual_R1_30.06.2026 — Document (p.13)

### REL run 1 — verdict {"answer": true, "module": true, "citation": true}

```text
Audit History supports two creation methods:

1. **Manual data entry**
   1. Click **+ New Record**.
   2. Select the **Vessel**.
   3. Select the **Inspection Type**.
   4. Click **Add New**.
   5. Complete all mandatory fields marked with **\***.
   6. Click **Save** to save the inspection details.
   7. Click **Upload** to attach supporting documents or attachments.
   8. Click **Next** to go to the **Observation** page and enter observation details, as applicable.

   The excerpts do not name the individual mandatory fields; they only state that fields marked **\*** must be completed.

2. **SIRE/CDI file upload**
   1. Click **New Record**.
   2. Select **SIRE 2.0 JSON**, **CDI XML**, or **SIRE XML**, as applicable.
   3. Click **Choose File** and select the file.
   4. Click **Upload**.
   5. The inspection and observation details are imported automatically and the inspection record is created. Supporting attachments can be added manually with **Upload**, if required.

**Source:** Manual data entry — *Audit - History Manual_R1_30.06.2026*, §2.1 Method 1 and §2.1.1 Inspection Record Page, pp.7–8. SIRE/CDI upload — same manual, §2.2 Method 2, p.11, and Document, p.13.
```

Citations: Audit - History Manual_R1_30.06.2026 — 2.1.1 INSPECTION RECORD PAGE: (p.8); Audit - History Manual_R1_30.06.2026 — 3.1 INSPECTION PAGE: (p.14); Audit - History Manual_R1_30.06.2026 — 2.2 METHOD 2: - SIRE\CDI UPLOAD (p.11); Audit - History Manual_R1_30.06.2026 — 2.1 METHOD 1: MANUAL DATA ENTRY (p.7); Audit - History Manual_R1_30.06.2026 — Document (p.13)

### REL run 2 — verdict {"answer": false, "module": true, "citation": true}

```text
There are two ways to create an inspection record:

1. **Manual data entry**
   1. Click **+ New Record**.
   2. Select the **Vessel**.
   3. Select the **Inspection Type**.
   4. Click **Add New**.
   5. Complete all inspection-detail fields marked with **\***.
   6. Click **Save** to save the inspection details.
   7. Click **Upload** to attach required supporting documents or attachments.
   8. Click **Next** to open the **Observation** page and enter observation details, as applicable.

2. **SIRE/CDI file upload**
   1. Click **New Record**.
   2. Select **SIRE 2.0 JSON**, **CDI XML**, or **SIRE XML**, as applicable.
   3. Click **Choose File** and select the required file.
   4. Click **Upload**. The inspection record is created automatically, with the inspection and observation details imported.
   5. Use **Upload** again to add supporting attachments manually, if required.

**Source:**  
- Manual data entry — *Audit - History Manual_R1_30.06.2026*, §2.1 Method 1, p.7; §2.1.1 Inspection Record Page, p.8.  
- SIRE/CDI upload — *Audit - History Manual_R1_30.06.2026*, §2.2 Method 2, p.11; Document, p.13.
```

Citations: Audit - History Manual_R1_30.06.2026 — 2.1.1 INSPECTION RECORD PAGE: (p.8); Audit - History Manual_R1_30.06.2026 — 3.1 INSPECTION PAGE: (p.14); Audit - History Manual_R1_30.06.2026 — 2.2 METHOD 2: - SIRE\CDI UPLOAD (p.11); Audit - History Manual_R1_30.06.2026 — 2.1 METHOD 1: MANUAL DATA ENTRY (p.7); Audit - History Manual_R1_30.06.2026 — Document (p.13)

### REL run 3 — verdict {"answer": true, "module": true, "citation": true}

```text
After creating the inspection record:

1. Complete every mandatory field marked with an asterisk (**\***). The excerpts do not list the individual field names.
2. Click **Save** to save the inspection details.
3. Click **Upload** to attach the required supporting documents or attachments. Attachments are displayed under the Upload icon.
4. Click **Next** to open the **Observation** page and enter observation details, as applicable.

For a manually created record, first select the **Vessel** and **Inspection Type**, then click **Add New**. For an imported record, the inspection and observation details are created automatically; supporting attachments can be uploaded manually if required.

**Source:** Audit - History Manual_R1_30.06.2026, §2.1.1 Inspection Record Page (p.8); §3.1 Inspection Page (p.14); §2.1 Method 1: Manual Data Entry (p.7); Document (p.13).
```

Citations: Audit - History Manual_R1_30.06.2026 — 2.1.1 INSPECTION RECORD PAGE: (p.8); Audit - History Manual_R1_30.06.2026 — 3.1 INSPECTION PAGE: (p.14); Audit - History Manual_R1_30.06.2026 — 2.2 METHOD 2: - SIRE\CDI UPLOAD (p.11); Audit - History Manual_R1_30.06.2026 — 2.1 METHOD 1: MANUAL DATA ENTRY (p.7); Audit - History Manual_R1_30.06.2026 — Document (p.13)


## certsurveys-1 (Master ID)

**Question:** What are the steps to add a brand-new certificate type to the Master list under Ship's Certificates?

**What the case requires** (must appear in the answer body): ['new', 'save', 'master id'] · must not: ['delete', 'export']

**Case evidence (from the manual):** Click the 'Edit' button. Click the 'New' button to add a new certificate record. The system adds a new editable row at the bottom of the table with an auto-generated Master ID. Enter the required details, including Certificate Name, Category, Group... Click the 'Save' icon to create the new certificate record, then click 'Yes, Reorder' or 'No, Keep at End'.

### Supporting manual excerpts (as indexed — the text the chatbot is given)

**Technical - Cert. & Surveys User Manual For Office_Sail Admin_R2_08.06.2026.pdf · Technical - Cert. & Surveys User Manual For Office_Sail Admin_R2_08.06.2026 > 1.2.1.4 HOW TO ADD A NEW MASTER CERTIFICATE (p.17) · p.17**

```text
* Click the 'Ship's Certificates' sub-submodule to view certificate details; the 'Master' tab is displayed by default. (Ref Figure 20)

* Click the 'Edit' button. (Ref Figure 20)

Screenshot of Ship Certificates Admin interface showing the Master tab and certificate list with callouts: 1. Click on the 'Ship's Certificates'. 2. Click here to edit.

Figure 20
```

### BASE run 1 — verdict {"answer": true, "citation": true}

```text
To add a brand-new certificate type to the **Master** list:

1. Open the **Admin** sub-module.
2. Open **Ship’s Certificates**. The **Master** tab opens by default.
3. Click **Edit**.
4. Click **New**. The system adds an editable row at the bottom with an auto-generated Master ID.
5. Enter the required details: **Certificate Name, Category, Group, Requirement/Reference, Applicable to Company,** and **Certificate Label**. Mandatory fields must be completed.
6. Click the **Save** icon.
7. Select **Yes, Reorder** to move the record to its selected Category and Group section, or **No, Keep at End** to leave it at the end of the table.

This function is for authorized users managing the system’s certificate master list.

**Source:** Technical - Cert. & Surveys User Manual For Office_Sail Admin_R2_08.06.2026, sections 1.2.1.1 “How to Access the Ship’s Certificates” (p.13), 1.2.1.4 “How to Add a New Master Certificate” (p.17), and Technical User Manual (p.18).
```

Citations: Technical - Cert. & Surveys User Manual For Office_Sail Admin_R2_08.06.2026 — 1.2.1.4 HOW TO ADD A NEW MASTER CERTIFICATE (p.17); Technical - Cert. & Surveys User Manual For Office_Sail Admin_R2_08.06.2026 — 1.2.1.3 HOW TO APPLY A NEW CERTIFICATE TYPE FLEET-WIDE (p.15); Technical - Cert. & Surveys User Manual For Office_Sail Admin_R2_08.06.2026 — TECHNICAL USER MANUAL (p.18); Technical - Cert. & Surveys User Manual For Office_Sail Admin_R2_08.06.2026 — 1.2.1 SHIP’S CERTIFICATES (p.13); Technical - Cert. & Surveys User Manual For Office_Sail Admin_R2_08.06.2026 — 1.2.1.1 HOW TO ACCESS THE SHIP’S CERTIFICATES (p.13)

### BASE run 2 — verdict {"answer": true, "citation": true}

```text
1. In the **Admin** sub-module, click **Ship’s Certificates**. The **Master** tab opens by default.
2. Click **Edit**.
3. Click **New**. The system adds an editable row at the bottom with an auto-generated **Master ID**.
4. Enter the required details: **Certificate Name, Category, Group, Requirement/Reference, Applicable to Company,** and **Certificate Label**.
5. Click the **Save** icon.
6. Select **Yes, Reorder** to move the certificate to its selected Category and Group section, or **No, Keep at End** to leave it at the end of the table.

This is for authorized administrators managing the Master certificate list. The required fields are mandatory.

**Source:** Technical - Cert. & Surveys User Manual For Office_Sail Admin_R2_08.06.2026, sections 1.2.1.1 (p.13), 1.2.1.4 (p.17), and Technical User Manual (p.18).
```

Citations: Technical - Cert. & Surveys User Manual For Office_Sail Admin_R2_08.06.2026 — 1.2.1.4 HOW TO ADD A NEW MASTER CERTIFICATE (p.17); Technical - Cert. & Surveys User Manual For Office_Sail Admin_R2_08.06.2026 — 1.2.1.3 HOW TO APPLY A NEW CERTIFICATE TYPE FLEET-WIDE (p.15); Technical - Cert. & Surveys User Manual For Office_Sail Admin_R2_08.06.2026 — TECHNICAL USER MANUAL (p.18); Technical - Cert. & Surveys User Manual For Office_Sail Admin_R2_08.06.2026 — 1.2.1 SHIP’S CERTIFICATES (p.13); Technical - Cert. & Surveys User Manual For Office_Sail Admin_R2_08.06.2026 — 1.2.1.1 HOW TO ACCESS THE SHIP’S CERTIFICATES (p.13)

### BASE run 3 — verdict {"answer": true, "citation": true}

```text
1. In the **Admin** sub-module, click **Ship’s Certificates**. The **Master** tab opens by default.
2. Click **Edit**.
3. Click **New**.
4. Enter the required details in the new editable row:
   - Certificate Name
   - Category
   - Group
   - Requirement/Reference
   - Applicable to Company
   - Certificate Label
5. Click the **Save** icon. The system creates the record with an auto-generated **Master ID**.
6. Choose **Yes, Reorder** to place it under the selected Category and Group, or **No, Keep at End** to leave it at the end of the table.

These steps are for an authorized user in the **Office Sail Admin** interface. The listed fields are mandatory as indicated in the manual. The Master list’s 71 system-defined certificates cannot be deleted.

Other supported certificate-list actions include applying a new certificate type fleet-wide and managing company- or vessel-level certificate records, but those are separate procedures.

**Source:** [1] *How to Add a New Master Certificate*, p. 17; [3] *Technical User Manual*, p. 18; [4] *Ship’s Certificates*, p. 13; [5] *How to Access the Ship’s Certificates*, p. 13.
```

Citations: Technical - Cert. & Surveys User Manual For Office_Sail Admin_R2_08.06.2026 — 1.2.1.4 HOW TO ADD A NEW MASTER CERTIFICATE (p.17); Technical - Cert. & Surveys User Manual For Office_Sail Admin_R2_08.06.2026 — 1.2.1.3 HOW TO APPLY A NEW CERTIFICATE TYPE FLEET-WIDE (p.15); Technical - Cert. & Surveys User Manual For Office_Sail Admin_R2_08.06.2026 — TECHNICAL USER MANUAL (p.18); Technical - Cert. & Surveys User Manual For Office_Sail Admin_R2_08.06.2026 — 1.2.1 SHIP’S CERTIFICATES (p.13); Technical - Cert. & Surveys User Manual For Office_Sail Admin_R2_08.06.2026 — 1.2.1.1 HOW TO ACCESS THE SHIP’S CERTIFICATES (p.13)

### REL run 1 — verdict {"answer": false, "citation": true}

```text
In the Office **Admin** module:

1. Click **Admin**, then click **Ship’s Certificates**. The **Master** tab opens by default.
2. Click **Edit**.
3. Click **New** to add a certificate record.
4. In the new editable row, enter the required details: **Certificate Name, Category, Group, Requirement/Reference, Applicable to Company, and Certificate Label**.
5. Click the **Save** icon.
6. Choose **Yes, Reorder** to move the certificate into the selected Category and Group section, or **No, Keep at End** to leave it at the end of the table.

This function is for authorized users managing the Master certificate list.

**Source:** Technical - Cert. & Surveys User Manual For Office_Sail Admin_R2_08.06.2026, sections 1.2.1.1, 1.2.1.4, and TECHNICAL USER MANUAL p.18.
```

Citations: Technical - Cert. & Surveys User Manual For Office_Sail Admin_R2_08.06.2026 — 1.2.1.4 HOW TO ADD A NEW MASTER CERTIFICATE (p.17); Technical - Cert. & Surveys User Manual For Office_Sail Admin_R2_08.06.2026 — 1.2.1.3 HOW TO APPLY A NEW CERTIFICATE TYPE FLEET-WIDE (p.15); Technical - Cert. & Surveys User Manual For Office_Sail Admin_R2_08.06.2026 — TECHNICAL USER MANUAL (p.18); Technical - Cert. & Surveys User Manual For Office_Sail Admin_R2_08.06.2026 — 1.2.1 SHIP’S CERTIFICATES (p.13); Technical - Cert. & Surveys User Manual For Office_Sail Admin_R2_08.06.2026 — 1.2.1.1 HOW TO ACCESS THE SHIP’S CERTIFICATES (p.13)

### REL run 2 — verdict {"answer": true, "citation": true}

```text
1. Click the **Admin** sub-module.
2. Click **Ship’s Certificates**. The **Master** tab opens by default.
3. Click **Edit**.
4. Click **New** to add a certificate record.
5. Enter the required details in the new editable row:
   - Certificate Name
   - Category
   - Group
   - Requirement/Reference
   - Applicable to Company
   - Certificate Label
6. Click the **Save** icon. The system assigns an auto-generated **Master ID**.
7. Choose:
   - **Yes, Reorder** to move the certificate to the selected Category and Group section; or
   - **No, Keep at End** to retain it at the end of the table.

The listed fields are mandatory as indicated in the manual.

**Source:** Technical - Cert. & Surveys User Manual For Office_Sail Admin_R2_08.06.2026, sections 1.2.1.1 “How to Access the Ship’s Certificates” (p.13), 1.2.1.4 “How to Add a New Master Certificate” (p.17), and technical steps on p.18.
```

Citations: Technical - Cert. & Surveys User Manual For Office_Sail Admin_R2_08.06.2026 — 1.2.1.4 HOW TO ADD A NEW MASTER CERTIFICATE (p.17); Technical - Cert. & Surveys User Manual For Office_Sail Admin_R2_08.06.2026 — 1.2.1.3 HOW TO APPLY A NEW CERTIFICATE TYPE FLEET-WIDE (p.15); Technical - Cert. & Surveys User Manual For Office_Sail Admin_R2_08.06.2026 — TECHNICAL USER MANUAL (p.18); Technical - Cert. & Surveys User Manual For Office_Sail Admin_R2_08.06.2026 — 1.2.1 SHIP’S CERTIFICATES (p.13); Technical - Cert. & Surveys User Manual For Office_Sail Admin_R2_08.06.2026 — 1.2.1.1 HOW TO ACCESS THE SHIP’S CERTIFICATES (p.13)

### REL run 3 — verdict {"answer": true, "citation": true}

```text
1. In the **Admin** sub-module, click **Ship’s Certificates**. The **Master** tab opens by default.
2. Click **Edit**.
3. Click **New**. The system adds an editable row at the bottom of the table with an auto-generated **Master ID**.
4. Enter the required details: **Certificate Name, Category, Group, Requirement/Reference, Applicable to Company,** and **Certificate Label**. Mandatory fields must be completed.
5. Click the **Save** icon.
6. Choose **Yes, Reorder** to place the certificate under its selected Category and Group, or **No, Keep at End** to leave it at the end of the table.

This procedure is for authorized users in the Office Admin module.

**Source:** Technical - Cert. & Surveys User Manual For Office_Sail Admin_R2_08.06.2026 — sections 1.2.1.1, 1.2.1.4, and Technical User Manual p.18.
```

Citations: Technical - Cert. & Surveys User Manual For Office_Sail Admin_R2_08.06.2026 — 1.2.1.4 HOW TO ADD A NEW MASTER CERTIFICATE (p.17); Technical - Cert. & Surveys User Manual For Office_Sail Admin_R2_08.06.2026 — 1.2.1.3 HOW TO APPLY A NEW CERTIFICATE TYPE FLEET-WIDE (p.15); Technical - Cert. & Surveys User Manual For Office_Sail Admin_R2_08.06.2026 — TECHNICAL USER MANUAL (p.18); Technical - Cert. & Surveys User Manual For Office_Sail Admin_R2_08.06.2026 — 1.2.1 SHIP’S CERTIFICATES (p.13); Technical - Cert. & Surveys User Manual For Office_Sail Admin_R2_08.06.2026 — 1.2.1.1 HOW TO ACCESS THE SHIP’S CERTIFICATES (p.13)

