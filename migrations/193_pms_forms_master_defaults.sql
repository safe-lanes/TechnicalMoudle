-- Fixed baseline on EVERY installation, shore and ships. No audit/sync writes.
-- UUID-v5 namespace: c9030cc3-3842-54f9-8626-1af86ca72675.
-- Existing UUID-matched rows (including edited/deleted rows) are never updated.
-- One DO statement: all conflict checks precede all inserts; errors roll it back.
DO $seed$
DECLARE
  seed_groups CONSTANT jsonb := $groups$
[
  {
    "fguuid": "4002e345-54db-5909-b85b-0a2b0e1b4311",
    "seed_key": "FG-DEF-A",
    "group_code": "A",
    "group_name": "Maintenance Planning & Execution",
    "display_order": 1,
    "is_default": true
  },
  {
    "fguuid": "1f0032e2-deb9-510c-a936-3f65851ae283",
    "seed_key": "FG-DEF-B",
    "group_code": "B",
    "group_name": "Critical Equipment & Operational Availability",
    "display_order": 2,
    "is_default": true
  },
  {
    "fguuid": "d3d69b94-2c2f-59cc-a268-2b141dd3dfe1",
    "seed_key": "FG-DEF-C",
    "group_code": "C",
    "group_name": "Permit to Work & Hazard Controls",
    "display_order": 3,
    "is_default": true
  },
  {
    "fguuid": "aeef5cd2-5cb0-56c9-a548-1d03fb9995eb",
    "seed_key": "FG-DEF-D",
    "group_code": "D",
    "group_name": "Inspection, Testing & Condition Monitoring",
    "display_order": 4,
    "is_default": true
  },
  {
    "fguuid": "ff931f5d-bfb0-5568-8c79-4417a092f257",
    "seed_key": "FG-DEF-E",
    "group_code": "E",
    "group_name": "Defect, Failure & Change Management",
    "display_order": 5,
    "is_default": true
  },
  {
    "fguuid": "1d02e03c-d8ab-50d2-9562-aafadccc5bbf",
    "seed_key": "FG-DEF-F",
    "group_code": "F",
    "group_name": "Spares, Workshop & External Services",
    "display_order": 6,
    "is_default": true
  },
  {
    "fguuid": "80cc6321-9936-5a31-ba40-76d90232da98",
    "seed_key": "FG-DEF-G",
    "group_code": "G",
    "group_name": "Major Repairs & Dry-Dock",
    "display_order": 7,
    "is_default": true
  }
]
$groups$::jsonb;
  seed_categories CONSTANT jsonb := $categories$
[
  {
    "fcuuid": "11745851-dbde-5d05-a412-236122466839",
    "seed_key": "FC-DEF-A-01",
    "group_uuid": "4002e345-54db-5909-b85b-0a2b0e1b4311",
    "category_no": 1,
    "category_name": "Completion & Closeout",
    "display_order": 1,
    "is_default": true
  },
  {
    "fcuuid": "c5b3883a-21e6-54ee-bfc3-21c620dd7791",
    "seed_key": "FC-DEF-A-02",
    "group_uuid": "4002e345-54db-5909-b85b-0a2b0e1b4311",
    "category_no": 2,
    "category_name": "Risk Assessment & Job Preparation",
    "display_order": 2,
    "is_default": true
  },
  {
    "fcuuid": "90c2bfde-3bb8-59da-9027-c0ac81aaf9b2",
    "seed_key": "FC-DEF-A-03",
    "group_uuid": "4002e345-54db-5909-b85b-0a2b0e1b4311",
    "category_no": 3,
    "category_name": "Work Planning & Method Statements",
    "display_order": 3,
    "is_default": true
  },
  {
    "fcuuid": "a67023f1-dd9b-574c-8ae0-aff07a5b8881",
    "seed_key": "FC-DEF-A-04",
    "group_uuid": "4002e345-54db-5909-b85b-0a2b0e1b4311",
    "category_no": 4,
    "category_name": "Inspection Planning & Checklists",
    "display_order": 4,
    "is_default": true
  },
  {
    "fcuuid": "80451f6c-2b92-506c-bf76-087876ce5a49",
    "seed_key": "FC-DEF-A-05",
    "group_uuid": "4002e345-54db-5909-b85b-0a2b0e1b4311",
    "category_no": 5,
    "category_name": "Scheduling & Deferral",
    "display_order": 5,
    "is_default": true
  },
  {
    "fcuuid": "5bf5cc13-be9c-565e-a0da-e0eb8c07242d",
    "seed_key": "FC-DEF-B-01",
    "group_uuid": "1f0032e2-deb9-510c-a936-3f65851ae283",
    "category_no": 1,
    "category_name": "Shutdown & Deactivation",
    "display_order": 1,
    "is_default": true
  },
  {
    "fcuuid": "da26a47e-c724-5064-9229-f3634d0594e6",
    "seed_key": "FC-DEF-B-02",
    "group_uuid": "1f0032e2-deb9-510c-a936-3f65851ae283",
    "category_no": 2,
    "category_name": "Reactivation & Return to Service",
    "display_order": 2,
    "is_default": true
  },
  {
    "fcuuid": "68a67f93-4109-5e18-a410-b2975f568578",
    "seed_key": "FC-DEF-B-03",
    "group_uuid": "1f0032e2-deb9-510c-a936-3f65851ae283",
    "category_no": 3,
    "category_name": "Functional Testing",
    "display_order": 3,
    "is_default": true
  },
  {
    "fcuuid": "3edd6680-1d4b-5748-b38f-a543751e0aac",
    "seed_key": "FC-DEF-B-04",
    "group_uuid": "1f0032e2-deb9-510c-a936-3f65851ae283",
    "category_no": 4,
    "category_name": "Safety System Bypass & Inhibition",
    "display_order": 4,
    "is_default": true
  },
  {
    "fcuuid": "abf64a51-4f35-5daf-a0cc-04abdfdc10e5",
    "seed_key": "FC-DEF-B-05",
    "group_uuid": "1f0032e2-deb9-510c-a936-3f65851ae283",
    "category_no": 5,
    "category_name": "Impairment & Out-of-Service",
    "display_order": 5,
    "is_default": true
  },
  {
    "fcuuid": "15b44d71-9111-5fae-ba1f-0a135765a527",
    "seed_key": "FC-DEF-B-06",
    "group_uuid": "1f0032e2-deb9-510c-a936-3f65851ae283",
    "category_no": 6,
    "category_name": "Shutdown Extension",
    "display_order": 6,
    "is_default": true
  },
  {
    "fcuuid": "acfd1e68-bdf5-54a2-9311-8b779b648cb9",
    "seed_key": "FC-DEF-B-07",
    "group_uuid": "1f0032e2-deb9-510c-a936-3f65851ae283",
    "category_no": 7,
    "category_name": "Overdue & Exception Control",
    "display_order": 7,
    "is_default": true
  },
  {
    "fcuuid": "0afee4b3-2c0c-58ab-b2f5-6fb012fb5001",
    "seed_key": "FC-DEF-B-08",
    "group_uuid": "1f0032e2-deb9-510c-a936-3f65851ae283",
    "category_no": 8,
    "category_name": "Contingency & Recovery",
    "display_order": 8,
    "is_default": true
  },
  {
    "fcuuid": "d7de1d65-662b-5486-b758-c4553ba3987c",
    "seed_key": "FC-DEF-C-01",
    "group_uuid": "d3d69b94-2c2f-59cc-a268-2b141dd3dfe1",
    "category_no": 1,
    "category_name": "General Permit to Work",
    "display_order": 1,
    "is_default": true
  },
  {
    "fcuuid": "0db9db5d-3c89-549f-8a22-c4251421d1d1",
    "seed_key": "FC-DEF-C-02",
    "group_uuid": "d3d69b94-2c2f-59cc-a268-2b141dd3dfe1",
    "category_no": 2,
    "category_name": "Hot & Cold Work Controls",
    "display_order": 2,
    "is_default": true
  },
  {
    "fcuuid": "5f1e88a1-7c78-5e31-97b3-28e342b64e4b",
    "seed_key": "FC-DEF-C-03",
    "group_uuid": "d3d69b94-2c2f-59cc-a268-2b141dd3dfe1",
    "category_no": 3,
    "category_name": "Enclosed Space & Atmosphere Control",
    "display_order": 3,
    "is_default": true
  },
  {
    "fcuuid": "5ae488f0-d8f9-584b-94e9-c143402a72b6",
    "seed_key": "FC-DEF-C-04",
    "group_uuid": "d3d69b94-2c2f-59cc-a268-2b141dd3dfe1",
    "category_no": 4,
    "category_name": "Electrical Safety",
    "display_order": 4,
    "is_default": true
  },
  {
    "fcuuid": "4cb4418f-3988-5fd5-9fc6-d5bc323ce755",
    "seed_key": "FC-DEF-C-05",
    "group_uuid": "d3d69b94-2c2f-59cc-a268-2b141dd3dfe1",
    "category_no": 5,
    "category_name": "Isolation & Energy Control",
    "display_order": 5,
    "is_default": true
  },
  {
    "fcuuid": "38c8df0f-069f-53da-b2db-5135665e8266",
    "seed_key": "FC-DEF-C-06",
    "group_uuid": "d3d69b94-2c2f-59cc-a268-2b141dd3dfe1",
    "category_no": 6,
    "category_name": "Work at Height & Overside",
    "display_order": 6,
    "is_default": true
  },
  {
    "fcuuid": "860eaa88-6bfe-5480-8ec3-ad4e43af9466",
    "seed_key": "FC-DEF-C-07",
    "group_uuid": "d3d69b94-2c2f-59cc-a268-2b141dd3dfe1",
    "category_no": 7,
    "category_name": "Lifting Operations",
    "display_order": 7,
    "is_default": true
  },
  {
    "fcuuid": "e236f6a3-8496-5bb8-8d34-33cdf1614a2c",
    "seed_key": "FC-DEF-C-08",
    "group_uuid": "d3d69b94-2c2f-59cc-a268-2b141dd3dfe1",
    "category_no": 8,
    "category_name": "Line Breaking & Pressure Systems",
    "display_order": 8,
    "is_default": true
  },
  {
    "fcuuid": "eb409d2e-37b7-5dc6-83e4-6d4a8afe000d",
    "seed_key": "FC-DEF-C-09",
    "group_uuid": "d3d69b94-2c2f-59cc-a268-2b141dd3dfe1",
    "category_no": 9,
    "category_name": "Cargo & Tank-System Maintenance",
    "display_order": 9,
    "is_default": true
  },
  {
    "fcuuid": "6e3a57b2-be19-5407-a13c-19cf07a0afc0",
    "seed_key": "FC-DEF-C-10",
    "group_uuid": "d3d69b94-2c2f-59cc-a268-2b141dd3dfe1",
    "category_no": 10,
    "category_name": "Boiler & Furnace Maintenance",
    "display_order": 10,
    "is_default": true
  },
  {
    "fcuuid": "817ecd51-c9b9-555b-99d0-4cf9e32bb211",
    "seed_key": "FC-DEF-C-11",
    "group_uuid": "d3d69b94-2c2f-59cc-a268-2b141dd3dfe1",
    "category_no": 11,
    "category_name": "Underwater & Diving Operations",
    "display_order": 11,
    "is_default": true
  },
  {
    "fcuuid": "0d1c6fef-eae4-52e6-bc09-517e2c4762d4",
    "seed_key": "FC-DEF-D-01",
    "group_uuid": "aeef5cd2-5cb0-56c9-a548-1d03fb9995eb",
    "category_no": 1,
    "category_name": "Post-Maintenance Inspection",
    "display_order": 1,
    "is_default": true
  },
  {
    "fcuuid": "139b81a4-3083-5f7b-ab19-e7f8de80189f",
    "seed_key": "FC-DEF-D-02",
    "group_uuid": "aeef5cd2-5cb0-56c9-a548-1d03fb9995eb",
    "category_no": 2,
    "category_name": "Functional & Performance Testing",
    "display_order": 2,
    "is_default": true
  },
  {
    "fcuuid": "082cbda8-b312-580d-9373-d3778def56f7",
    "seed_key": "FC-DEF-D-03",
    "group_uuid": "aeef5cd2-5cb0-56c9-a548-1d03fb9995eb",
    "category_no": 3,
    "category_name": "Pressure & Leak Testing",
    "display_order": 3,
    "is_default": true
  },
  {
    "fcuuid": "fc381ad9-427f-5199-bb75-176e486c3400",
    "seed_key": "FC-DEF-D-04",
    "group_uuid": "aeef5cd2-5cb0-56c9-a548-1d03fb9995eb",
    "category_no": 4,
    "category_name": "Calibration & Instrument Verification",
    "display_order": 4,
    "is_default": true
  },
  {
    "fcuuid": "29dc6709-755d-5a67-ab57-2af6c91e3925",
    "seed_key": "FC-DEF-D-05",
    "group_uuid": "aeef5cd2-5cb0-56c9-a548-1d03fb9995eb",
    "category_no": 5,
    "category_name": "Condition Monitoring",
    "display_order": 5,
    "is_default": true
  },
  {
    "fcuuid": "5782bba9-0ed3-5f56-b8af-52778ff73c7a",
    "seed_key": "FC-DEF-D-06",
    "group_uuid": "aeef5cd2-5cb0-56c9-a548-1d03fb9995eb",
    "category_no": 6,
    "category_name": "Lubrication & Oil Analysis",
    "display_order": 6,
    "is_default": true
  },
  {
    "fcuuid": "abd51e6d-9b06-58e8-9982-c0dbfa51ced9",
    "seed_key": "FC-DEF-D-07",
    "group_uuid": "aeef5cd2-5cb0-56c9-a548-1d03fb9995eb",
    "category_no": 7,
    "category_name": "Overhaul Measurements",
    "display_order": 7,
    "is_default": true
  },
  {
    "fcuuid": "05be694d-aec9-57ca-a40a-fca1b22b22bc",
    "seed_key": "FC-DEF-D-08",
    "group_uuid": "aeef5cd2-5cb0-56c9-a548-1d03fb9995eb",
    "category_no": 8,
    "category_name": "Recommissioning & Handover",
    "display_order": 8,
    "is_default": true
  },
  {
    "fcuuid": "560a5b0b-b349-5da4-ba67-6ae1d5804e00",
    "seed_key": "FC-DEF-D-09",
    "group_uuid": "aeef5cd2-5cb0-56c9-a548-1d03fb9995eb",
    "category_no": 9,
    "category_name": "Safety Equipment Inspection & Service",
    "display_order": 9,
    "is_default": true
  },
  {
    "fcuuid": "649f13de-793c-57b0-95eb-cee90586f3bc",
    "seed_key": "FC-DEF-D-10",
    "group_uuid": "aeef5cd2-5cb0-56c9-a548-1d03fb9995eb",
    "category_no": 10,
    "category_name": "Defect Rectification Verification",
    "display_order": 10,
    "is_default": true
  },
  {
    "fcuuid": "6b7e8f5e-3396-5440-a1a6-845ae903989b",
    "seed_key": "FC-DEF-E-01",
    "group_uuid": "ff931f5d-bfb0-5568-8c79-4417a092f257",
    "category_no": 1,
    "category_name": "Defect Reporting",
    "display_order": 1,
    "is_default": true
  },
  {
    "fcuuid": "1b8d3447-db1f-5edc-9262-391cfdd7941d",
    "seed_key": "FC-DEF-E-02",
    "group_uuid": "ff931f5d-bfb0-5568-8c79-4417a092f257",
    "category_no": 2,
    "category_name": "Breakdown & Failure Reporting",
    "display_order": 2,
    "is_default": true
  },
  {
    "fcuuid": "abc543ab-df0c-58b0-bb56-2573b82fa4b5",
    "seed_key": "FC-DEF-E-03",
    "group_uuid": "ff931f5d-bfb0-5568-8c79-4417a092f257",
    "category_no": 3,
    "category_name": "Root Cause Analysis",
    "display_order": 3,
    "is_default": true
  },
  {
    "fcuuid": "b3f4b68f-7832-5b87-b966-28d7c215dddf",
    "seed_key": "FC-DEF-E-04",
    "group_uuid": "ff931f5d-bfb0-5568-8c79-4417a092f257",
    "category_no": 4,
    "category_name": "Temporary Repair & Operational Restrictions",
    "display_order": 4,
    "is_default": true
  },
  {
    "fcuuid": "3c1d241c-67df-54f5-8369-e650101bfc0a",
    "seed_key": "FC-DEF-E-05",
    "group_uuid": "ff931f5d-bfb0-5568-8c79-4417a092f257",
    "category_no": 5,
    "category_name": "Non-Conformity & Corrective Action",
    "display_order": 5,
    "is_default": true
  },
  {
    "fcuuid": "fb18f8bc-45e8-5dec-81b2-a1268e83896f",
    "seed_key": "FC-DEF-E-06",
    "group_uuid": "ff931f5d-bfb0-5568-8c79-4417a092f257",
    "category_no": 6,
    "category_name": "Management of Change",
    "display_order": 6,
    "is_default": true
  },
  {
    "fcuuid": "589e5cbf-48ba-5b73-9861-4ef6916ddcb4",
    "seed_key": "FC-DEF-E-07",
    "group_uuid": "ff931f5d-bfb0-5568-8c79-4417a092f257",
    "category_no": 7,
    "category_name": "PMS Configuration & Maintenance Changes",
    "display_order": 7,
    "is_default": true
  },
  {
    "fcuuid": "70ff3f04-898e-5d73-af7a-71f8706bafde",
    "seed_key": "FC-DEF-E-08",
    "group_uuid": "ff931f5d-bfb0-5568-8c79-4417a092f257",
    "category_no": 8,
    "category_name": "Class & Statutory Findings",
    "display_order": 8,
    "is_default": true
  },
  {
    "fcuuid": "b6e10c55-bf7c-5c58-8d3c-ba7885c39aa2",
    "seed_key": "FC-DEF-E-09",
    "group_uuid": "ff931f5d-bfb0-5568-8c79-4417a092f257",
    "category_no": 9,
    "category_name": "Reliability Improvement & Repeat Defects",
    "display_order": 9,
    "is_default": true
  },
  {
    "fcuuid": "771e2ce4-f54c-5014-ad56-5a23f0914c1c",
    "seed_key": "FC-DEF-F-01",
    "group_uuid": "1d02e03c-d8ab-50d2-9562-aafadccc5bbf",
    "category_no": 1,
    "category_name": "Spare Parts Procurement",
    "display_order": 1,
    "is_default": true
  },
  {
    "fcuuid": "dd711e8a-5184-5380-9093-bfc809279986",
    "seed_key": "FC-DEF-F-02",
    "group_uuid": "1d02e03c-d8ab-50d2-9562-aafadccc5bbf",
    "category_no": 2,
    "category_name": "Spare Parts Issue & Consumption",
    "display_order": 2,
    "is_default": true
  },
  {
    "fcuuid": "c99609d4-bb1f-50a1-be74-f3a3f2f6ccb9",
    "seed_key": "FC-DEF-F-03",
    "group_uuid": "1d02e03c-d8ab-50d2-9562-aafadccc5bbf",
    "category_no": 3,
    "category_name": "Critical Spare Availability",
    "display_order": 3,
    "is_default": true
  },
  {
    "fcuuid": "ad007d98-86f6-5059-9a56-b496d4cb2a2e",
    "seed_key": "FC-DEF-F-04",
    "group_uuid": "1d02e03c-d8ab-50d2-9562-aafadccc5bbf",
    "category_no": 4,
    "category_name": "Spare Parts Return & Unused Materials",
    "display_order": 4,
    "is_default": true
  },
  {
    "fcuuid": "3c0c3c8d-fdb2-5e4a-b4be-df1c05d0d56f",
    "seed_key": "FC-DEF-F-05",
    "group_uuid": "1d02e03c-d8ab-50d2-9562-aafadccc5bbf",
    "category_no": 5,
    "category_name": "Workshop & Component Repair",
    "display_order": 5,
    "is_default": true
  },
  {
    "fcuuid": "bd6b6e34-2c17-5b95-ba4a-42052e6101a7",
    "seed_key": "FC-DEF-F-06",
    "group_uuid": "1d02e03c-d8ab-50d2-9562-aafadccc5bbf",
    "category_no": 6,
    "category_name": "Shore Service & Specialist Attendance",
    "display_order": 6,
    "is_default": true
  },
  {
    "fcuuid": "b3351685-de22-5b94-8825-ca69871fbf29",
    "seed_key": "FC-DEF-F-07",
    "group_uuid": "1d02e03c-d8ab-50d2-9562-aafadccc5bbf",
    "category_no": 7,
    "category_name": "Contractor Management & Attendance",
    "display_order": 7,
    "is_default": true
  },
  {
    "fcuuid": "754043a4-c5cd-5c7b-9311-6f18b2027854",
    "seed_key": "FC-DEF-F-08",
    "group_uuid": "1d02e03c-d8ab-50d2-9562-aafadccc5bbf",
    "category_no": 8,
    "category_name": "Repair Scope & Commercial Approval",
    "display_order": 8,
    "is_default": true
  },
  {
    "fcuuid": "6dcffe9a-ff03-5931-9ac9-7d67dbfce45a",
    "seed_key": "FC-DEF-F-09",
    "group_uuid": "1d02e03c-d8ab-50d2-9562-aafadccc5bbf",
    "category_no": 9,
    "category_name": "Service Documentation & Records",
    "display_order": 9,
    "is_default": true
  },
  {
    "fcuuid": "c115b439-0ff8-55b2-9b8c-fc135df07a40",
    "seed_key": "FC-DEF-G-01",
    "group_uuid": "80cc6321-9936-5a31-ba40-76d90232da98",
    "category_no": 1,
    "category_name": "Major Overhaul Planning",
    "display_order": 1,
    "is_default": true
  },
  {
    "fcuuid": "fc319cf9-05a1-55e4-8ee6-26f97f30d29a",
    "seed_key": "FC-DEF-G-02",
    "group_uuid": "80cc6321-9936-5a31-ba40-76d90232da98",
    "category_no": 2,
    "category_name": "Dry-Dock Planning & Repair Specification",
    "display_order": 2,
    "is_default": true
  },
  {
    "fcuuid": "407dc1b3-bd24-5237-9137-94966edf6a0d",
    "seed_key": "FC-DEF-G-03",
    "group_uuid": "80cc6321-9936-5a31-ba40-76d90232da98",
    "category_no": 3,
    "category_name": "Dry-Dock Completion & Outstanding Items",
    "display_order": 3,
    "is_default": true
  },
  {
    "fcuuid": "684d2581-6f48-5ae9-a576-dfd54ff164ae",
    "seed_key": "FC-DEF-G-04",
    "group_uuid": "80cc6321-9936-5a31-ba40-76d90232da98",
    "category_no": 4,
    "category_name": "Trials & Post-Repair Verification",
    "display_order": 4,
    "is_default": true
  },
  {
    "fcuuid": "7d26183a-2f79-5989-80fd-c2e0bd7148b9",
    "seed_key": "FC-DEF-G-05",
    "group_uuid": "80cc6321-9936-5a31-ba40-76d90232da98",
    "category_no": 5,
    "category_name": "Lessons Learned & Continuous Improvement",
    "display_order": 5,
    "is_default": true
  }
]
$categories$::jsonb;
  seed_forms CONSTANT jsonb := $forms$
[
  {
    "fmuuid": "84a50f13-9656-5920-bc24-725ba86e7d62",
    "seed_key": "FM-DEF-001",
    "form_id": "A01-001",
    "scope": "fleet",
    "vessel_id": null,
    "group_uuid": "4002e345-54db-5909-b85b-0a2b0e1b4311",
    "category_uuid": "11745851-dbde-5d05-a412-236122466839",
    "form_name": "Maintenance Work Completion Report",
    "company_form_name": "Maintenance Work Completion Report",
    "when_to_use": "After the task is performed, to record work actually done, findings, readings, labour, parts used and any follow-up action before closure.",
    "responsible": "Person who performed the work; assigned engineer consolidates the record.",
    "typical_jobs": "Record pump overhaul findings, filter change, clearances, test readings and parts consumed.",
    "suggested_approver": "Chief Engineer or responsible HOD verifies completion and evidence; additional approval if required by SMS.",
    "is_default": true
  },
  {
    "fmuuid": "dcabbb2d-d2d1-5ad0-b202-e414483079ef",
    "seed_key": "FM-DEF-002",
    "form_id": "A02-001",
    "scope": "fleet",
    "vessel_id": null,
    "group_uuid": "4002e345-54db-5909-b85b-0a2b0e1b4311",
    "category_uuid": "c5b3883a-21e6-54ee-bfc3-21c620dd7791",
    "form_name": "Risk Assessment (RA) Form",
    "company_form_name": "Risk Assessment (RA) Form",
    "when_to_use": "Before work where required by the SMS; especially non-routine, high-risk, unfamiliar, simultaneous or critical-equipment work. Review if conditions change.",
    "responsible": "Person in charge of the job prepares it with the work team and affected departments.",
    "typical_jobs": "Main engine overhaul, critical pump shutdown, work in a hazardous area.",
    "suggested_approver": "Master or designated responsible officer under the SMS; shore approval for defined high-risk cases if required.",
    "is_default": true
  },
  {
    "fmuuid": "1c3ead75-e894-56bf-9413-6f8f8945043b",
    "seed_key": "FM-DEF-003",
    "form_id": "A02-002",
    "scope": "fleet",
    "vessel_id": null,
    "group_uuid": "4002e345-54db-5909-b85b-0a2b0e1b4311",
    "category_uuid": "c5b3883a-21e6-54ee-bfc3-21c620dd7791",
    "form_name": "Job Safety Analysis (JSA) / Task Risk Assessment",
    "company_form_name": "Job Safety Analysis (JSA) / Task Risk Assessment",
    "when_to_use": "When task steps and hazards need to be assessed in detail; may be incorporated into the RA instead of creating a duplicate document.",
    "responsible": "Job supervisor / person in charge with participating crew.",
    "typical_jobs": "Removing a heavy motor, opening a pressurised system, work near rotating machinery.",
    "suggested_approver": "Chief Engineer / relevant HOD or other designated permit issuer under the SMS.",
    "is_default": true
  },
  {
    "fmuuid": "e743c94e-6e16-5d70-adbc-1d2fb7d0f799",
    "seed_key": "FM-DEF-004",
    "form_id": "A02-003",
    "scope": "fleet",
    "vessel_id": null,
    "group_uuid": "4002e345-54db-5909-b85b-0a2b0e1b4311",
    "category_uuid": "c5b3883a-21e6-54ee-bfc3-21c620dd7791",
    "form_name": "Toolbox Talk / Pre-Job Briefing Record",
    "company_form_name": "Toolbox Talk / Pre-Job Briefing Record",
    "when_to_use": "Before work when required by the SMS, permit or risk assessment; repeat when job scope, personnel or hazards change.",
    "responsible": "Person in charge of the job conducts the briefing; all participating personnel attend and acknowledge as required.",
    "typical_jobs": "Machinery overhaul, hot work, lifting operations, multi-team jobs.",
    "suggested_approver": "Responsible HOD or permit issuer confirms the briefing where the procedure requires it.",
    "is_default": true
  },
  {
    "fmuuid": "01b0fb2d-a528-58b2-995f-ca7f816c9701",
    "seed_key": "FM-DEF-005",
    "form_id": "A03-001",
    "scope": "fleet",
    "vessel_id": null,
    "group_uuid": "4002e345-54db-5909-b85b-0a2b0e1b4311",
    "category_uuid": "90c2bfde-3bb8-59da-9027-c0ac81aaf9b2",
    "form_name": "Maintenance Method Statement / Job Procedure",
    "company_form_name": "Maintenance Method Statement / Job Procedure",
    "when_to_use": "Before complex or major work when a controlled sequence, special tools, technical instructions, responsibilities or hold points are needed.",
    "responsible": "Chief Engineer / assigned engineer prepares or obtains the procedure, including maker instructions where applicable.",
    "typical_jobs": "Main engine overhaul, turbocharger overhaul, major valve replacement.",
    "suggested_approver": "Chief Engineer; Technical Superintendent / shore technical manager for major or non-standard work when required.",
    "is_default": true
  },
  {
    "fmuuid": "0c88ee7a-d125-5606-ad3c-43d4e0115428",
    "seed_key": "FM-DEF-006",
    "form_id": "A04-001",
    "scope": "fleet",
    "vessel_id": null,
    "group_uuid": "4002e345-54db-5909-b85b-0a2b0e1b4311",
    "category_uuid": "a67023f1-dd9b-574c-8ae0-aff07a5b8881",
    "form_name": "Maintenance Inspection Checklist",
    "company_form_name": "Maintenance Inspection Checklist",
    "when_to_use": "During planned inspection or maintenance when defined inspection points must be checked and recorded.",
    "responsible": "Assigned engineer / technician performs and records inspection.",
    "typical_jobs": "Pumps, compressors, generators, boilers, steering gear.",
    "suggested_approver": "Responsible HOD / Chief Engineer reviews exceptions and signs off as required.",
    "is_default": true
  },
  {
    "fmuuid": "043a8e22-40b7-5fb7-8131-7074e395a8ce",
    "seed_key": "FM-DEF-007",
    "form_id": "A05-001",
    "scope": "fleet",
    "vessel_id": null,
    "group_uuid": "4002e345-54db-5909-b85b-0a2b0e1b4311",
    "category_uuid": "80451f6c-2b92-506c-bf76-087876ce5a49",
    "form_name": "Maintenance Deferral / Postponement Request",
    "company_form_name": "Maintenance Deferral / Postponement Request",
    "when_to_use": "Before a scheduled job is deferred beyond its due date, where the SMS permits deferral and requires risk review and authorization.",
    "responsible": "Assigned engineer raises the request with reason, risk, proposed revised date and interim controls.",
    "typical_jobs": "Spare not received, weather or operational conditions prevent safe completion, specialist unavailable.",
    "suggested_approver": "Chief Engineer and/or Technical Superintendent under the vessel's PMS/SMS authority matrix; Master informed where required.",
    "is_default": true
  },
  {
    "fmuuid": "4021aedd-33de-5180-bab9-f543d879e2c6",
    "seed_key": "FM-DEF-008",
    "form_id": "B01-001",
    "scope": "fleet",
    "vessel_id": null,
    "group_uuid": "1f0032e2-deb9-510c-a936-3f65851ae283",
    "category_uuid": "5bf5cc13-be9c-565e-a0da-e0eb8c07242d",
    "form_name": "Critical Equipment Shutdown / Deactivation Request",
    "company_form_name": "Critical Equipment Shutdown / Deactivation Request",
    "when_to_use": "Before deliberately taking identified critical equipment or a critical system out of service; obtain required approval before shutdown.",
    "responsible": "Chief Engineer / responsible HOD raises the request and documents duration, risks, alternatives and safeguards.",
    "typical_jobs": "Taking an essential fire pump, emergency generator, steering system or other designated critical equipment out of service.",
    "suggested_approver": "Master and Technical Superintendent / designated shore authority as specified by the SMS; additional authority if required.",
    "is_default": true
  },
  {
    "fmuuid": "331e0969-3026-57c4-8e5b-f883534cffb5",
    "seed_key": "FM-DEF-009",
    "form_id": "B02-001",
    "scope": "fleet",
    "vessel_id": null,
    "group_uuid": "1f0032e2-deb9-510c-a936-3f65851ae283",
    "category_uuid": "da26a47e-c724-5064-9229-f3634d0594e6",
    "form_name": "Critical Equipment Reactivation / Return-to-Service Form",
    "company_form_name": "Critical Equipment Reactivation / Return-to-Service Form",
    "when_to_use": "After repair and before returning critical equipment to operational service when formal checks and authorization are required.",
    "responsible": "Assigned engineer performs checks; responsible HOD records results and confirms readiness.",
    "typical_jobs": "Returning an emergency generator or essential pump to service after repairs.",
    "suggested_approver": "Chief Engineer and Master / shore authority where required by the shutdown approval or SMS.",
    "is_default": true
  },
  {
    "fmuuid": "bdbd24ee-e5e6-53c1-8046-bfd736437f04",
    "seed_key": "FM-DEF-010",
    "form_id": "B03-001",
    "scope": "fleet",
    "vessel_id": null,
    "group_uuid": "1f0032e2-deb9-510c-a936-3f65851ae283",
    "category_uuid": "68a67f93-4109-5e18-a410-b2975f568578",
    "form_name": "Critical Equipment Functional Test Report",
    "company_form_name": "Critical Equipment Functional Test Report",
    "when_to_use": "After relevant maintenance and during scheduled tests required by the PMS, maker, SMS or safety procedures.",
    "responsible": "Assigned engineer / designated competent tester performs and records the test.",
    "typical_jobs": "Emergency generator start test, standby pump run, emergency shutdown or protective trip test.",
    "suggested_approver": "Chief Engineer / responsible HOD; shore/class/statutory witness or approval where specifically required.",
    "is_default": true
  },
  {
    "fmuuid": "c3da8616-0a4f-5a8e-ac78-0389da0897d4",
    "seed_key": "FM-DEF-011",
    "form_id": "B04-001",
    "scope": "fleet",
    "vessel_id": null,
    "group_uuid": "1f0032e2-deb9-510c-a936-3f65851ae283",
    "category_uuid": "3edd6680-1d4b-5748-b38f-a543751e0aac",
    "form_name": "Safety System Bypass / Alarm Inhibition Authorization",
    "company_form_name": "Safety System Bypass / Alarm Inhibition Authorization",
    "when_to_use": "Before inhibiting, bypassing or disabling an alarm, trip, interlock, detection or shutdown function, following the SMS procedure and time limits.",
    "responsible": "Responsible engineer requests the bypass and defines scope, duration, compensating controls and restoration plan.",
    "typical_jobs": "Temporarily inhibiting an alarm during sensor replacement or testing a protective trip.",
    "suggested_approver": "Chief Engineer and Master; shore technical / safety authority as required by SMS and system criticality.",
    "is_default": true
  },
  {
    "fmuuid": "3a0336e7-f929-5408-9814-5f9b516eb5c8",
    "seed_key": "FM-DEF-012",
    "form_id": "B05-001",
    "scope": "fleet",
    "vessel_id": null,
    "group_uuid": "1f0032e2-deb9-510c-a936-3f65851ae283",
    "category_uuid": "abf64a51-4f35-5daf-a0cc-04abdfdc10e5",
    "form_name": "Critical Equipment Impairment / Out-of-Service Notification",
    "company_form_name": "Critical Equipment Impairment / Out-of-Service Notification",
    "when_to_use": "Immediately when designated critical equipment fails, is unavailable or cannot perform its required function; notify relevant ship and shore personnel promptly.",
    "responsible": "Discovering officer / responsible HOD raises the report; Chief Engineer coordinates technical details.",
    "typical_jobs": "Fire pump failure, steering gear fault, emergency equipment unavailable.",
    "suggested_approver": "Master and Technical Superintendent / designated shore contact under the SMS; DPA or other authority if escalation criteria are met.",
    "is_default": true
  },
  {
    "fmuuid": "a0b963ad-661d-5a44-afc4-167767d1d4ca",
    "seed_key": "FM-DEF-013",
    "form_id": "B06-001",
    "scope": "fleet",
    "vessel_id": null,
    "group_uuid": "1f0032e2-deb9-510c-a936-3f65851ae283",
    "category_uuid": "15b44d71-9111-5fae-ba1f-0a135765a527",
    "form_name": "Critical Equipment Shutdown Extension Request",
    "company_form_name": "Critical Equipment Shutdown Extension Request",
    "when_to_use": "Before an approved shutdown period or restoration deadline is exceeded, where the procedure requires renewed approval and review of safeguards.",
    "responsible": "Responsible HOD / Chief Engineer raises the extension with revised schedule, reason and risk controls.",
    "typical_jobs": "Unexpected damage found during overhaul requiring additional repair time.",
    "suggested_approver": "Master and Technical Superintendent / designated shore authority in accordance with SMS.",
    "is_default": true
  },
  {
    "fmuuid": "7ae88440-a83b-53f0-ab36-86e1d39a6418",
    "seed_key": "FM-DEF-014",
    "form_id": "B07-001",
    "scope": "fleet",
    "vessel_id": null,
    "group_uuid": "1f0032e2-deb9-510c-a936-3f65851ae283",
    "category_uuid": "acfd1e68-bdf5-54a2-9311-8b779b648cb9",
    "form_name": "Critical Equipment Maintenance Overdue / Exception Report",
    "company_form_name": "Critical Equipment Maintenance Overdue / Exception Report",
    "when_to_use": "When critical maintenance is missed, cannot be completed by its due date, or needs a formally documented exception and escalation.",
    "responsible": "Assigned engineer identifies the overdue job; Chief Engineer verifies status and risk information.",
    "typical_jobs": "Critical task overdue because of operational constraints or unavailable parts.",
    "suggested_approver": "Chief Engineer and Technical Superintendent / shore authority as prescribed by the SMS; Master informed as required.",
    "is_default": true
  },
  {
    "fmuuid": "22b670fd-d0ca-5321-b661-97762c529117",
    "seed_key": "FM-DEF-015",
    "form_id": "B08-001",
    "scope": "fleet",
    "vessel_id": null,
    "group_uuid": "1f0032e2-deb9-510c-a936-3f65851ae283",
    "category_uuid": "0afee4b3-2c0c-58ab-b2f5-6fb012fb5001",
    "form_name": "Critical Equipment Recovery / Contingency Plan",
    "company_form_name": "Critical Equipment Recovery / Contingency Plan",
    "when_to_use": "When critical equipment is unavailable or degraded and temporary safeguards, alternative arrangements and recovery steps must be documented.",
    "responsible": "Chief Engineer with the affected HOD prepares and implements the plan.",
    "typical_jobs": "Alternative fire-fighting arrangements while an essential fire pump is unavailable, subject to approved procedures.",
    "suggested_approver": "Master and shore technical management; DPA / designated safety authority if the SMS requires.",
    "is_default": true
  },
  {
    "fmuuid": "627fdd5f-252d-5e2b-8431-839c100c69da",
    "seed_key": "FM-DEF-016",
    "form_id": "C01-001",
    "scope": "fleet",
    "vessel_id": null,
    "group_uuid": "d3d69b94-2c2f-59cc-a268-2b141dd3dfe1",
    "category_uuid": "d7de1d65-662b-5486-b758-c4553ba3987c",
    "form_name": "General Permit to Work (PTW)",
    "company_form_name": "General Permit to Work (PTW)",
    "when_to_use": "Before work for which the SMS requires formal permit authorization; identifies scope, location, hazards, isolations, precautions and validity period.",
    "responsible": "Person in charge requests the permit; authorized officer verifies site conditions and precautions.",
    "typical_jobs": "Non-routine hazardous maintenance or coordinated work involving multiple teams.",
    "suggested_approver": "Authorized permit issuer under the SMS, commonly Chief Engineer / Master / designated officer according to location and risk.",
    "is_default": true
  },
  {
    "fmuuid": "60acfa9f-ac74-5ddf-832b-d05dc28fdec9",
    "seed_key": "FM-DEF-017",
    "form_id": "C02-001",
    "scope": "fleet",
    "vessel_id": null,
    "group_uuid": "d3d69b94-2c2f-59cc-a268-2b141dd3dfe1",
    "category_uuid": "0db9db5d-3c89-549f-8a22-c4251421d1d1",
    "form_name": "Hot Work Permit",
    "company_form_name": "Hot Work Permit",
    "when_to_use": "Before welding, flame cutting, brazing or other spark/heat-generating work where a permit is required; verify area preparation, gas checks and fire watch arrangements.",
    "responsible": "Person in charge of hot work requests the permit and ensures precautions remain in place.",
    "typical_jobs": "Welding a bracket, flame cutting, grinding in a controlled hot-work area.",
    "suggested_approver": "Authorized hot-work permit issuer under SMS, typically Master or Chief Engineer / designated officer; shore authorization if specified.",
    "is_default": true
  },
  {
    "fmuuid": "4dbc91e6-839f-583e-bc10-88e277c8419b",
    "seed_key": "FM-DEF-018",
    "form_id": "C02-002",
    "scope": "fleet",
    "vessel_id": null,
    "group_uuid": "d3d69b94-2c2f-59cc-a268-2b141dd3dfe1",
    "category_uuid": "0db9db5d-3c89-549f-8a22-c4251421d1d1",
    "form_name": "Cold Work Permit",
    "company_form_name": "Cold Work Permit",
    "when_to_use": "Where the SMS requires a permit for non-hot work in a hazardous area or for specified mechanical activities.",
    "responsible": "Person in charge of the job requests the permit and confirms all conditions.",
    "typical_jobs": "Specified repairs in tanker cargo areas or mechanical work on equipment containing hazardous substances.",
    "suggested_approver": "Authorized permit issuer designated by the SMS, often Chief Engineer / Master depending on location.",
    "is_default": true
  },
  {
    "fmuuid": "aa19af8b-8b9d-580f-bc90-d740859244e0",
    "seed_key": "FM-DEF-019",
    "form_id": "C03-001",
    "scope": "fleet",
    "vessel_id": null,
    "group_uuid": "d3d69b94-2c2f-59cc-a268-2b141dd3dfe1",
    "category_uuid": "5f1e88a1-7c78-5e31-97b3-28e342b64e4b",
    "form_name": "Enclosed Space Entry Permit",
    "company_form_name": "Enclosed Space Entry Permit",
    "when_to_use": "Before entering a space classified as enclosed or requiring controlled entry under the SMS; confirm isolation, atmosphere testing, attendant, communications and rescue arrangements.",
    "responsible": "Entry supervisor / person in charge arranges preparation and entry controls; entrants and attendant follow the permit.",
    "typical_jobs": "Ballast tank, fuel tank, cofferdam, void space or machinery space classified for controlled entry.",
    "suggested_approver": "Master or designated responsible officer / authorized entry permit issuer under the SMS.",
    "is_default": true
  },
  {
    "fmuuid": "a1cf08ad-0942-5aa1-a113-936225fd2979",
    "seed_key": "FM-DEF-020",
    "form_id": "C03-002",
    "scope": "fleet",
    "vessel_id": null,
    "group_uuid": "d3d69b94-2c2f-59cc-a268-2b141dd3dfe1",
    "category_uuid": "5f1e88a1-7c78-5e31-97b3-28e342b64e4b",
    "form_name": "Gas Testing / Atmosphere Test Record",
    "company_form_name": "Gas Testing / Atmosphere Test Record",
    "when_to_use": "Before entry or hot work where required, and at intervals or continuously during work where the risk assessment or SMS requires monitoring.",
    "responsible": "Trained and authorized gas tester takes and records readings; entry/work supervisor checks validity.",
    "typical_jobs": "Enclosed-space entry, tank maintenance, hot work in a potentially flammable atmosphere.",
    "suggested_approver": "Authorized officer / permit issuer accepts results; specialist or shore approval only when specified.",
    "is_default": true
  },
  {
    "fmuuid": "5cfbc95c-81a3-5e7a-894a-5043a2a754b2",
    "seed_key": "FM-DEF-021",
    "form_id": "C04-001",
    "scope": "fleet",
    "vessel_id": null,
    "group_uuid": "d3d69b94-2c2f-59cc-a268-2b141dd3dfe1",
    "category_uuid": "5ae488f0-d8f9-584b-94e9-c143402a72b6",
    "form_name": "Electrical Work Permit",
    "company_form_name": "Electrical Work Permit",
    "when_to_use": "Before electrical work for which the SMS requires a permit; define equipment, voltage, isolation, testing and precautions.",
    "responsible": "Qualified electrician / responsible engineer requests and performs work within competence.",
    "typical_jobs": "Motor replacement, switchboard work, electrical fault-finding.",
    "suggested_approver": "Authorized electrical permit issuer under SMS; Chief Engineer / Master or HV authorized person as applicable.",
    "is_default": true
  },
  {
    "fmuuid": "dd3f0632-0314-5ae0-bd04-63d34e587063",
    "seed_key": "FM-DEF-022",
    "form_id": "C04-002",
    "scope": "fleet",
    "vessel_id": null,
    "group_uuid": "d3d69b94-2c2f-59cc-a268-2b141dd3dfe1",
    "category_uuid": "5ae488f0-d8f9-584b-94e9-c143402a72b6",
    "form_name": "High-Voltage Work Permit",
    "company_form_name": "High-Voltage Work Permit",
    "when_to_use": "Before work on high-voltage equipment under the vessel's dedicated HV safety procedure.",
    "responsible": "Authorized HV personnel plan and perform the work under the approved HV procedure.",
    "typical_jobs": "HV motor maintenance, HV switchgear inspection, HV cable testing.",
    "suggested_approver": "Designated HV Authorizing Officer / responsible senior engineer as defined by SMS.",
    "is_default": true
  },
  {
    "fmuuid": "b11bcc5f-9a32-56fd-9846-1cc20ef97248",
    "seed_key": "FM-DEF-023",
    "form_id": "C05-001",
    "scope": "fleet",
    "vessel_id": null,
    "group_uuid": "d3d69b94-2c2f-59cc-a268-2b141dd3dfe1",
    "category_uuid": "4cb4418f-3988-5fd5-9fc6-d5bc323ce755",
    "form_name": "Electrical / Mechanical Isolation Certificate",
    "company_form_name": "Electrical / Mechanical Isolation Certificate",
    "when_to_use": "Before work requiring formal control and verification of electrical, mechanical, hydraulic, pneumatic, pressure, steam or other hazardous energy.",
    "responsible": "Responsible engineer identifies energy sources; authorized person applies and verifies isolation.",
    "typical_jobs": "Pump repair, motor removal, work on rotating machinery or pressurised equipment.",
    "suggested_approver": "Authorized isolating officer / Chief Engineer or designated officer under SMS.",
    "is_default": true
  },
  {
    "fmuuid": "f85e5e51-bd78-5c15-901e-da7e31397740",
    "seed_key": "FM-DEF-024",
    "form_id": "C05-002",
    "scope": "fleet",
    "vessel_id": null,
    "group_uuid": "d3d69b94-2c2f-59cc-a268-2b141dd3dfe1",
    "category_uuid": "4cb4418f-3988-5fd5-9fc6-d5bc323ce755",
    "form_name": "Lockout / Tagout (LOTO) Record",
    "company_form_name": "Lockout / Tagout (LOTO) Record",
    "when_to_use": "Whenever locks/tags and documented control are required to prevent unintended energization, start-up, movement or release of energy.",
    "responsible": "Authorized person applies locks/tags; job supervisor verifies isolation and controls access.",
    "typical_jobs": "Isolating a motor, preventing remote start, maintaining automatic machinery.",
    "suggested_approver": "Authorized isolating officer / responsible HOD under the SMS.",
    "is_default": true
  },
  {
    "fmuuid": "f8813c30-3405-5cb3-b124-56b4fcbce6e1",
    "seed_key": "FM-DEF-025",
    "form_id": "C06-001",
    "scope": "fleet",
    "vessel_id": null,
    "group_uuid": "d3d69b94-2c2f-59cc-a268-2b141dd3dfe1",
    "category_uuid": "38c8df0f-069f-53da-b2db-5135665e8266",
    "form_name": "Working Aloft / Working at Height Permit",
    "company_form_name": "Working Aloft / Working at Height Permit",
    "when_to_use": "Before work at height where a permit or formal authorization is required; include access, fall prevention, rescue and weather considerations.",
    "responsible": "Person in charge arranges equipment and precautions; workers check their equipment and follow controls.",
    "typical_jobs": "Mast lights, antennas, funnel, elevated piping or platform maintenance.",
    "suggested_approver": "Master / Chief Engineer / designated permit issuer as specified by SMS and work location.",
    "is_default": true
  },
  {
    "fmuuid": "b05fdb1d-a9cd-5757-be98-a13df7eb78ba",
    "seed_key": "FM-DEF-026",
    "form_id": "C06-002",
    "scope": "fleet",
    "vessel_id": null,
    "group_uuid": "d3d69b94-2c2f-59cc-a268-2b141dd3dfe1",
    "category_uuid": "38c8df0f-069f-53da-b2db-5135665e8266",
    "form_name": "Overside Work Permit",
    "company_form_name": "Overside Work Permit",
    "when_to_use": "Before work over the vessel's side when required; assess weather, access, fall protection, rescue and communication arrangements.",
    "responsible": "Person in charge of the work coordinates the team and safety arrangements.",
    "typical_jobs": "Hull inspection, overboard fittings, shell plating or external sensor repair.",
    "suggested_approver": "Master or designated officer under SMS.",
    "is_default": true
  },
  {
    "fmuuid": "9579a7a9-ef99-5abd-9aa0-30e3013999da",
    "seed_key": "FM-DEF-027",
    "form_id": "C07-001",
    "scope": "fleet",
    "vessel_id": null,
    "group_uuid": "d3d69b94-2c2f-59cc-a268-2b141dd3dfe1",
    "category_uuid": "860eaa88-6bfe-5480-8ec3-ad4e43af9466",
    "form_name": "Lifting Operation Plan / Permit",
    "company_form_name": "Lifting Operation Plan / Permit",
    "when_to_use": "Before a lift that requires a plan or permit under SMS, especially heavy, complex, blind or high-risk lifts; check load, lifting gear, route and personnel roles.",
    "responsible": "Lifting supervisor / competent person prepares the plan and checks certified equipment.",
    "typical_jobs": "Removing a motor, lifting a pump casing, engine-room component handling by crane.",
    "suggested_approver": "Chief Engineer / Master or designated lifting authority as specified by SMS; shore approval where required.",
    "is_default": true
  },
  {
    "fmuuid": "5564403c-dfb5-5461-b0f4-dff62b3e7366",
    "seed_key": "FM-DEF-028",
    "form_id": "C08-001",
    "scope": "fleet",
    "vessel_id": null,
    "group_uuid": "d3d69b94-2c2f-59cc-a268-2b141dd3dfe1",
    "category_uuid": "e236f6a3-8496-5bb8-8d34-33cdf1614a2c",
    "form_name": "Line Breaking / Pressure System Opening Permit",
    "company_form_name": "Line Breaking / Pressure System Opening Permit",
    "when_to_use": "Before opening lines or equipment that may contain pressure, steam, fuel, gas, chemicals or other hazardous material when a specific permit/control is required.",
    "responsible": "Responsible engineer / person in charge identifies contents, depressurizes, drains, isolates and verifies safe condition.",
    "typical_jobs": "Opening a fuel line, steam line, compressed-air system or chemical pipe.",
    "suggested_approver": "Authorized permit issuer / Chief Engineer under SMS; Master or specialist authorization where required.",
    "is_default": true
  },
  {
    "fmuuid": "c34811ad-3896-57ca-b9c6-0e0ffcf2bb2f",
    "seed_key": "FM-DEF-029",
    "form_id": "C09-001",
    "scope": "fleet",
    "vessel_id": null,
    "group_uuid": "d3d69b94-2c2f-59cc-a268-2b141dd3dfe1",
    "category_uuid": "eb409d2e-37b7-5dc6-83e4-6d4a8afe000d",
    "form_name": "Tank / Cargo System Maintenance Preparation Certificate",
    "company_form_name": "Tank / Cargo System Maintenance Preparation Certificate",
    "when_to_use": "When required for work involving cargo tanks, cargo lines, pump rooms or hazardous cargo systems; use alongside relevant entry, gas-test, isolation or hot-work documents.",
    "responsible": "Cargo / deck officer or responsible engineer coordinates system preparation with the relevant department.",
    "typical_jobs": "Cargo pump maintenance, tank instrumentation repair, cargo pipeline inspection.",
    "suggested_approver": "Master / Chief Officer / Chief Engineer and shore cargo or technical authority as applicable to the system and SMS.",
    "is_default": true
  },
  {
    "fmuuid": "f949d37c-3d82-5a7b-a844-e182f7645a40",
    "seed_key": "FM-DEF-030",
    "form_id": "C10-001",
    "scope": "fleet",
    "vessel_id": null,
    "group_uuid": "d3d69b94-2c2f-59cc-a268-2b141dd3dfe1",
    "category_uuid": "6e3a57b2-be19-5407-a13c-19cf07a0afc0",
    "form_name": "Boiler / Furnace Maintenance Entry Authorization",
    "company_form_name": "Boiler / Furnace Maintenance Entry Authorization",
    "when_to_use": "Before opening or entering a boiler, furnace or similar equipment when a documented authorization is required; verify cooling, isolation, atmosphere and entry controls.",
    "responsible": "Responsible engineer prepares equipment and entry/work controls; competent personnel perform work.",
    "typical_jobs": "Internal boiler inspection, furnace repair, burner maintenance involving entry.",
    "suggested_approver": "Chief Engineer / designated entry or permit issuer; Master informed or approves where required.",
    "is_default": true
  },
  {
    "fmuuid": "9d40226b-05e8-5361-86e2-bcf9cd0a42ed",
    "seed_key": "FM-DEF-031",
    "form_id": "C11-001",
    "scope": "fleet",
    "vessel_id": null,
    "group_uuid": "d3d69b94-2c2f-59cc-a268-2b141dd3dfe1",
    "category_uuid": "817ecd51-c9b9-555b-99d0-4cf9e32bb211",
    "form_name": "Underwater Work / Diving Authorization",
    "company_form_name": "Underwater Work / Diving Authorization",
    "when_to_use": "Before underwater inspection or repair where approved by the company and permitted by applicable requirements; define scope, communications, vessel status and emergency response.",
    "responsible": "Master coordinates vessel safety; approved diving contractor / competent diving supervisor controls diving operations.",
    "typical_jobs": "Propeller inspection, hull inspection or underwater repair.",
    "suggested_approver": "Company / shore management and Master under SMS; relevant authorities as applicable.",
    "is_default": true
  },
  {
    "fmuuid": "43b99161-2d90-5893-90e5-1a99a5544f3f",
    "seed_key": "FM-DEF-032",
    "form_id": "D01-001",
    "scope": "fleet",
    "vessel_id": null,
    "group_uuid": "aeef5cd2-5cb0-56c9-a548-1d03fb9995eb",
    "category_uuid": "0d1c6fef-eae4-52e6-bc09-517e2c4762d4",
    "form_name": "Post-Maintenance Inspection Report",
    "company_form_name": "Post-Maintenance Inspection Report",
    "when_to_use": "After work where a responsible officer or independent inspection must verify assembly, guards, workmanship and safety before operation.",
    "responsible": "Person performing the work requests inspection; designated competent inspector checks it.",
    "typical_jobs": "Checking assembly, clearances, fasteners, alignment and guards after overhaul.",
    "suggested_approver": "Responsible HOD / Chief Engineer; independent or shore verification if specified.",
    "is_default": true
  },
  {
    "fmuuid": "7ffcb679-0dbc-56fb-8992-842ce27fefea",
    "seed_key": "FM-DEF-033",
    "form_id": "D02-001",
    "scope": "fleet",
    "vessel_id": null,
    "group_uuid": "aeef5cd2-5cb0-56c9-a548-1d03fb9995eb",
    "category_uuid": "139b81a4-3083-5f7b-ab19-e7f8de80189f",
    "form_name": "Functional Test / Performance Test Report",
    "company_form_name": "Functional Test / Performance Test Report",
    "when_to_use": "After maintenance or repair when the equipment's function or performance must be demonstrated and recorded.",
    "responsible": "Assigned engineer / competent tester performs the test and records acceptance criteria/results.",
    "typical_jobs": "Testing pump delivery, motor direction, alarm response or automatic start.",
    "suggested_approver": "Chief Engineer / responsible HOD; shore, class or statutory witness where specifically required.",
    "is_default": true
  },
  {
    "fmuuid": "cb866bd1-a5f4-526f-9955-f1174342bca1",
    "seed_key": "FM-DEF-034",
    "form_id": "D03-001",
    "scope": "fleet",
    "vessel_id": null,
    "group_uuid": "aeef5cd2-5cb0-56c9-a548-1d03fb9995eb",
    "category_uuid": "082cbda8-b312-580d-9373-d3778def56f7",
    "form_name": "Pressure Test / Leak Test Report",
    "company_form_name": "Pressure Test / Leak Test Report",
    "when_to_use": "After work affecting pressure integrity when testing is specified by maker, procedure, class, statutory rules or engineering assessment.",
    "responsible": "Responsible engineer / competent test personnel conduct and record the approved test.",
    "typical_jobs": "Pipe replacement, pressure vessel repair, valve or flange work.",
    "suggested_approver": "Chief Engineer / Technical Superintendent; class or authorized surveyor where required.",
    "is_default": true
  },
  {
    "fmuuid": "4a00c045-6195-5f7a-8040-23d7874fe00a",
    "seed_key": "FM-DEF-035",
    "form_id": "D04-001",
    "scope": "fleet",
    "vessel_id": null,
    "group_uuid": "aeef5cd2-5cb0-56c9-a548-1d03fb9995eb",
    "category_uuid": "fc381ad9-427f-5199-bb75-176e486c3400",
    "form_name": "Calibration / Instrument Verification Report",
    "company_form_name": "Calibration / Instrument Verification Report",
    "when_to_use": "After calibration, adjustment, sensor replacement or verification where readings or protective functions must be confirmed.",
    "responsible": "Qualified instrument/electrical technician or service engineer performs the calibration.",
    "typical_jobs": "Pressure transmitter, temperature sensor, level switch or flow meter calibration.",
    "suggested_approver": "Responsible HOD / Chief Engineer; specialist service or shore review when required.",
    "is_default": true
  },
  {
    "fmuuid": "3aafc6af-394a-50c3-8a4d-d04c2b184cdf",
    "seed_key": "FM-DEF-036",
    "form_id": "D05-001",
    "scope": "fleet",
    "vessel_id": null,
    "group_uuid": "aeef5cd2-5cb0-56c9-a548-1d03fb9995eb",
    "category_uuid": "29dc6709-755d-5a67-ab57-2af6c91e3925",
    "form_name": "Condition Monitoring Report",
    "company_form_name": "Condition Monitoring Report",
    "when_to_use": "When condition-based maintenance, trending or diagnostics are performed; attach readings and identify follow-up work.",
    "responsible": "Assigned engineer or competent specialist collects and interprets condition data.",
    "typical_jobs": "Vibration measurement, lubricating-oil analysis, thermal imaging or machinery performance monitoring.",
    "suggested_approver": "Chief Engineer / responsible HOD; Technical Superintendent reviews significant abnormal findings.",
    "is_default": true
  },
  {
    "fmuuid": "0465b350-7272-5f0e-9968-07ddceb13fe2",
    "seed_key": "FM-DEF-037",
    "form_id": "D06-001",
    "scope": "fleet",
    "vessel_id": null,
    "group_uuid": "aeef5cd2-5cb0-56c9-a548-1d03fb9995eb",
    "category_uuid": "5782bba9-0ed3-5f56-b8af-52778ff73c7a",
    "form_name": "Lubrication / Oil Sampling Record",
    "company_form_name": "Lubrication / Oil Sampling Record",
    "when_to_use": "During planned lubrication, fluid replacement or oil-condition monitoring as required by PMS and maker instructions.",
    "responsible": "Assigned engineer takes sample or performs lubrication and records product, quantity, date and observations.",
    "typical_jobs": "Gearbox oil sample, bearing lubrication, hydraulic oil analysis.",
    "suggested_approver": "Responsible HOD / Chief Engineer reviews exceptions and confirms record as required.",
    "is_default": true
  },
  {
    "fmuuid": "1d1ceaf7-40f9-56d7-a817-b009e0673f10",
    "seed_key": "FM-DEF-038",
    "form_id": "D07-001",
    "scope": "fleet",
    "vessel_id": null,
    "group_uuid": "aeef5cd2-5cb0-56c9-a548-1d03fb9995eb",
    "category_uuid": "abd51e6d-9b06-58e8-9982-c0dbfa51ced9",
    "form_name": "Machinery Overhaul Measurement Report",
    "company_form_name": "Machinery Overhaul Measurement Report",
    "when_to_use": "During major overhaul where clearances, dimensions, wear limits or alignment values must be documented against maker tolerances.",
    "responsible": "Assigned engineer / competent technician takes and records measurements.",
    "typical_jobs": "Bearing clearances, crankshaft deflection, cylinder liner measurements, component wear.",
    "suggested_approver": "Chief Engineer / responsible HOD; Technical Superintendent or maker's representative where required.",
    "is_default": true
  },
  {
    "fmuuid": "a2b2625f-1c0d-5c03-8451-1df73dee658d",
    "seed_key": "FM-DEF-039",
    "form_id": "D08-001",
    "scope": "fleet",
    "vessel_id": null,
    "group_uuid": "aeef5cd2-5cb0-56c9-a548-1d03fb9995eb",
    "category_uuid": "05be694d-aec9-57ca-a40a-fca1b22b22bc",
    "form_name": "Recommissioning / Handover Certificate",
    "company_form_name": "Recommissioning / Handover Certificate",
    "when_to_use": "After repair or maintenance when equipment must be formally handed back following isolation, major work or cross-department coordination.",
    "responsible": "Job supervisor and responsible operating department confirm work status, safeguards and handover details.",
    "typical_jobs": "Returning a repaired pump, compressor or system to operational control.",
    "suggested_approver": "Chief Engineer / responsible HOD; Master or shore authority if required for critical equipment.",
    "is_default": true
  },
  {
    "fmuuid": "9476bf9f-b4c6-5980-b9ee-178c6bc9460a",
    "seed_key": "FM-DEF-040",
    "form_id": "D09-001",
    "scope": "fleet",
    "vessel_id": null,
    "group_uuid": "aeef5cd2-5cb0-56c9-a548-1d03fb9995eb",
    "category_uuid": "560a5b0b-b349-5da4-ba67-6ae1d5804e00",
    "form_name": "Periodic Safety Equipment Inspection / Service Record",
    "company_form_name": "Periodic Safety Equipment Inspection / Service Record",
    "when_to_use": "For scheduled inspection, servicing and testing of safety equipment under the maintenance programme and applicable requirements.",
    "responsible": "Designated competent crew or authorized service provider performs the inspection/service.",
    "typical_jobs": "Fire pumps, fire detection, emergency generators, lifeboat machinery and launching appliances.",
    "suggested_approver": "Responsible officer / Chief Engineer as assigned; Master and shore/class review where required.",
    "is_default": true
  },
  {
    "fmuuid": "333d0884-0d24-5cee-8ee3-a486f21aebda",
    "seed_key": "FM-DEF-041",
    "form_id": "D10-001",
    "scope": "fleet",
    "vessel_id": null,
    "group_uuid": "aeef5cd2-5cb0-56c9-a548-1d03fb9995eb",
    "category_uuid": "649f13de-793c-57b0-95eb-cee90586f3bc",
    "form_name": "Defect Rectification Verification Form",
    "company_form_name": "Defect Rectification Verification Form",
    "when_to_use": "After reported defects are repaired when a designated person must confirm that the original defect is resolved and any test is satisfactory.",
    "responsible": "Person completing the repair records rectification; reporting officer or user confirms where practical.",
    "typical_jobs": "Repairing a leaking valve, faulty sensor or damaged coupling.",
    "suggested_approver": "Responsible HOD / Chief Engineer; Master or shore technical authority for critical/significant defects as required.",
    "is_default": true
  },
  {
    "fmuuid": "ebe99ccf-9982-56a9-99f9-c89a18b32802",
    "seed_key": "FM-DEF-042",
    "form_id": "E01-001",
    "scope": "fleet",
    "vessel_id": null,
    "group_uuid": "ff931f5d-bfb0-5568-8c79-4417a092f257",
    "category_uuid": "6b7e8f5e-3396-5440-a1a6-845ae903989b",
    "form_name": "Defect / Machinery Deficiency Report",
    "company_form_name": "Defect / Machinery Deficiency Report",
    "when_to_use": "Whenever equipment is found defective or does not meet its required operating condition; classify severity and track follow-up.",
    "responsible": "Person discovering the defect reports it; responsible HOD assesses and tracks it.",
    "typical_jobs": "Pump leakage, abnormal vibration, faulty pressure gauge, machinery malfunction.",
    "suggested_approver": "Chief Engineer / responsible HOD; Master and shore technical management for significant or critical defects.",
    "is_default": true
  },
  {
    "fmuuid": "7b642c25-350e-55c1-a468-e5ef5bc1423e",
    "seed_key": "FM-DEF-043",
    "form_id": "E02-001",
    "scope": "fleet",
    "vessel_id": null,
    "group_uuid": "ff931f5d-bfb0-5568-8c79-4417a092f257",
    "category_uuid": "1b8d3447-db1f-5edc-9262-391cfdd7941d",
    "form_name": "Breakdown / Failure Report",
    "company_form_name": "Breakdown / Failure Report",
    "when_to_use": "When equipment unexpectedly fails or cannot perform its intended function; record symptoms, effects, immediate response and downtime.",
    "responsible": "Officer / engineer discovering the failure; responsible HOD compiles technical details.",
    "typical_jobs": "Auxiliary engine failure, compressor breakdown, steering gear malfunction.",
    "suggested_approver": "Chief Engineer and Master; Technical Superintendent / shore authority for significant failures per SMS.",
    "is_default": true
  },
  {
    "fmuuid": "5146b8f8-4421-5f8c-8423-b1ddaa05ba32",
    "seed_key": "FM-DEF-044",
    "form_id": "E03-001",
    "scope": "fleet",
    "vessel_id": null,
    "group_uuid": "ff931f5d-bfb0-5568-8c79-4417a092f257",
    "category_uuid": "abc543ab-df0c-58b0-bb56-2573b82fa4b5",
    "form_name": "Failure Investigation / Root Cause Analysis (RCA)",
    "company_form_name": "Failure Investigation / Root Cause Analysis (RCA)",
    "when_to_use": "For significant, recurring, safety-related or critical-equipment failures when the SMS or management requires investigation.",
    "responsible": "Chief Engineer / investigation lead with relevant crew and shore specialists gathers evidence and identifies causes/actions.",
    "typical_jobs": "Repeated bearing failure, recurring pump damage or emergency generator starting failures.",
    "suggested_approver": "Technical Superintendent / shore technical manager; DPA or senior management where required by severity/SMS.",
    "is_default": true
  },
  {
    "fmuuid": "f716cc23-a8fb-58bf-982a-16bf2080016c",
    "seed_key": "FM-DEF-045",
    "form_id": "E04-001",
    "scope": "fleet",
    "vessel_id": null,
    "group_uuid": "ff931f5d-bfb0-5568-8c79-4417a092f257",
    "category_uuid": "b3f4b68f-7832-5b87-b966-28d7c215dddf",
    "form_name": "Temporary Repair / Operational Restriction Report",
    "company_form_name": "Temporary Repair / Operational Restriction Report",
    "when_to_use": "When an interim repair or operating restriction is used pending permanent rectification; document limitations, risk, monitoring and deadline.",
    "responsible": "Responsible engineer records the temporary measure, safeguards and planned permanent repair.",
    "typical_jobs": "Temporary leak repair, reduced capacity, equipment operating under an approved limitation.",
    "suggested_approver": "Chief Engineer and Master; Technical Superintendent / shore authority as required. Do not use as a substitute for mandatory statutory/class approval.",
    "is_default": true
  },
  {
    "fmuuid": "3fe7e486-448a-5749-b3e7-79ab1ed7392b",
    "seed_key": "FM-DEF-046",
    "form_id": "E05-001",
    "scope": "fleet",
    "vessel_id": null,
    "group_uuid": "ff931f5d-bfb0-5568-8c79-4417a092f257",
    "category_uuid": "3c1d241c-67df-54f5-8369-e650101bfc0a",
    "form_name": "Non-Conformity / Corrective Action Report",
    "company_form_name": "Non-Conformity / Corrective Action Report",
    "when_to_use": "When a deviation from a required procedure, maintenance requirement or SMS control needs formal correction and follow-up.",
    "responsible": "Person identifying the non-conformity reports it; responsible HOD investigates and assigns corrective action.",
    "typical_jobs": "Required maintenance omitted, inspection reveals procedural failure, mandatory control not followed.",
    "suggested_approver": "Master / DPA / shore management according to the company's non-conformity procedure.",
    "is_default": true
  },
  {
    "fmuuid": "daac3fb3-8261-54ec-b9a3-3f0d26b31dac",
    "seed_key": "FM-DEF-047",
    "form_id": "E06-001",
    "scope": "fleet",
    "vessel_id": null,
    "group_uuid": "ff931f5d-bfb0-5568-8c79-4417a092f257",
    "category_uuid": "fb18f8bc-45e8-5dec-81b2-a1268e83896f",
    "form_name": "Management of Change (MOC) Request",
    "company_form_name": "Management of Change (MOC) Request",
    "when_to_use": "Before a technical, operational or procedural change that falls within the company's MOC scope; assess risk and obtain approval before implementation.",
    "responsible": "Originator / responsible engineer prepares scope, reasons, risk assessment, drawings and affected documents.",
    "typical_jobs": "Different equipment design, system arrangement change, modification of control logic.",
    "suggested_approver": "Technical Superintendent / shore technical management and other designated SMS authorities; Master as applicable.",
    "is_default": true
  },
  {
    "fmuuid": "69aa197f-b8ca-5f5b-afe8-5365e78893a5",
    "seed_key": "FM-DEF-048",
    "form_id": "E07-001",
    "scope": "fleet",
    "vessel_id": null,
    "group_uuid": "ff931f5d-bfb0-5568-8c79-4417a092f257",
    "category_uuid": "589e5cbf-48ba-5b73-9861-4ef6916ddcb4",
    "form_name": "PMS Modification / Maintenance Interval Change Request",
    "company_form_name": "PMS Modification / Maintenance Interval Change Request",
    "when_to_use": "When component data, job instructions, spare links, stores, maintenance interval or other PMS requirements need to be revised.",
    "responsible": "Responsible engineer / HOD or vessel PMS coordinator raises a reasoned change request.",
    "typical_jobs": "Revising a job interval, adding inspection tasks, correcting instructions or equipment details.",
    "suggested_approver": "Chief Engineer / Master as required; shore PMS administrator / Technical Superintendent approves office-side changes per workflow.",
    "is_default": true
  },
  {
    "fmuuid": "04279b4d-c075-549a-b015-e17c3920f9b2",
    "seed_key": "FM-DEF-049",
    "form_id": "E08-001",
    "scope": "fleet",
    "vessel_id": null,
    "group_uuid": "ff931f5d-bfb0-5568-8c79-4417a092f257",
    "category_uuid": "70ff3f04-898e-5d73-af7a-71f8706bafde",
    "form_name": "Class / Statutory Survey Finding Rectification Record",
    "company_form_name": "Class / Statutory Survey Finding Rectification Record",
    "when_to_use": "When applicable class, flag, statutory or authorized survey findings require rectification and supporting evidence.",
    "responsible": "Responsible HOD / Chief Engineer coordinates rectification and keeps evidence.",
    "typical_jobs": "Machinery survey finding, repair of a defect recorded during statutory inspection.",
    "suggested_approver": "Master and Technical Superintendent / shore authority; class, flag or recognized organization verifies where required.",
    "is_default": true
  },
  {
    "fmuuid": "a4317e41-9731-532f-986c-2ebc372d1344",
    "seed_key": "FM-DEF-050",
    "form_id": "E09-001",
    "scope": "fleet",
    "vessel_id": null,
    "group_uuid": "ff931f5d-bfb0-5568-8c79-4417a092f257",
    "category_uuid": "b6e10c55-bf7c-5c58-8d3c-ba7885c39aa2",
    "form_name": "Repeat Defect / Reliability Improvement Report",
    "company_form_name": "Repeat Defect / Reliability Improvement Report",
    "when_to_use": "When recurring faults need trend analysis and corrective action beyond repeated individual repairs.",
    "responsible": "Responsible HOD / Chief Engineer analyses history and recommends corrective actions.",
    "typical_jobs": "Repeated motor trips, recurring seal failures, recurring overheating.",
    "suggested_approver": "Technical Superintendent / shore reliability or technical manager; DPA if safety-management escalation is required.",
    "is_default": true
  },
  {
    "fmuuid": "f46e0c73-a877-5a06-95a8-34e9724f7843",
    "seed_key": "FM-DEF-051",
    "form_id": "F01-001",
    "scope": "fleet",
    "vessel_id": null,
    "group_uuid": "1d02e03c-d8ab-50d2-9562-aafadccc5bbf",
    "category_uuid": "771e2ce4-f54c-5014-ad56-5a23f0914c1c",
    "form_name": "Spare Parts Requisition Form",
    "company_form_name": "Spare Parts Requisition Form",
    "when_to_use": "When required parts need to be requested from shore, ordered or procured for planned or corrective maintenance.",
    "responsible": "Assigned engineer / HOD identifies part number, quantity, technical specification and urgency.",
    "typical_jobs": "Seal kit, bearings, filters, pump impeller, replacement motor.",
    "suggested_approver": "Chief Engineer / Master and shore purchasing or Technical Superintendent according to purchasing limits and SMS.",
    "is_default": true
  },
  {
    "fmuuid": "d9ebd253-9766-543f-85eb-f2d7936dcb85",
    "seed_key": "FM-DEF-052",
    "form_id": "F02-001",
    "scope": "fleet",
    "vessel_id": null,
    "group_uuid": "1d02e03c-d8ab-50d2-9562-aafadccc5bbf",
    "category_uuid": "dd711e8a-5184-5380-9093-bfc809279986",
    "form_name": "Spare Parts Issue / Consumption Record",
    "company_form_name": "Spare Parts Issue / Consumption Record",
    "when_to_use": "Whenever stores issues or consumes parts against a maintenance job; record quantity, location/bin and linked work order.",
    "responsible": "Storekeeper or responsible engineer records issue/consumption; user confirms parts used if required.",
    "typical_jobs": "Seals, gaskets, filters, bearings and other parts consumed for a job.",
    "suggested_approver": "Chief Engineer / Stores-in-Charge or designated officer under stock-control procedure.",
    "is_default": true
  },
  {
    "fmuuid": "bc5f6f14-a961-56e2-8001-9431f7dea542",
    "seed_key": "FM-DEF-053",
    "form_id": "F03-001",
    "scope": "fleet",
    "vessel_id": null,
    "group_uuid": "1d02e03c-d8ab-50d2-9562-aafadccc5bbf",
    "category_uuid": "c99609d4-bb1f-50a1-be74-f3a3f2f6ccb9",
    "form_name": "Critical Spare Parts Shortage Report",
    "company_form_name": "Critical Spare Parts Shortage Report",
    "when_to_use": "When essential or critical spares are unavailable or stock levels create a maintenance or operational risk.",
    "responsible": "Storekeeper / responsible engineer reports shortage and checks alternatives and lead time.",
    "typical_jobs": "Unavailable essential pump seal kit, engine component or safety-system spare.",
    "suggested_approver": "Chief Engineer and Technical Superintendent / shore purchasing; Master informed if operational risk exists.",
    "is_default": true
  },
  {
    "fmuuid": "adbda3bf-26bc-5cbb-acb3-d8a339f24745",
    "seed_key": "FM-DEF-054",
    "form_id": "F04-001",
    "scope": "fleet",
    "vessel_id": null,
    "group_uuid": "1d02e03c-d8ab-50d2-9562-aafadccc5bbf",
    "category_uuid": "ad007d98-86f6-5059-9a56-b496d4cb2a2e",
    "form_name": "Spare Parts Return / Unused Material Record",
    "company_form_name": "Spare Parts Return / Unused Material Record",
    "when_to_use": "When issued parts are unused, returned, damaged or unsuitable and stores balances need correction.",
    "responsible": "Person returning the part and storekeeper document quantity, condition and related job.",
    "typical_jobs": "Returning unused gaskets or documenting a damaged replacement component.",
    "suggested_approver": "Stores-in-Charge / Chief Engineer under stores control procedures.",
    "is_default": true
  },
  {
    "fmuuid": "c96ccdeb-7840-5e3c-b100-32a791167cd2",
    "seed_key": "FM-DEF-055",
    "form_id": "F05-001",
    "scope": "fleet",
    "vessel_id": null,
    "group_uuid": "1d02e03c-d8ab-50d2-9562-aafadccc5bbf",
    "category_uuid": "3c0c3c8d-fdb2-5e4a-b4be-df1c05d0d56f",
    "form_name": "Workshop Repair / Component Service Report",
    "company_form_name": "Workshop Repair / Component Service Report",
    "when_to_use": "When a component is repaired, inspected or overhauled in an onboard or shore workshop; retain work details and measurements.",
    "responsible": "Workshop technician / engineer or external workshop prepares service report.",
    "typical_jobs": "Reconditioning a pump, motor repair, machining a component.",
    "suggested_approver": "Chief Engineer / Technical Superintendent depending on scope and cost approval limits.",
    "is_default": true
  },
  {
    "fmuuid": "310ac769-8994-5e25-ae32-3108cc3f9f9b",
    "seed_key": "FM-DEF-056",
    "form_id": "F06-001",
    "scope": "fleet",
    "vessel_id": null,
    "group_uuid": "1d02e03c-d8ab-50d2-9562-aafadccc5bbf",
    "category_uuid": "bd6b6e34-2c17-5b95-ba4a-42052e6101a7",
    "form_name": "Shore Service / Riding Squad Work Report",
    "company_form_name": "Shore Service / Riding Squad Work Report",
    "when_to_use": "Whenever a maker's service engineer or specialist team carries out work onboard; capture diagnosis, work performed, parts, test results and recommendations.",
    "responsible": "Service engineer prepares report; shipboard engineer verifies vessel details and work scope.",
    "typical_jobs": "Turbocharger service, automation troubleshooting, engine-maker attendance.",
    "suggested_approver": "Chief Engineer / Master acknowledges completion; Technical Superintendent / shore technical authority accepts where required.",
    "is_default": true
  },
  {
    "fmuuid": "df57eeaf-572a-5d64-9a42-eed6009ba1e3",
    "seed_key": "FM-DEF-057",
    "form_id": "F07-001",
    "scope": "fleet",
    "vessel_id": null,
    "group_uuid": "1d02e03c-d8ab-50d2-9562-aafadccc5bbf",
    "category_uuid": "b3351685-de22-5b94-8825-ca69871fbf29",
    "form_name": "Contractor / Service Attendance Record",
    "company_form_name": "Contractor / Service Attendance Record",
    "when_to_use": "When external personnel attend onboard and the company requires records of identity, attendance, scope, induction or safety arrangements.",
    "responsible": "Responsible shipboard officer or contractor coordinator records attendance and induction.",
    "typical_jobs": "Specialist electrical repair, calibration service, pump overhaul by contractor.",
    "suggested_approver": "Master / Chief Engineer or designated contractor controller under SMS.",
    "is_default": true
  },
  {
    "fmuuid": "b1709d0b-7439-5459-8e49-8f9c19c1e3cd",
    "seed_key": "FM-DEF-058",
    "form_id": "F08-001",
    "scope": "fleet",
    "vessel_id": null,
    "group_uuid": "1d02e03c-d8ab-50d2-9562-aafadccc5bbf",
    "category_uuid": "754043a4-c5cd-5c7b-9311-6f18b2027854",
    "form_name": "Repair Specification / Quotation Approval Form",
    "company_form_name": "Repair Specification / Quotation Approval Form",
    "when_to_use": "Before significant repair expenditure or non-routine work where scope, cost, technical specification or shore authorization must be agreed.",
    "responsible": "Chief Engineer / Technical Superintendent defines scope and obtains quotation or specification.",
    "typical_jobs": "Major engine repair, replacement pump package, substantial workshop repairs.",
    "suggested_approver": "Authorized shore budget holder / Technical Superintendent / procurement approver according to delegated financial limits.",
    "is_default": true
  },
  {
    "fmuuid": "1a322b0f-9dfd-5d75-92f3-34ff2eed5c20",
    "seed_key": "FM-DEF-059",
    "form_id": "F09-001",
    "scope": "fleet",
    "vessel_id": null,
    "group_uuid": "1d02e03c-d8ab-50d2-9562-aafadccc5bbf",
    "category_uuid": "6dcffe9a-ff03-5931-9ac9-7d67dbfce45a",
    "form_name": "Repair Completion and Supporting Document Record",
    "company_form_name": "Repair Completion and Supporting Document Record",
    "when_to_use": "After external repairs when service reports, certificates, measurements, replaced-part details, photos and test results must be retained.",
    "responsible": "Responsible engineer collects and links service documents to the equipment and work order.",
    "typical_jobs": "Attaching maker service report and test results to equipment history.",
    "suggested_approver": "Chief Engineer / Technical Superintendent reviews completeness where required.",
    "is_default": true
  },
  {
    "fmuuid": "44d3fbf2-5c27-5932-a639-45991c73600f",
    "seed_key": "FM-DEF-060",
    "form_id": "G01-001",
    "scope": "fleet",
    "vessel_id": null,
    "group_uuid": "80cc6321-9936-5a31-ba40-76d90232da98",
    "category_uuid": "c115b439-0ff8-55b2-9b8c-fc135df07a40",
    "form_name": "Major Overhaul Work Pack",
    "company_form_name": "Major Overhaul Work Pack",
    "when_to_use": "Before and during a major overhaul requiring controlled procedures, RA, permits, resources, measurements, hold points and acceptance criteria.",
    "responsible": "Chief Engineer / overhaul coordinator assembles and manages the pack with assigned engineers and service provider.",
    "typical_jobs": "Main engine overhaul, generator overhaul, major compressor overhaul.",
    "suggested_approver": "Technical Superintendent / shore technical manager; Master and maker/class authority where required.",
    "is_default": true
  },
  {
    "fmuuid": "52b8722d-fa30-5d3c-946c-e4c61031834d",
    "seed_key": "FM-DEF-061",
    "form_id": "G02-001",
    "scope": "fleet",
    "vessel_id": null,
    "group_uuid": "80cc6321-9936-5a31-ba40-76d90232da98",
    "category_uuid": "fc319cf9-05a1-55e4-8ee6-26f97f30d29a",
    "form_name": "Dry-Dock Repair Specification / Work List",
    "company_form_name": "Dry-Dock Repair Specification / Work List",
    "when_to_use": "During dry-dock planning to define, cost, schedule and track repairs, inspections and class items.",
    "responsible": "Chief Engineer / Master with shore technical team and relevant HODs prepare the list.",
    "typical_jobs": "Hull repairs, sea valves, propeller work, machinery or structural repairs.",
    "suggested_approver": "Technical Superintendent / shore management; class or statutory approvals as applicable.",
    "is_default": true
  },
  {
    "fmuuid": "f5ca95b2-24ab-5ea9-951d-a3920c5934bc",
    "seed_key": "FM-DEF-062",
    "form_id": "G03-001",
    "scope": "fleet",
    "vessel_id": null,
    "group_uuid": "80cc6321-9936-5a31-ba40-76d90232da98",
    "category_uuid": "407dc1b3-bd24-5237-9137-94966edf6a0d",
    "form_name": "Dry-Dock Work Completion / Outstanding Items Report",
    "company_form_name": "Dry-Dock Work Completion / Outstanding Items Report",
    "when_to_use": "During dry-dock closeout to document completed work, outstanding items, restrictions, certificates and follow-up actions.",
    "responsible": "Chief Engineer / dry-dock coordinator verifies completed scope and lists remaining items.",
    "typical_jobs": "Unfinished repairs, deferred items, parts pending delivery, post-dock tests.",
    "suggested_approver": "Master and Technical Superintendent / shore management; class or statutory sign-off where required.",
    "is_default": true
  },
  {
    "fmuuid": "fed67999-9f53-59a8-86a3-4835ea0f93e1",
    "seed_key": "FM-DEF-063",
    "form_id": "G04-001",
    "scope": "fleet",
    "vessel_id": null,
    "group_uuid": "80cc6321-9936-5a31-ba40-76d90232da98",
    "category_uuid": "684d2581-6f48-5ae9-a576-dfd54ff164ae",
    "form_name": "Post-Repair Trials / Sea Trial Report",
    "company_form_name": "Post-Repair Trials / Sea Trial Report",
    "when_to_use": "After substantial repairs or changes when maker, class, SMS or technical management requires operational trials and acceptance evidence.",
    "responsible": "Chief Engineer / responsible technical team performs or coordinates trials and records results.",
    "typical_jobs": "Steering gear overhaul, propulsion-related repairs, generator or control-system changes.",
    "suggested_approver": "Master and Technical Superintendent; class / flag / recognized organization where required.",
    "is_default": true
  },
  {
    "fmuuid": "3267e1ed-32a0-5b37-94cf-f9603f2ded35",
    "seed_key": "FM-DEF-064",
    "form_id": "G05-001",
    "scope": "fleet",
    "vessel_id": null,
    "group_uuid": "80cc6321-9936-5a31-ba40-76d90232da98",
    "category_uuid": "7d26183a-2f79-5989-80fd-c2e0bd7148b9",
    "form_name": "Maintenance Lessons Learned / Improvement Report",
    "company_form_name": "Maintenance Lessons Learned / Improvement Report",
    "when_to_use": "After major failure, overhaul or maintenance event when lessons should be captured and used to improve future jobs, risk controls or PMS tasks.",
    "responsible": "Chief Engineer / job leader gathers feedback from the crew and service providers.",
    "typical_jobs": "Unexpected failure mode, repeated overhaul difficulties, improvement to inspection practice.",
    "suggested_approver": "Technical Superintendent / shore technical manager; safety management review where relevant.",
    "is_default": true
  }
]
$forms$::jsonb;
  candidate jsonb;
  owner_uuid text;
  owner_detail text;
  prerequisite text;
BEGIN
  FOREACH prerequisite IN ARRAY ARRAY['pms_form_groups', 'pms_form_categories', 'pms_forms_master'] LOOP
    IF to_regclass('public.' || prerequisite) IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001',
        MESSAGE = format('Forms Master defaults prerequisite missing: public.%s (apply migration 192 first)', prerequisite);
    END IF;
  END LOOP;

  PERFORM pg_advisory_xact_lock(764192);

  -- Deliberately match legacy seed preflight, including deleted-row eligibility.
  -- Group/Category trim removes ordinary spaces only; Form collapses ASCII whitespace.
  FOR candidate IN SELECT value FROM jsonb_array_elements(seed_groups) LOOP
    IF EXISTS (SELECT 1 FROM public.pms_form_groups WHERE fguuid = candidate->>'fguuid') THEN CONTINUE; END IF;
    SELECT fguuid, format('code=%s name=%s seed_key=%s', group_code, group_name, seed_key)
      INTO owner_uuid, owner_detail FROM public.pms_form_groups
      WHERE group_code = candidate->>'group_code' OR seed_key = candidate->>'seed_key'
        OR (is_deleted = false AND lower(trim(group_name)) = lower(trim(candidate->>'group_name')))
      ORDER BY fguuid LIMIT 1;
    IF FOUND THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = format(
        'Forms Master seed conflict: table=pms_form_groups seed_key=%s expected_uuid=%s actual_uuid=%s expected_code=%s expected_name=%s owner=[%s]',
        candidate->>'seed_key', candidate->>'fguuid', owner_uuid, candidate->>'group_code', candidate->>'group_name', owner_detail);
    END IF;
  END LOOP;

  FOR candidate IN SELECT value FROM jsonb_array_elements(seed_categories) LOOP
    IF EXISTS (SELECT 1 FROM public.pms_form_categories WHERE fcuuid = candidate->>'fcuuid') THEN CONTINUE; END IF;
    SELECT fcuuid, format('parent=%s number=%s name=%s seed_key=%s', group_uuid, category_no, category_name, seed_key)
      INTO owner_uuid, owner_detail FROM public.pms_form_categories
      WHERE seed_key = candidate->>'seed_key'
        OR (group_uuid = candidate->>'group_uuid' AND
          (category_no = (candidate->>'category_no')::integer
            OR (is_deleted = false AND lower(trim(category_name)) = lower(trim(candidate->>'category_name')))))
      ORDER BY fcuuid LIMIT 1;
    IF FOUND THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = format(
        'Forms Master seed conflict: table=pms_form_categories seed_key=%s expected_uuid=%s actual_uuid=%s expected_parent=%s expected_number=%s expected_name=%s owner=[%s]',
        candidate->>'seed_key', candidate->>'fcuuid', owner_uuid, candidate->>'group_uuid', candidate->>'category_no', candidate->>'category_name', owner_detail);
    END IF;
  END LOOP;

  FOR candidate IN SELECT value FROM jsonb_array_elements(seed_forms) LOOP
    IF EXISTS (SELECT 1 FROM public.pms_forms_master WHERE fmuuid = candidate->>'fmuuid') THEN CONTINUE; END IF;
    SELECT fmuuid, format('code=%s name=%s seed_key=%s', form_id, form_name, seed_key)
      INTO owner_uuid, owner_detail FROM public.pms_forms_master
      WHERE form_id = candidate->>'form_id' OR seed_key = candidate->>'seed_key'
        OR (is_deleted = false AND
          lower(trim(regexp_replace(form_name, '[ ' || chr(9) || chr(10) || chr(13) || chr(12) || chr(11) || ']+', ' ', 'g'))) =
          lower(trim(regexp_replace(candidate->>'form_name', '[ ' || chr(9) || chr(10) || chr(13) || chr(12) || chr(11) || ']+', ' ', 'g'))))
      ORDER BY fmuuid LIMIT 1;
    IF FOUND THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = format(
        'Forms Master seed conflict: table=pms_forms_master seed_key=%s expected_uuid=%s actual_uuid=%s expected_code=%s expected_name=%s owner=[%s]',
        candidate->>'seed_key', candidate->>'fmuuid', owner_uuid, candidate->>'form_id', candidate->>'form_name', owner_detail);
    END IF;
  END LOOP;

  -- All preflight checks succeeded. UUID-only conflict targets never adopt another identity.
  -- Omitted columns retain migration 192 defaults; local IDs/timestamps are generated by PostgreSQL.
  FOR candidate IN SELECT value FROM jsonb_array_elements(seed_groups) LOOP
    INSERT INTO public.pms_form_groups (fguuid, seed_key, group_code, group_name, display_order, is_default)
      VALUES (candidate->>'fguuid', candidate->>'seed_key', candidate->>'group_code', candidate->>'group_name',
        (candidate->>'display_order')::integer, (candidate->>'is_default')::boolean)
      ON CONFLICT (fguuid) DO NOTHING;
  END LOOP;
  FOR candidate IN SELECT value FROM jsonb_array_elements(seed_categories) LOOP
    INSERT INTO public.pms_form_categories (fcuuid, seed_key, group_uuid, category_no, category_name, display_order, is_default)
      VALUES (candidate->>'fcuuid', candidate->>'seed_key', candidate->>'group_uuid', (candidate->>'category_no')::integer,
        candidate->>'category_name', (candidate->>'display_order')::integer, (candidate->>'is_default')::boolean)
      ON CONFLICT (fcuuid) DO NOTHING;
  END LOOP;
  FOR candidate IN SELECT value FROM jsonb_array_elements(seed_forms) LOOP
    INSERT INTO public.pms_forms_master (fmuuid, seed_key, form_id, scope, vessel_id, group_uuid, category_uuid,
      form_name, company_form_name, when_to_use, responsible, typical_jobs, suggested_approver, is_default)
      VALUES (candidate->>'fmuuid', candidate->>'seed_key', candidate->>'form_id', candidate->>'scope', candidate->>'vessel_id',
        candidate->>'group_uuid', candidate->>'category_uuid', candidate->>'form_name', candidate->>'company_form_name',
        candidate->>'when_to_use', candidate->>'responsible', candidate->>'typical_jobs', candidate->>'suggested_approver',
        (candidate->>'is_default')::boolean)
      ON CONFLICT (fmuuid) DO NOTHING;
  END LOOP;
END $seed$;
