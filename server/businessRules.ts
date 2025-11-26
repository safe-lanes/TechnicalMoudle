/**
 * ============================================================================
 * PMS BUSINESS RULES & MODULE INTERLINKING - COMPREHENSIVE REFERENCE
 * ============================================================================
 * 
 * This file serves as the authoritative reference for all business logic,
 * validation rules, workflows, and cross-module interlinking in the PMS system.
 * 
 * Based on consolidated specification documents:
 * - 1 Components.docx
 * - 2 Work orders.docx  
 * - 3 RUNNING HOURS MODULE.docx
 * - 4 spares.docx
 * - 5 Stores.docx
 * - Global BUSINESS RULES.docx
 * - Admin 4 Guide 1.docx
 * - 00 clarifications - Ans.txt
 * 
 * Last Updated: November 2025
 * ============================================================================
 */

// ============================================================================
// SECTION 1: CORE SYSTEM MODEL
// ============================================================================

export const SYSTEM_ARCHITECTURE = {
  /**
   * Three core physical hierarchies:
   * 1. Components Hierarchy (SFI-based)
   * 2. Running Hours Architecture  
   * 3. Jobs Architecture
   * 
   * Two distinct inventory types:
   * 1. Spares (linked to Components & Work Orders)
   * 2. Stores (NOT linked to PMS - completely isolated)
   */
  
  hierarchies: {
    components: {
      description: "SFI-based equipment breakdown structure",
      parentComponents: "3-digit SFI codes representing main machinery",
      childComponents: "Multiple levels under parent (sub-components/parts)",
      keyRule: "Every job and spare is linked to a specific component/sub-component"
    },
    
    runningHours: {
      description: "RH tracking for machinery usage",
      visibility: "Only parent components appear in Running Hours module",
      propagation: "RH updates propagate from parent → all children via delta",
      restriction: "Sub-components do NOT appear in RH module (only in WOs & job history)"
    },
    
    jobs: {
      description: "Maintenance task definitions",
      ownership: "Jobs belong to SUB-COMPONENTS, not parent components",
      types: ["Calendar-based (date intervals)", "Running Hours-based (RH thresholds)"],
      cycleReset: "Every job cycle resets on completion (planned/unplanned)"
    }
  },
  
  inventoryTypes: {
    spares: {
      linkedTo: ["Components", "Work Orders", "Jobs"],
      notLinkedTo: ["Running Hours", "Stores"],
      purpose: "Critical spare parts for maintenance tasks"
    },
    stores: {
      linkedTo: [], // COMPLETELY ISOLATED
      notLinkedTo: ["Components", "Jobs", "Work Orders", "Running Hours"],
      purpose: "General consumables (tools, PPE, lubes, chemicals, paints)"
    }
  }
};

// ============================================================================
// SECTION 2: FLEET ADMIN & VESSEL SETUP FLOW
// ============================================================================

export const FLEET_ADMIN_RULES = {
  /**
   * Data Flow: Fleet Admin → Vessel
   * The Fleet Admin data is imported first, then vessel data is imported.
   * Vessel import sheets have linkages with Fleet Admin data.
   * 
   * IMPORTANT: After importing, changes in Fleet Admin do NOT reflect directly.
   * If component/job/spare details are changed, they need to be re-selected 
   * and re-mapped for changes to take effect.
   */
  
  dataFlowPrinciple: "IMPORT_THEN_INDEPENDENT",
  
  importSequence: [
    "1. Fleet Equipment Master data imported",
    "2. Fleet Job Master data imported", 
    "3. Fleet Spare Master data imported",
    "4. Maker/Model Master imported",
    "5. Vessel imports with linkages to Fleet data",
    "6. Vessel works independently after import"
  ],
  
  postImportBehavior: {
    changeReflection: false, // Changes in Fleet Admin do NOT auto-reflect
    updateMethod: "Re-select and re-map to apply changes"
  },
  
  componentInitialization: {
    source: "VESSEL_EXCEL_UPLOAD", // Ship uploads own Component Excel
    codeFormat: {
      fleetCode: "331.001.AA", // Fleet Equipment Code format
      vesselCode: "331.001.01", // First 7 digits same as Fleet Code
      multipleChildren: ".01, .02, .03..." // Numbered sequence for multiple children
    }
  },
  
  jobInitialization: {
    source: "FLEET_JOB_MASTER", // Jobs directly copied from Fleet Job Master
    frequencyModification: true, // Vessel CAN modify frequency
    originalSource: "Fleet Admin"
  },
  
  sparesInitialization: {
    source: "BOTH", // Created at Fleet Admin AND by vessel
    vesselCreation: "Requires office approval",
    robInitialization: "Vessel uploads own initial ROB via Excel"
  },
  
  fleetEquipmentMapping: {
    vesselMapping: "Link Fleet Equipment Code to specific vessel",
    componentMapping: "Link Fleet Equipment Code to vessel Component Codes",
    jobMapping: "Link/unlink jobs from vessels",
    spareMapping: "Link/unlink spares from vessels"
  }
};

// ============================================================================
// SECTION 3: COMPONENTS MODULE BUSINESS RULES
// ============================================================================

export const COMPONENTS_RULES = {
  /**
   * The Components Module is the foundational equipment register.
   * It contains the full hierarchical structure of all machinery, equipment,
   * and systems onboard, organized strictly per SFI Codes.
   */
  
  sfiFramework: {
    mainGroups: [
      { code: "1", name: "Ship General" },
      { code: "2", name: "Hull" },
      { code: "3", name: "Equipment for Cargo" },
      { code: "4", name: "Ship's Equipment" },
      { code: "5", name: "Equipment for Crew & Passengers" },
      { code: "6", name: "Machinery Main Components" },
      { code: "7", name: "Systems for Machinery Main Components" },
      { code: "8", name: "Ship Common Systems" }
    ],
    fixedGroups: true, // Top-level SFI groups (1-8) CANNOT be changed
    codeFormat: "digits and dots only, NO dashes"
  },
  
  fleetEquipmentCode: {
    format: "Typically 10 characters (not strictly enforced)",
    generation: "Maker Code + Model Code",
    purpose: "Identifies equipment type across entire fleet",
    editableBy: "PMS Software Provider ONLY",
    links: ["Jobs", "Spares", "Manuals", "Templates"]
  },
  
  componentVsSubComponent: {
    parent: {
      definition: "Main machinery (appears in RH module)",
      examples: ["Main Engine", "Generator", "Purifier"],
      isParentFlag: true
    },
    subComponent: {
      definition: "Child parts (appear in WOs, Spares, Jobs)",
      examples: ["Cylinder Liner", "Piston", "LOP", "Filters"],
      hasParentId: true
    }
  },
  
  criticality: {
    assignedBy: "Company Superintendent / Technical Office",
    values: ["Yes", "No"],
    impact: [
      "Component appears in Critical filter",
      "Jobs attached inherit critical status",
      "Critical spares can be linked",
      "Reports classify equipment as critical"
    ],
    shipCanEdit: false
  },
  
  runningHoursInComponents: {
    pencilIconBehavior: "Updates parent RH using RH module logic",
    deltaPropagation: "ALWAYS applied to sub-components",
    constraint: "Child RH must stay ≤ parent RH",
    noDirectJobModification: "RH updates do NOT modify job history directly"
  },
  
  jobsInComponents: {
    ownership: "Jobs belong to SUB-COMPONENTS only",
    parentComponentJobs: false, // Jobs CANNOT be assigned to parent components
    frequencyTypes: ["Calendar", "Running Hours"],
    nextDueCalculation: {
      calendar: "Date-based",
      runningHours: "Remaining Hours (not date)"
    }
  },
  
  sparesInComponents: {
    linkingRule: "Each spare may link to MULTIPLE components",
    displayRule: "Unique rows with merged component codes",
    vesselSpecific: true
  },
  
  sections: {
    A: "Component Information",
    B: "Running Hours & Condition Monitoring",
    C: "Jobs",
    D: "Maintenance History",
    E: "Spares",
    F: "Drawings & Manuals",
    G: "Classification & Regulatory Data",
    H: "Requisitions (placeholder for future)"
  },
  
  fieldPermissions: {
    fleetEquipmentCode: { ship: false, office: false, admin: true },
    fleetEquipmentName: { ship: false, office: false, admin: true },
    parentComponentCode: { ship: false, office: "Admin only", admin: true },
    componentCode: { ship: false, office: false, admin: true },
    componentName: { ship: false, office: "Admin/approval", admin: true },
    maker: { ship: false, office: true, admin: true },
    makerCode: { ship: false, office: false, admin: true },
    model: { ship: false, office: true, admin: true },
    modelCode: { ship: false, office: false, admin: true },
    serialNo: { ship: false, office: true, admin: true },
    drawingNo: { ship: false, office: true, admin: true },
    location: { ship: false, office: true, admin: true },
    critical: { ship: false, office: true, admin: true },
    conditionBased: { ship: false, office: true, admin: true },
    commissioningDate: { ship: false, office: true, admin: true },
    rating: { ship: false, office: true, admin: true },
    equipSystemDept: { ship: false, office: true, admin: true },
    installationDate: { ship: false, office: true, admin: true },
    runningHours: { ship: "Only via RH Module", office: "No direct edit", admin: true },
    isActive: { ship: false, office: true, admin: true },
    vesselCode: { ship: false, office: false, admin: "System" },
    isParent: { ship: false, office: false, admin: true },
    notes: { ship: false, office: true, admin: true }
  }
};

// ============================================================================
// SECTION 4: RUNNING HOURS MODULE BUSINESS RULES
// ============================================================================

export const RUNNING_HOURS_RULES = {
  /**
   * The Running Hours module is the MASTER source of truth for all RH values.
   * Parent components only appear here. Child RH is derived via delta propagation.
   */
  
  masterSourceOfTruth: true,
  
  visibility: {
    parentComponents: true, // ONLY parents visible in RH module
    childComponents: false, // Children NEVER appear in RH module
    childVisibility: "Only in Work Orders and job history"
  },
  
  updateModes: {
    setTotal: {
      description: "Enter present counter reading from machinery",
      validation: "New reading >= Old reading"
    },
    addDelta: {
      description: "Enter only change since last reading",
      calculation: "New total = Previous + Delta",
      validation: "Delta >= 0"
    }
  },
  
  validationRules: {
    noBackwardUpdates: {
      rule: "New RH cannot be less than Old RH",
      blocking: true,
      errorMessage: "New reading cannot be less than previous reading."
    },
    practicalMaximumWarning: {
      calculation: "max_hours = 25 × days_between",
      blocking: false,
      warningMessage: "Running hours increase exceeds practical maximum (25 hours/day). Please verify."
    },
    dateNotEarlier: {
      rule: "System auto-fills date/time, no manual backdating allowed"
    }
  },
  
  deltaPropagation: {
    trigger: "When parent RH changes",
    formula: "ChildRH_new = ChildRH_old + Delta",
    ensures: "Child RH never lags behind parent usage",
    constraint: "Child RH must NEVER exceed parent RH"
  },
  
  meterReplacement: {
    parentMeter: {
      handler: "ONLY in Running Hours module",
      behavior: [
        "Parent resets to 0 (or new meter reading)",
        "Old meter final reading stored in history",
        "History entry with meter_replaced = true",
        "Delta still propagates to children"
      ]
    },
    subComponentMeter: {
      handler: "ONLY through Work Orders",
      behavior: "Sub-component RH resets to 0, subsequent deltas still apply"
    }
  },
  
  childReplacementScenario: {
    rhReset: "Child RH resets to 0",
    futureUpdates: "Parent deltas still apply after replacement",
    keyDistinction: "Only apply NEW delta after replacement, not old total"
  },
  
  parentReplacementScenario: {
    parentRh: "Reset to 0",
    allChildren: "Also reset to 0",
    newSequence: "All RH entries begin from zero"
  },
  
  backwardCorrection: {
    normalUI: false, // NOT allowed in normal UI
    officeAdminOnly: true,
    behavior: "Negative delta applied to all children",
    logging: "Special history event with 'admin correction' tag"
  },
  
  workOrderTrigger: {
    condition: "CurrentRH >= LastDoneRH + FrequencyRH - LeadTimeRH",
    timing: "Real-time on each successful RH update",
    noDailyBatch: true,
    gracePeriod: "168 running hours beyond due RH"
  },
  
  historyFields: [
    "Date (DD-MMM-YYYY HH:MM)",
    "Old RH",
    "New RH", 
    "Delta",
    "Update Mode (Set Total / Add Delta)",
    "Meter Replaced (Yes/No)",
    "User",
    "Tag/Note",
    "Comments"
  ],
  
  permissions: {
    updateRH: "All users (open model)",
    bulkUpdate: "All users",
    exportRH: "All users (ship and shore)",
    approvals: "None required - updates effective immediately"
  }
};

// ============================================================================
// SECTION 5: WORK ORDERS MODULE BUSINESS RULES  
// ============================================================================

export const WORK_ORDER_RULES = {
  /**
   * Work Orders are the execution records for maintenance tasks.
   * They can be Planned (from Jobs) or Unplanned (manual creation).
   */
  
  workOrderTypes: {
    planned: {
      source: "Auto-generated from Jobs when threshold reached",
      numbering: "JOBCODE.WO-YYYY-XX (e.g., JOB-331.831-02.WO-2025-01)",
      partA: "Read-only for ship users (job template data)",
      partB: "Ship fills completion details"
    },
    unplanned: {
      source: "Created manually for breakdowns/defects",
      numbering: "UWO-VESSELCODE-YYYY-XX (e.g., UWO-V001-2025-001)",
      mustResetCycle: true, // MUST reset job cycle
      mustUpdateLastDoneRH: true,
      mustAppearInHistory: true
    }
  },
  
  statusValues: {
    due: {
      condition: "WO generated within lead time but before due date",
      color: "Orange"
    },
    dueGraceP: {
      condition: "Due date exceeded but still inside grace period",
      color: "Amber/Yellow"
    },
    overdue: {
      condition: "Beyond due date + grace period OR beyond RH threshold + 168h grace",
      color: "Red"
    },
    pendingApproval: {
      condition: "Part B filled by ship, waiting for HoD approval",
      color: "Grey/Blue"
    },
    postponed: {
      condition: "WO postponed to new date, next due still in future",
      color: "Blue"
    },
    completed: {
      condition: "WO approved by HoD (final)",
      color: "Green"
    }
  },
  
  sortOrder: [
    "1. Overdue (nearest due date first)",
    "2. Grace P (nearest due date first)",
    "3. Due (nearest due date first)",
    "4. Postponed",
    "5. Pending Approval",
    "6. Active",
    "7. Completed",
    "8. Rejected"
  ],
  
  gracePeriod: {
    calendarJobs: {
      rule: "End of month OR 7 days after due date (whichever is longer)",
      condition: "If due before end of month → grace till end of month; If due in last week → 7 days"
    },
    runningHoursJobs: {
      hours: 168,
      description: "168 running hours beyond due RH"
    }
  },
  
  partA: {
    description: "Work Order Details (immutable job template data)",
    sections: [
      "A1: Work Order Information",
      "A2: Required Spare Parts",
      "A3: Required Tools & Equipment", 
      "A4: Safety Requirements",
      "A5: Work History"
    ],
    editability: {
      ship: false, // All fields read-only for ship
      office: "Editable only before WO is frozen",
      admin: true
    }
  },
  
  partB: {
    description: "Work Completion Record (ship fills this)",
    sections: {
      B1: "Risk Assessment, Checklists & Records",
      B2: "Details of Work Carried Out (duration, work description)",
      B3: "Running Hours (Previous Reading read-only, Current Reading editable)",
      B4: "Spare Parts Consumed"
    }
  },
  
  runningHoursInWO: {
    previousReading: {
      source: "Auto-filled from component's currentCumulativeRH",
      editable: false
    },
    currentReading: {
      editable: true,
      validation: {
        notLessThanPrevious: true,
        notExceedParentRH: true,
        errorMessage: "Current Reading cannot be less than Previous Reading."
      }
    },
    updateBehavior: {
      updates: "Sub-component RH ONLY",
      neverUpdates: "Parent RH (reserved for RH module)",
      onApproval: "Updates sub-component RH, job's Last Done RH, job history"
    }
  },
  
  spareConsumption: {
    preloadedRows: "From required spares in Part A",
    quantityConsumed: "Editable",
    comments: "Optional",
    addNewSpare: "Button to add spare not in template",
    robDeduction: {
      timing: "On work order approval",
      behavior: "Automatic ROB deduction from selected location",
      negativeROB: false, // ROB never goes negative
      warningOnInsufficient: true
    }
  },
  
  postponement: {
    allowedBy: ["HoD roles", "Office"],
    shipAllowed: false,
    requirements: [
      "Reason for Postponement (mandatory)",
      "Authorized By (dropdown)",
      "Approval Remarks (optional)",
      "Next Due Date (must be > original due date)",
      "Attach Document (optional)"
    ],
    behavior: [
      "Status becomes Postponed",
      "WO is NOT marked Completed",
      "History entry created with postponement details",
      "WO re-enters Due/Grace states when new date reaches threshold"
    ]
  },
  
  approval: {
    flow: "Ship fills Part B → Submit for Approval → HoD approves",
    onApproval: [
      "Status becomes Completed",
      "Date Completed set",
      "Part A and Part B become immutable",
      "Maintenance History entry created",
      "Jobs table updates Last Done & Next Due",
      "Spare ROB deducted",
      "Sub-component RH updated"
    ]
  },
  
  jobCycleUpdate: {
    onWOApproval: {
      calendarJobs: {
        updates: ["lastDoneDate", "nextDueDate"],
        nextDueFormula: "lastDoneDate + frequencyValue × frequencyUnit"
      },
      runningHoursJobs: {
        updates: ["lastDoneRH", "nextDueRH"],
        source: "currentReading from WO Part B runningHours field"
      }
    }
  },
  
  permissions: {
    viewWOList: { ship: true, office: true, admin: true },
    openEditPartB: { ship: "If assigned/allowed", office: true, admin: true },
    viewOnlyCompleted: { ship: true, office: true, admin: true },
    createPlannedWO: { ship: false, office: true, admin: true },
    createUnplannedWO: { ship: true, office: true, admin: true },
    postponeWO: { ship: false, office: "HoD roles", admin: true }
  }
};

// ============================================================================
// SECTION 6: SPARES MODULE BUSINESS RULES
// ============================================================================

export const SPARES_RULES = {
  /**
   * Spares are linked to Components and consumed through Work Orders.
   * Each spare must link to at least one component.
   */
  
  linkageRules: {
    linkedTo: ["Components", "Work Orders"],
    notLinkedTo: ["Running Hours", "Stores"],
    minimumComponents: 1,
    maximumComponents: "Unlimited (practical limit 50+)",
    sharedSpares: "Same spare can serve multiple identical components (e.g., AE1, AE2, AE3)"
  },
  
  partCode: {
    uniqueness: "Unique per vessel",
    format: "Auto-generated: VESSELCODE-XXXX (e.g., V001-0001)",
    editability: {
      ship: false,
      office: "Limited",
      admin: true
    }
  },
  
  stockControl: {
    robCalculation: "ROB = ROB_A + ROB_B (Location A + Location B)",
    minQty: "Minimum acceptable stock level",
    statusCalculation: {
      OK: "ROB >= Min",
      LOW: "0 < ROB < Min",
      CRITICAL: "ROB = 0 AND Critical = Yes"
    }
  },
  
  locations: {
    supported: ["Location A", "Location B"],
    totalROB: "Sum of both locations",
    consumption: "User selects which location to consume from",
    noAutoBalance: true // Never auto-balance between locations
  },
  
  criticalSpareAlerts: {
    triggerCondition: "Critical = YES AND ROB = 0",
    display: ["Dashboard", "Alerts module", "Spares Inventory red-highlight"]
  },
  
  robBehavior: {
    neverNegative: true,
    onInsufficientStock: {
      allowWOCompletion: true,
      showWarning: true,
      setROB: 0 // Never negative
    }
  },
  
  woIntegration: {
    preloadedInPartA: "Required spares from job template",
    consumedInPartB: "Quantity consumed editable",
    robDeductionTiming: "On WO approval",
    historyLogging: "Always logged with WO reference"
  },
  
  excelUpload: {
    validation: "Strict header validation",
    existingCode: "Merge quantities (update)",
    newCode: "Create new spare",
    historyCreation: "For every ROB change"
  },
  
  transactionHistory: {
    immutable: true,
    fields: [
      "Transaction Type (Consumed/Received)",
      "Date",
      "Place (for receipt)",
      "Qty change",
      "Old ROB",
      "New ROB",
      "User",
      "WO Reference (if applicable)",
      "Comments"
    ]
  },
  
  ihmFlag: {
    purpose: "Inventory of Hazardous Materials identification",
    trackedInHistory: true,
    disposal: "Future: disposal instructions"
  },
  
  permissions: {
    addSpare: { ship: "Via Modify PMS", office: true, hod: true, admin: true },
    editSpare: { ship: "Limited", office: true, hod: true, admin: true },
    consumeSpare: { ship: true, office: true, hod: true, admin: true },
    bulkUpdate: { ship: true, office: true, hod: true, admin: true },
    deleteSpare: { ship: "Request approval", office: true, hod: true, admin: true },
    excelUpload: { ship: false, office: true, hod: false, admin: true }
  }
};

// ============================================================================
// SECTION 7: STORES MODULE BUSINESS RULES (ISOLATED FROM PMS)
// ============================================================================

export const STORES_RULES = {
  /**
   * CRITICAL: Stores module is COMPLETELY ISOLATED from PMS.
   * NOT linked to Components, Jobs, Work Orders, or Running Hours.
   */
  
  isolation: {
    linkedTo: [], // NOTHING
    notLinkedTo: ["Components", "Jobs", "Work Orders", "Running Hours", "Spares"],
    reason: "General consumables, not maintenance-specific"
  },
  
  inventoryTypes: {
    stores: {
      examples: ["Tools", "Rags", "PPE", "General machinery stores", "Deck stores", "Gaskets"]
    },
    lubes: {
      examples: ["Hydraulic oils", "Gear oils", "ME cylinder oils", "Greases"],
      uomStandard: "Litres (not drums)"
    },
    chemicals: {
      examples: ["Boiler chemicals", "RO plant chemicals", "Cleaning agents", "Biocides"]
    },
    others: {
      examples: ["Paints", "Coatings", "Cleaning products", "Client-specific"]
    }
  },
  
  commonLogic: {
    itemCode: "Unique per vessel",
    locations: ["Location A", "Location B"],
    robCalculation: "ROB_A + ROB_B",
    transactions: ["Consumption", "Receipt"],
    historyImmutable: true
  },
  
  stockStatus: {
    OK: "ROB >= Min",
    LOW: "0 < ROB < Min",
    ROB_ZERO: "Visually emphasized low state",
    noCriticalBadge: true // 'Critical' concept reserved for Spares only
  },
  
  ihmHandling: {
    applicable: true, // IHM flag applies to all tabs
    robZeroWithIHM: "Strong visual warning required",
    trackedInHistory: true
  },
  
  permissions: {
    addItem: { ship: true, office: true },
    editItem: { ship: true, office: true },
    robChanges: { ship: true, office: true },
    softDelete: { ship: "HoD only", office: true },
    ihmChange: { ship: "HoD only", office: true },
    excelUpload: { ship: true, office: true }
  },
  
  vesselIsolation: {
    strict: true,
    crossVesselSync: false,
    description: "Each vessel maintains independent inventory"
  }
};

// ============================================================================
// SECTION 8: CROSS-MODULE RH LOGIC
// ============================================================================

export const CROSS_MODULE_RH_RULES = {
  /**
   * Running Hours logic spans multiple modules with strict rules.
   */
  
  parentRH: {
    updateSource: "Running Hours module ONLY (or Components quick-edit)",
    woNeverUpdates: true, // WO NEVER updates parent RH
    propagation: "Delta to all children"
  },
  
  subComponentRH: {
    updateSource: "Work Order Part B ONLY",
    constraints: {
      cannotExceedParent: true,
      cannotGoBackward: true
    }
  },
  
  synchronization: {
    onParentRHChange: "All children receive delta",
    onComponentInstallation: "Child cycles reset",
    onWOCompletion: "Sub-component cycles reset"
  },
  
  validationHierarchy: {
    level1: "Parent RH is master source",
    level2: "Sub-component RH derived from parent deltas",
    level3: "WO RH must not exceed parent RH"
  }
};

// ============================================================================
// SECTION 9: CROSS-MODULE SPARES LOGIC
// ============================================================================

export const CROSS_MODULE_SPARES_RULES = {
  sparesAppearIn: ["Components", "Work Orders", "Spares module"],
  sparesDoNotAppearIn: ["Running Hours", "Stores"],
  
  consumptionThroughWO: {
    insufficientStock: "Show warning, allow completion",
    robNeverNegative: true,
    criticalSpareAtZero: "Red alert"
  },
  
  oneSpareMultipleComponents: {
    rule: "Single spare row maps to multiple component codes",
    noDuplication: true
  }
};

// ============================================================================
// SECTION 10: ROLE-BASED ACCESS CONTROL
// ============================================================================

export const RBAC_RULES = {
  userRoles: {
    GSU: "General Ship User",
    TU: "Technical User",
    HOD: "Head of Department",
    OFFICE: "Office/Shore Staff",
    ADMIN: "PMS Admin/Software Provider"
  },
  
  permissionMatrix: {
    addStoresSpares: { GSU: true, TU: true, HOD: true, OFFICE: true, ADMIN: true },
    editStoresSpares: { GSU: true, TU: true, HOD: true, OFFICE: true, ADMIN: true },
    deleteInactivate: { GSU: false, TU: false, HOD: true, OFFICE: true, ADMIN: true },
    updateComponentRH: { GSU: false, TU: false, HOD: true, OFFICE: true, ADMIN: true },
    updateSubComponentRH: { GSU: "via WO", TU: "via WO", HOD: true, OFFICE: true, ADMIN: true },
    bulkUpdateInventory: { GSU: true, TU: true, HOD: true, OFFICE: true, ADMIN: true },
    excelUpload: { GSU: true, TU: true, HOD: true, OFFICE: true, ADMIN: true }
  }
};

// ============================================================================
// SECTION 11: HISTORY & AUDIT RULES
// ============================================================================

export const AUDIT_RULES = {
  rhHistory: {
    componentRH: "Tracked in RH module",
    subComponentRH: "Tracked in WO module"
  },
  
  inventoryHistory: {
    everyTransaction: "Must create history row",
    immutable: true,
    noModification: true,
    noDeletion: true
  },
  
  auditTrail: {
    fields: [
      "Timestamp",
      "Username",
      "Action",
      "Old value",
      "New value",
      "IP address (office)"
    ]
  }
};

// ============================================================================
// SECTION 12: DEVELOPER SAFETY RULES (CRITICAL VALIDATIONS)
// ============================================================================

export const SAFETY_RULES = {
  /**
   * These rules MUST be enforced in all code paths.
   * Violations indicate bugs that need immediate fixing.
   */
  
  rule1_NoNegativeROB: {
    description: "Never allow negative ROB",
    modules: ["Spares", "Stores"],
    enforcement: "Block save if result would be negative"
  },
  
  rule2_ChildNotExceedParent: {
    description: "Never allow child RH > parent RH",
    validation: "WO Part B validation",
    errorMessage: "Sub-component RH cannot exceed parent RH"
  },
  
  rule3_NoBackwardRH: {
    description: "Never allow backward RH",
    applies: ["Parent", "Child"],
    exception: "Admin correction only"
  },
  
  rule4_UnplannedWOResetsCycle: {
    description: "Unplanned WO resets job cycle",
    reason: "Job completed earlier than scheduled"
  },
  
  rule5_NoCircularLogic: {
    description: "Avoid circular RH logic",
    correct: ["RH module updates parent", "WO updates child"],
    incorrect: "Never reverse propagate child → parent"
  },
  
  rule6_InactiveNotEditable: {
    description: "Inactive spare or store must not be editable/consumable"
  },
  
  rule7_OneSpareRow: {
    description: "One spare row mapped to multiple components",
    antiPattern: "Do not duplicate spare rows per component"
  },
  
  rule8_SeparateHistories: {
    description: "Running Hours vs Work Orders keep separate histories"
  },
  
  rule9_JobsOnSubComponentsOnly: {
    description: "Jobs belong to sub-components, not parent components",
    validation: "Block job creation on parent components"
  },
  
  rule10_StoresIsolation: {
    description: "Stores module has ZERO PMS linkages",
    noFields: ["componentId", "workOrderId", "jobId"]
  }
};

// ============================================================================
// SECTION 13: WORK ORDER NUMBERING SPECIFICATION
// ============================================================================

export const WO_NUMBERING = {
  planned: {
    format: "<JOB CODE>.WO-<YEAR>-<RUNNING NUMBER>",
    example: "JOB-ABC1234.WO-2025-001",
    runningNumber: "Per-job-per-year sequential"
  },
  unplanned: {
    format: "UWO-<VESSEL CODE>-<YEAR>-<RUNNING NUMBER>",
    example: "UWO-VESSEL01-2025-001",
    runningNumber: "Per-vessel-per-year sequential"
  },
  typeDeterm: "Determined by job linkage presence (has jobId = Planned, no jobId = Unplanned)"
};

// ============================================================================
// SECTION 14: LEAD TIME WARNINGS
// ============================================================================

export const LEAD_TIME_RULES = {
  colorCoding: {
    red: "≤3 days until due",
    orange: "≤7 days until due",
    yellow: ">7 days until due"
  },
  hydration: "Backend automatically hydrates WOs with leadTimeValue and leadTimeUnit from linked jobs",
  persistJobId: "All WO creation paths (manual, auto-generation, bulk import) must persist jobId"
};

// ============================================================================
// SECTION 15: MODIFY PMS WORKFLOW
// ============================================================================

export const MODIFY_PMS_RULES = {
  scope: {
    components: true,
    jobs: true,
    spares: true,
    storesItems: true
  },
  
  workflow: {
    shipProposal: "Ship proposes changes",
    officeApproval: "Office approves/rejects",
    onApproval: "Changes reflect in respective module"
  },
  
  alwaysRequired: true, // All structural changes go through Modify PMS
  
  types: {
    add: "Add new component/job/spare/store",
    modify: "Modify existing data",
    delete: "Delete/inactivate"
  }
};

// ============================================================================
// SECTION 16: MAINTENANCE HISTORY IMMUTABILITY
// ============================================================================

export const MAINTENANCE_HISTORY_RULES = {
  immutable: true,
  operations: {
    insert: true,
    update: false, // BLOCKED
    delete: false  // BLOCKED
  },
  enforcement: "PostgreSQL triggers enforce INSERT-only behavior",
  errorMessage: "Maintenance history records cannot be modified or deleted"
};

// ============================================================================
// SECTION 17: AUTO-GENERATION SCHEDULER
// ============================================================================

export const AUTO_GENERATION_RULES = {
  calendarJobs: {
    trigger: "When nextDueDate reached",
    calculation: "Based on lastDoneDate + interval"
  },
  runningHoursJobs: {
    trigger: "When currentRH >= nextDueRH - leadTime",
    source: "Current RH from Running Hours module"
  },
  timing: "Real-time on RH update (no daily batch)"
};

// ============================================================================
// EXPORT ALL RULES
// ============================================================================

export const ALL_BUSINESS_RULES = {
  SYSTEM_ARCHITECTURE,
  FLEET_ADMIN_RULES,
  COMPONENTS_RULES,
  RUNNING_HOURS_RULES,
  WORK_ORDER_RULES,
  SPARES_RULES,
  STORES_RULES,
  CROSS_MODULE_RH_RULES,
  CROSS_MODULE_SPARES_RULES,
  RBAC_RULES,
  AUDIT_RULES,
  SAFETY_RULES,
  WO_NUMBERING,
  LEAD_TIME_RULES,
  MODIFY_PMS_RULES,
  MAINTENANCE_HISTORY_RULES,
  AUTO_GENERATION_RULES
};

export default ALL_BUSINESS_RULES;
