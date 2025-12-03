import fs from 'fs';
import path from 'path';

const testDataPath = path.join(process.cwd(), 'test-data.json');

function generateDefectId(): string {
  const now = Date.now();
  const random = Math.random().toString(36).substring(2, 10);
  return `DEF-${now}-${random}`;
}

function generateDefectReference(index: number): string {
  const year = new Date().getFullYear().toString().slice(-2);
  const num = (index + 1).toString().padStart(4, '0');
  return `DN/007/${year}/${num}/V`;
}

const defects = [
  // DEFECT 1: Recurring Defect #1 - Main Engine Fuel Pump (First occurrence)
  {
    id: generateDefectId(),
    seedId: "SEED-DEF-001",
    vesselId: "V001",
    vesselName: "MV Test",
    issueDate: "2025-09-15",
    category: "Defect",
    defectType: "Pump / Compressor / Turbine Malfunction",
    description: "Main Engine No.1 Fuel Injection Pump showing abnormal pressure fluctuations during operation. Fuel delivery pressure dropping intermittently from 350 bar to 280 bar causing engine power reduction. Suspect worn plunger barrel assembly and delivery valve requiring replacement.",
    descriptionHtml: "<p>Main Engine No.1 Fuel Injection Pump showing abnormal pressure fluctuations during operation. Fuel delivery pressure dropping intermittently from 350 bar to 280 bar causing engine power reduction. Suspect worn plunger barrel assembly and delivery valve requiring replacement.</p>",
    descriptionText: "Main Engine No.1 Fuel Injection Pump showing abnormal pressure fluctuations during operation. Fuel delivery pressure dropping intermittently from 350 bar to 280 bar causing engine power reduction. Suspect worn plunger barrel assembly and delivery valve requiring replacement.",
    actionTakenRequested: "Replace fuel injection pump plunger and barrel assembly. Overhaul delivery valve. Conduct fuel pressure test after repair.",
    targetCloseDate: "2025-10-15",
    dateCompleted: "2025-10-10",
    status: "Closed",
    priority: "High",
    critical: true,
    is_coc: false,
    severity: 3,
    source: "Internal",
    equipmentCategory: "Machinery",
    equipmentType: "Pump",
    equipmentMake: "MAN",
    equipmentModel: "6L32",
    equipmentSerialNo: "MAN-FIP-2019-0542",
    equipmentLocation: "Engine Room - Main Engine Platform",
    equipmentSystem: "Main Engine Fuel System",
    componentId: null,
    purchaseOrderRef: "PO-2025-0892",
    responsibleDept: "Chief Engineer",
    verifiedDate: "2025-10-12",
    defectCategory: "Machinery Failure (Main & Auxiliary)",
    viqVersion: "VIQ 7",
    viqRef: "5.12",
    viqChapter: "Machinery Management",
    viqSection: "Fuel Oil System",
    sfiCodeRef: "613.1",
    immediateCause: {
      unsafeAct: [],
      unsafeCondition: ["Equipment wear and deterioration", "High operating hours on component"]
    },
    immediateCauseExplanation: "Fuel injection pump has exceeded recommended overhaul interval of 12,000 running hours. Current RH is 14,500. Normal wear pattern accelerated by high sulfur fuel usage in certain trading areas.",
    rootCause: {
      individualFactor: [],
      systemFactor: ["Inadequate maintenance interval planning", "Delayed spare parts procurement"]
    },
    rootCauseExplanation: "PMS maintenance interval was not updated when fuel quality parameters changed. Spare parts order was delayed due to budget constraints in Q3.",
    equipment_key: "V001_MAIN_ENGINE_FUEL_PUMP_NO1",
    raisedById: "USR-CE-001",
    raisedByName: "John Morrison",
    raisedByRank: "Chief Engineer",
    operatingCondition: "SAILING",
    locationText: "North Atlantic",
    occurrenceType: "BREAKDOWN",
    responsibleRole: "Chief Engineer",
    responsibleRoleId: "USR-CE-001",
    isDeferred: false,
    deferReason: null,
    deferNewTargetDate: null,
    deferApprovalRequired: false,
    reportToThirdParty: false,
    classReport: false,
    flagReport: false,
    portReport: false,
    reportReferenceNo: null,
    reportDate: null,
    vesselLocationType: "atSea",
    portName: null,
    latitude: "48.2500",
    longitude: "-32.5000",
    vesselLocationDetail: null,
    reportedBy: "Chief Engineer",
    assignedTo: "2nd Engineer",
    reviewedBy: "Chief Engineer",
    closedBy: "Chief Engineer",
    closedOn: "2025-10-10T14:30:00Z",
    closureComment: "Fuel injection pump overhauled successfully. New plunger and barrel assembly fitted. Delivery valve replaced. Fuel pressure test conducted - all parameters normal. Engine load test completed satisfactorily.",
    closureFiles: [],
    linkedDefects: [],
    notes: [
      {
        noteId: "NOTE-001-1",
        noteText: "Spare parts received from MAN B&W Singapore branch",
        attachments: [],
        createdBy: "2nd Engineer",
        createdOn: "2025-10-05T08:00:00Z"
      },
      {
        noteId: "NOTE-001-2",
        noteText: "Overhaul completed in 6 hours with maker's representative supervision",
        attachments: [],
        createdBy: "Chief Engineer",
        createdOn: "2025-10-10T14:00:00Z"
      }
    ],
    actions: [
      {
        id: "ACT-001-1",
        actionType: "Corrective",
        proposedBy: "Chief Engineer",
        actionDescription: "Replace fuel injection pump plunger barrel assembly and delivery valve",
        responsibility: "2nd Engineer",
        email: "2ndengineer@vessel.com",
        dueDate: "2025-10-10",
        dateCompleted: "2025-10-10",
        status: "Closed"
      },
      {
        id: "ACT-001-2",
        actionType: "Preventive",
        proposedBy: "Chief Engineer",
        actionDescription: "Update PMS maintenance interval for all fuel injection pumps to 10,000 RH",
        responsibility: "Chief Engineer",
        email: "chiefengineer@vessel.com",
        dueDate: "2025-10-20",
        dateCompleted: "2025-10-18",
        status: "Closed"
      }
    ],
    attachments: [
      {
        name: "FIP_pressure_test_report.pdf",
        size: 245000,
        type: "application/pdf"
      },
      {
        name: "worn_plunger_photo.jpg",
        size: 1850000,
        type: "image/jpeg"
      }
    ],
    auditTrail: [
      {
        action: "Created",
        userId: "USR-CE-001",
        userName: "John Morrison",
        timestamp: "2025-09-15T10:30:00Z",
        details: { status: "Open" }
      },
      {
        action: "Updated",
        userId: "USR-CE-001",
        userName: "John Morrison",
        timestamp: "2025-10-10T14:30:00Z",
        details: { status: "Closed", previousStatus: "In-Progress" }
      }
    ],
    createdAt: new Date("2025-09-15T10:30:00Z"),
    updatedAt: new Date("2025-10-10T14:30:00Z")
  },

  // DEFECT 2: Recurring Defect #2 - Main Engine Fuel Pump (Second occurrence - SAME equipment_key)
  {
    id: generateDefectId(),
    seedId: "SEED-DEF-002",
    vesselId: "V001",
    vesselName: "MV Test",
    issueDate: "2025-11-20",
    category: "Defect",
    defectType: "Pump / Compressor / Turbine Malfunction",
    description: "Main Engine No.1 Fuel Injection Pump - Recurring issue. Fuel pressure again dropping below normal operating parameters. After previous repair in October, pump functioned normally for 40 days before symptoms reappeared. Suspect defective replacement parts or underlying system issue.",
    descriptionHtml: "<p>Main Engine No.1 Fuel Injection Pump - Recurring issue. Fuel pressure again dropping below normal operating parameters. After previous repair in October, pump functioned normally for 40 days before symptoms reappeared. Suspect defective replacement parts or underlying system issue.</p>",
    descriptionText: "Main Engine No.1 Fuel Injection Pump - Recurring issue. Fuel pressure again dropping below normal operating parameters. After previous repair in October, pump functioned normally for 40 days before symptoms reappeared. Suspect defective replacement parts or underlying system issue.",
    actionTakenRequested: "Conduct comprehensive fuel system analysis. Check fuel quality. Inspect all related components including fuel lines, filters, and fuel oil heaters.",
    targetCloseDate: "2025-12-15",
    dateCompleted: null,
    status: "In-Progress",
    priority: "High",
    critical: true,
    is_coc: false,
    severity: 3,
    source: "Internal",
    equipmentCategory: "Machinery",
    equipmentType: "Pump",
    equipmentMake: "MAN",
    equipmentModel: "6L32",
    equipmentSerialNo: "MAN-FIP-2019-0542",
    equipmentLocation: "Engine Room - Main Engine Platform",
    equipmentSystem: "Main Engine Fuel System",
    componentId: null,
    purchaseOrderRef: "PO-2025-1156",
    responsibleDept: "Chief Engineer",
    verifiedDate: null,
    defectCategory: "Machinery Failure (Main & Auxiliary)",
    viqVersion: "VIQ 7",
    viqRef: "5.12",
    viqChapter: "Machinery Management",
    viqSection: "Fuel Oil System",
    sfiCodeRef: "613.1",
    immediateCause: {
      unsafeAct: [],
      unsafeCondition: ["Possible defective replacement parts", "Fuel contamination suspected"]
    },
    immediateCauseExplanation: "Replacement parts from October repair may have been substandard or fuel system contamination causing accelerated wear.",
    rootCause: {
      individualFactor: [],
      systemFactor: ["Spare parts quality verification process inadequate", "Fuel testing frequency insufficient"]
    },
    rootCauseExplanation: "Parts sourced from third-party supplier without OEM certification. Fuel testing only done at bunkering, not regular intervals.",
    equipment_key: "V001_MAIN_ENGINE_FUEL_PUMP_NO1",
    raisedById: "USR-CE-001",
    raisedByName: "John Morrison",
    raisedByRank: "Chief Engineer",
    operatingCondition: "SAILING",
    locationText: "Mediterranean Sea",
    occurrenceType: "BREAKDOWN",
    responsibleRole: "Chief Engineer",
    responsibleRoleId: "USR-CE-001",
    isDeferred: false,
    deferReason: null,
    deferNewTargetDate: null,
    deferApprovalRequired: false,
    reportToThirdParty: false,
    classReport: false,
    flagReport: false,
    portReport: false,
    reportReferenceNo: null,
    reportDate: null,
    vesselLocationType: "atSea",
    portName: null,
    latitude: "36.1500",
    longitude: "14.3000",
    vesselLocationDetail: null,
    reportedBy: "Chief Engineer",
    assignedTo: "2nd Engineer",
    reviewedBy: null,
    closedBy: null,
    closedOn: null,
    closureComment: null,
    closureFiles: [],
    linkedDefects: [],
    notes: [
      {
        noteId: "NOTE-002-1",
        noteText: "Fuel sample sent for laboratory analysis. Results expected in 5 days.",
        attachments: [],
        createdBy: "Chief Engineer",
        createdOn: "2025-11-21T09:00:00Z"
      },
      {
        noteId: "NOTE-002-2",
        noteText: "Technical superintendent consulted. Recommended complete fuel system inspection.",
        attachments: [],
        createdBy: "Chief Engineer",
        createdOn: "2025-11-22T16:00:00Z"
      }
    ],
    actions: [
      {
        id: "ACT-002-1",
        actionType: "Corrective",
        proposedBy: "Chief Engineer",
        actionDescription: "Send fuel samples for comprehensive laboratory analysis",
        responsibility: "3rd Engineer",
        email: "3rdengineer@vessel.com",
        dueDate: "2025-11-25",
        dateCompleted: "2025-11-21",
        status: "Closed"
      },
      {
        id: "ACT-002-2",
        actionType: "Corrective",
        proposedBy: "Technical Superintendent",
        actionDescription: "Arrange maker's representative to inspect complete fuel injection system at next port",
        responsibility: "Chief Engineer",
        email: "chiefengineer@vessel.com",
        dueDate: "2025-12-05",
        dateCompleted: null,
        status: "In Progress"
      },
      {
        id: "ACT-002-3",
        actionType: "Preventive",
        proposedBy: "Fleet Manager",
        actionDescription: "Review and update spare parts procurement policy to require OEM certification",
        responsibility: "Purchasing Manager",
        email: "purchasing@company.com",
        dueDate: "2025-12-20",
        dateCompleted: null,
        status: "Open"
      }
    ],
    attachments: [
      {
        name: "fuel_sample_analysis_request.pdf",
        size: 125000,
        type: "application/pdf"
      }
    ],
    auditTrail: [
      {
        action: "Created",
        userId: "USR-CE-001",
        userName: "John Morrison",
        timestamp: "2025-11-20T08:00:00Z",
        details: { status: "Open" }
      },
      {
        action: "Updated",
        userId: "USR-CE-001",
        userName: "John Morrison",
        timestamp: "2025-11-22T10:00:00Z",
        details: { status: "In-Progress", previousStatus: "Open" }
      }
    ],
    createdAt: new Date("2025-11-20T08:00:00Z"),
    updatedAt: new Date("2025-11-22T10:00:00Z")
  },

  // DEFECT 3: COC Defect #1 - Emergency Generator with Class Report
  {
    id: generateDefectId(),
    seedId: "SEED-DEF-003",
    vesselId: "V001",
    vesselName: "MV Test",
    issueDate: "2025-10-25",
    category: "COC",
    defectType: "Safety Equipment Deficiency (Fire / Lifeboat / Alarm)",
    description: "Emergency Generator failed to start automatically during weekly test. Manual start successful but auto-start relay found defective. Class surveyor present during annual survey identified this as Condition of Class item requiring rectification within 3 months.",
    descriptionHtml: "<p>Emergency Generator failed to start automatically during weekly test. Manual start successful but auto-start relay found defective. Class surveyor present during annual survey identified this as Condition of Class item requiring rectification within 3 months.</p>",
    descriptionText: "Emergency Generator failed to start automatically during weekly test. Manual start successful but auto-start relay found defective. Class surveyor present during annual survey identified this as Condition of Class item requiring rectification within 3 months.",
    actionTakenRequested: "Replace auto-start relay. Conduct full function test of emergency generator including blackout simulation. Present to Class surveyor for CoC lift.",
    targetCloseDate: "2026-01-25",
    dateCompleted: null,
    status: "Open",
    priority: "High",
    critical: true,
    is_coc: true,
    severity: 3,
    source: "Class",
    equipmentCategory: "Safety",
    equipmentType: "Generator",
    equipmentMake: "Caterpillar",
    equipmentModel: "3516",
    equipmentSerialNo: "CAT-EG-2018-1234",
    equipmentLocation: "Emergency Generator Room",
    equipmentSystem: "Emergency Power System",
    componentId: null,
    purchaseOrderRef: "PO-2025-1089",
    responsibleDept: "Chief Engineer",
    verifiedDate: null,
    defectCategory: "Condition of Class (CoC) Related",
    viqVersion: "VIQ 7",
    viqRef: "7.8",
    viqChapter: "Safety Management",
    viqSection: "Emergency Systems",
    sfiCodeRef: "641.2",
    immediateCause: {
      unsafeAct: [],
      unsafeCondition: ["Relay contact degradation", "Age-related component failure"]
    },
    immediateCauseExplanation: "Auto-start relay is original equipment from 2018. Contact resistance increased beyond acceptable limits causing intermittent starting failure.",
    rootCause: {
      individualFactor: [],
      systemFactor: ["No planned replacement schedule for relays", "Condition monitoring not implemented for starting circuit"]
    },
    rootCauseExplanation: "Electrical components like relays not included in regular PMS schedule. Only visual inspection performed, no electrical testing of contact resistance.",
    equipment_key: "V001_EMERGENCY_GENERATOR",
    raisedById: "USR-CS-001",
    raisedByName: "DNV GL Surveyor",
    raisedByRank: "Class Surveyor",
    operatingCondition: "PORT",
    locationText: "Rotterdam",
    occurrenceType: "ROUTINE",
    responsibleRole: "Chief Engineer",
    responsibleRoleId: "USR-CE-001",
    isDeferred: false,
    deferReason: null,
    deferNewTargetDate: null,
    deferApprovalRequired: false,
    reportToThirdParty: true,
    classReport: true,
    flagReport: true,
    portReport: false,
    reportReferenceNo: "DNV-COC-2025-MV001-0045",
    reportDate: "2025-10-25",
    vesselLocationType: "atPort",
    portName: "Rotterdam",
    latitude: null,
    longitude: null,
    vesselLocationDetail: "Alongside",
    reportedBy: "Chief Engineer",
    assignedTo: "Electrical Officer",
    reviewedBy: "Technical Superintendent",
    closedBy: null,
    closedOn: null,
    closureComment: null,
    closureFiles: [],
    linkedDefects: [],
    notes: [
      {
        noteId: "NOTE-003-1",
        noteText: "Class surveyor imposed CoC with 3-month deadline. Copy of survey report received.",
        attachments: ["COC_Survey_Report.pdf"],
        createdBy: "Chief Engineer",
        createdOn: "2025-10-25T16:00:00Z"
      },
      {
        noteId: "NOTE-003-2",
        noteText: "Replacement relay ordered from Caterpillar authorized dealer in Singapore. ETA: 2 weeks.",
        attachments: [],
        createdBy: "Purchasing Manager",
        createdOn: "2025-10-28T10:00:00Z"
      },
      {
        noteId: "NOTE-003-3",
        noteText: "Flag state notified as per regulation requirements.",
        attachments: [],
        createdBy: "DPA",
        createdOn: "2025-10-26T09:00:00Z"
      }
    ],
    actions: [
      {
        id: "ACT-003-1",
        actionType: "Corrective",
        proposedBy: "Chief Engineer",
        actionDescription: "Procure and replace auto-start relay with OEM part",
        responsibility: "Purchasing Manager",
        email: "purchasing@company.com",
        dueDate: "2025-11-15",
        dateCompleted: null,
        status: "In Progress"
      },
      {
        id: "ACT-003-2",
        actionType: "Corrective",
        proposedBy: "Chief Engineer",
        actionDescription: "Conduct blackout simulation test after relay replacement",
        responsibility: "Chief Engineer",
        email: "chiefengineer@vessel.com",
        dueDate: "2025-11-20",
        dateCompleted: null,
        status: "Open"
      },
      {
        id: "ACT-003-3",
        actionType: "Corrective",
        proposedBy: "Technical Superintendent",
        actionDescription: "Arrange Class surveyor attendance for CoC closure",
        responsibility: "Technical Superintendent",
        email: "techsupt@company.com",
        dueDate: "2025-12-15",
        dateCompleted: null,
        status: "Open"
      },
      {
        id: "ACT-003-4",
        actionType: "Preventive",
        proposedBy: "Fleet Manager",
        actionDescription: "Add all emergency generator electrical components to PMS with 5-year replacement cycle",
        responsibility: "Fleet PMS Administrator",
        email: "pmsadmin@company.com",
        dueDate: "2026-01-31",
        dateCompleted: null,
        status: "Open"
      }
    ],
    attachments: [
      {
        name: "COC_Survey_Report.pdf",
        size: 450000,
        type: "application/pdf"
      },
      {
        name: "EG_test_record.pdf",
        size: 180000,
        type: "application/pdf"
      }
    ],
    auditTrail: [
      {
        action: "Created",
        userId: "USR-CE-001",
        userName: "John Morrison",
        timestamp: "2025-10-25T16:00:00Z",
        details: { status: "Open", is_coc: true }
      }
    ],
    createdAt: new Date("2025-10-25T16:00:00Z"),
    updatedAt: new Date("2025-10-28T10:00:00Z")
  },

  // DEFECT 4: COC Defect #2 - Lifeboat Davit with Class and Flag Reports
  {
    id: generateDefectId(),
    seedId: "SEED-DEF-004",
    vesselId: "V001",
    vesselName: "MV Test",
    issueDate: "2025-11-05",
    category: "COC",
    defectType: "Safety Equipment Deficiency (Fire / Lifeboat / Alarm)",
    description: "Port side lifeboat davit wire showing visible broken strands exceeding 10% in one lay length. Identified during PSC inspection at Houston. Condition of Class imposed by attending Class surveyor. Wire replacement mandatory before next port departure.",
    descriptionHtml: "<p>Port side lifeboat davit wire showing visible broken strands exceeding 10% in one lay length. Identified during PSC inspection at Houston. Condition of Class imposed by attending Class surveyor. Wire replacement mandatory before next port departure.</p>",
    descriptionText: "Port side lifeboat davit wire showing visible broken strands exceeding 10% in one lay length. Identified during PSC inspection at Houston. Condition of Class imposed by attending Class surveyor. Wire replacement mandatory before next port departure.",
    actionTakenRequested: "Replace lifeboat davit wire. Conduct load test. Present to Class surveyor for CoC lift before departure.",
    targetCloseDate: "2025-11-10",
    dateCompleted: "2025-11-08",
    status: "Closed",
    priority: "High",
    critical: true,
    is_coc: true,
    severity: 3,
    source: "PSC",
    equipmentCategory: "Safety",
    equipmentType: "Deck Equipment",
    equipmentMake: "Vestdavit",
    equipmentModel: "PSLB-25",
    equipmentSerialNo: "VD-2017-PS-0089",
    equipmentLocation: "Port Side Boat Deck",
    equipmentSystem: "Lifeboat Launching System",
    componentId: null,
    purchaseOrderRef: "PO-2025-1102",
    responsibleDept: "Chief Officer",
    verifiedDate: "2025-11-09",
    defectCategory: "Condition of Class (CoC) Related",
    viqVersion: "VIQ 7",
    viqRef: "8.15",
    viqChapter: "Life Saving Appliances",
    viqSection: "Lifeboat and Rescue Boat Arrangements",
    sfiCodeRef: "761.3",
    immediateCause: {
      unsafeAct: [],
      unsafeCondition: ["Wire rope fatigue", "Corrosion due to marine environment"]
    },
    immediateCauseExplanation: "Davit wire exposed to high stress during regular drills combined with salt spray corrosion accelerated strand breakage.",
    rootCause: {
      individualFactor: ["Inspection not thorough during weekly checks"],
      systemFactor: ["Wire rope inspection criteria not clear in checklist"]
    },
    rootCauseExplanation: "Weekly davit inspection checklist did not specify detailed wire examination requirements. Crew training on wire rope rejection criteria needed.",
    equipment_key: "V001_LIFEBOAT_DAVIT_PORT",
    raisedById: "USR-PSC-001",
    raisedByName: "USCG Inspector",
    raisedByRank: "PSC Inspector",
    operatingCondition: "PORT",
    locationText: "Houston, Texas",
    occurrenceType: "ROUTINE",
    responsibleRole: "Chief Officer",
    responsibleRoleId: "USR-CO-001",
    isDeferred: false,
    deferReason: null,
    deferNewTargetDate: null,
    deferApprovalRequired: false,
    reportToThirdParty: true,
    classReport: true,
    flagReport: true,
    portReport: true,
    reportReferenceNo: "USCG-PSC-2025-HOU-1156 / DNV-COC-2025-MV001-0052",
    reportDate: "2025-11-05",
    vesselLocationType: "atPort",
    portName: "Houston",
    latitude: null,
    longitude: null,
    vesselLocationDetail: "Alongside",
    reportedBy: "Chief Officer",
    assignedTo: "Bosun",
    reviewedBy: "Master",
    closedBy: "Chief Officer",
    closedOn: "2025-11-08T18:00:00Z",
    closureComment: "New davit wire installed. Load test conducted with 1.1 times Safe Working Load. Class surveyor attended and lifted CoC. PSC deficiency rectified. Departure clearance obtained.",
    closureFiles: ["wire_replacement_certificate.pdf", "load_test_report.pdf"],
    linkedDefects: [],
    notes: [
      {
        noteId: "NOTE-004-1",
        noteText: "Emergency wire procurement arranged from local Vestdavit agent in Houston.",
        attachments: [],
        createdBy: "Purchasing Manager",
        createdOn: "2025-11-05T20:00:00Z"
      },
      {
        noteId: "NOTE-004-2",
        noteText: "Wire delivered to vessel. Replacement work started.",
        attachments: [],
        createdBy: "Chief Officer",
        createdOn: "2025-11-07T08:00:00Z"
      },
      {
        noteId: "NOTE-004-3",
        noteText: "Class surveyor from DNV attended. CoC lifted. PSC release obtained.",
        attachments: ["COC_lift_certificate.pdf"],
        createdBy: "Master",
        createdOn: "2025-11-08T17:00:00Z"
      }
    ],
    actions: [
      {
        id: "ACT-004-1",
        actionType: "Corrective",
        proposedBy: "Chief Officer",
        actionDescription: "Procure and install new davit wire - emergency basis",
        responsibility: "Bosun",
        email: "bosun@vessel.com",
        dueDate: "2025-11-08",
        dateCompleted: "2025-11-08",
        status: "Closed"
      },
      {
        id: "ACT-004-2",
        actionType: "Corrective",
        proposedBy: "Chief Officer",
        actionDescription: "Conduct load test with Class surveyor witness",
        responsibility: "Chief Officer",
        email: "chiefofficer@vessel.com",
        dueDate: "2025-11-08",
        dateCompleted: "2025-11-08",
        status: "Closed"
      },
      {
        id: "ACT-004-3",
        actionType: "Preventive",
        proposedBy: "Master",
        actionDescription: "Revise weekly lifeboat inspection checklist to include detailed wire examination criteria",
        responsibility: "Safety Officer",
        email: "safetyofficer@vessel.com",
        dueDate: "2025-11-20",
        dateCompleted: "2025-11-18",
        status: "Closed"
      },
      {
        id: "ACT-004-4",
        actionType: "Preventive",
        proposedBy: "Fleet Manager",
        actionDescription: "Fleet-wide training on wire rope inspection and rejection criteria",
        responsibility: "Training Manager",
        email: "training@company.com",
        dueDate: "2025-12-31",
        dateCompleted: "2025-12-01",
        status: "Closed"
      }
    ],
    attachments: [
      {
        name: "PSC_deficiency_report.pdf",
        size: 320000,
        type: "application/pdf"
      },
      {
        name: "wire_replacement_certificate.pdf",
        size: 180000,
        type: "application/pdf"
      },
      {
        name: "load_test_report.pdf",
        size: 220000,
        type: "application/pdf"
      },
      {
        name: "broken_wire_photos.zip",
        size: 5500000,
        type: "application/zip"
      }
    ],
    auditTrail: [
      {
        action: "Created",
        userId: "USR-CO-001",
        userName: "Robert Chen",
        timestamp: "2025-11-05T16:00:00Z",
        details: { status: "Open", is_coc: true }
      },
      {
        action: "Updated",
        userId: "USR-CO-001",
        userName: "Robert Chen",
        timestamp: "2025-11-08T18:00:00Z",
        details: { status: "Closed", previousStatus: "In-Progress" }
      }
    ],
    createdAt: new Date("2025-11-05T16:00:00Z"),
    updatedAt: new Date("2025-11-08T18:00:00Z")
  },

  // DEFECT 5: Regular Defect - Ballast Pump (Awaiting Parts)
  {
    id: generateDefectId(),
    seedId: "SEED-DEF-005",
    vesselId: "V001",
    vesselName: "MV Test",
    issueDate: "2025-11-15",
    category: "Defect",
    defectType: "Pump / Compressor / Turbine Malfunction",
    description: "No.2 Ballast Pump mechanical seal leaking heavily. Pump taken out of service. Ballast operations can continue with No.1 pump but redundancy compromised. Mechanical seal kit ordered.",
    descriptionHtml: "<p>No.2 Ballast Pump mechanical seal leaking heavily. Pump taken out of service. Ballast operations can continue with No.1 pump but redundancy compromised. Mechanical seal kit ordered.</p>",
    descriptionText: "No.2 Ballast Pump mechanical seal leaking heavily. Pump taken out of service. Ballast operations can continue with No.1 pump but redundancy compromised. Mechanical seal kit ordered.",
    actionTakenRequested: "Replace mechanical seal. Test pump operation. Return to service.",
    targetCloseDate: "2025-12-10",
    dateCompleted: null,
    status: "Awaiting Parts",
    priority: "Medium",
    critical: false,
    is_coc: false,
    severity: 2,
    source: "Internal",
    equipmentCategory: "Machinery",
    equipmentType: "Pump",
    equipmentMake: "Wartsila",
    equipmentModel: "W32",
    equipmentSerialNo: "WAR-BP-2020-0156",
    equipmentLocation: "Engine Room - Ballast Pump Room",
    equipmentSystem: "Ballast Water System",
    componentId: null,
    purchaseOrderRef: "PO-2025-1134",
    responsibleDept: "2nd Engineer",
    verifiedDate: null,
    defectCategory: "Ballast / Cargo / Tank Systems",
    viqVersion: "VIQ 7",
    viqRef: "6.4",
    viqChapter: "Cargo and Ballast Operations",
    viqSection: "Ballast Systems",
    sfiCodeRef: "522.1",
    immediateCause: {
      unsafeAct: [],
      unsafeCondition: ["Seal wear due to abrasive particles in ballast water"]
    },
    immediateCauseExplanation: "Ballast water strainer mesh size may be allowing fine particles to reach the pump, causing premature seal wear.",
    rootCause: {
      individualFactor: [],
      systemFactor: ["Strainer mesh specification needs review"]
    },
    rootCauseExplanation: "Strainer mesh may be too coarse for current trading pattern. More fine sediment in coastal waters than anticipated.",
    equipment_key: "V001_BALLAST_PUMP_NO2",
    raisedById: "USR-2E-001",
    raisedByName: "Michael Torres",
    raisedByRank: "2nd Engineer",
    operatingCondition: "SAILING",
    locationText: "Gulf of Mexico",
    occurrenceType: "BREAKDOWN",
    responsibleRole: "2nd Engineer",
    responsibleRoleId: "USR-2E-001",
    isDeferred: false,
    deferReason: null,
    deferNewTargetDate: null,
    deferApprovalRequired: false,
    reportToThirdParty: false,
    classReport: false,
    flagReport: false,
    portReport: false,
    reportReferenceNo: null,
    reportDate: null,
    vesselLocationType: "atSea",
    portName: null,
    latitude: "26.5000",
    longitude: "-90.2500",
    vesselLocationDetail: null,
    reportedBy: "2nd Engineer",
    assignedTo: "4th Engineer",
    reviewedBy: null,
    closedBy: null,
    closedOn: null,
    closureComment: null,
    closureFiles: [],
    linkedDefects: [],
    notes: [
      {
        noteId: "NOTE-005-1",
        noteText: "Seal kit ordered from Wartsila Singapore. Expected delivery at next port call (Singapore).",
        attachments: [],
        createdBy: "Purchasing Manager",
        createdOn: "2025-11-16T09:00:00Z"
      }
    ],
    actions: [
      {
        id: "ACT-005-1",
        actionType: "Corrective",
        proposedBy: "2nd Engineer",
        actionDescription: "Replace mechanical seal upon parts arrival",
        responsibility: "4th Engineer",
        email: "4thengineer@vessel.com",
        dueDate: "2025-12-05",
        dateCompleted: null,
        status: "Open"
      },
      {
        id: "ACT-005-2",
        actionType: "Preventive",
        proposedBy: "Chief Engineer",
        actionDescription: "Review and upgrade ballast strainer mesh size",
        responsibility: "2nd Engineer",
        email: "2ndengineer@vessel.com",
        dueDate: "2025-12-20",
        dateCompleted: null,
        status: "Open"
      }
    ],
    attachments: [
      {
        name: "seal_leak_photo.jpg",
        size: 2100000,
        type: "image/jpeg"
      }
    ],
    auditTrail: [
      {
        action: "Created",
        userId: "USR-2E-001",
        userName: "Michael Torres",
        timestamp: "2025-11-15T14:00:00Z",
        details: { status: "Open" }
      },
      {
        action: "Updated",
        userId: "USR-2E-001",
        userName: "Michael Torres",
        timestamp: "2025-11-16T10:00:00Z",
        details: { status: "Awaiting Parts", previousStatus: "Open" }
      }
    ],
    createdAt: new Date("2025-11-15T14:00:00Z"),
    updatedAt: new Date("2025-11-16T10:00:00Z")
  },

  // DEFECT 6: Regular Defect - Navigation Radar (Open)
  {
    id: generateDefectId(),
    seedId: "SEED-DEF-006",
    vesselId: "V001",
    vesselName: "MV Test",
    issueDate: "2025-11-28",
    category: "Defect",
    defectType: "Navigation / Communication System Fault",
    description: "S-Band Radar (Radar No.2) displaying intermittent video freeze on screen. Issue occurs approximately every 30 minutes and lasts for 2-3 seconds. Vessel still has full navigation capability with X-Band radar operational. Service engineer visit requested.",
    descriptionHtml: "<p>S-Band Radar (Radar No.2) displaying intermittent video freeze on screen. Issue occurs approximately every 30 minutes and lasts for 2-3 seconds. Vessel still has full navigation capability with X-Band radar operational. Service engineer visit requested.</p>",
    descriptionText: "S-Band Radar (Radar No.2) displaying intermittent video freeze on screen. Issue occurs approximately every 30 minutes and lasts for 2-3 seconds. Vessel still has full navigation capability with X-Band radar operational. Service engineer visit requested.",
    actionTakenRequested: "Arrange Kongsberg service engineer to inspect and repair at next suitable port.",
    targetCloseDate: "2025-12-20",
    dateCompleted: null,
    status: "Open",
    priority: "Medium",
    critical: false,
    is_coc: false,
    severity: 2,
    source: "Internal",
    equipmentCategory: "Navigation",
    equipmentType: "Navigation Equipment",
    equipmentMake: "Kongsberg",
    equipmentModel: "K-Chief",
    equipmentSerialNo: "KON-RAD-2019-0234",
    equipmentLocation: "Bridge - Navigation Console",
    equipmentSystem: "Navigation System",
    componentId: null,
    purchaseOrderRef: null,
    responsibleDept: "Chief Officer",
    verifiedDate: null,
    defectCategory: "Navigation & Communication Equipment",
    viqVersion: "VIQ 7",
    viqRef: "4.6",
    viqChapter: "Navigation",
    viqSection: "Radar and ARPA",
    sfiCodeRef: "413.2",
    immediateCause: {
      unsafeAct: [],
      unsafeCondition: ["Suspected display processor fault"]
    },
    immediateCauseExplanation: "Video freeze pattern suggests display processor or graphics card intermittent failure. Antenna rotation normal.",
    rootCause: {
      individualFactor: [],
      systemFactor: ["Equipment approaching end of service life"]
    },
    rootCauseExplanation: "Radar system installed in 2019 approaching 6 years of continuous operation. Some components may need proactive replacement.",
    equipment_key: "V001_RADAR_SBAND",
    raisedById: "USR-2O-001",
    raisedByName: "James Wilson",
    raisedByRank: "2nd Officer",
    operatingCondition: "SAILING",
    locationText: "Straits of Gibraltar",
    occurrenceType: "ROUTINE",
    responsibleRole: "Electrical Officer",
    responsibleRoleId: "USR-EO-001",
    isDeferred: false,
    deferReason: null,
    deferNewTargetDate: null,
    deferApprovalRequired: false,
    reportToThirdParty: false,
    classReport: false,
    flagReport: false,
    portReport: false,
    reportReferenceNo: null,
    reportDate: null,
    vesselLocationType: "atSea",
    portName: null,
    latitude: "35.9500",
    longitude: "-5.5000",
    vesselLocationDetail: null,
    reportedBy: "2nd Officer",
    assignedTo: "Electrical Officer",
    reviewedBy: null,
    closedBy: null,
    closedOn: null,
    closureComment: null,
    closureFiles: [],
    linkedDefects: [],
    notes: [
      {
        noteId: "NOTE-006-1",
        noteText: "Contacted Kongsberg service center. Engineer availability confirmed for Rotterdam port call on Dec 15-16.",
        attachments: [],
        createdBy: "Technical Superintendent",
        createdOn: "2025-11-29T10:00:00Z"
      }
    ],
    actions: [
      {
        id: "ACT-006-1",
        actionType: "Corrective",
        proposedBy: "Chief Officer",
        actionDescription: "Arrange Kongsberg service engineer attendance at Rotterdam",
        responsibility: "Technical Superintendent",
        email: "techsupt@company.com",
        dueDate: "2025-12-15",
        dateCompleted: null,
        status: "In Progress"
      }
    ],
    attachments: [
      {
        name: "radar_fault_video.mp4",
        size: 15000000,
        type: "video/mp4"
      }
    ],
    auditTrail: [
      {
        action: "Created",
        userId: "USR-2O-001",
        userName: "James Wilson",
        timestamp: "2025-11-28T06:00:00Z",
        details: { status: "Open" }
      }
    ],
    createdAt: new Date("2025-11-28T06:00:00Z"),
    updatedAt: new Date("2025-11-29T10:00:00Z")
  },

  // DEFECT 7: Regular Defect - Sewage Treatment Plant (Deferred)
  {
    id: generateDefectId(),
    seedId: "SEED-DEF-007",
    vesselId: "V001",
    vesselName: "MV Test",
    issueDate: "2025-10-10",
    category: "Defect",
    defectType: "Environmental Compliance Issue (BWM / SOx / OWS)",
    description: "Sewage Treatment Plant UV sterilization unit showing reduced effectiveness. Effluent coliform count slightly elevated but still within MARPOL limits. UV lamp replacement recommended during next dry dock.",
    descriptionHtml: "<p>Sewage Treatment Plant UV sterilization unit showing reduced effectiveness. Effluent coliform count slightly elevated but still within MARPOL limits. UV lamp replacement recommended during next dry dock.</p>",
    descriptionText: "Sewage Treatment Plant UV sterilization unit showing reduced effectiveness. Effluent coliform count slightly elevated but still within MARPOL limits. UV lamp replacement recommended during next dry dock.",
    actionTakenRequested: "Monitor effluent quality weekly. Replace UV lamps during scheduled dry dock in Q1 2026.",
    targetCloseDate: "2025-11-30",
    dateCompleted: null,
    status: "Deferred",
    priority: "Low",
    critical: false,
    is_coc: false,
    severity: 1,
    source: "Internal",
    equipmentCategory: "Machinery",
    equipmentType: "Other",
    equipmentMake: "Wartsila",
    equipmentModel: "W32",
    equipmentSerialNo: "WAR-STP-2018-0089",
    equipmentLocation: "Engine Room - STP Compartment",
    equipmentSystem: "Sewage Treatment System",
    componentId: null,
    purchaseOrderRef: null,
    responsibleDept: "2nd Engineer",
    verifiedDate: null,
    defectCategory: "Environmental / Pollution Control (e.g., BWM, SOx, OWS)",
    viqVersion: "VIQ 7",
    viqRef: "9.12",
    viqChapter: "Pollution Prevention",
    viqSection: "Sewage",
    sfiCodeRef: "542.4",
    immediateCause: {
      unsafeAct: [],
      unsafeCondition: ["UV lamp degradation over time"]
    },
    immediateCauseExplanation: "UV lamps have exceeded recommended operating hours. Output reduced but still functional.",
    rootCause: {
      individualFactor: [],
      systemFactor: ["Replacement schedule aligned with dry dock - acceptable delay"]
    },
    rootCauseExplanation: "UV lamp replacement is a planned maintenance item. Current degradation within acceptable limits until dry dock.",
    equipment_key: "V001_SEWAGE_TREATMENT_PLANT",
    raisedById: "USR-2E-001",
    raisedByName: "Michael Torres",
    raisedByRank: "2nd Engineer",
    operatingCondition: "SAILING",
    locationText: "Pacific Ocean",
    occurrenceType: "ROUTINE",
    responsibleRole: "2nd Engineer",
    responsibleRoleId: "USR-2E-001",
    isDeferred: true,
    deferReason: "Effluent still within MARPOL compliance limits. UV lamp replacement scheduled for Q1 2026 dry dock.",
    deferNewTargetDate: "2026-03-31",
    deferApprovalRequired: true,
    reportToThirdParty: false,
    classReport: false,
    flagReport: false,
    portReport: false,
    reportReferenceNo: null,
    reportDate: null,
    vesselLocationType: "atSea",
    portName: null,
    latitude: "32.5000",
    longitude: "-150.0000",
    vesselLocationDetail: null,
    reportedBy: "2nd Engineer",
    assignedTo: "3rd Engineer",
    reviewedBy: "Chief Engineer",
    closedBy: null,
    closedOn: null,
    closureComment: null,
    closureFiles: [],
    linkedDefects: [],
    notes: [
      {
        noteId: "NOTE-007-1",
        noteText: "Weekly effluent testing shows coliform count at 180/100ml (limit is 250/100ml). Within acceptable range.",
        attachments: [],
        createdBy: "3rd Engineer",
        createdOn: "2025-10-17T08:00:00Z"
      },
      {
        noteId: "NOTE-007-2",
        noteText: "Deferment approved by Technical Superintendent. UV lamps included in dry dock work scope.",
        attachments: [],
        createdBy: "Technical Superintendent",
        createdOn: "2025-10-20T14:00:00Z"
      }
    ],
    actions: [
      {
        id: "ACT-007-1",
        actionType: "Corrective",
        proposedBy: "2nd Engineer",
        actionDescription: "Replace UV lamps during Q1 2026 dry dock",
        responsibility: "Technical Superintendent",
        email: "techsupt@company.com",
        dueDate: "2026-03-31",
        dateCompleted: null,
        status: "Open"
      },
      {
        id: "ACT-007-2",
        actionType: "Preventive",
        proposedBy: "Chief Engineer",
        actionDescription: "Continue weekly effluent testing and record results",
        responsibility: "3rd Engineer",
        email: "3rdengineer@vessel.com",
        dueDate: "2026-03-31",
        dateCompleted: null,
        status: "In Progress"
      }
    ],
    attachments: [
      {
        name: "effluent_test_results.pdf",
        size: 95000,
        type: "application/pdf"
      }
    ],
    auditTrail: [
      {
        action: "Created",
        userId: "USR-2E-001",
        userName: "Michael Torres",
        timestamp: "2025-10-10T10:00:00Z",
        details: { status: "Open" }
      },
      {
        action: "Updated",
        userId: "USR-CE-001",
        userName: "John Morrison",
        timestamp: "2025-10-20T14:00:00Z",
        details: { status: "Deferred", previousStatus: "Open", isDeferred: true }
      }
    ],
    createdAt: new Date("2025-10-10T10:00:00Z"),
    updatedAt: new Date("2025-10-20T14:00:00Z")
  },

  // DEFECT 8: Regular Defect - Fire Detection Panel (Closed)
  {
    id: generateDefectId(),
    seedId: "SEED-DEF-008",
    vesselId: "V001",
    vesselName: "MV Test",
    issueDate: "2025-10-20",
    category: "Defect",
    defectType: "Safety Equipment Deficiency (Fire / Lifeboat / Alarm)",
    description: "Fire detection panel Zone 4 (Accommodation Deck 3) showing intermittent Earth Fault alarm. All smoke detectors in zone tested and found operational. Suspected cable insulation degradation. Cable tracing and repair completed.",
    descriptionHtml: "<p>Fire detection panel Zone 4 (Accommodation Deck 3) showing intermittent Earth Fault alarm. All smoke detectors in zone tested and found operational. Suspected cable insulation degradation. Cable tracing and repair completed.</p>",
    descriptionText: "Fire detection panel Zone 4 (Accommodation Deck 3) showing intermittent Earth Fault alarm. All smoke detectors in zone tested and found operational. Suspected cable insulation degradation. Cable tracing and repair completed.",
    actionTakenRequested: "Trace detection loop cable. Identify and repair insulation damage.",
    targetCloseDate: "2025-10-30",
    dateCompleted: "2025-10-28",
    status: "Closed",
    priority: "High",
    critical: true,
    is_coc: false,
    severity: 2,
    source: "Internal",
    equipmentCategory: "Safety",
    equipmentType: "Control System",
    equipmentMake: "Kongsberg",
    equipmentModel: "K-Chief",
    equipmentSerialNo: "KON-FD-2018-0567",
    equipmentLocation: "Bridge - Safety Center",
    equipmentSystem: "Fire Detection System",
    componentId: null,
    purchaseOrderRef: null,
    responsibleDept: "Electrical Officer",
    verifiedDate: "2025-10-29",
    defectCategory: "Safety & Emergency Systems (Fire, Lifesaving, Alarms)",
    viqVersion: "VIQ 7",
    viqRef: "7.5",
    viqChapter: "Safety Management",
    viqSection: "Fire Detection and Alarm",
    sfiCodeRef: "721.1",
    immediateCause: {
      unsafeAct: [],
      unsafeCondition: ["Cable insulation damage from chafing"]
    },
    immediateCauseExplanation: "Detection loop cable passing through bulkhead penetration was chafing against the gland, causing intermittent earth fault.",
    rootCause: {
      individualFactor: [],
      systemFactor: ["Bulkhead penetration gland not properly fitted during installation"]
    },
    rootCauseExplanation: "Original installation may have had insufficient cable protection at penetration point. Added cable sleeve for protection.",
    equipment_key: "V001_FIRE_DETECTION_ZONE4",
    raisedById: "USR-EO-001",
    raisedByName: "David Kim",
    raisedByRank: "Electrical Officer",
    operatingCondition: "SAILING",
    locationText: "Indian Ocean",
    occurrenceType: "ROUTINE",
    responsibleRole: "Electrical Officer",
    responsibleRoleId: "USR-EO-001",
    isDeferred: false,
    deferReason: null,
    deferNewTargetDate: null,
    deferApprovalRequired: false,
    reportToThirdParty: false,
    classReport: false,
    flagReport: false,
    portReport: false,
    reportReferenceNo: null,
    reportDate: null,
    vesselLocationType: "atSea",
    portName: null,
    latitude: "5.5000",
    longitude: "75.0000",
    vesselLocationDetail: null,
    reportedBy: "Electrical Officer",
    assignedTo: "Electrical Officer",
    reviewedBy: "Chief Engineer",
    closedBy: "Electrical Officer",
    closedOn: "2025-10-28T16:00:00Z",
    closureComment: "Cable traced through Zone 4 accommodation deck. Found chafing damage at frame 45 bulkhead penetration. Damaged section cut out and cable re-terminated. Cable sleeve fitted for protection. Full zone test conducted - no earth faults. System returned to normal.",
    closureFiles: ["cable_repair_photo.jpg"],
    linkedDefects: [],
    notes: [
      {
        noteId: "NOTE-008-1",
        noteText: "Megger test on detection loop showed 2 Megohm (should be >10 Megohm). Earth fault confirmed.",
        attachments: [],
        createdBy: "Electrical Officer",
        createdOn: "2025-10-21T10:00:00Z"
      },
      {
        noteId: "NOTE-008-2",
        noteText: "Cable damage located at bulkhead penetration frame 45. Approximately 50mm of cable affected.",
        attachments: [],
        createdBy: "Electrical Officer",
        createdOn: "2025-10-27T14:00:00Z"
      }
    ],
    actions: [
      {
        id: "ACT-008-1",
        actionType: "Corrective",
        proposedBy: "Electrical Officer",
        actionDescription: "Trace detection loop cable and locate earth fault",
        responsibility: "Electrical Officer",
        email: "electricalofficer@vessel.com",
        dueDate: "2025-10-27",
        dateCompleted: "2025-10-27",
        status: "Closed"
      },
      {
        id: "ACT-008-2",
        actionType: "Corrective",
        proposedBy: "Electrical Officer",
        actionDescription: "Repair cable insulation damage and re-terminate",
        responsibility: "Electrical Officer",
        email: "electricalofficer@vessel.com",
        dueDate: "2025-10-28",
        dateCompleted: "2025-10-28",
        status: "Closed"
      },
      {
        id: "ACT-008-3",
        actionType: "Preventive",
        proposedBy: "Chief Engineer",
        actionDescription: "Inspect all bulkhead cable penetrations in fire detection system",
        responsibility: "Electrical Officer",
        email: "electricalofficer@vessel.com",
        dueDate: "2025-11-15",
        dateCompleted: "2025-11-10",
        status: "Closed"
      }
    ],
    attachments: [
      {
        name: "cable_damage_photo.jpg",
        size: 1800000,
        type: "image/jpeg"
      },
      {
        name: "megger_test_before.pdf",
        size: 85000,
        type: "application/pdf"
      },
      {
        name: "megger_test_after.pdf",
        size: 85000,
        type: "application/pdf"
      }
    ],
    auditTrail: [
      {
        action: "Created",
        userId: "USR-EO-001",
        userName: "David Kim",
        timestamp: "2025-10-20T08:00:00Z",
        details: { status: "Open" }
      },
      {
        action: "Updated",
        userId: "USR-EO-001",
        userName: "David Kim",
        timestamp: "2025-10-28T16:00:00Z",
        details: { status: "Closed", previousStatus: "In-Progress" }
      }
    ],
    createdAt: new Date("2025-10-20T08:00:00Z"),
    updatedAt: new Date("2025-10-28T16:00:00Z")
  },

  // DEFECT 9: Regular Defect - Steering Gear (Pending)
  {
    id: generateDefectId(),
    seedId: "SEED-DEF-009",
    vesselId: "V001",
    vesselName: "MV Test",
    issueDate: "2025-11-25",
    category: "Defect",
    defectType: "Steering / Rudder / Propulsion System Defect",
    description: "Steering gear hydraulic oil temperature running higher than normal. Operating at 55°C (normal is 40-45°C). No visible leaks. Hydraulic oil cooler effectiveness reduced. Cooler cleaning scheduled.",
    descriptionHtml: "<p>Steering gear hydraulic oil temperature running higher than normal. Operating at 55°C (normal is 40-45°C). No visible leaks. Hydraulic oil cooler effectiveness reduced. Cooler cleaning scheduled.</p>",
    descriptionText: "Steering gear hydraulic oil temperature running higher than normal. Operating at 55°C (normal is 40-45°C). No visible leaks. Hydraulic oil cooler effectiveness reduced. Cooler cleaning scheduled.",
    actionTakenRequested: "Clean hydraulic oil cooler. Check cooler tube bundle for blockage or scaling. Verify seawater flow.",
    targetCloseDate: "2025-12-05",
    dateCompleted: null,
    status: "Pending",
    priority: "Medium",
    critical: false,
    is_coc: false,
    severity: 2,
    source: "Internal",
    equipmentCategory: "Machinery",
    equipmentType: "Control System",
    equipmentMake: "MAN",
    equipmentModel: "6L32",
    equipmentSerialNo: "MAN-SG-2017-0123",
    equipmentLocation: "Steering Gear Room",
    equipmentSystem: "Steering System",
    componentId: null,
    purchaseOrderRef: null,
    responsibleDept: "3rd Engineer",
    verifiedDate: null,
    defectCategory: "Steering / Rudder / Propulsion Systems",
    viqVersion: "VIQ 7",
    viqRef: "5.8",
    viqChapter: "Machinery Management",
    viqSection: "Steering Gear",
    sfiCodeRef: "531.2",
    immediateCause: {
      unsafeAct: [],
      unsafeCondition: ["Cooler tube fouling from marine growth"]
    },
    immediateCauseExplanation: "Extended operation in warm tropical waters has accelerated marine growth inside cooler tubes on seawater side.",
    rootCause: {
      individualFactor: [],
      systemFactor: ["Cooler cleaning interval may need shortening for tropical trading"]
    },
    rootCauseExplanation: "Current 6-month cooler cleaning interval may be insufficient for continuous tropical operation. Consider 3-month interval.",
    equipment_key: "V001_STEERING_GEAR",
    raisedById: "USR-3E-001",
    raisedByName: "Ahmed Hassan",
    raisedByRank: "3rd Engineer",
    operatingCondition: "SAILING",
    locationText: "South China Sea",
    occurrenceType: "ROUTINE",
    responsibleRole: "3rd Engineer",
    responsibleRoleId: "USR-3E-001",
    isDeferred: false,
    deferReason: null,
    deferNewTargetDate: null,
    deferApprovalRequired: false,
    reportToThirdParty: false,
    classReport: false,
    flagReport: false,
    portReport: false,
    reportReferenceNo: null,
    reportDate: null,
    vesselLocationType: "atSea",
    portName: null,
    latitude: "12.5000",
    longitude: "115.0000",
    vesselLocationDetail: null,
    reportedBy: "3rd Engineer",
    assignedTo: "3rd Engineer",
    reviewedBy: null,
    closedBy: null,
    closedOn: null,
    closureComment: null,
    closureFiles: [],
    linkedDefects: [],
    notes: [
      {
        noteId: "NOTE-009-1",
        noteText: "Monitoring oil temperature closely. Alarm limit is 65°C. Currently stable at 55°C.",
        attachments: [],
        createdBy: "3rd Engineer",
        createdOn: "2025-11-26T08:00:00Z"
      }
    ],
    actions: [
      {
        id: "ACT-009-1",
        actionType: "Corrective",
        proposedBy: "3rd Engineer",
        actionDescription: "Clean hydraulic oil cooler seawater side at next port",
        responsibility: "3rd Engineer",
        email: "3rdengineer@vessel.com",
        dueDate: "2025-12-03",
        dateCompleted: null,
        status: "Open"
      },
      {
        id: "ACT-009-2",
        actionType: "Preventive",
        proposedBy: "Chief Engineer",
        actionDescription: "Review and update cooler cleaning interval in PMS for tropical trading",
        responsibility: "2nd Engineer",
        email: "2ndengineer@vessel.com",
        dueDate: "2025-12-15",
        dateCompleted: null,
        status: "Open"
      }
    ],
    attachments: [
      {
        name: "oil_temp_trend.pdf",
        size: 150000,
        type: "application/pdf"
      }
    ],
    auditTrail: [
      {
        action: "Created",
        userId: "USR-3E-001",
        userName: "Ahmed Hassan",
        timestamp: "2025-11-25T10:00:00Z",
        details: { status: "Open" }
      },
      {
        action: "Updated",
        userId: "USR-3E-001",
        userName: "Ahmed Hassan",
        timestamp: "2025-11-26T08:00:00Z",
        details: { status: "Pending", previousStatus: "Open" }
      }
    ],
    createdAt: new Date("2025-11-25T10:00:00Z"),
    updatedAt: new Date("2025-11-26T08:00:00Z")
  },

  // DEFECT 10: Regular Defect - Mooring Winch (In-Progress)
  {
    id: generateDefectId(),
    seedId: "SEED-DEF-010",
    vesselId: "V001",
    vesselName: "MV Test",
    issueDate: "2025-12-01",
    category: "Defect",
    defectType: "Mooring / Deck Equipment Failure",
    description: "Forward mooring winch No.1 brake band showing excessive wear. Brake lining thickness reduced to 4mm (minimum is 3mm). Brake still functional but replacement parts ordered for precautionary maintenance.",
    descriptionHtml: "<p>Forward mooring winch No.1 brake band showing excessive wear. Brake lining thickness reduced to 4mm (minimum is 3mm). Brake still functional but replacement parts ordered for precautionary maintenance.</p>",
    descriptionText: "Forward mooring winch No.1 brake band showing excessive wear. Brake lining thickness reduced to 4mm (minimum is 3mm). Brake still functional but replacement parts ordered for precautionary maintenance.",
    actionTakenRequested: "Order brake band replacement parts. Replace brake band before next major port operation.",
    targetCloseDate: "2025-12-15",
    dateCompleted: null,
    status: "In-Progress",
    priority: "Medium",
    critical: false,
    is_coc: false,
    severity: 2,
    source: "Internal",
    equipmentCategory: "Deck",
    equipmentType: "Deck Equipment",
    equipmentMake: "Wartsila",
    equipmentModel: "W32",
    equipmentSerialNo: "WAR-MW-2018-0045",
    equipmentLocation: "Forecastle - Port Side",
    equipmentSystem: "Mooring System",
    componentId: null,
    purchaseOrderRef: "PO-2025-1178",
    responsibleDept: "Chief Officer",
    verifiedDate: null,
    defectCategory: "Deck Equipment & Mooring Systems",
    viqVersion: "VIQ 7",
    viqRef: "3.18",
    viqChapter: "Deck",
    viqSection: "Mooring Equipment",
    sfiCodeRef: "651.2",
    immediateCause: {
      unsafeAct: [],
      unsafeCondition: ["Normal wear from frequent mooring operations"]
    },
    immediateCauseExplanation: "Vessel has completed 45 port calls this year with multiple mooring operations per call. High usage causing accelerated wear.",
    rootCause: {
      individualFactor: [],
      systemFactor: ["High trading frequency impact on equipment wear rates"]
    },
    rootCauseExplanation: "Current liner trades require frequent port calls. May need to stock additional spare brake bands onboard.",
    equipment_key: "V001_MOORING_WINCH_FWD_NO1",
    raisedById: "USR-BS-001",
    raisedByName: "Carlos Rodriguez",
    raisedByRank: "Bosun",
    operatingCondition: "PORT",
    locationText: "Singapore",
    occurrenceType: "ROUTINE",
    responsibleRole: "Bosun",
    responsibleRoleId: "USR-BS-001",
    isDeferred: false,
    deferReason: null,
    deferNewTargetDate: null,
    deferApprovalRequired: false,
    reportToThirdParty: false,
    classReport: false,
    flagReport: false,
    portReport: false,
    reportReferenceNo: null,
    reportDate: null,
    vesselLocationType: "atPort",
    portName: "Singapore",
    latitude: null,
    longitude: null,
    vesselLocationDetail: "Anchorage",
    reportedBy: "Bosun",
    assignedTo: "Bosun",
    reviewedBy: "Chief Officer",
    closedBy: null,
    closedOn: null,
    closureComment: null,
    closureFiles: [],
    linkedDefects: [],
    notes: [
      {
        noteId: "NOTE-010-1",
        noteText: "Brake band spare parts ordered from local supplier. Expected delivery in 3 days.",
        attachments: [],
        createdBy: "Purchasing Manager",
        createdOn: "2025-12-02T09:00:00Z"
      },
      {
        noteId: "NOTE-010-2",
        noteText: "Bosun team prepared tools and equipment for brake band replacement.",
        attachments: [],
        createdBy: "Bosun",
        createdOn: "2025-12-02T14:00:00Z"
      }
    ],
    actions: [
      {
        id: "ACT-010-1",
        actionType: "Corrective",
        proposedBy: "Bosun",
        actionDescription: "Procure replacement brake band and lining",
        responsibility: "Purchasing Manager",
        email: "purchasing@company.com",
        dueDate: "2025-12-05",
        dateCompleted: null,
        status: "In Progress"
      },
      {
        id: "ACT-010-2",
        actionType: "Corrective",
        proposedBy: "Chief Officer",
        actionDescription: "Replace brake band upon parts arrival",
        responsibility: "Bosun",
        email: "bosun@vessel.com",
        dueDate: "2025-12-10",
        dateCompleted: null,
        status: "Open"
      },
      {
        id: "ACT-010-3",
        actionType: "Preventive",
        proposedBy: "Chief Officer",
        actionDescription: "Increase spare brake band stock level to 2 sets per winch",
        responsibility: "Purchasing Manager",
        email: "purchasing@company.com",
        dueDate: "2025-12-20",
        dateCompleted: null,
        status: "Open"
      }
    ],
    attachments: [
      {
        name: "brake_band_measurement.jpg",
        size: 1500000,
        type: "image/jpeg"
      },
      {
        name: "winch_inspection_checklist.pdf",
        size: 120000,
        type: "application/pdf"
      }
    ],
    auditTrail: [
      {
        action: "Created",
        userId: "USR-BS-001",
        userName: "Carlos Rodriguez",
        timestamp: "2025-12-01T11:00:00Z",
        details: { status: "Open" }
      },
      {
        action: "Updated",
        userId: "USR-CO-001",
        userName: "Robert Chen",
        timestamp: "2025-12-02T10:00:00Z",
        details: { status: "In-Progress", previousStatus: "Open" }
      }
    ],
    createdAt: new Date("2025-12-01T11:00:00Z"),
    updatedAt: new Date("2025-12-02T14:00:00Z")
  }
];

async function seedDefects() {
  try {
    console.log('Reading test-data.json...');
    const data = JSON.parse(fs.readFileSync(testDataPath, 'utf-8'));
    
    console.log('Seeding 10 defects...');
    console.log('- 2 Recurring (same equipment_key: Main Engine Fuel Pump)');
    console.log('- 2 COC (with class/flag reports)');
    console.log('- 6 Regular defects with mixed statuses');
    
    if (!data.defects) {
      data.defects = {};
    }
    
    for (const defect of defects) {
      data.defects[defect.id] = {
        ...defect,
        createdAt: defect.createdAt.toISOString(),
        updatedAt: defect.updatedAt.toISOString()
      };
      console.log(`  Added: ${defect.seedId} - ${defect.description.substring(0, 50)}... [${defect.status}]${defect.is_coc ? ' [COC]' : ''}${defect.equipment_key === 'V001_MAIN_ENGINE_FUEL_PUMP_NO1' ? ' [RECURRING]' : ''}`);
    }
    
    console.log('\nWriting to test-data.json...');
    fs.writeFileSync(testDataPath, JSON.stringify(data, null, 2));
    
    console.log('\n✅ Successfully seeded 10 defects!');
    console.log('\nSummary:');
    console.log('  Defect 1: Recurring #1 - Main Engine Fuel Pump (Closed)');
    console.log('  Defect 2: Recurring #2 - Main Engine Fuel Pump (In-Progress)');
    console.log('  Defect 3: COC #1 - Emergency Generator (Open) - Class & Flag Report');
    console.log('  Defect 4: COC #2 - Lifeboat Davit Wire (Closed) - Class, Flag & Port Report');
    console.log('  Defect 5: Ballast Pump (Awaiting Parts)');
    console.log('  Defect 6: Navigation Radar (Open)');
    console.log('  Defect 7: Sewage Treatment Plant (Deferred)');
    console.log('  Defect 8: Fire Detection Panel (Closed)');
    console.log('  Defect 9: Steering Gear (Pending)');
    console.log('  Defect 10: Mooring Winch (In-Progress)');
    
  } catch (error) {
    console.error('Error seeding defects:', error);
    process.exit(1);
  }
}

seedDefects();
