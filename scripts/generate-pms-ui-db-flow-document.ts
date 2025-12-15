import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  ShadingType,
} from "docx";
import * as fs from "fs";

function createHeading(text: string, level: HeadingLevel): Paragraph {
  return new Paragraph({
    text: text,
    heading: level,
    spacing: { before: 400, after: 200 },
  });
}

function createParagraph(text: string, bold: boolean = false): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text: text, bold: bold })],
    spacing: { after: 120 },
  });
}

function createBullet(text: string, level: number = 0): Paragraph {
  return new Paragraph({
    children: [new TextRun(text)],
    bullet: { level: level },
    spacing: { after: 60 },
  });
}

function createTableHeader(cells: string[]): TableRow {
  return new TableRow({
    children: cells.map(
      (cell) =>
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: cell, bold: true })] })],
          shading: { type: ShadingType.SOLID, color: "4472C4" },
          width: { size: 100 / cells.length, type: WidthType.PERCENTAGE },
        })
    ),
  });
}

function createTableRow(cells: string[]): TableRow {
  return new TableRow({
    children: cells.map(
      (cell) =>
        new TableCell({
          children: [new Paragraph({ text: cell })],
          width: { size: 100 / cells.length, type: WidthType.PERCENTAGE },
        })
    ),
  });
}

async function generateDocument() {
  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: "PMS UI Flow & Database Table Mapping",
                bold: true,
                size: 56,
                color: "2E74B5",
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: "Seafarer Technical Management System",
                size: 32,
                italics: true,
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "Document Version: 1.0", size: 24 }),
            ],
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({
            children: [
              new TextRun({ text: `Generated: ${new Date().toLocaleDateString()}`, size: 24 }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 800 },
          }),

          createHeading("1. Application Overview", HeadingLevel.HEADING_1),
          createParagraph(
            "The Seafarer Technical Management System is a full-stack maritime Planned Maintenance System (PMS) designed to manage technical equipment maintenance, scheduling, and performance tracking for vessels and fleets."
          ),
          createParagraph("Key Functional Areas:", true),
          createBullet("Core PMS Operations - Components, Jobs, Work Orders, Running Hours"),
          createBullet("Certificate & Surveys Management - Regulatory compliance tracking"),
          createBullet("Defect Reporting - Condition of Class, SIRE VIQ 7 integration"),
          createBullet("Spares & Stores Management - Inventory with dual locations"),
          createBullet("Fleet Administration - Multi-vessel management, bulk imports"),
          createBullet("Admin Module - User management, data import/export, settings"),

          createHeading("1.1 Admin → Downstream Behavior", HeadingLevel.HEADING_2),
          createParagraph(
            "Changes made in the Admin module cascade throughout the system:"
          ),
          createBullet("Fleet/Vessel changes affect all related components, jobs, and work orders"),
          createBullet("User role changes immediately affect access permissions"),
          createBullet("PMS Settings (lead times, grace periods) affect work order status calculations"),
          createBullet("Master Data changes (makers, SFI codes) propagate to component forms"),

          createHeading("2. UI-Wise End-to-End Data Flow", HeadingLevel.HEADING_1),
          createParagraph(
            "This section describes the complete user interaction flow from UI screens to database persistence."
          ),

          createHeading("2.1 Architecture Overview", HeadingLevel.HEADING_2),
          createParagraph("Frontend: React + TypeScript + Vite + TanStack Query + Wouter"),
          createParagraph("Backend: Express.js + TypeScript"),
          createParagraph("Database: PostgreSQL (Neon) for Modules 1-3, File Storage for Modules 4+"),
          createParagraph("ORM: Drizzle ORM with Zod validation"),

          createHeading("2.2 Data Flow Pattern", HeadingLevel.HEADING_2),
          createParagraph("All data operations follow this pattern:"),
          createBullet("UI Form/Table → User interaction (create, edit, delete)"),
          createBullet("TanStack Query → API call via fetch/mutation"),
          createBullet("Express Routes → Request handling and validation"),
          createBullet("HybridStorage → Routes to PostgreSQL or FileStorage"),
          createBullet("PostgresStorage/FileStorage → Drizzle ORM or JSON persistence"),
          createBullet("Database → PostgreSQL tables or test-data.json"),

          createHeading("3. Table Mapping for Each UI Flow", HeadingLevel.HEADING_1),

          createHeading("3.1 Module 1: Core Reference Data", HeadingLevel.HEADING_2),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              createTableHeader(["UI Screen", "PostgreSQL Table", "Operations", "Primary Key"]),
              createTableRow(["Login/User Management", "users", "SELECT, INSERT, UPDATE, DELETE", "id (integer)"]),
              createTableRow(["Fleet Admin Dashboard", "fleets", "SELECT, INSERT, UPDATE, DELETE", "id (text)"]),
              createTableRow(["Vessel Selector", "vessels", "SELECT, INSERT, UPDATE, DELETE", "id (text)"]),
              createTableRow(["PMS Settings", "pms_vessel_settings", "SELECT, INSERT, UPDATE", "id (integer)"]),
            ],
          }),

          createHeading("3.1.1 Users Table Flow", HeadingLevel.HEADING_3),
          createParagraph("UI Path: Login → Dashboard → Admin → User Management"),
          createBullet("GET /api/users → PostgresStorage.getUsers() → SELECT * FROM users"),
          createBullet("POST /api/users → PostgresStorage.createUser() → INSERT INTO users"),
          createBullet("PATCH /api/users/:id → PostgresStorage.updateUser() → UPDATE users SET ..."),
          createBullet("DELETE /api/users/:id → PostgresStorage.deleteUser() → DELETE FROM users"),

          createHeading("3.1.2 Vessels Table Flow", HeadingLevel.HEADING_3),
          createParagraph("UI Path: Vessel Selector (header dropdown) → Fleet Admin"),
          createBullet("GET /api/vessels → PostgresStorage.getVessels() → SELECT * FROM vessels"),
          createBullet("POST /api/vessels → PostgresStorage.createVessel() → INSERT INTO vessels"),
          createBullet("Vessel selection triggers context change across all modules"),

          createHeading("3.2 Module 2: Master Data", HeadingLevel.HEADING_2),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              createTableHeader(["UI Screen", "PostgreSQL Table", "Operations", "Primary Key"]),
              createTableRow(["Master Data → Makers", "makers", "SELECT, INSERT, UPDATE, DELETE", "id (text)"]),
              createTableRow(["Dropdown Options", "master_lists", "SELECT, INSERT, UPDATE, DELETE", "id (text)"]),
              createTableRow(["Maker Registry", "maker_list", "SELECT, INSERT, UPDATE, DELETE", "id (text)"]),
              createTableRow(["SFI Code Management", "sfi_details", "SELECT, INSERT, UPDATE, DELETE", "id (text)"]),
              createTableRow(["Equipment Master", "master_data", "SELECT, INSERT, UPDATE, DELETE", "id (text)"]),
            ],
          }),

          createHeading("3.2.1 Makers Flow", HeadingLevel.HEADING_3),
          createParagraph("UI Path: Admin → Master Data → Makers Tab"),
          createBullet("Used as dropdown options in Component forms (Maker field)"),
          createBullet("Cascades to components.maker and components.makerCode fields"),

          createHeading("3.2.2 SFI Details Flow", HeadingLevel.HEADING_3),
          createParagraph("UI Path: Admin → Master Data → SFI Codes Tab"),
          createBullet("Provides standardized classification codes for components"),
          createBullet("Links to components via component category classification"),

          createHeading("3.3 Module 3: Components & Related Data", HeadingLevel.HEADING_2),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              createTableHeader(["UI Screen", "PostgreSQL Table", "Operations", "Primary Key"]),
              createTableRow(["PMS → Components List", "components", "SELECT, INSERT, UPDATE, DELETE", "id (text)"]),
              createTableRow(["Component Form - Section F", "component_documents", "SELECT, INSERT, UPDATE, DELETE", "id (integer)"]),
              createTableRow(["Component Form - Classification", "component_class_regulatory", "SELECT, INSERT, UPDATE, DELETE", "id (integer)"]),
              createTableRow(["Component Form - History", "component_maintenance_history", "SELECT, INSERT (only)", "id (integer)"]),
              createTableRow(["Component Form - Section G", "component_requisitions", "SELECT, INSERT, UPDATE, DELETE", "id (integer)"]),
              createTableRow(["Running Hours Module", "running_hours_audit", "SELECT, INSERT", "id (integer)"]),
            ],
          }),

          createHeading("3.3.1 Components Flow", HeadingLevel.HEADING_3),
          createParagraph("UI Path: PMS → Components → Component List/Form"),
          createBullet("GET /api/components?vesselId=X → Filters by vessel"),
          createBullet("GET /api/fleet-components → dataScope='fleet' templates"),
          createBullet("Supports hierarchical structure via parentId field"),
          createBullet("Running Hours tracked via currentCumulativeRH field"),

          createHeading("3.3.2 Component Maintenance History (IMMUTABLE)", HeadingLevel.HEADING_3),
          createParagraph("CRITICAL: This table is INSERT-ONLY. No updates or deletes allowed.", true),
          createBullet("Records created automatically when Work Orders are completed"),
          createBullet("Serves as permanent audit trail for all maintenance performed"),
          createBullet("PostgreSQL trigger enforces immutability constraint"),

          createHeading("3.3.3 Running Hours Audit Flow", HeadingLevel.HEADING_3),
          createParagraph("UI Path: PMS → Running Hours → Update RH"),
          createBullet("Tracks all running hours updates for compliance"),
          createBullet("Supports meter replacement scenarios (oldMeterFinal, newMeterStart)"),
          createBullet("Delta propagation: Parent RH changes cascade to children"),

          createHeading("3.4 Module 4: Jobs & Work Orders (File Storage)", HeadingLevel.HEADING_2),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              createTableHeader(["UI Screen", "Storage", "Operations", "Key"]),
              createTableRow(["PMS → Jobs List/Form", "test-data.json (jobs)", "CRUD", "id (string)"]),
              createTableRow(["PMS → Work Orders List", "test-data.json (workOrders)", "CRUD", "id (string)"]),
              createTableRow(["Work Order Form", "test-data.json (workOrderExecutions)", "CRUD", "id (string)"]),
            ],
          }),

          createHeading("3.4.1 Jobs Flow", HeadingLevel.HEADING_3),
          createParagraph("Jobs are IMMUTABLE TEMPLATES. Work Orders are execution records.", true),
          createBullet("Jobs define: frequency, component, task description, spares needed"),
          createBullet("Job changes do NOT affect existing Work Orders (frozen snapshot)"),

          createHeading("3.4.2 Work Orders Flow", HeadingLevel.HEADING_3),
          createParagraph("UI Path: PMS → Work Orders → Work Order Form"),
          createBullet("Part A: READ-ONLY snapshot of Job template (immutable after creation)"),
          createBullet("Part B: Execution details (editable: completion date, remarks, etc.)"),
          createBullet("Naming: Planned = JOB_CODE.WO-YEAR-NNN, Unplanned = UWO-VESSEL-YEAR-NNN"),

          createHeading("3.5 Module 5: Spares & Stores (File Storage)", HeadingLevel.HEADING_2),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              createTableHeader(["UI Screen", "Storage", "Operations", "Key"]),
              createTableRow(["PMS → Spares", "test-data.json (spares)", "CRUD", "id (integer)"]),
              createTableRow(["Spares History", "test-data.json (sparesHistory)", "INSERT", "id (integer)"]),
              createTableRow(["PMS → Stores", "test-data.json (storesItems)", "CRUD", "id (integer)"]),
              createTableRow(["Stores Ledger", "test-data.json (storesLedger)", "INSERT", "id (integer)"]),
            ],
          }),

          createHeading("3.5.1 Spares Flow", HeadingLevel.HEADING_3),
          createParagraph("UI Path: PMS → Spares → Spares List/Form"),
          createBullet("Linked to components via componentId and componentSpareCode"),
          createBullet("Dual locations: robLocationA, robLocationB"),
          createBullet("Transaction history recorded in sparesHistory"),
          createBullet("Consumption triggers warning if ROB < Min"),

          createHeading("3.5.2 Stores Flow (ISOLATED)", HeadingLevel.HEADING_3),
          createParagraph("CRITICAL: Stores module has ZERO linkages to Components/Jobs/Work Orders.", true),
          createBullet("Completely isolated per Global Business Rule Section 7.2"),
          createBullet("Manages: stores, lubricants, chemicals, others"),

          createHeading("3.6 Module 6: Defects (File Storage)", HeadingLevel.HEADING_2),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              createTableHeader(["UI Screen", "Storage", "Operations", "Key"]),
              createTableRow(["Defects → Defect List", "test-data.json (defects)", "CRUD", "id (string)"]),
              createTableRow(["Defect Actions", "test-data.json (defectActions)", "CRUD", "id (integer)"]),
              createTableRow(["Defect Attachments", "test-data.json (defectAttachments)", "CRUD", "id (integer)"]),
              createTableRow(["Recurring Defects", "test-data.json (recurringDefects)", "CRUD", "id (string)"]),
            ],
          }),

          createHeading("3.6.1 Defects Flow", HeadingLevel.HEADING_3),
          createParagraph("UI Path: Defects → Defect List → Defect Form"),
          createBullet("ID Format: DEF-VESSEL-YEAR-NNN (auto-generated)"),
          createBullet("Tracks Condition of Class items"),
          createBullet("Integrates with SIRE VIQ 7 codes"),

          createHeading("3.7 Module 7: Certificates & Surveys (File Storage)", HeadingLevel.HEADING_2),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              createTableHeader(["UI Screen", "Storage", "Operations", "Key"]),
              createTableRow(["Cert & Surveys → Certificates", "test-data.json (certificates)", "CRUD", "id (string)"]),
              createTableRow(["Cert & Surveys → Surveys", "test-data.json (surveys)", "CRUD", "id (string)"]),
            ],
          }),

          createHeading("3.7.1 Certificates & Surveys Flow", HeadingLevel.HEADING_3),
          createParagraph("UI Path: Cert & Surveys → Certificates/Surveys AG Grid Table"),
          createBullet("AG Grid Enterprise with inline date editing"),
          createBullet("Due In filter: All, 3 months, 2 months, 1 month, Overdue"),
          createBullet("File attachments stored as base64 in test-data.json"),

          createHeading("4. Data Classification", HeadingLevel.HEADING_1),

          createHeading("4.1 Master/Config Data", HeadingLevel.HEADING_2),
          createBullet("fleets, vessels - Core organizational structure"),
          createBullet("users - Authentication and authorization"),
          createBullet("pms_vessel_settings - Per-vessel configuration"),
          createBullet("makers, maker_list, sfi_details, master_data, master_lists - Reference data"),

          createHeading("4.2 Transactional Data", HeadingLevel.HEADING_2),
          createBullet("work_orders, work_order_executions - Maintenance execution records"),
          createBullet("spares_history, stores_ledger - Inventory transactions"),
          createBullet("running_hours_audit - RH update history"),
          createBullet("component_maintenance_history - Maintenance audit trail (immutable)"),
          createBullet("defects, defect_actions - Issue tracking"),

          createHeading("4.3 Reference Data", HeadingLevel.HEADING_2),
          createBullet("jobs - Maintenance job templates (immutable templates)"),
          createBullet("components - Equipment registry"),
          createBullet("component_documents, component_class_regulatory - Component metadata"),
          createBullet("certificates, surveys - Regulatory compliance records"),
          createBullet("spares, stores_items - Inventory master data"),

          createHeading("5. Integrity & Persistence Validation", HeadingLevel.HEADING_1),

          createHeading("5.1 Database Constraints", HeadingLevel.HEADING_2),
          createBullet("Primary keys enforce uniqueness"),
          createBullet("Foreign key relationships (vesselId, componentId, etc.)"),
          createBullet("Unique constraints (users.username, fleets.code, etc.)"),
          createBullet("Immutability triggers on component_maintenance_history"),

          createHeading("5.2 Validation Rules", HeadingLevel.HEADING_2),
          createBullet("Zod schemas validate all API request bodies"),
          createBullet("Drizzle-zod generates schemas from table definitions"),
          createBullet("Frontend form validation via react-hook-form + zodResolver"),

          createHeading("5.3 Data Persistence", HeadingLevel.HEADING_2),
          createBullet("PostgreSQL (Modules 1-3): ACID-compliant, durable storage"),
          createBullet("File Storage (Modules 4+): test-data.json with atomic writes"),
          createBullet("HybridStorage layer routes operations to correct storage"),

          createHeading("5.4 Business Rules Enforcement", HeadingLevel.HEADING_2),
          createBullet("Work Order Part A immutability (frozen job snapshot)"),
          createBullet("Component Maintenance History INSERT-only"),
          createBullet("RH delta propagation to child components"),
          createBullet("Stores module isolation (no PMS linkages)"),
          createBullet("Work Order naming conventions enforced"),
          createBullet("Defect ID naming pattern validation"),

          createHeading("6. Storage Layer Summary", HeadingLevel.HEADING_1),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              createTableHeader(["Module", "Tables", "Storage Type", "Status"]),
              createTableRow(["Module 1", "users, fleets, vessels, pms_vessel_settings", "PostgreSQL", "Migrated"]),
              createTableRow(["Module 2", "makers, master_lists, maker_list, sfi_details, master_data", "PostgreSQL", "Migrated"]),
              createTableRow(["Module 3", "components, component_documents, component_class_regulatory, component_maintenance_history, component_requisitions, running_hours_audit", "PostgreSQL", "Migrated"]),
              createTableRow(["Module 4", "jobs, work_orders, work_order_executions", "File (JSON)", "Pending Migration"]),
              createTableRow(["Module 5", "spares, spares_history, stores_items, stores_ledger", "File (JSON)", "Pending Migration"]),
              createTableRow(["Module 6", "defects, defect_actions, defect_attachments, recurring_defects", "File (JSON)", "Pending Migration"]),
              createTableRow(["Module 7", "certificates, surveys", "File (JSON)", "Pending Migration"]),
            ],
          }),

          createHeading("7. Key Files Reference", HeadingLevel.HEADING_1),
          createBullet("shared/schema.ts - All table definitions (Drizzle ORM)"),
          createBullet("server/routes.ts - API endpoint handlers"),
          createBullet("server/hybridStorage.ts - Storage routing layer"),
          createBullet("server/postgresStorage.ts - PostgreSQL CRUD operations"),
          createBullet("server/persistentFileStorage.ts - JSON file storage"),
          createBullet("client/src/pages/ - UI page components"),
          createBullet("client/src/lib/queryClient.ts - TanStack Query configuration"),
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync("PMS_UI_DB_FLOW_DOCUMENT.docx", buffer);
  console.log("✅ Word document generated: PMS_UI_DB_FLOW_DOCUMENT.docx");
}

generateDocument().catch(console.error);
