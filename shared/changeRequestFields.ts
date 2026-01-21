/**
 * Field definitions for Change Request workflow
 * Maps display names to database column names for each target type
 * Enables proper oldValue capture and apply logic
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
  { columnName: 'code', displayName: 'Component Code', type: 'text', editable: true },
  { columnName: 'description', displayName: 'Description', type: 'text', editable: true },
  { columnName: 'maker', displayName: 'Maker', type: 'text', editable: true },
  { columnName: 'model', displayName: 'Model', type: 'text', editable: true },
  { columnName: 'serialNumber', displayName: 'Serial Number', type: 'text', editable: true },
  { columnName: 'location', displayName: 'Location', type: 'text', editable: true },
  { columnName: 'criticality', displayName: 'Criticality', type: 'select', editable: true, options: ['HIGH', 'MEDIUM', 'LOW'] },
  { columnName: 'status', displayName: 'Status', type: 'select', editable: true, options: ['ACTIVE', 'INACTIVE', 'DECOMMISSIONED'] },
  { columnName: 'installationDate', displayName: 'Installation Date', type: 'date', editable: true },
  { columnName: 'warrantyExpiryDate', displayName: 'Warranty Expiry Date', type: 'date', editable: true },
  { columnName: 'notes', displayName: 'Notes', type: 'text', editable: true },
  { columnName: 'runningHoursType', displayName: 'Running Hours Type', type: 'select', editable: true, options: ['MASTER', 'INHERITED', 'NOT_RH_DRIVEN'] },
  { columnName: 'currentRunningHours', displayName: 'Current Running Hours', type: 'number', editable: false },
];

export const JOB_FIELDS: FieldDefinition[] = [
  { columnName: 'title', displayName: 'Job Title', type: 'text', editable: true },
  { columnName: 'code', displayName: 'Job Code', type: 'text', editable: true },
  { columnName: 'description', displayName: 'Description', type: 'text', editable: true },
  { columnName: 'intervalType', displayName: 'Interval Type', type: 'select', editable: true, options: ['CALENDAR', 'RUNNING_HOURS', 'BOTH'] },
  { columnName: 'intervalValue', displayName: 'Interval Value', type: 'number', editable: true },
  { columnName: 'intervalUnit', displayName: 'Interval Unit', type: 'select', editable: true, options: ['DAYS', 'WEEKS', 'MONTHS', 'YEARS', 'HOURS'] },
  { columnName: 'priority', displayName: 'Priority', type: 'select', editable: true, options: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] },
  { columnName: 'estimatedDuration', displayName: 'Estimated Duration (hours)', type: 'number', editable: true },
  { columnName: 'instructions', displayName: 'Instructions', type: 'text', editable: true },
  { columnName: 'safetyPrecautions', displayName: 'Safety Precautions', type: 'text', editable: true },
  { columnName: 'requiredParts', displayName: 'Required Parts', type: 'text', editable: true },
  { columnName: 'requiredTools', displayName: 'Required Tools', type: 'text', editable: true },
  { columnName: 'classRelated', displayName: 'Class Related', type: 'boolean', editable: true },
  { columnName: 'flagRelated', displayName: 'Flag Related', type: 'boolean', editable: true },
];

export const WORK_ORDER_FIELDS: FieldDefinition[] = [
  { columnName: 'title', displayName: 'Work Order Title', type: 'text', editable: true },
  { columnName: 'description', displayName: 'Description', type: 'text', editable: true },
  { columnName: 'priority', displayName: 'Priority', type: 'select', editable: true, options: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] },
  { columnName: 'status', displayName: 'Status', type: 'select', editable: false, options: ['OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] },
  { columnName: 'dueDate', displayName: 'Due Date', type: 'date', editable: true },
  { columnName: 'estimatedDuration', displayName: 'Estimated Duration (hours)', type: 'number', editable: true },
  { columnName: 'instructions', displayName: 'Instructions', type: 'text', editable: true },
  { columnName: 'safetyPrecautions', displayName: 'Safety Precautions', type: 'text', editable: true },
  { columnName: 'assignedTo', displayName: 'Assigned To', type: 'text', editable: true },
  { columnName: 'completedBy', displayName: 'Completed By', type: 'text', editable: false },
  { columnName: 'completedAt', displayName: 'Completed At', type: 'date', editable: false },
  { columnName: 'remarks', displayName: 'Remarks', type: 'text', editable: true },
];

export const SPARE_FIELDS: FieldDefinition[] = [
  { columnName: 'name', displayName: 'Spare Name', type: 'text', editable: true },
  { columnName: 'partNumber', displayName: 'Part Number', type: 'text', editable: true },
  { columnName: 'description', displayName: 'Description', type: 'text', editable: true },
  { columnName: 'maker', displayName: 'Maker', type: 'text', editable: true },
  { columnName: 'unit', displayName: 'Unit', type: 'text', editable: true },
  { columnName: 'minStock', displayName: 'Minimum Stock', type: 'number', editable: true },
  { columnName: 'maxStock', displayName: 'Maximum Stock', type: 'number', editable: true },
  { columnName: 'reorderLevel', displayName: 'Reorder Level', type: 'number', editable: true },
  { columnName: 'location', displayName: 'Location', type: 'text', editable: true },
  { columnName: 'notes', displayName: 'Notes', type: 'text', editable: true },
  { columnName: 'rob', displayName: 'ROB (Remaining on Board)', type: 'number', editable: false },
];

export const STORE_FIELDS: FieldDefinition[] = [
  { columnName: 'name', displayName: 'Store Item Name', type: 'text', editable: true },
  { columnName: 'itemCode', displayName: 'Item Code', type: 'text', editable: true },
  { columnName: 'description', displayName: 'Description', type: 'text', editable: true },
  { columnName: 'category', displayName: 'Category', type: 'text', editable: true },
  { columnName: 'unit', displayName: 'Unit', type: 'text', editable: true },
  { columnName: 'minStock', displayName: 'Minimum Stock', type: 'number', editable: true },
  { columnName: 'maxStock', displayName: 'Maximum Stock', type: 'number', editable: true },
  { columnName: 'reorderLevel', displayName: 'Reorder Level', type: 'number', editable: true },
  { columnName: 'location', displayName: 'Location', type: 'text', editable: true },
  { columnName: 'notes', displayName: 'Notes', type: 'text', editable: true },
  { columnName: 'rob', displayName: 'ROB (Remaining on Board)', type: 'number', editable: false },
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
