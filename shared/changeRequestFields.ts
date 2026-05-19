/**
 * Field definitions for Change Request workflow
 * Maps display names to actual database column names for each target type
 * These MUST match the actual schema in shared/schema.ts
 */

export interface FieldDefinition {
  columnName: string;
  displayName: string;
  type: 'text' | 'number' | 'boolean' | 'date' | 'select';
  editable: boolean;
  options?: string[];
}

export const COMPONENT_FIELDS: FieldDefinition[] = [
  { columnName: 'name', displayName: 'Component Name', type: 'text', editable: true },
  { columnName: 'componentCode', displayName: 'Component Code', type: 'text', editable: true },
  { columnName: 'fleetEquipmentCode', displayName: 'Fleet Equipment Code', type: 'text', editable: true },
  { columnName: 'fleetEquipmentName', displayName: 'Fleet Equipment Name', type: 'text', editable: true },
  { columnName: 'componentCategory', displayName: 'Component Category', type: 'text', editable: true },
  { columnName: 'maker', displayName: 'Maker', type: 'text', editable: true },
  { columnName: 'makerCode', displayName: 'Maker Code', type: 'text', editable: true },
  { columnName: 'model', displayName: 'Model', type: 'text', editable: true },
  { columnName: 'modelCode', displayName: 'Model Code', type: 'text', editable: true },
  { columnName: 'serialNo', displayName: 'Serial Number', type: 'text', editable: true },
  { columnName: 'drawingNo', displayName: 'Drawing Number', type: 'text', editable: true },
  { columnName: 'location', displayName: 'Location', type: 'text', editable: true },
  { columnName: 'critical', displayName: 'Critical', type: 'boolean', editable: true },
  { columnName: 'conditionBased', displayName: 'Condition Based', type: 'boolean', editable: true },
  { columnName: 'installationDate', displayName: 'Installation Date', type: 'date', editable: true },
  { columnName: 'commissionedDate', displayName: 'Commissioned Date', type: 'date', editable: true },
  { columnName: 'rating', displayName: 'Rating', type: 'text', editable: true },
  { columnName: 'eqptSystemDept', displayName: 'Equipment System Dept', type: 'text', editable: true },
  { columnName: 'isActive', displayName: 'Is Active', type: 'boolean', editable: true },
  { columnName: 'notes', displayName: 'Notes', type: 'text', editable: true },
  { columnName: 'department', displayName: 'Department', type: 'text', editable: true },
  { columnName: 'category', displayName: 'Category', type: 'text', editable: true },
  { columnName: 'classItem', displayName: 'Class Item', type: 'boolean', editable: true },
  { columnName: 'noOfUnits', displayName: 'Number of Units', type: 'text', editable: true },
  { columnName: 'dimensionsSize', displayName: 'Dimensions/Size', type: 'text', editable: true },
  { columnName: 'currentCumulativeRH', displayName: 'Current Cumulative RH', type: 'number', editable: false },
];

export const JOB_FIELDS: FieldDefinition[] = [
  { columnName: 'jobTitle', displayName: 'Job Title', type: 'text', editable: true },
  { columnName: 'jobNo', displayName: 'Job Number', type: 'text', editable: false },
  { columnName: 'assignedTo', displayName: 'Assigned To', type: 'text', editable: true },
  { columnName: 'maintenanceType', displayName: 'Maintenance Type', type: 'select', editable: true, options: ['Inspection', 'Overhaul', 'Service', 'Testing'] },
  { columnName: 'maintenanceBasis', displayName: 'Maintenance Basis', type: 'select', editable: true, options: ['Calendar', 'Running Hours', 'Dual Frequency'] },
  { columnName: 'frequencyValue', displayName: 'Frequency Value', type: 'text', editable: true },
  { columnName: 'frequencyUnit', displayName: 'Frequency Unit', type: 'select', editable: true, options: ['Months', 'Years', 'Weeks', 'Days', 'Hours'] },
  { columnName: 'intervalRunningHour', displayName: 'Interval Running Hours', type: 'number', editable: true },
  { columnName: 'leadTimeValue', displayName: 'Lead Time Value', type: 'number', editable: true },
  { columnName: 'leadTimeUnit', displayName: 'Lead Time Unit', type: 'select', editable: true, options: ['Days', 'Weeks', 'Months'] },
  { columnName: 'initialNextDue', displayName: 'Initial Next Due', type: 'date', editable: true },
  { columnName: 'lastDoneDate', displayName: 'Last Done Date', type: 'date', editable: true },
  { columnName: 'nextDueDate', displayName: 'Next Due Date', type: 'date', editable: false },
  { columnName: 'lastDoneRH', displayName: 'Last Done RH', type: 'text', editable: true },
  { columnName: 'nextDueRH', displayName: 'Next Due RH', type: 'text', editable: false },
  { columnName: 'jobPriority', displayName: 'Job Priority', type: 'select', editable: true, options: ['Low', 'Medium', 'High', 'Critical'] },
  { columnName: 'classRelated', displayName: 'Class Related', type: 'select', editable: true, options: ['Yes', 'No'] },
  { columnName: 'briefWorkDescription', displayName: 'Brief Work Description', type: 'text', editable: true },
  { columnName: 'jobDescription', displayName: 'Job Description', type: 'text', editable: true },
  { columnName: 'approver', displayName: 'Approver', type: 'text', editable: true },
  { columnName: 'department', displayName: 'Department', type: 'text', editable: true },
  { columnName: 'criticality', displayName: 'Criticality', type: 'text', editable: true },
  { columnName: 'isActive', displayName: 'Is Active', type: 'boolean', editable: true },
];

export const WORK_ORDER_FIELDS: FieldDefinition[] = [
  { columnName: 'jobTitle', displayName: 'Job Title', type: 'text', editable: true },
  { columnName: 'workOrderNo', displayName: 'Work Order Number', type: 'text', editable: false },
  { columnName: 'workOrderType', displayName: 'Work Order Type', type: 'select', editable: false, options: ['Planned', 'Unplanned'] },
  { columnName: 'assignedTo', displayName: 'Assigned To', type: 'text', editable: true },
  { columnName: 'dueDate', displayName: 'Due Date', type: 'date', editable: true },
  { columnName: 'status', displayName: 'Status', type: 'select', editable: false, options: ['Completed', 'Due', 'Due (Grace P)', 'Overdue', 'Postponed', 'Pending Approval', 'Active'] },
  { columnName: 'taskType', displayName: 'Task Type', type: 'select', editable: true, options: ['Inspection', 'Overhaul', 'Service', 'Testing'] },
  { columnName: 'maintenanceType', displayName: 'Maintenance Type', type: 'select', editable: true, options: ['Inspection', 'Overhaul', 'Service', 'Testing'] },
  { columnName: 'maintenanceBasis', displayName: 'Maintenance Basis', type: 'select', editable: false, options: ['Calendar', 'Running Hours', 'Dual Frequency'] },
  { columnName: 'frequencyValue', displayName: 'Frequency Value', type: 'text', editable: true },
  { columnName: 'frequencyUnit', displayName: 'Frequency Unit', type: 'select', editable: true, options: ['Months', 'Years', 'Weeks', 'Days'] },
  { columnName: 'approverRemarks', displayName: 'Approver Remarks', type: 'text', editable: true },
  { columnName: 'approver', displayName: 'Approver', type: 'text', editable: true },
  { columnName: 'nextDueDate', displayName: 'Next Due Date', type: 'date', editable: false },
  { columnName: 'nextDueReading', displayName: 'Next Due Reading', type: 'text', editable: false },
  { columnName: 'currentReading', displayName: 'Current Reading', type: 'text', editable: false },
  { columnName: 'classRelated', displayName: 'Class Related', type: 'select', editable: true, options: ['Yes', 'No'] },
  { columnName: 'jobPriority', displayName: 'Job Priority', type: 'select', editable: true, options: ['Low', 'Medium', 'High', 'Critical'] },
  { columnName: 'briefWorkDescription', displayName: 'Brief Work Description', type: 'text', editable: true },
  { columnName: 'department', displayName: 'Department', type: 'text', editable: true },
  { columnName: 'criticality', displayName: 'Criticality', type: 'text', editable: true },
  { columnName: 'isActive', displayName: 'Is Active', type: 'boolean', editable: true },
];

export const SPARE_FIELDS: FieldDefinition[] = [
  { columnName: 'partName', displayName: 'Part Name', type: 'text', editable: true },
  { columnName: 'partCode', displayName: 'Part Code', type: 'text', editable: true },
  { columnName: 'partNumber', displayName: 'Part Number', type: 'text', editable: true },
  { columnName: 'componentName', displayName: 'Component Name', type: 'text', editable: true },
  { columnName: 'componentCode', displayName: 'Component Code', type: 'text', editable: true },
  { columnName: 'critical', displayName: 'Critical', type: 'select', editable: true, options: ['Critical', 'Non-Critical', 'Yes', 'No'] },
  { columnName: 'min', displayName: 'Minimum Stock', type: 'number', editable: true },
  { columnName: 'max', displayName: 'Maximum Stock', type: 'number', editable: true },
  { columnName: 'unitCost', displayName: 'Unit Cost', type: 'number', editable: true },
  { columnName: 'stockingNumber', displayName: 'Stocking Number', type: 'text', editable: true },
  { columnName: 'leadTime', displayName: 'Lead Time', type: 'text', editable: true },
  { columnName: 'supplier', displayName: 'Supplier', type: 'text', editable: true },
  { columnName: 'lastOrderDate', displayName: 'Last Order Date', type: 'date', editable: true },
  { columnName: 'location', displayName: 'Location', type: 'text', editable: true },
  { columnName: 'location2', displayName: 'Location 2', type: 'text', editable: true },
  { columnName: 'uom', displayName: 'Unit of Measurement', type: 'text', editable: true },
  { columnName: 'drawingNumber', displayName: 'Drawing Number', type: 'text', editable: true },
  { columnName: 'drawingNo', displayName: 'Drawing No', type: 'text', editable: true },
  { columnName: 'rob', displayName: 'ROB (Remaining on Board)', type: 'number', editable: false },
  { columnName: 'robLocationA', displayName: 'ROB Location A', type: 'number', editable: false },
  { columnName: 'robLocationB', displayName: 'ROB Location B', type: 'number', editable: false },
];

export const STORE_FIELDS: FieldDefinition[] = [
  { columnName: 'itemName', displayName: 'Item Name', type: 'text', editable: true },
  { columnName: 'itemCode', displayName: 'Item Code', type: 'text', editable: true },
  { columnName: 'impaCode', displayName: 'IMPA Code', type: 'text', editable: true },
  { columnName: 'itemType', displayName: 'Item Type', type: 'select', editable: true, options: ['stores', 'lubricants', 'chemicals', 'others'] },
  { columnName: 'category', displayName: 'Category', type: 'text', editable: true },
  { columnName: 'specification', displayName: 'Specification', type: 'text', editable: true },
  { columnName: 'uom', displayName: 'Unit of Measurement', type: 'text', editable: true },
  { columnName: 'min', displayName: 'Minimum Stock', type: 'number', editable: true },
  { columnName: 'max', displayName: 'Maximum Stock', type: 'number', editable: true },
  { columnName: 'unitCost', displayName: 'Unit Cost', type: 'number', editable: true },
  { columnName: 'supplier', displayName: 'Supplier', type: 'text', editable: true },
  { columnName: 'lastOrderDate', displayName: 'Last Order Date', type: 'date', editable: true },
  { columnName: 'leadTime', displayName: 'Lead Time', type: 'text', editable: true },
  { columnName: 'locationA', displayName: 'Location A', type: 'text', editable: true },
  { columnName: 'locationB', displayName: 'Location B', type: 'text', editable: true },
  { columnName: 'ihm', displayName: 'IHM Flag', type: 'boolean', editable: true },
  { columnName: 'ihmDetails', displayName: 'IHM Details', type: 'text', editable: true },
  { columnName: 'remarks', displayName: 'Remarks', type: 'text', editable: true },
  { columnName: 'isActive', displayName: 'Is Active', type: 'boolean', editable: true },
  { columnName: 'rob', displayName: 'ROB (Remaining on Board)', type: 'number', editable: false },
  { columnName: 'robLocationA', displayName: 'ROB Location A', type: 'number', editable: false },
  { columnName: 'robLocationB', displayName: 'ROB Location B', type: 'number', editable: false },
];

export type TargetType = 'component' | 'job' | 'work_order' | 'spare' | 'store';

export function getFieldDefinitions(targetType: TargetType): FieldDefinition[] {
  switch (targetType) {
    case 'component':
      return COMPONENT_FIELDS;
    case 'job':
      return JOB_FIELDS;
    case 'work_order':
      return WORK_ORDER_FIELDS;
    case 'spare':
      return SPARE_FIELDS;
    case 'store':
      return STORE_FIELDS;
    default:
      return [];
  }
}

export function getEditableFields(targetType: TargetType): FieldDefinition[] {
  return getFieldDefinitions(targetType).filter(f => f.editable);
}

export function getFieldByColumnName(targetType: TargetType, columnName: string): FieldDefinition | undefined {
  return getFieldDefinitions(targetType).find(f => f.columnName === columnName);
}

export function getFieldByDisplayName(targetType: TargetType, displayName: string): FieldDefinition | undefined {
  return getFieldDefinitions(targetType).find(f => f.displayName === displayName);
}
