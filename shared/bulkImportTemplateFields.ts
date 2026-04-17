/**
 * Single Source of Truth: Bulk Import Template Fields
 *
 * This file defines the canonical field specifications for each Bulk Data Import template.
 * The Field Mapping Guide in the admin UI reads directly from these definitions, so any
 * change here is automatically reflected in the guide without touching component files.
 *
 * Pattern mirrors shared/sparesTemplateFields.ts (Spares already uses that file).
 * Add new templates here as they are introduced.
 */

export interface BulkImportTemplateField {
  header: string;
  key: string;
  required: boolean;
  description: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// MACHINERY COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Canonical field specification for the Machinery Components import template.
 * DO NOT add fields here without also adding them to the backend template generator.
 */
export const MACHINERY_COMPONENT_TEMPLATE_FIELDS: BulkImportTemplateField[] = [
  { header: 'Component Code',          key: 'componentCode',       required: true,  description: 'Unique identifier (e.g., 1.1.1)' },
  { header: 'Component Name',          key: 'componentName',       required: true,  description: 'Component name' },
  { header: 'Component Category',      key: 'componentCategory',   required: true,  description: 'One of the 8 main categories' },
  { header: 'Vessel Code',             key: 'vesselCode',          required: true,  description: 'Vessel identification code (critical for tracking components)' },
  { header: 'Parent Component Code',   key: 'parentComponentCode', required: false, description: 'Parent component code' },
  { header: 'Maker',                   key: 'maker',               required: false, description: 'Manufacturer name' },
  { header: 'Model',                   key: 'model',               required: false, description: 'Model number' },
  { header: 'Serial No',               key: 'serialNo',            required: false, description: 'Serial number' },
  { header: 'Location',                key: 'location',            required: false, description: 'Physical location' },
  { header: 'Critical (Yes/No)',        key: 'critical',            required: false, description: 'Yes or No' },
  { header: 'Condition Based (Yes/No)', key: 'conditionBased',     required: false, description: 'Yes or No' },
  { header: 'Running Hours',           key: 'runningHours',        required: false, description: 'Numeric value' },
  { header: 'Commissioned Date',       key: 'commissionedDate',    required: false, description: 'Date component was commissioned' },
  { header: 'Class Item',              key: 'classItem',           required: false, description: 'Yes or No' },
];

/**
 * Returns the field mappings array expected by the UniformBulkUpload fieldMappings prop.
 */
export function getMachineryComponentFieldMappings() {
  return MACHINERY_COMPONENT_TEMPLATE_FIELDS.map(f => ({
    field: f.header,
    required: f.required,
    description: f.description,
  }));
}
