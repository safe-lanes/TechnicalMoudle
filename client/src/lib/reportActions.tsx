import { Pencil, Eye } from "lucide-react";

export type ReportEntityKind =
  | "workOrder"
  | "component"
  | "spare"
  | "store"
  | "ihm"
  | "changeRequest"
  | "anomaly";

export interface ReportActionConfig {
  entityKind: ReportEntityKind | ((row: Record<string, any>) => ReportEntityKind);
  menuName: string | ((row: Record<string, any>) => string);
  idFields: string[] | ((row: Record<string, any>) => string[]);
  route: (id: string, row: Record<string, any>) => string;
}

const PLACEHOLDER_VALUES = new Set(["", "-", "—", "–", "n/a", "na", "null", "undefined", "total", "totals", "subtotal", "grand total"]);

const FIRST_DEFINED = (row: Record<string, any>, fields: string[]): string | null => {
  if (!row) return null;
  const isSummaryRow =
    row.isTotal === true ||
    row.isSummary === true ||
    row.isGroupRow === true ||
    row.__isSummary === true ||
    row.rowType === "summary" ||
    row.rowType === "total";
  if (isSummaryRow) return null;
  for (const f of fields) {
    const v = row?.[f];
    if (v === undefined || v === null) continue;
    const s = String(v).trim();
    if (s === "") continue;
    if (PLACEHOLDER_VALUES.has(s.toLowerCase())) continue;
    return s;
  }
  return null;
};

const WORK_ORDER_ID_FIELDS = ["workOrderId", "workOrderUuid", "wouuid", "woId"];
const COMPONENT_ID_FIELDS = ["componentId", "componentUuid", "cuuid"];
const SPARE_ID_FIELDS = ["spareId", "spareUuid", "spuuid"];
const STORE_ID_FIELDS = ["itemId", "storeId", "storeItemId"];
const CHANGE_REQUEST_ID_FIELDS = ["ruid", "changeRequestId", "crId", "id"];

export const REPORT_ACTIONS: Record<string, ReportActionConfig> = {
  // Maintenance & Work Orders → Work Order page
  "due-jobs-7":           { entityKind: "workOrder", menuName: "pms-work-orders", idFields: WORK_ORDER_ID_FIELDS, route: (id) => `/pms/work-order/${encodeURIComponent(id)}` },
  "overdue-jobs":         { entityKind: "workOrder", menuName: "pms-work-orders", idFields: WORK_ORDER_ID_FIELDS, route: (id) => `/pms/work-order/${encodeURIComponent(id)}` },
  "completed-jobs":       { entityKind: "workOrder", menuName: "pms-work-orders", idFields: WORK_ORDER_ID_FIELDS, route: (id) => `/pms/work-order/${encodeURIComponent(id)}` },
  "all-jobs":             { entityKind: "workOrder", menuName: "pms-work-orders", idFields: WORK_ORDER_ID_FIELDS, route: (id) => `/pms/work-order/${encodeURIComponent(id)}` },
  "unplanned-jobs":       { entityKind: "workOrder", menuName: "pms-work-orders", idFields: WORK_ORDER_ID_FIELDS, route: (id) => `/pms/work-order/${encodeURIComponent(id)}` },
  "postponement-log":     { entityKind: "workOrder", menuName: "pms-work-orders", idFields: WORK_ORDER_ID_FIELDS, route: (id) => `/pms/work-order/${encodeURIComponent(id)}` },

  // Running Hours & Condition → Component
  "rh-utilization-summary": { entityKind: "component", menuName: "pms-components", idFields: COMPONENT_ID_FIELDS, route: (id) => `/pms/maintenance-records/${encodeURIComponent(id)}` },
  "rh-anomaly-detection":   { entityKind: "component", menuName: "pms-components", idFields: COMPONENT_ID_FIELDS, route: (id) => `/pms/maintenance-records/${encodeURIComponent(id)}` },

  // Inventory - Spares → Spares module
  "spares-low-stock":             { entityKind: "spare", menuName: "pms-spares", idFields: SPARE_ID_FIELDS, route: (id) => `/spares?spareId=${encodeURIComponent(id)}` },
  "spares-consumption-analysis":  { entityKind: "spare", menuName: "pms-spares", idFields: SPARE_ID_FIELDS, route: (id) => `/spares?spareId=${encodeURIComponent(id)}` },
  "spares-critical-parts":        { entityKind: "spare", menuName: "pms-spares", idFields: SPARE_ID_FIELDS, route: (id) => `/spares?spareId=${encodeURIComponent(id)}` },

  // Inventory - Stores → Stores module
  "stores-inventory-status":     { entityKind: "store", menuName: "pms-stores", idFields: STORE_ID_FIELDS, route: (id) => `/stores?itemId=${encodeURIComponent(id)}` },
  "lubes-oil-analysis":          { entityKind: "store", menuName: "pms-stores", idFields: STORE_ID_FIELDS, route: (id) => `/stores?itemId=${encodeURIComponent(id)}` },
  "chemicals-tracking":          { entityKind: "store", menuName: "pms-stores", idFields: STORE_ID_FIELDS, route: (id) => `/stores?itemId=${encodeURIComponent(id)}` },
  "low-stock-alert":             { entityKind: "store", menuName: "pms-stores", idFields: STORE_ID_FIELDS, route: (id) => `/stores?itemId=${encodeURIComponent(id)}` },
  "stores-consumption-analysis": { entityKind: "store", menuName: "pms-stores", idFields: STORE_ID_FIELDS, route: (id) => `/stores?itemId=${encodeURIComponent(id)}` },

  // IHM — per-row destination based on row.itemType ('spare' → Spares module, 'store' → Stores module)
  "ihm-inventory-status": {
    entityKind: (row) => (row?.itemType === "spare" ? "spare" : "store"),
    menuName: (row) => (row?.itemType === "spare" ? "pms-spares" : "pms-stores"),
    idFields: (row) =>
      row?.itemType === "spare"
        ? ["spareId", "spareUuid", "spuuid"]
        : ["itemId", "storeId", "storeItemId"],
    route: (id, row) =>
      row?.itemType === "spare"
        ? `/spares?spareId=${encodeURIComponent(id)}`
        : `/stores?itemId=${encodeURIComponent(id)}`,
  },

  // Change Requests — Modify-PMS list page with the specific request pre-selected via query param
  "change-requests-status":          { entityKind: "changeRequest", menuName: "pms-modify-pms", idFields: CHANGE_REQUEST_ID_FIELDS, route: (id) => `/pms/modify-pms/jobs?requestId=${encodeURIComponent(id)}` },
  "change-requests-status-tracking": { entityKind: "changeRequest", menuName: "pms-modify-pms", idFields: CHANGE_REQUEST_ID_FIELDS, route: (id) => `/pms/modify-pms/jobs?requestId=${encodeURIComponent(id)}` },

  // Critical Equipment
  "critical-components-list":   { entityKind: "component", menuName: "pms-components",  idFields: COMPONENT_ID_FIELDS,  route: (id) => `/pms/maintenance-records/${encodeURIComponent(id)}` },
  "critical-equipment-schedule":{ entityKind: "workOrder", menuName: "pms-work-orders", idFields: WORK_ORDER_ID_FIELDS, route: (id) => `/pms/work-order/${encodeURIComponent(id)}` },
  "critical-equipment":         { entityKind: "component", menuName: "pms-components",  idFields: COMPONENT_ID_FIELDS,  route: (id) => `/pms/maintenance-records/${encodeURIComponent(id)}` },

  // LSA/FFA
  "lsa-ffa-master-list":          { entityKind: "component", menuName: "pms-components",  idFields: COMPONENT_ID_FIELDS,  route: (id) => `/pms/maintenance-records/${encodeURIComponent(id)}` },
  "lsa-ffa-maintenance-schedule": { entityKind: "workOrder", menuName: "pms-work-orders", idFields: WORK_ORDER_ID_FIELDS, route: (id) => `/pms/work-order/${encodeURIComponent(id)}` },

  // Class Items
  "class-items-master-list": { entityKind: "component", menuName: "pms-components",  idFields: COMPONENT_ID_FIELDS,  route: (id) => `/pms/maintenance-records/${encodeURIComponent(id)}` },
  "class-items-jobs-status": { entityKind: "workOrder", menuName: "pms-work-orders", idFields: WORK_ORDER_ID_FIELDS, route: (id) => `/pms/work-order/${encodeURIComponent(id)}` },
};

export const getReportAction = (reportId?: string | null): ReportActionConfig | null => {
  if (!reportId) return null;
  return REPORT_ACTIONS[reportId] || null;
};

export const extractRowEntityId = (row: Record<string, any>, config: ReportActionConfig): string | null => {
  const fields = typeof config.idFields === "function" ? config.idFields(row) : config.idFields;
  return FIRST_DEFINED(row, fields);
};

export const resolveMenuName = (config: ReportActionConfig, row: Record<string, any>): string => {
  return typeof config.menuName === "function" ? config.menuName(row) : config.menuName;
};

export { Pencil, Eye };
